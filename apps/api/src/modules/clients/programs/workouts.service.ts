// Antrenman kayıtları: danışan kendi antrenmanını girer; antrenör yüz yüze seansı danışan adına girebilir.
// Kayıtlar danışanın verisidir; antrenör sadece "Antrenman kayıtlarım" paylaşılıyorsa görür (denetim kaydıyla).
import { Inject, Injectable } from '@nestjs/common';
import { badRequest, forbidden } from '../../../common/app-error.js';
import { PrismaService } from '../../../common/prisma/prisma.service.js';
import { AccessService } from '../../relationships/access.service.js';
import { ConsentsService } from '../../consents/consents.service.js';
import type { ProgramContent } from './program-content.js';
import { ProgramsService } from './programs.service.js';
import { performanceByExercise, type WorkoutEntry, type WorkoutLogInput } from './workout-log.js';

const DAY = 86_400_000;
const MAX_PAST_DAYS = 30;

const SELECT = {
  id: true,
  programId: true,
  dayId: true,
  date: true,
  entries: true,
  rpe: true,
  pain: true,
  painNote: true,
  note: true,
  source: true,
  createdAt: true,
} as const;

@Injectable()
export class WorkoutsService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(AccessService) private readonly access: AccessService,
    @Inject(ConsentsService) private readonly consents: ConsentsService,
    @Inject(ProgramsService) private readonly programs: ProgramsService,
  ) {}

  private assertDate(date: string) {
    const day = Date.parse(`${date}T00:00:00Z`);
    const today = Date.parse(`${new Date().toISOString().slice(0, 10)}T00:00:00Z`);
    if (Number.isNaN(day) || new Date(day).toISOString().slice(0, 10) !== date) throw badRequest('INVALID_DATE', 'Tarih geçerli değil.');
    // Saat dilimi farkı için bugünden bir gün sonrası kabul edilir
    if (day > today + DAY) throw badRequest('INVALID_DATE', 'Gelecek bir güne antrenman kaydedilemez.');
    if (day < today - MAX_PAST_DAYS * DAY) throw badRequest('INVALID_DATE', `En fazla ${MAX_PAST_DAYS} gün öncesine kayıt girilebilir.`);
  }

  private dayOf(content: ProgramContent, dayId: string | undefined) {
    if (!dayId) return undefined;
    const day = content.days.find((d) => d.id === dayId);
    if (!day) throw badRequest('DAY_NOT_FOUND', 'Programda böyle bir gün yok.');
    return day;
  }

  // Danışan kendi kaydını girer (sağlık verisi rızası gerekir). programId verilirse yayındaki programa bağlanır.
  async logForSelf(clientId: string, input: WorkoutLogInput, programId?: string) {
    if (!(await this.consents.hasActive(clientId, 'health_data'))) {
      throw forbidden('HEALTH_CONSENT_REQUIRED', 'Antrenman kaydetmek için önce Profil bölümünden sağlık verisi iznini vermelisin.');
    }
    this.assertDate(input.date);
    let link: { programId: string; versionId: string } | null = null;
    if (programId) {
      const { program, published, content } = await this.programs.publishedForClient(clientId, programId);
      this.dayOf(content, input.dayId);
      link = { programId: program.id, versionId: published.id };
    }
    return this.prisma.workoutLog.create({
      data: {
        userId: clientId,
        programId: link?.programId ?? null,
        versionId: link?.versionId ?? null,
        dayId: link ? (input.dayId ?? null) : null,
        date: input.date,
        entries: input.entries as unknown as object,
        rpe: input.rpe ?? null,
        pain: input.pain,
        painNote: input.pain ? input.painNote?.trim() || null : null,
        note: input.note?.trim() || null,
        source: 'SELF',
        enteredById: clientId,
      },
      select: SELECT,
    });
  }

  // Antrenör yüz yüze seansı danışan adına girer
  async logByProfessional(professionalId: string, clientId: string, input: WorkoutLogInput) {
    await this.access.requireAccess(professionalId, clientId, 'WORKOUTS', 'DATA_CHANGED', { action: 'workout_log' });
    this.assertDate(input.date);
    const program = await this.prisma.trainingProgram.findUnique({ where: { professionalId_clientId: { professionalId, clientId } }, select: { id: true } });
    const published = program ? await this.prisma.trainingProgramVersion.findFirst({ where: { programId: program.id, status: 'APPROVED' } }) : null;
    if (published && input.dayId) this.dayOf(published.content as unknown as ProgramContent, input.dayId);
    return this.prisma.workoutLog.create({
      data: {
        userId: clientId,
        programId: published ? program!.id : null,
        versionId: published?.id ?? null,
        dayId: published ? (input.dayId ?? null) : null,
        date: input.date,
        entries: input.entries as unknown as object,
        rpe: input.rpe ?? null,
        pain: input.pain,
        painNote: input.pain ? input.painNote?.trim() || null : null,
        note: input.note?.trim() || null,
        source: 'PROFESSIONAL',
        enteredById: professionalId,
      },
      select: SELECT,
    });
  }

  listForSelf(clientId: string, limit = 30) {
    return this.prisma.workoutLog.findMany({ where: { userId: clientId }, orderBy: [{ date: 'desc' }, { createdAt: 'desc' }], take: limit, select: SELECT });
  }

  async listForProfessional(professionalId: string, clientId: string, limit = 30) {
    await this.access.requireAccess(professionalId, clientId, 'WORKOUTS', 'DATA_VIEWED', undefined, { dedupeMinutes: 10 });
    return this.listForSelf(clientId, limit);
  }

  // Egzersiz başına performans özeti (son 120 gün)
  async performance(professionalId: string, clientId: string) {
    await this.access.requireAccess(professionalId, clientId, 'WORKOUTS', 'DATA_VIEWED', undefined, { dedupeMinutes: 10 });
    const from = new Date(Date.now() - 120 * DAY).toISOString().slice(0, 10);
    const logs = await this.prisma.workoutLog.findMany({ where: { userId: clientId, date: { gte: from } }, select: { date: true, entries: true } });
    return performanceByExercise(logs.map((l) => ({ date: l.date, entries: l.entries as unknown as WorkoutEntry[] })));
  }
}
