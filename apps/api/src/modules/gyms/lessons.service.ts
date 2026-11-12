// Salon dersleri: grup ve özel ders, haftalık tekrar, üye yazma, katılım ve ders hakkı.
// Sahip ve resepsiyon her derste her şeyi yapar; eğitmen sadece kendi derslerinde (özel ders oluşturma, üye yazma, katılım).
// Ders hakkı sadece "katıldı" işaretlenince düşer; işaret geri alınırsa geri eklenir. Her hareket GymSessionLog'a yazılır.
import { randomUUID } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import { badRequest, conflict, forbidden, notFound } from '../../common/app-error.js';
import { PrismaService } from '../../common/prisma/prisma.service.js';
import type { GymBookingStatus, GymLessonKind } from '../../generated/prisma/enums.js';
import { addDays, can, localDay, overlaps, pickCoverage, timeToMin, toDay, type Coverage } from './gym-rules.js';
import { GymsService, type GymContext } from './gyms.service.js';

const DAY = /^\d{4}-\d{2}-\d{2}$/;
const isValidDay = (s: string) => DAY.test(s) && toDay(new Date(`${s}T00:00:00Z`)) === s;
const asDate = (day: string) => new Date(`${day}T00:00:00Z`);
const MAX_RANGE_DAYS = 42;

export interface LessonInput {
  kind: GymLessonKind;
  title?: string;
  trainerId: string;
  date: string;
  startTime: string;
  durationMin: number;
  capacity?: number;
  memberId?: string;
  repeatWeeks?: number;
}

type LessonRow = {
  id: string;
  kind: GymLessonKind;
  title: string;
  trainerId: string;
  date: Date;
  startTime: string;
  durationMin: number;
  capacity: number;
  seriesId: string | null;
  status: 'SCHEDULED' | 'CANCELLED';
  cancelReason: string | null;
};

const WARNING_TEXT = {
  NO_ACTIVE_MEMBERSHIP: 'Üyenin bu tarihte geçerli üyeliği yok.',
  NO_SESSIONS_LEFT: 'Üyenin bu ders için kullanabileceği ders hakkı yok.',
} as const;

@Injectable()
export class LessonsService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(GymsService) private readonly gyms: GymsService,
  ) {}

  // Sahip/resepsiyon her dersi, eğitmen sadece kendi dersini yönetir
  private canManage(ctx: GymContext, lesson: { trainerId: string }) {
    return can(ctx.role, 'lessons.manage') || lesson.trainerId === ctx.userId;
  }

  private async lesson(ctx: GymContext, id: string) {
    const l = await this.prisma.gymLesson.findFirst({ where: { id, gymId: ctx.gymId } });
    if (!l) throw notFound('LESSON_NOT_FOUND', 'Ders bulunamadı.');
    return l;
  }

  private async coverageFor(memberId: string, kind: GymLessonKind, day: string): Promise<Coverage> {
    const ms = await this.prisma.membership.findMany({ where: { memberId }, select: { id: true, status: true, startDate: true, endDate: true, sessionsLeft: true } });
    return pickCoverage(
      kind,
      day,
      ms.map((m) => ({ ...m, startDate: toDay(m.startDate), endDate: toDay(m.endDate) })),
    );
  }

  private present(l: LessonRow, names: Map<string, string>, counts?: Map<string, { booked: number; attended: number }>) {
    return {
      id: l.id,
      kind: l.kind,
      title: l.title,
      trainer: { id: l.trainerId, name: names.get(l.trainerId) ?? 'Eski ekip üyesi' },
      date: toDay(l.date),
      startTime: l.startTime,
      durationMin: l.durationMin,
      capacity: l.capacity,
      seriesId: l.seriesId,
      status: l.status,
      cancelReason: l.cancelReason,
      ...(counts ? { booked: counts.get(l.id)?.booked ?? 0, attended: counts.get(l.id)?.attended ?? 0 } : {}),
    };
  }

  private async names(gymId: string) {
    return new Map((await this.gyms.teamOf(gymId)).map((p) => [p.userId, p.name]));
  }

  // ───────────── Takvim ─────────────

  async list(userId: string, options: { from: string; to: string; mine: boolean }) {
    const ctx = await this.gyms.context(userId);
    const { from, to } = options;
    if (!isValidDay(from) || !isValidDay(to) || from > to || to > addDays(from, MAX_RANGE_DAYS)) {
      throw badRequest('INVALID_RANGE', `Tarih aralığı geçerli değil (en fazla ${MAX_RANGE_DAYS} gün).`);
    }
    const rows = await this.prisma.gymLesson.findMany({
      where: { gymId: ctx.gymId, date: { gte: asDate(from), lte: asDate(to) }, ...(options.mine ? { trainerId: userId } : {}) },
      orderBy: [{ date: 'asc' }, { startTime: 'asc' }],
      take: 500,
    });
    const grouped = await this.prisma.gymBooking.groupBy({
      by: ['lessonId', 'status'],
      where: { lessonId: { in: rows.map((r) => r.id) }, status: { in: ['BOOKED', 'ATTENDED', 'NO_SHOW'] } },
      _count: { _all: true },
    });
    const counts = new Map<string, { booked: number; attended: number }>();
    for (const g of grouped) {
      const c = counts.get(g.lessonId) ?? { booked: 0, attended: 0 };
      c.booked += g._count._all;
      if (g.status === 'ATTENDED') c.attended += g._count._all;
      counts.set(g.lessonId, c);
    }
    const names = await this.names(ctx.gymId);
    return rows.map((r) => this.present(r, names, counts));
  }

  async detail(userId: string, id: string) {
    const ctx = await this.gyms.context(userId);
    const l = await this.lesson(ctx, id);
    const bookings = await this.prisma.gymBooking.findMany({
      where: { lessonId: id, status: { not: 'CANCELLED' } },
      orderBy: { createdAt: 'asc' },
      select: { id: true, memberId: true, status: true, deducted: true, markedAt: true },
    });
    const members = await this.prisma.gymMember.findMany({ where: { id: { in: bookings.map((b) => b.memberId) } }, select: { id: true, fullName: true } });
    const day = toDay(l.date);
    // Ders hakkı uyarısı sadece henüz işaretlenmemiş kayıtlarda anlamlıdır
    const coverage = await Promise.all(bookings.map((b) => (b.status === 'BOOKED' ? this.coverageFor(b.memberId, l.kind, day) : Promise.resolve(null))));
    return {
      lesson: this.present(l, await this.names(ctx.gymId)),
      canManage: this.canManage(ctx, l),
      bookings: bookings.map((b, i) => {
        const c = coverage[i];
        return {
          id: b.id,
          member: { id: b.memberId, fullName: members.find((m) => m.id === b.memberId)?.fullName ?? 'Üye' },
          status: b.status,
          deducted: b.deducted,
          markedAt: b.markedAt,
          warning: c && c.kind === 'NONE' ? { code: c.reason, text: WARNING_TEXT[c.reason] } : null,
        };
      }),
    };
  }

  // ───────────── Ders oluşturma ve iptal ─────────────

  async create(userId: string, input: LessonInput) {
    const ctx = await this.gyms.context(userId);
    const manager = can(ctx.role, 'lessons.manage');
    // Eğitmen sadece kendine özel ders açabilir; grup dersi programını sahip/resepsiyon kurar
    if (!manager && (input.kind !== 'PRIVATE' || input.trainerId !== userId)) {
      throw forbidden('GYM_FORBIDDEN', 'Sadece kendi özel dersini oluşturabilirsin.');
    }
    if (!isValidDay(input.date)) throw badRequest('INVALID_DATE', 'Ders tarihi geçerli değil.');
    if (input.date < addDays(localDay(), -1)) throw badRequest('INVALID_DATE', 'Geçmiş tarihe ders eklenemez.');
    if (timeToMin(input.startTime) === null) throw badRequest('INVALID_TIME', 'Saati SS:DD biçiminde yaz.');
    if ((timeToMin(input.startTime) ?? 0) + input.durationMin > 24 * 60) throw badRequest('INVALID_TIME', 'Ders gece yarısını geçemez.');

    const team = await this.gyms.teamOf(ctx.gymId);
    const trainer = team.find((p) => p.userId === input.trainerId);
    if (!trainer || trainer.role === 'RECEPTION') throw badRequest('TRAINER_NOT_FOUND', 'Dersi verecek kişi salonun eğitmeni ya da sahibi olmalı.');

    let memberId: string | null = null;
    if (input.kind === 'PRIVATE') {
      if (!input.memberId) throw badRequest('MEMBER_REQUIRED', 'Özel ders için üye seç.');
      const m = await this.prisma.gymMember.findFirst({ where: { id: input.memberId, gymId: ctx.gymId, status: 'ACTIVE' }, select: { id: true } });
      if (!m) throw notFound('MEMBER_NOT_FOUND', 'Üye bulunamadı.');
      memberId = m.id;
    } else if (!input.capacity) {
      throw badRequest('CAPACITY_REQUIRED', 'Grup dersi için kontenjan yaz.');
    }

    const weeks = input.repeatWeeks ?? 1;
    const days = Array.from({ length: weeks }, (_, i) => addDays(input.date, i * 7));
    // Aynı eğitmenin aynı saatte iki dersi olamaz
    const existing = await this.prisma.gymLesson.findMany({
      where: { gymId: ctx.gymId, trainerId: input.trainerId, status: 'SCHEDULED', date: { in: days.map(asDate) } },
      select: { date: true, startTime: true, durationMin: true, title: true },
    });
    const clash = existing.find((e) => overlaps(e, input));
    if (clash) {
      const [y, m, d] = toDay(clash.date).split('-');
      throw conflict('TRAINER_BUSY', `${trainer.name} ${d}.${m}.${y} ${clash.startTime} saatinde başka bir derste (${clash.title}).`);
    }

    const seriesId = weeks > 1 ? randomUUID() : null;
    const title = input.title?.trim() || (input.kind === 'PRIVATE' ? 'Özel ders' : 'Grup dersi');
    const created = await this.prisma.$transaction(
      days.map((day) =>
        this.prisma.gymLesson.create({
          data: {
            gymId: ctx.gymId,
            kind: input.kind,
            title,
            trainerId: input.trainerId,
            date: asDate(day),
            startTime: input.startTime,
            durationMin: input.durationMin,
            capacity: input.kind === 'PRIVATE' ? 1 : (input.capacity ?? 1),
            seriesId,
            createdById: userId,
            ...(memberId ? { bookings: { create: { gymId: ctx.gymId, memberId, createdById: userId } } } : {}),
          },
        }),
      ),
    );
    const names = new Map(team.map((p) => [p.userId, p.name]));
    const coverage = memberId ? await this.coverageFor(memberId, input.kind, input.date) : null;
    return {
      lessons: created.map((l) => this.present(l, names)),
      warning: coverage && coverage.kind === 'NONE' ? { code: coverage.reason, text: WARNING_TEXT[coverage.reason] } : null,
    };
  }

  // Katılım işaretlenmiş ders iptal edilemez (önce işaretler geri alınmalı). İptalde kimsenin ders hakkı düşmez.
  async cancel(userId: string, id: string, reason: string, wholeSeries: boolean) {
    const ctx = await this.gyms.context(userId);
    const l = await this.lesson(ctx, id);
    if (!this.canManage(ctx, l)) throw forbidden('GYM_FORBIDDEN', 'Bu dersi iptal etme yetkin yok.');
    if (l.status === 'CANCELLED') throw conflict('ALREADY_CANCELLED', 'Bu ders zaten iptal edilmiş.');
    // Seri iptalinde bu ders ve sonraki haftalar iptal olur; geçmiş haftalar kalır
    const targets =
      wholeSeries && l.seriesId
        ? await this.prisma.gymLesson.findMany({ where: { seriesId: l.seriesId, gymId: ctx.gymId, status: 'SCHEDULED', date: { gte: l.date } }, select: { id: true } })
        : [{ id: l.id }];
    const ids = targets.map((t) => t.id);
    if (await this.prisma.gymBooking.count({ where: { lessonId: { in: ids }, status: { in: ['ATTENDED', 'NO_SHOW'] } } })) {
      throw conflict('ATTENDANCE_MARKED', 'Katılımı işaretlenmiş ders iptal edilemez. Önce işaretleri geri al.');
    }
    await this.prisma.gymLesson.updateMany({ where: { id: { in: ids } }, data: { status: 'CANCELLED', cancelledAt: new Date(), cancelReason: reason.trim() } });
    return { cancelled: ids.length };
  }

  // ───────────── Üye yazma ─────────────

  async book(userId: string, lessonId: string, memberId: string) {
    const ctx = await this.gyms.context(userId);
    const l = await this.lesson(ctx, lessonId);
    if (!this.canManage(ctx, l)) throw forbidden('GYM_FORBIDDEN', 'Bu derse üye yazma yetkin yok.');
    if (l.status === 'CANCELLED') throw conflict('LESSON_CANCELLED', 'İptal edilmiş derse üye yazılamaz.');
    const member = await this.prisma.gymMember.findFirst({ where: { id: memberId, gymId: ctx.gymId, status: 'ACTIVE' }, select: { id: true } });
    if (!member) throw notFound('MEMBER_NOT_FOUND', 'Üye bulunamadı.');
    const taken = await this.prisma.gymBooking.count({ where: { lessonId, status: { not: 'CANCELLED' } } });
    const existing = await this.prisma.gymBooking.findUnique({ where: { lessonId_memberId: { lessonId, memberId } } });
    if (existing && existing.status !== 'CANCELLED') throw conflict('ALREADY_BOOKED', 'Üye bu derse zaten yazılı.');
    if (taken >= l.capacity) throw conflict('LESSON_FULL', 'Ders dolu.');
    const booking = existing
      ? await this.prisma.gymBooking.update({ where: { id: existing.id }, data: { status: 'BOOKED', markedAt: null, markedById: null, membershipId: null, deducted: false } })
      : await this.prisma.gymBooking.create({ data: { gymId: ctx.gymId, lessonId, memberId, createdById: userId } });
    // Ders hakkı yoksa yazmak engellenmez; uyarı döner
    const coverage = await this.coverageFor(memberId, l.kind, toDay(l.date));
    return { booking, warning: coverage.kind === 'NONE' ? { code: coverage.reason, text: WARNING_TEXT[coverage.reason] } : null };
  }

  async unbook(userId: string, bookingId: string) {
    const ctx = await this.gyms.context(userId);
    const b = await this.prisma.gymBooking.findFirst({ where: { id: bookingId, gymId: ctx.gymId }, include: { lesson: { select: { trainerId: true } } } });
    if (!b) throw notFound('BOOKING_NOT_FOUND', 'Kayıt bulunamadı.');
    if (!this.canManage(ctx, b.lesson)) throw forbidden('GYM_FORBIDDEN', 'Bu kaydı değiştirme yetkin yok.');
    if (b.status !== 'BOOKED') throw conflict('ATTENDANCE_MARKED', 'Katılımı işaretlenmiş kayıt kaldırılamaz. Önce işareti geri al.');
    await this.prisma.gymBooking.update({ where: { id: bookingId }, data: { status: 'CANCELLED' } });
    return { id: bookingId, status: 'CANCELLED' as const };
  }

  // ───────────── Katılım ─────────────

  // "Katıldı" → uygun üyelikten 1 ders hakkı düşer. "Gelmedi" düşmez. İşaret geri alınırsa (BOOKED) düşen hak geri eklenir.
  async mark(userId: string, bookingId: string, status: Exclude<GymBookingStatus, 'CANCELLED'>) {
    const ctx = await this.gyms.context(userId);
    const b = await this.prisma.gymBooking.findFirst({ where: { id: bookingId, gymId: ctx.gymId }, include: { lesson: true } });
    if (!b) throw notFound('BOOKING_NOT_FOUND', 'Kayıt bulunamadı.');
    if (!this.canManage(ctx, b.lesson)) throw forbidden('GYM_FORBIDDEN', 'Bu derste katılım işaretleme yetkin yok.');
    if (b.status === 'CANCELLED') throw conflict('BOOKING_CANCELLED', 'Bu kayıt kaldırılmış.');
    if (b.lesson.status === 'CANCELLED') throw conflict('LESSON_CANCELLED', 'İptal edilmiş derste katılım işaretlenemez.');
    const day = toDay(b.lesson.date);
    if (status !== 'BOOKED' && day > localDay()) throw badRequest('LESSON_IN_FUTURE', 'Henüz yapılmamış derste katılım işaretlenemez.');
    if (b.status === status) return { booking: b, coverage: null };

    let coverage: Coverage | null = null;
    const updated = await this.prisma.$transaction(async (tx) => {
      // Önce eski işaretin düşürdüğü hakkı geri ver
      if (b.deducted && b.membershipId) {
        await tx.membership.update({ where: { id: b.membershipId }, data: { sessionsLeft: { increment: 1 } } });
        await tx.gymSessionLog.create({ data: { gymId: ctx.gymId, membershipId: b.membershipId, bookingId, delta: 1, reason: 'ATTENDANCE_UNDONE', byId: userId } });
      }
      let membershipId: string | null = null;
      let deducted = false;
      if (status === 'ATTENDED') {
        const ms = await tx.membership.findMany({ where: { memberId: b.memberId }, select: { id: true, status: true, startDate: true, endDate: true, sessionsLeft: true } });
        coverage = pickCoverage(
          b.lesson.kind,
          day,
          ms.map((m) => ({ ...m, startDate: toDay(m.startDate), endDate: toDay(m.endDate) })),
        );
        if (coverage.kind === 'SESSION') {
          // Eşzamanlı işaretlemede hak eksiye düşmesin
          const dec = await tx.membership.updateMany({ where: { id: coverage.membershipId, sessionsLeft: { gt: 0 } }, data: { sessionsLeft: { decrement: 1 } } });
          if (dec.count === 1) {
            deducted = true;
            await tx.gymSessionLog.create({ data: { gymId: ctx.gymId, membershipId: coverage.membershipId, bookingId, delta: -1, reason: 'ATTENDED', byId: userId } });
          }
        }
        membershipId = coverage.kind === 'NONE' ? null : coverage.membershipId;
      }
      return tx.gymBooking.update({
        where: { id: bookingId },
        data: { status, membershipId, deducted, markedById: status === 'BOOKED' ? null : userId, markedAt: status === 'BOOKED' ? null : new Date() },
      });
    });
    const c = coverage as Coverage | null;
    return {
      booking: updated,
      warning: c && c.kind === 'NONE' ? { code: c.reason, text: `${WARNING_TEXT[c.reason]} Katılım kaydedildi, ders hakkı düşülmedi.` } : null,
    };
  }

  // ───────────── Üyenin dersleri ─────────────

  async memberLessons(userId: string, memberId: string) {
    const ctx = await this.gyms.context(userId, 'members.view');
    const m = await this.prisma.gymMember.findFirst({ where: { id: memberId, gymId: ctx.gymId }, select: { id: true } });
    if (!m) throw notFound('MEMBER_NOT_FOUND', 'Üye bulunamadı.');
    const rows = await this.prisma.gymBooking.findMany({
      where: { memberId, status: { not: 'CANCELLED' }, lesson: { status: 'SCHEDULED' } },
      include: { lesson: true },
      orderBy: [{ lesson: { date: 'desc' } }, { lesson: { startTime: 'desc' } }],
      take: 60,
    });
    const names = await this.names(ctx.gymId);
    const today = localDay();
    const items = rows.map((r) => ({ bookingId: r.id, status: r.status, deducted: r.deducted, lesson: this.present(r.lesson, names) }));
    return {
      upcoming: items.filter((i) => i.lesson.date >= today && i.status === 'BOOKED').reverse(),
      history: items.filter((i) => !(i.lesson.date >= today && i.status === 'BOOKED')).slice(0, 30),
    };
  }
}
