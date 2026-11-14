// İçerik kütüphanesi ve Programım (kütüphane kısmı): ücretsiz programa katılma, gün gün görevler, tek hareket ekleme.
// İçerik genel bilgidir; kişiye özel program uzmandan gelir (danışan dosyasındaki plan ve program, ayrı modül).
import { Inject, Injectable } from '@nestjs/common';
import { badRequest, conflict, notFound } from '../../common/app-error.js';
import { addLocalDays, isValidDay, localDay } from '../../common/local-day.js';
import { PrismaService } from '../../common/prisma/prisma.service.js';
import { CATEGORY_LABELS, findItem, findProgram, ITEMS, PROGRAMS, type LibraryItem, type LibraryProgram } from './catalog.js';
import { dayDurationSec, dayIndexOn, nextDayFrom, scheduleDate, setSeconds, workSeconds, workText } from './library-rules.js';

const asDate = (day: string) => new Date(`${day}T00:00:00Z`);
const dayOf = (d: Date) => d.toISOString().slice(0, 10);
// En fazla bu kadar gün sonrası için başlangıç tarihi seçilebilir
const MAX_START_AHEAD = 14;
const MAX_ACTIVE_PROGRAMS = 5;

const itemCard = (i: LibraryItem) => ({
  id: i.id,
  kind: i.kind,
  category: i.category,
  categoryLabel: CATEGORY_LABELS[i.category],
  title: i.title,
  summary: i.summary,
  level: i.level,
  ...(i.work ? { workText: workText(i.work), durationSec: workSeconds(i.work) } : {}),
  ...(i.minutes ? { minutes: i.minutes } : {}),
});

const programCard = (p: LibraryProgram) => ({
  id: p.id,
  title: p.title,
  description: p.description,
  category: p.category,
  categoryLabel: CATEGORY_LABELS[p.category],
  level: p.level,
  weeks: p.weeks,
  daysPerWeek: p.daysPerWeek,
  totalDays: p.days.length,
  access: p.access,
  // Bir günün ortalama süresi (dakika, yukarı yuvarlanmış)
  minutesPerDay: Math.ceil(p.days.reduce((s, d) => s + dayDurationSec(d), 0) / p.days.length / 60),
});

function resolvedDay(p: LibraryProgram, dayIndex: number) {
  const day = p.days[dayIndex]!;
  return {
    dayIndex,
    title: day.title,
    durationSec: dayDurationSec(day),
    steps: day.steps.map((s, i) => {
      const item = findItem(s.itemId)!;
      return {
        index: i,
        item: { id: item.id, title: item.title, kind: item.kind },
        workText: workText(s.work),
        sets: s.work.sets,
        setSec: setSeconds(s.work),
        restSec: s.work.restSec,
        durationSec: workSeconds(s.work),
        restAfterSec: s.restAfterSec,
      };
    }),
  };
}

@Injectable()
export class LibraryService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  catalog() {
    return { items: ITEMS.map(itemCard), programs: PROGRAMS.map(programCard) };
  }

  item(id: string) {
    const i = findItem(id);
    if (!i) throw notFound('ITEM_NOT_FOUND', 'İçerik bulunamadı.');
    return { ...itemCard(i), equipment: i.equipment ?? null, primary: i.primary ?? [], secondary: i.secondary ?? [], steps: i.steps, mistakes: i.mistakes ?? [], warnings: i.warnings ?? [], sections: i.sections ?? [] };
  }

  async program(userId: string, id: string) {
    const p = findProgram(id);
    if (!p) throw notFound('PROGRAM_NOT_FOUND', 'Program bulunamadı.');
    const enrollment = await this.prisma.libraryEnrollment.findFirst({ where: { userId, programId: id, status: 'ACTIVE' }, select: { id: true, startDate: true } });
    // Program günlerinden sadece farklı olan şablonlar gösterilir (tekrar eden günler aynıdır)
    const preview = p.days.slice(0, Math.min(p.days.length, p.daysPerWeek)).map((_, i) => resolvedDay(p, i));
    return { ...programCard(p), preview, enrollment: enrollment ? { id: enrollment.id, startDate: dayOf(enrollment.startDate) } : null };
  }

  async join(userId: string, programId: string, startDate?: string) {
    const p = findProgram(programId);
    if (!p) throw notFound('PROGRAM_NOT_FOUND', 'Program bulunamadı.');
    const today = localDay();
    const start = startDate ?? today;
    if (!isValidDay(start) || start < today || start > addLocalDays(today, MAX_START_AHEAD)) {
      throw badRequest('INVALID_DATE', `Başlangıç bugün ya da en geç ${MAX_START_AHEAD} gün sonrası olmalı.`);
    }
    const active = await this.prisma.libraryEnrollment.findMany({ where: { userId, status: 'ACTIVE' }, select: { programId: true } });
    if (active.some((a) => a.programId === programId)) throw conflict('ALREADY_JOINED', 'Bu programa zaten katıldın.');
    if (active.length >= MAX_ACTIVE_PROGRAMS) throw conflict('TOO_MANY_PROGRAMS', `Aynı anda en fazla ${MAX_ACTIVE_PROGRAMS} programa katılabilirsin.`);
    const e = await this.prisma.libraryEnrollment.create({ data: { userId, programId, startDate: asDate(start) } });
    return { id: e.id, programId, startDate: start };
  }

  private async enrollment(userId: string, id: string) {
    const e = await this.prisma.libraryEnrollment.findFirst({ where: { id, userId } });
    if (!e) throw notFound('ENROLLMENT_NOT_FOUND', 'Program kaydı bulunamadı.');
    return e;
  }

  async leave(userId: string, id: string) {
    const e = await this.enrollment(userId, id);
    if (e.status !== 'ACTIVE') throw conflict('NOT_ACTIVE', 'Bu program zaten bitmiş ya da bırakılmış.');
    await this.prisma.libraryEnrollment.update({ where: { id }, data: { status: 'LEFT', endedAt: new Date() } });
    return { id, status: 'LEFT' as const };
  }

  // Bir hareketi tamamlandı/yapılmadı işaretler. Gelecekteki program günü işaretlenemez.
  async setStepDone(userId: string, id: string, dayIndex: number, stepIndex: number, done: boolean) {
    const e = await this.enrollment(userId, id);
    if (e.status === 'LEFT') throw conflict('NOT_ACTIVE', 'Bu programı bırakmışsın.');
    const p = findProgram(e.programId);
    const day = p?.days[dayIndex];
    if (!p || !day || !day.steps[stepIndex]) throw badRequest('INVALID_STEP', 'Geçersiz program adımı.');
    if (scheduleDate(p, dayOf(e.startDate), dayIndex) > localDay()) throw badRequest('DAY_IN_FUTURE', 'Henüz gelmemiş program günü işaretlenemez.');
    if (done) {
      await this.prisma.libraryCompletion.upsert({
        where: { enrollmentId_dayIndex_stepIndex: { enrollmentId: id, dayIndex, stepIndex } },
        create: { enrollmentId: id, dayIndex, stepIndex },
        update: {},
      });
    } else {
      await this.prisma.libraryCompletion.deleteMany({ where: { enrollmentId: id, dayIndex, stepIndex } });
    }
    // Bütün günler tamamlandıysa program "tamamlandı" olur; işaret geri alınırsa tekrar aktif
    const total = p.days.reduce((s, d) => s + d.steps.length, 0);
    const doneCount = await this.prisma.libraryCompletion.count({ where: { enrollmentId: id } });
    const status = doneCount >= total ? 'COMPLETED' : 'ACTIVE';
    if (status !== e.status) await this.prisma.libraryEnrollment.update({ where: { id }, data: { status, endedAt: status === 'COMPLETED' ? new Date() : null } });
    return { dayIndex, stepIndex, done, status };
  }

  async enrollments(userId: string) {
    const rows = await this.prisma.libraryEnrollment.findMany({
      where: { userId, status: { in: ['ACTIVE', 'COMPLETED'] } },
      orderBy: { createdAt: 'desc' },
      include: { _count: { select: { completions: true } } },
    });
    const today = localDay();
    return rows.flatMap((e) => {
      const p = findProgram(e.programId);
      if (!p) return [];
      const start = dayOf(e.startDate);
      const total = p.days.reduce((s, d) => s + d.steps.length, 0);
      const next = dayIndexOn(p, start, today) !== null ? { dayIndex: dayIndexOn(p, start, today)!, date: today } : nextDayFrom(p, start, today);
      return [{ id: e.id, status: e.status, startDate: start, program: programCard(p), progress: { done: e._count.completions, total }, next }];
    });
  }

  // ───── Tek hareketi görevlere ekleme ─────

  async addTask(userId: string, itemId: string, date?: string) {
    const item = findItem(itemId);
    if (!item || !item.work) throw badRequest('INVALID_ITEM', 'Sadece hareket ve masajlar görevlere eklenebilir.');
    const today = localDay();
    const day = date ?? today;
    if (!isValidDay(day) || day < today || day > addLocalDays(today, MAX_START_AHEAD)) throw badRequest('INVALID_DATE', 'Tarih bugün ya da önümüzdeki iki hafta içinde olmalı.');
    try {
      const t = await this.prisma.libraryTask.create({ data: { userId, itemId, date: asDate(day) } });
      return { id: t.id, itemId, date: day };
    } catch {
      throw conflict('ALREADY_ADDED', 'Bu hareket o günün görevlerinde zaten var.');
    }
  }

  async removeTask(userId: string, id: string) {
    const r = await this.prisma.libraryTask.deleteMany({ where: { id, userId } });
    if (r.count === 0) throw notFound('TASK_NOT_FOUND', 'Görev bulunamadı.');
    return { id, removed: true };
  }

  async setTaskDone(userId: string, id: string, done: boolean) {
    const t = await this.prisma.libraryTask.findFirst({ where: { id, userId } });
    if (!t) throw notFound('TASK_NOT_FOUND', 'Görev bulunamadı.');
    if (done && dayOf(t.date) > localDay()) throw badRequest('DAY_IN_FUTURE', 'Henüz gelmemiş günün görevi işaretlenemez.');
    await this.prisma.libraryTask.update({ where: { id }, data: { doneAt: done ? new Date() : null } });
    return { id, done };
  }

  // ───── Programım: bir günün görevleri ─────

  async day(userId: string, date: string) {
    if (!isValidDay(date)) throw badRequest('INVALID_DATE', 'Tarih geçerli değil.');
    const [enrollments, tasks] = await Promise.all([
      this.prisma.libraryEnrollment.findMany({ where: { userId, status: { in: ['ACTIVE', 'COMPLETED'] } }, include: { completions: { select: { dayIndex: true, stepIndex: true } } } }),
      this.prisma.libraryTask.findMany({ where: { userId, date: asDate(date) }, orderBy: { createdAt: 'asc' } }),
    ]);
    const programs = enrollments.flatMap((e) => {
      const p = findProgram(e.programId);
      if (!p) return [];
      const start = dayOf(e.startDate);
      const dayIndex = dayIndexOn(p, start, date);
      if (dayIndex === null) return [];
      const resolved = resolvedDay(p, dayIndex);
      const steps = resolved.steps.map((s) => ({ ...s, done: e.completions.some((c) => c.dayIndex === dayIndex && c.stepIndex === s.index) }));
      return [{ enrollmentId: e.id, program: { id: p.id, title: p.title, totalDays: p.days.length }, ...resolved, steps, doneCount: steps.filter((s) => s.done).length }];
    });
    return {
      date,
      programs,
      tasks: tasks.flatMap((t) => {
        const item = findItem(t.itemId);
        if (!item?.work) return [];
        return [{ id: t.id, item: { id: item.id, title: item.title, kind: item.kind }, workText: workText(item.work), durationSec: workSeconds(item.work), done: t.doneAt !== null }];
      }),
    };
  }
}
