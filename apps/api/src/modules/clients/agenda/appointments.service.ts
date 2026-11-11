// Randevular: uzman oluşturur, erteler, tamamlar/iptal eder; danışan görür ve iptal edebilir.
// Uzmanın hazırlık notu (`notes`) ve görüşme özeti (`outcome`) danışana gösterilmez.
// Randevudan 24 saat önce danışana otomatik hatırlatma bildirimi gider.
import { Inject, Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { badRequest, conflict, forbidden, notFound } from '../../../common/app-error.js';
import { PrismaService } from '../../../common/prisma/prisma.service.js';
import type { AppointmentMode, AppointmentStatus } from '../../../generated/prisma/enums.js';

const nameOf = (p: { firstName: string | null; lastName: string | null; username: string }) =>
  [p.firstName, p.lastName].filter(Boolean).join(' ') || p.username;

const PERSON = { select: { id: true, firstName: true, lastName: true, username: true } } as const;
const PAST_TOLERANCE_MS = 5 * 60_000;
const REMINDER_WINDOW_MS = 24 * 3_600_000;

export interface AppointmentInput {
  startsAt: Date;
  durationMin: number;
  mode: AppointmentMode;
  title?: string;
  location?: string;
  notes?: string;
}

@Injectable()
export class AppointmentsService {
  private readonly log = new Logger(AppointmentsService.name);

  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  private async requireActive(professionalId: string, clientId: string) {
    const rel = await this.prisma.clientRelationship.findFirst({ where: { professionalId, clientId, status: 'ACTIVE' }, select: { id: true } });
    if (!rel) throw forbidden('NO_ACCESS', 'Bu danışan için randevu oluşturamazsın.');
  }

  // Aynı uzmanın planlanmış randevularıyla çakışma
  private async assertNoOverlap(professionalId: string, startsAt: Date, durationMin: number, excludeId?: string) {
    const end = startsAt.getTime() + durationMin * 60_000;
    const nearby = await this.prisma.appointment.findMany({
      where: {
        professionalId,
        status: 'SCHEDULED',
        ...(excludeId ? { id: { not: excludeId } } : {}),
        startsAt: { gte: new Date(startsAt.getTime() - 8 * 3_600_000), lt: new Date(end) },
      },
      select: { startsAt: true, durationMin: true },
    });
    if (nearby.some((a) => a.startsAt.getTime() + a.durationMin * 60_000 > startsAt.getTime())) {
      throw conflict('APPOINTMENT_OVERLAP', 'Bu saatte başka bir randevun var.');
    }
  }

  private notify(userId: string, type: string, data: Record<string, string>) {
    return this.prisma.notification.create({ data: { userId, type, data } });
  }

  // ───────────── Uzman ─────────────

  async create(professionalId: string, clientId: string, input: AppointmentInput) {
    await this.requireActive(professionalId, clientId);
    if (input.startsAt.getTime() < Date.now() - PAST_TOLERANCE_MS) throw badRequest('IN_PAST', 'Randevu geçmiş bir zamana verilemez.');
    await this.assertNoOverlap(professionalId, input.startsAt, input.durationMin);
    const a = await this.prisma.appointment.create({
      data: { professionalId, clientId, ...input, title: input.title?.trim() || null, location: input.location?.trim() || null, notes: input.notes?.trim() || null },
    });
    await this.notify(clientId, 'appointment_created', { appointmentId: a.id, professionalId, startsAt: a.startsAt.toISOString() });
    return a;
  }

  private async ownScheduled(professionalId: string, id: string) {
    const a = await this.prisma.appointment.findFirst({ where: { id, professionalId } });
    if (!a) throw notFound('APPOINTMENT_NOT_FOUND', 'Randevu bulunamadı.');
    if (a.status !== 'SCHEDULED') throw conflict('NOT_SCHEDULED', 'Bu randevu artık planlı değil.');
    return a;
  }

  async update(professionalId: string, id: string, patch: Partial<AppointmentInput>) {
    const a = await this.ownScheduled(professionalId, id);
    const startsAt = patch.startsAt ?? a.startsAt;
    const durationMin = patch.durationMin ?? a.durationMin;
    const moved = startsAt.getTime() !== a.startsAt.getTime() || durationMin !== a.durationMin;
    if (moved) {
      if (startsAt.getTime() < Date.now() - PAST_TOLERANCE_MS) throw badRequest('IN_PAST', 'Randevu geçmiş bir zamana alınamaz.');
      await this.assertNoOverlap(professionalId, startsAt, durationMin, id);
    }
    const updated = await this.prisma.appointment.update({
      where: { id },
      data: {
        startsAt,
        durationMin,
        ...(patch.mode ? { mode: patch.mode } : {}),
        ...(patch.title !== undefined ? { title: patch.title.trim() || null } : {}),
        ...(patch.location !== undefined ? { location: patch.location.trim() || null } : {}),
        ...(patch.notes !== undefined ? { notes: patch.notes.trim() || null } : {}),
        // Zaman değişince hatırlatma yeniden gönderilir
        ...(moved ? { reminderSentAt: null } : {}),
      },
    });
    if (moved || patch.mode) {
      await this.notify(a.clientId, 'appointment_updated', { appointmentId: id, professionalId, startsAt: updated.startsAt.toISOString() });
    }
    return updated;
  }

  // Tamamlandı / gelmedi / iptal. Tamamlandı ve gelmedi, randevu saati geldikten sonra işaretlenir.
  async setStatus(professionalId: string, id: string, input: { status: Exclude<AppointmentStatus, 'SCHEDULED'>; outcome?: string; reason?: string }) {
    const a = await this.ownScheduled(professionalId, id);
    if (input.status !== 'CANCELLED' && a.startsAt.getTime() > Date.now()) {
      throw badRequest('NOT_YET', 'Randevu saati gelmeden tamamlandı ya da gelmedi olarak işaretlenemez.');
    }
    const updated = await this.prisma.appointment.update({
      where: { id },
      data: {
        status: input.status,
        ...(input.outcome?.trim() ? { outcome: input.outcome.trim() } : {}),
        ...(input.status === 'CANCELLED' ? { cancelledById: professionalId, cancelReason: input.reason?.trim() || null } : {}),
      },
    });
    if (input.status === 'CANCELLED') {
      await this.notify(a.clientId, 'appointment_cancelled', { appointmentId: id, professionalId, startsAt: a.startsAt.toISOString() });
    }
    return updated;
  }

  async listForProfessional(professionalId: string, options: { from: Date; to: Date; clientId?: string }) {
    const rows = await this.prisma.appointment.findMany({
      where: { professionalId, startsAt: { gte: options.from, lt: options.to }, ...(options.clientId ? { clientId: options.clientId } : {}) },
      orderBy: { startsAt: 'asc' },
      include: { client: PERSON },
    });
    return rows.map(({ client, ...a }) => ({ ...a, client: { id: client.id, name: nameOf(client), username: client.username } }));
  }

  // ───────────── Danışan ─────────────

  async listForClient(clientId: string) {
    const rows = await this.prisma.appointment.findMany({
      where: { clientId, startsAt: { gte: new Date(Date.now() - 30 * 86_400_000) } },
      orderBy: { startsAt: 'asc' },
      select: {
        id: true,
        startsAt: true,
        durationMin: true,
        mode: true,
        status: true,
        title: true,
        location: true,
        cancelReason: true,
        professional: { select: { firstName: true, lastName: true, username: true, professionalProfile: { select: { title: true } } } },
      },
    });
    return rows.map(({ professional, ...a }) => ({
      ...a,
      professional: { name: nameOf(professional), title: professional.professionalProfile?.title ?? null },
    }));
  }

  async cancelByClient(clientId: string, id: string, reason?: string) {
    const a = await this.prisma.appointment.findFirst({ where: { id, clientId } });
    if (!a) throw notFound('APPOINTMENT_NOT_FOUND', 'Randevu bulunamadı.');
    if (a.status !== 'SCHEDULED' || a.startsAt.getTime() < Date.now()) throw conflict('NOT_CANCELLABLE', 'Bu randevu iptal edilemez.');
    await this.prisma.appointment.update({
      where: { id },
      data: { status: 'CANCELLED', cancelledById: clientId, cancelReason: reason?.trim() || null },
    });
    await this.notify(a.professionalId, 'appointment_cancelled_by_client', { appointmentId: id, clientId, startsAt: a.startsAt.toISOString() });
    return { id, status: 'CANCELLED' as const };
  }

  // ───────────── Otomatik hatırlatma ─────────────

  @Cron(CronExpression.EVERY_10_MINUTES)
  async sendDueReminders(now = new Date()): Promise<number> {
    const due = await this.prisma.appointment.findMany({
      where: { status: 'SCHEDULED', reminderSentAt: null, startsAt: { gt: now, lte: new Date(now.getTime() + REMINDER_WINDOW_MS) } },
      select: { id: true, clientId: true, professionalId: true, startsAt: true },
    });
    for (const a of due) {
      try {
        await this.prisma.$transaction([
          this.prisma.appointment.update({ where: { id: a.id }, data: { reminderSentAt: now } }),
          this.prisma.notification.create({
            data: { userId: a.clientId, type: 'appointment_reminder', data: { appointmentId: a.id, professionalId: a.professionalId, startsAt: a.startsAt.toISOString() } },
          }),
        ]);
      } catch (e) {
        this.log.warn(`Randevu hatırlatması gönderilemedi: ${(e as Error).message}`);
      }
    }
    return due.length;
  }
}
