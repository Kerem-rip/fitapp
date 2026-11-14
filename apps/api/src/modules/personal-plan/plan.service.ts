// Kişisel 28 günlük program: giriş, güvenlik kapısı, (geliştirme modunda) satın alma, başlangıç tarihi, günlük görevler,
// geri bildirim, anlık alternatif, haftalık uyarlama ve gelişim raporu.
// - Erişim sunucuda doğrulanan satın almaya bağlıdır; istemci hiçbir şeyi belirleyemez.
// - Aynı isteğin tekrarı çift kayıt/çift ücret oluşturmaz (idempotency anahtarı + kullanıcı başına kilit).
// - Haftalar, haftanın başladığı gün performansa göre üretilir (her okumada kontrol edilir; arka plan işi gerekmez).
// - Önceki dönemlerin verileri hiçbir zaman silinmez ya da üzerine yazılmaz.
import { HttpException, Inject, Injectable } from '@nestjs/common';
import { badRequest, conflict, forbidden, notFound } from '../../common/app-error.js';
import { addLocalDays, isValidDay, localDay } from '../../common/local-day.js';
import { PrismaService } from '../../common/prisma/prisma.service.js';
import { env } from '../../config/env.js';
import type { Prisma } from '../../generated/prisma/client.js';
import { findItem } from '../library/catalog.js';
import { workSeconds, workText } from '../library/library-rules.js';
import { alternativesFor, dayEstimates, prescribe, workOf, type DaySpec, type EntrySpec, type PlanParams } from './engine/base.js';
import { deriveWeek, type EntryLog } from './engine/adapt.js';
import { generateWeek1 } from './engine/generate.js';
import { dailyEnergyEstimate } from './energy.js';
import { intakeSchema, MIN_AGE, screen, SCREENING_QUESTIONS, startLevel, type PlanIntake, type ScreeningResult, GOALS, EXPERIENCES, CAPACITIES, DAILY_ACTIVITIES } from './intake.js';
import { currentDayNumber, dayDateOf, endDateOf, INTAKE_MAX_AGE_DAYS, phaseOf, PLAN_DAYS, PLAN_WEEKS, START_WINDOW_DAYS, startDateProblem, weekOfDay, weekStartDay, type PlanPhase } from './lifecycle.js';
import { metaOf, planItems } from './plan-meta.js';
import { AREA_TITLES, BODY_AREAS, CATEGORY_TITLES, ENGINE_VERSION, HOME_EQUIPMENT, PLAN_CATEGORIES, SETTINGS, SUBCATEGORIES, type BodyArea } from './plan-types.js';
import { buildReport, type PlanReport, type ReportLog } from './report.js';

// Ödeme: gerçek ödeme sağlayıcısı henüz yok. Geliştirme modunda satın alma "DEV" olarak kaydedilir; üretimde kapalıdır.
export const PRICE = { amountMinor: null as number | null, currency: 'TRY', label: 'Fiyat yakında', demo: true };

type StoredParams = {
  level: 1 | 2 | 3;
  seed: string;
  avoid: string[];
  restrictedAreas: BodyArea[];
  needsProfessional: boolean;
  ageYears: number;
  screening: ScreeningResult;
  adaptationLog: string[];
};

const asJson = (v: unknown) => v as Prisma.InputJsonValue;
const dayStr = (d: Date) => d.toISOString().slice(0, 10);
const asDate = (day: string) => new Date(`${day}T00:00:00Z`);

export function ageOn(birthDate: Date, day: string): number {
  const b = birthDate;
  const d = new Date(`${day}T00:00:00Z`);
  let age = d.getUTCFullYear() - b.getUTCFullYear();
  if (d.getUTCMonth() < b.getUTCMonth() || (d.getUTCMonth() === b.getUTCMonth() && d.getUTCDate() < b.getUTCDate())) age -= 1;
  return age;
}

const SAFETY_PAIN = 'Ağrı hissettiğinde hareketi bırak. Ağrı sürerse ya da keskinse bir doktora ya da uzmana danış.';

@Injectable()
export class PlanService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  // ───── Başlıklar ve form seçenekleri ─────

  catalog() {
    const counts = new Map<string, number>();
    for (const item of planItems()) for (const c of metaOf(item.id)!.categories) counts.set(c.category, (counts.get(c.category) ?? 0) + 1);
    return {
      engineVersion: ENGINE_VERSION,
      minAge: MIN_AGE,
      startWindowDays: START_WINDOW_DAYS,
      price: PRICE,
      // Kategori başlıkları hazır; içerik zamanla genişler (hareketi olmayan kategoriler boş görünür)
      categories: PLAN_CATEGORIES.map((c) => ({ id: c, title: CATEGORY_TITLES[c], moves: counts.get(c) ?? 0, subcategories: SUBCATEGORIES[c] })),
      options: { goals: GOALS, experiences: EXPERIENCES, capacities: CAPACITIES, settings: SETTINGS, equipment: HOME_EQUIPMENT, dailyActivities: DAILY_ACTIVITIES, painAreas: BODY_AREAS.map((id) => ({ id, title: AREA_TITLES[id] })), extras: ['FACE_CARE'] },
      screeningQuestions: SCREENING_QUESTIONS,
    };
  }

  // ───── Giriş formu ─────

  // Formu doldurmayı kolaylaştırmak için mevcut bilgiler (tekrar sorulmaz; kişi değiştirebilir)
  async prefill(userId: string) {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { birthDate: true, heightCm: true, gender: true } });
    const rows = await this.prisma.measurement.findMany({
      where: { userId, voidedAt: null, kind: { in: ['WEIGHT', 'HEIGHT', 'WAIST', 'HIP', 'ARM'] } },
      orderBy: { takenAt: 'desc' },
      select: { kind: true, value: true },
    });
    const latest = (kind: string) => rows.find((r) => r.kind === kind)?.value ?? null;
    const [lastIntake, lastInstance] = await Promise.all([
      this.prisma.planIntake.findFirst({ where: { userId }, orderBy: { createdAt: 'desc' }, select: { data: true, createdAt: true } }),
      this.prisma.planInstance.findFirst({ where: { userId }, orderBy: { sequence: 'desc' }, select: { endDate: true } }),
    ]);
    return {
      ageYears: ageOn(user.birthDate, localDay()),
      sex: user.gender === 'FEMALE' ? 'female' : user.gender === 'MALE' ? 'male' : 'other',
      heightCm: user.heightCm ?? latest('HEIGHT'),
      weightKg: latest('WEIGHT'),
      waistCm: latest('WAIST'),
      hipCm: latest('HIP'),
      armCm: latest('ARM'),
      lastIntake: lastIntake ? { data: lastIntake.data, createdAt: lastIntake.createdAt.toISOString() } : null,
      // Yeni dönemde ölçüler ve hedefler yeniden doğrulanır
      needsConfirmation: lastInstance !== null,
    };
  }

  async submitIntake(userId: string, intake: PlanIntake) {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { birthDate: true } });
    const age = ageOn(user.birthDate, localDay());
    const screening = screen(intake, age);
    const row = await this.prisma.planIntake.create({
      data: { userId, data: asJson(intake), screening: asJson(screening), eligible: screening.status !== 'BLOCKED' },
      select: { id: true, createdAt: true },
    });
    return { intakeId: row.id, eligible: screening.status !== 'BLOCKED', screening, createdAt: row.createdAt.toISOString() };
  }

  // ───── Durum ─────

  private async instanceProgress(instanceId: string, generatedWeeks: number) {
    const [days, logs] = await Promise.all([
      this.prisma.planDay.findMany({ where: { instanceId, kind: 'TRAINING' }, select: { dayNumber: true, entries: true } }),
      this.prisma.planEntryLog.findMany({ where: { instanceId, status: 'DONE' }, select: { dayNumber: true, entryIndex: true } }),
    ]);
    let planned = 0;
    let done = 0;
    let completedDays = 0;
    for (const d of days) {
      const mains = (d.entries as unknown as EntrySpec[]).filter((e) => e.section === 'MAIN' && !e.optional);
      const doneHere = mains.filter((e) => logs.some((l) => l.dayNumber === d.dayNumber && l.entryIndex === e.index)).length;
      planned += mains.length;
      done += doneHere;
      if (mains.length > 0 && doneHere === mains.length) completedDays += 1;
    }
    return { trainingDays: days.length, completedDays, plannedMain: planned, doneMain: done, allCompleted: generatedWeeks >= PLAN_WEEKS && days.length > 0 && completedDays === days.length };
  }

  async current(userId: string) {
    await this.autoStartExpired(userId);
    const today = localDay();
    const [purchase, instance, intake] = await Promise.all([
      this.prisma.planPurchase.findFirst({ where: { userId, status: 'PAID' }, orderBy: { createdAt: 'desc' }, include: { instance: { select: { id: true } } } }),
      this.prisma.planInstance.findFirst({ where: { userId }, orderBy: { sequence: 'desc' } }),
      this.prisma.planIntake.findFirst({ where: { userId }, orderBy: { createdAt: 'desc' } }),
    ]);
    const inst = instance ? await this.sync(instance) : null;
    const progress = inst ? await this.instanceProgress(inst.id, inst.generatedWeeks) : null;
    const pendingPurchase = purchase && !purchase.instance ? purchase : null;
    const phase: PlanPhase | 'NONE' = pendingPurchase
      ? phaseOf({ startDate: null, purchaseDay: dayStr(pendingPurchase.purchaseDay), today, allCompleted: false })
      : inst
        ? phaseOf({ startDate: dayStr(inst.startDate), purchaseDay: dayStr(inst.startDate), today, allCompleted: progress!.allCompleted })
        : 'NONE';
    const ended = phase === 'COMPLETED' || phase === 'EXPIRED';
    // Yeni dönem için bekleyen ya da süren bir şey yoksa satın alınabilir
    const canPurchase = !pendingPurchase && !(inst && !ended) || phase === 'START_WINDOW_MISSED';
    const screening = intake ? (intake.screening as unknown as ScreeningResult) : null;
    return {
      phase,
      // Süre dolmuş ya da tamamlanmış ve yeni satın alma yapılmamış
      awaitingRepurchase: ended && !pendingPurchase,
      canPurchase,
      price: PRICE,
      purchase: pendingPurchase
        ? { id: pendingPurchase.id, purchaseDay: dayStr(pendingPurchase.purchaseDay), startWindowEndsAt: addLocalDays(dayStr(pendingPurchase.purchaseDay), START_WINDOW_DAYS), provider: pendingPurchase.provider }
        : null,
      instance: inst
        ? {
            id: inst.id,
            sequence: inst.sequence,
            startDate: dayStr(inst.startDate),
            endDate: dayStr(inst.endDate),
            currentDay: currentDayNumber(dayStr(inst.startDate), today),
            generatedWeeks: inst.generatedWeeks,
            needsProfessional: inst.needsProfessional,
            engineVersion: inst.engineVersion,
            progress: progress!,
            hasReport: inst.reportedAt !== null,
          }
        : null,
      intake: intake
        ? { id: intake.id, eligible: intake.eligible, status: screening?.status ?? null, reasons: screening?.reasons ?? [], referToProfessional: screening?.referToProfessional ?? false, createdAt: intake.createdAt.toISOString() }
        : null,
    };
  }

  // ───── Satın alma (geliştirme modu) ─────

  private async lock(tx: Prisma.TransactionClient, userId: string) {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${userId}))`;
  }

  async purchase(userId: string, idempotencyKey: string) {
    // Gerçek ödeme sağlayıcısı bağlanana kadar üretimde satın alma kapalıdır
    if (env.nodeEnv === 'production') throw new HttpException({ code: 'PAYMENT_NOT_CONFIGURED', message: 'Ödeme henüz kullanıma açılmadı.' }, 503);
    return this.prisma.$transaction(async (tx) => {
      await this.lock(tx, userId);
      const existing = await tx.planPurchase.findUnique({ where: { userId_idempotencyKey: { userId, idempotencyKey } } });
      if (existing) return this.purchaseView(existing);

      const today = localDay();
      const intake = await tx.planIntake.findFirst({ where: { userId }, orderBy: { createdAt: 'desc' } });
      if (!intake) throw badRequest('INTAKE_REQUIRED', 'Önce kişisel bilgi formunu doldur.');
      if (!intake.eligible) throw forbidden('NOT_ELIGIBLE', 'Sağlık taramasına göre otomatik program hazırlanamıyor. Bir uzmana danışmanı öneririz.');
      if (localDay(intake.createdAt) < addLocalDays(today, -INTAKE_MAX_AGE_DAYS)) throw conflict('INTAKE_STALE', 'Bilgi formun eskidi. Güncel bilgilerle yeniden doldur.');
      const user = await tx.user.findUniqueOrThrow({ where: { id: userId }, select: { birthDate: true } });
      if (ageOn(user.birthDate, today) < MIN_AGE) throw forbidden('AGE_RESTRICTED', 'Kişisel program 18 yaş ve üzeri içindir.');

      const pending = await tx.planPurchase.findFirst({ where: { userId, status: 'PAID', instance: null }, orderBy: { createdAt: 'desc' } });
      if (pending && today <= addLocalDays(dayStr(pending.purchaseDay), START_WINDOW_DAYS)) throw conflict('PURCHASE_PENDING', 'Satın aldığın programın başlangıç tarihini seçmelisin.');
      const last = await tx.planInstance.findFirst({ where: { userId }, orderBy: { sequence: 'desc' } });
      if (last && today <= dayStr(last.endDate)) throw conflict('PLAN_IN_PROGRESS', 'Mevcut programın sürüyor; bittikten sonra yenisini alabilirsin.');
      // Yeni dönem: bilgiler önceki dönem bittikten SONRA yeniden doğrulanmış olmalı
      if (last && intake.createdAt < new Date(asDate(dayStr(last.endDate)).getTime())) throw conflict('INTAKE_RECONFIRM', 'Yeni program için ölçülerini ve hedeflerini yeniden doğrulaman gerekiyor.');

      const row = await tx.planPurchase.create({
        data: { userId, intakeId: intake.id, idempotencyKey, status: 'PAID', provider: 'DEV', amountMinor: PRICE.amountMinor, currency: PRICE.currency, purchaseDay: asDate(today) },
      });
      return this.purchaseView(row);
    });
  }

  private purchaseView(p: { id: string; purchaseDay: Date; provider: string; status: string; amountMinor: number | null; currency: string }) {
    const day = dayStr(p.purchaseDay);
    return { id: p.id, status: p.status, provider: p.provider, demo: p.provider === 'DEV', amountMinor: p.amountMinor, currency: p.currency, purchaseDay: day, startWindowEndsAt: addLocalDays(day, START_WINDOW_DAYS) };
  }

  // ───── Başlangıç tarihi ve ilk haftanın üretimi ─────

  async chooseStart(userId: string, purchaseId: string, requestedStart: string) {
    let startDate = requestedStart;
    if (!isValidDay(startDate)) throw badRequest('INVALID_DATE', 'Tarih geçerli değil.');
    const today = localDay();
    return this.prisma.$transaction(async (tx) => {
      await this.lock(tx, userId);
      startDate = requestedStart;
      const purchase = await tx.planPurchase.findFirst({ where: { id: purchaseId, userId, status: 'PAID' }, include: { instance: true, intake: true } });
      if (!purchase) throw notFound('PURCHASE_NOT_FOUND', 'Satın alma bulunamadı.');
      if (purchase.instance) {
        if (dayStr(purchase.instance.startDate) === startDate || startDateProblem(startDate, today, dayStr(purchase.purchaseDay)) === 'WINDOW_MISSED') return { instanceId: purchase.instance.id, startDate: dayStr(purchase.instance.startDate), endDate: dayStr(purchase.instance.endDate) };
        throw conflict('START_ALREADY_CHOSEN', 'Bu program için başlangıç tarihi zaten seçildi.');
      }
      const deadline = addLocalDays(dayStr(purchase.purchaseDay), START_WINDOW_DAYS);
      const problem = startDateProblem(startDate, today, dayStr(purchase.purchaseDay));
      // Karar: pencere kaçırılırsa program son günde (satın alma günü + 14) otomatik başlar
      if (problem === 'WINDOW_MISSED') startDate = deadline;
      if (problem === 'PAST') throw badRequest('START_IN_PAST', 'Başlangıç tarihi bugünden önce olamaz.');
      if (problem === 'TOO_LATE') throw badRequest('START_TOO_LATE', `Başlangıç tarihi satın almadan sonra en fazla ${START_WINDOW_DAYS} gün içinde seçilebilir.`);

      const user = await tx.user.findUniqueOrThrow({ where: { id: userId }, select: { birthDate: true } });
      const intake = intakeSchema.parse(purchase.intake.data);
      // Başlangıç gününde yaş ve tarama yeniden değerlendirilir
      const ageYears = ageOn(user.birthDate, startDate);
      const screening = screen(intake, ageYears);
      if (screening.status === 'BLOCKED') throw forbidden('NOT_ELIGIBLE', 'Sağlık taramasına göre otomatik program hazırlanamıyor. Bir uzmana danışmanı öneririz.');

      const previous = await tx.planInstance.findFirst({ where: { userId }, orderBy: { sequence: 'desc' } });
      let bonus = 0;
      let avoid: string[] = [];
      let carriedAreas: BodyArea[] = [];
      if (previous) {
        const prevParams = previous.params as unknown as StoredParams;
        carriedAreas = prevParams.restrictedAreas ?? [];
        const prevDays = await tx.planDay.findMany({ where: { instanceId: previous.id, kind: 'TRAINING' }, select: { entries: true } });
        avoid = [...new Set(prevDays.flatMap((d) => (d.entries as unknown as EntrySpec[]).filter((e) => e.section === 'MAIN').map((e) => e.itemId)))];
        const rep = previous.report as unknown as PlanReport | null;
        if (rep) {
          if (rep.totals.completionRate >= 0.85 && (rep.totals.avgRpe ?? 7) <= 7 && !rep.needsProfessional) bonus = 1;
          else if (rep.totals.completionRate < 0.4) bonus = -1;
        }
      }
      const sequence = (previous?.sequence ?? 0) + 1;
      const params: PlanParams = {
        intake,
        ageYears,
        screening,
        level: startLevel(intake, bonus),
        seed: `${userId}:${sequence}`,
        avoid,
        restrictedAreas: [...new Set([...screening.restrictedAreas, ...carriedAreas])],
        needsProfessional: false,
      };
      const week1 = generateWeek1(params);
      const stored: StoredParams = { level: params.level, seed: params.seed, avoid, restrictedAreas: params.restrictedAreas, needsProfessional: false, ageYears, screening, adaptationLog: [] };
      const created = await tx.planInstance.create({
        data: {
          userId,
          purchaseId,
          intakeId: purchase.intakeId,
          sequence,
          startDate: asDate(startDate),
          endDate: asDate(endDateOf(startDate)),
          engineVersion: ENGINE_VERSION,
          params: asJson(stored),
          previousInstanceId: previous?.id ?? null,
          generatedWeeks: 1,
          days: { create: week1.map((d) => this.dayRow(d, startDate)) },
        },
        select: { id: true },
      });
      return { instanceId: created.id, startDate, endDate: endDateOf(startDate) };
    });
  }

  // Başlangıç tarihi seçilmeden 14 günlük pencere geçmiş satın almaları son günde başlatır (karar: otomatik başlasın)
  private async autoStartExpired(userId: string) {
    const today = localDay();
    const pending = await this.prisma.planPurchase.findMany({ where: { userId, status: 'PAID', instance: null }, select: { id: true, purchaseDay: true } });
    for (const p of pending) {
      const deadline = addLocalDays(dayStr(p.purchaseDay), START_WINDOW_DAYS);
      if (today <= deadline) continue;
      try {
        await this.chooseStart(userId, p.id, deadline);
      } catch {
        // Uygunluk değiştiyse (ör. yaş/tarama) otomatik başlamaz; durum 'başlangıç süresi geçti' olarak görünür
      }
    }
  }

  private dayRow(d: DaySpec, startDate: string) {
    return { dayNumber: d.dayNumber, weekNumber: d.weekNumber, date: asDate(dayDateOf(startDate, d.dayNumber)), kind: d.kind, focus: d.focus, title: d.title, estimatedMinutes: d.estimatedMinutes, estimatedKcal: d.estimatedKcal, entries: asJson(d.entries) };
  }

  // ───── Erişim ve tembel hafta üretimi ─────

  private async owned(userId: string, instanceId: string) {
    const inst = await this.prisma.planInstance.findFirst({ where: { id: instanceId, userId } });
    if (!inst) throw notFound('PLAN_NOT_FOUND', 'Program bulunamadı.');
    return this.sync(inst);
  }

  private paramsOf(inst: { params: unknown; intake?: { data: unknown } }, intake: PlanIntake): PlanParams {
    const s = inst.params as StoredParams;
    return { intake, ageYears: s.ageYears, screening: s.screening, level: s.level, seed: s.seed, avoid: s.avoid, restrictedAreas: s.restrictedAreas, needsProfessional: s.needsProfessional };
  }

  private toSpec(row: { dayNumber: number; weekNumber: number; kind: string; focus: string | null; title: string; estimatedMinutes: number; estimatedKcal: number; entries: unknown }): DaySpec {
    return { dayNumber: row.dayNumber, weekNumber: row.weekNumber, kind: row.kind as DaySpec['kind'], focus: row.focus as DaySpec['focus'], title: row.title, estimatedMinutes: row.estimatedMinutes, estimatedKcal: row.estimatedKcal, entries: row.entries as EntrySpec[] };
  }

  private toLog(l: { dayNumber: number; entryIndex: number; status: 'DONE' | 'SKIPPED'; rpe: number | null; pain: boolean; painArea: string | null; painSharp: boolean }): EntryLog {
    return { dayNumber: l.dayNumber, entryIndex: l.entryIndex, status: l.status, rpe: l.rpe, pain: l.pain, painArea: (l.painArea as BodyArea | null) ?? null, painSharp: l.painSharp };
  }

  // Başlamış haftalar üretilir; program bittiyse rapor kaydedilir
  private async sync<T extends { id: string; userId: string; intakeId: string; startDate: Date; endDate: Date; generatedWeeks: number; params: unknown; reportedAt: Date | null }>(inst: T): Promise<T> {
    const today = localDay();
    const startDate = dayStr(inst.startDate);
    let current = inst;
    while (current.generatedWeeks < PLAN_WEEKS && addLocalDays(startDate, weekStartDay(current.generatedWeeks + 1) - 1) <= today) {
      const generated = current.generatedWeeks;
      const next = generated + 1;
      const intakeRow = await this.prisma.planIntake.findUniqueOrThrow({ where: { id: current.intakeId } });
      const [prevRows, logRows] = await Promise.all([
        this.prisma.planDay.findMany({ where: { instanceId: current.id, weekNumber: generated }, orderBy: { dayNumber: 'asc' } }),
        this.prisma.planEntryLog.findMany({ where: { instanceId: current.id, dayNumber: { gte: weekStartDay(generated), lte: generated * 7 } } }),
      ]);
      const stored = current.params as StoredParams;
      const params = this.paramsOf(current, intakeSchema.parse(intakeRow.data));
      const derived = deriveWeek(prevRows.map((r) => this.toSpec(r)), logRows.map((l) => this.toLog(l)), params, next);
      const nextParams: StoredParams = { ...stored, restrictedAreas: derived.restrictedAreas, needsProfessional: derived.needsProfessional, adaptationLog: [...(stored.adaptationLog ?? []), ...derived.log.map((l) => `Hafta ${next}: ${l}`)] };
      await this.prisma.$transaction(async (tx) => {
        // Aynı anda iki istek aynı haftayı üretmesin: sadece beklenen sayıdaki kayıt güncellenir
        const upd = await tx.planInstance.updateMany({ where: { id: current.id, generatedWeeks: generated }, data: { generatedWeeks: next, needsProfessional: derived.needsProfessional, params: asJson(nextParams) } });
        if (upd.count === 1) await tx.planDay.createMany({ data: derived.days.map((d) => ({ ...this.dayRow(d, startDate), instanceId: current.id })) });
      });
      const fresh = await this.prisma.planInstance.findUniqueOrThrow({ where: { id: current.id } });
      current = fresh as unknown as T;
    }
    if (today > dayStr(current.endDate) && current.reportedAt === null) {
      const report = await this.computeReport(current);
      await this.prisma.planInstance.updateMany({ where: { id: current.id, reportedAt: null }, data: { report: asJson(report), reportedAt: new Date() } });
      current = (await this.prisma.planInstance.findUniqueOrThrow({ where: { id: current.id } })) as unknown as T;
    }
    return current;
  }

  // ───── Görünümler ─────

  private entryView(e: EntrySpec, log: { status: string; rpe: number | null; pain: boolean; painArea: string | null; painSharp: boolean; note: string | null; actualReps: number | null; actualSeconds: number | null } | undefined) {
    const item = findItem(e.itemId)!;
    const work = workOf(e);
    return {
      index: e.index,
      section: e.section,
      itemId: e.itemId,
      title: item.title,
      kind: item.kind,
      workText: workText(work),
      sets: e.sets,
      reps: e.reps ?? null,
      seconds: e.seconds ?? null,
      perSide: e.perSide ?? false,
      restSec: e.restSec,
      durationSec: workSeconds(work),
      optional: e.optional ?? false,
      rationale: e.rationale,
      original: e.originalItemId ? { id: e.originalItemId, title: findItem(e.originalItemId)?.title ?? e.originalItemId } : null,
      videoUrl: item.videoUrl ?? null,
      equipment: item.equipment ?? null,
      steps: item.steps,
      mistakes: item.mistakes ?? [],
      warnings: item.warnings ?? [],
      log: log
        ? { status: log.status, rpe: log.rpe, pain: log.pain, painArea: log.painArea, painSharp: log.painSharp, note: log.note, actualReps: log.actualReps, actualSeconds: log.actualSeconds }
        : null,
    };
  }

  async overview(userId: string, instanceId: string) {
    const inst = await this.owned(userId, instanceId);
    const today = localDay();
    const startDate = dayStr(inst.startDate);
    const [rows, logs, progress] = await Promise.all([
      this.prisma.planDay.findMany({ where: { instanceId }, orderBy: { dayNumber: 'asc' } }),
      this.prisma.planEntryLog.findMany({ where: { instanceId, status: 'DONE' }, select: { dayNumber: true, entryIndex: true } }),
      this.instanceProgress(instanceId, inst.generatedWeeks),
    ]);
    const days = rows.map((r) => {
      const mains = (r.entries as unknown as EntrySpec[]).filter((e) => e.section === 'MAIN' && !e.optional);
      const done = mains.filter((e) => logs.some((l) => l.dayNumber === r.dayNumber && l.entryIndex === e.index)).length;
      return { dayNumber: r.dayNumber, weekNumber: r.weekNumber, date: dayStr(r.date), kind: r.kind, focus: r.focus, title: r.title, estimatedMinutes: r.estimatedMinutes, estimatedKcal: r.estimatedKcal, plannedMain: mains.length, doneMain: done, isToday: dayStr(r.date) === today };
    });
    const params = inst.params as unknown as StoredParams;
    return {
      id: inst.id,
      sequence: inst.sequence,
      startDate,
      endDate: dayStr(inst.endDate),
      currentDay: currentDayNumber(startDate, today),
      phase: phaseOf({ startDate, purchaseDay: startDate, today, allCompleted: progress.allCompleted }),
      generatedWeeks: inst.generatedWeeks,
      needsProfessional: inst.needsProfessional,
      engineVersion: inst.engineVersion,
      level: params.level,
      // Sonraki haftalar, haftanın başladığı gün performansına göre hazırlanır
      pendingWeeks: Array.from({ length: PLAN_WEEKS - inst.generatedWeeks }, (_, i) => ({ week: inst.generatedWeeks + i + 1, preparedOn: addLocalDays(startDate, weekStartDay(inst.generatedWeeks + i + 1) - 1) })),
      progress,
      adaptationLog: params.adaptationLog ?? [],
      days,
      energy: await this.energyOf(inst, params),
      disclaimer: 'Tahmini değerler ölçüm ya da sonuç garantisi değildir. Otomatik program, tıbbi değerlendirmenin ya da diyetisyen planının yerine geçmez.',
    };
  }

  private async energyOf(inst: { intakeId: string }, params: StoredParams) {
    const intake = intakeSchema.parse((await this.prisma.planIntake.findUniqueOrThrow({ where: { id: inst.intakeId } })).data);
    return dailyEnergyEstimate({ sex: intake.sex, ageYears: params.ageYears, heightCm: intake.heightCm, weightKg: intake.weightKg, dailyActivity: intake.dailyActivity });
  }

  async day(userId: string, instanceId: string, dayNumber: number) {
    const inst = await this.owned(userId, instanceId);
    const row = await this.prisma.planDay.findUnique({ where: { instanceId_dayNumber: { instanceId, dayNumber } } });
    if (!row) {
      if (dayNumber < 1 || dayNumber > PLAN_DAYS) throw notFound('DAY_NOT_FOUND', 'Bu gün programda yok.');
      const week = weekOfDay(dayNumber);
      throw notFound('DAY_NOT_PREPARED', `${week}. hafta, haftanın başladığı gün (${addLocalDays(dayStr(inst.startDate), weekStartDay(week) - 1)}) performansına göre hazırlanır.`);
    }
    const intake = intakeSchema.parse((await this.prisma.planIntake.findUniqueOrThrow({ where: { id: inst.intakeId } })).data);
    const params = this.paramsOf(inst, intake);
    const logs = await this.prisma.planEntryLog.findMany({ where: { instanceId, dayNumber } });
    const entries = (row.entries as unknown as EntrySpec[]).map((e) => {
      const view = this.entryView(e, logs.find((l) => l.entryIndex === e.index));
      // Anlık uyarlama: aynı güvenli kalıptan alternatifler (yapılmış hareket için sunulmaz)
      const taken = new Set((row.entries as unknown as EntrySpec[]).map((x) => x.itemId));
      const alternatives = e.section === 'MAIN' && view.log?.status !== 'DONE' ? alternativesFor(e.itemId, params, taken).map((id) => ({ id, title: findItem(id)!.title })) : [];
      return { ...view, alternatives };
    });
    const mains = entries.filter((e) => e.section === 'MAIN' && !e.optional);
    return {
      instanceId,
      dayNumber,
      weekNumber: row.weekNumber,
      date: dayStr(row.date),
      kind: row.kind,
      focus: row.focus,
      title: row.title,
      estimatedMinutes: row.estimatedMinutes,
      estimatedKcal: row.estimatedKcal,
      source: { kind: 'SOCIALFIT_PLAN', title: 'SocialFit 28 günlük program' },
      progress: { plannedMain: mains.length, doneMain: mains.filter((e) => e.log?.status === 'DONE').length },
      entries,
      safety: SAFETY_PAIN,
    };
  }

  // ───── Geri bildirim ve anlık uyarlama ─────

  async logEntry(
    userId: string,
    instanceId: string,
    dayNumber: number,
    entryIndex: number,
    input: { status: 'DONE' | 'SKIPPED'; rpe?: number | null; pain?: boolean; painArea?: BodyArea | null; painSharp?: boolean; note?: string | null; actualReps?: number | null; actualSeconds?: number | null },
  ) {
    const inst = await this.owned(userId, instanceId);
    const today = localDay();
    if (today > dayStr(inst.endDate)) throw conflict('PLAN_ENDED', 'Program sona erdi; kayıt eklenemez.');
    const row = await this.prisma.planDay.findUnique({ where: { instanceId_dayNumber: { instanceId, dayNumber } } });
    if (!row) throw notFound('DAY_NOT_FOUND', 'Bu gün henüz hazır değil.');
    if (dayStr(row.date) > today) throw badRequest('DAY_IN_FUTURE', 'Henüz gelmemiş günün hareketi işaretlenemez.');
    const entry = (row.entries as unknown as EntrySpec[]).find((e) => e.index === entryIndex);
    if (!entry) throw notFound('ENTRY_NOT_FOUND', 'Hareket bulunamadı.');
    const done = input.status === 'DONE';
    const pain = Boolean(input.pain || input.painArea || input.painSharp);
    const data = {
      status: input.status,
      rpe: done ? (input.rpe ?? null) : null,
      pain,
      painArea: input.painArea ?? null,
      painSharp: Boolean(input.painSharp),
      note: input.note?.trim() || null,
      actualReps: done ? (input.actualReps ?? null) : null,
      actualSeconds: done ? (input.actualSeconds ?? null) : null,
    };
    await this.prisma.planEntryLog.upsert({ where: { instanceId_dayNumber_entryIndex: { instanceId, dayNumber, entryIndex } }, create: { instanceId, dayNumber, entryIndex, ...data }, update: { ...data, loggedAt: new Date() } });
    return {
      logged: true,
      status: input.status,
      // Ağrıda güvenlik kuralları önceliklidir
      safety: pain ? SAFETY_PAIN : null,
      seeProfessional: Boolean(input.painSharp),
      dayProgress: (await this.day(userId, instanceId, dayNumber)).progress,
    };
  }

  async swapEntry(userId: string, instanceId: string, dayNumber: number, entryIndex: number, itemId: string) {
    const inst = await this.owned(userId, instanceId);
    const row = await this.prisma.planDay.findUnique({ where: { instanceId_dayNumber: { instanceId, dayNumber } } });
    if (!row) throw notFound('DAY_NOT_FOUND', 'Bu gün henüz hazır değil.');
    if (dayStr(row.date) < localDay()) throw conflict('DAY_PASSED', 'Geçmiş günün hareketi değiştirilemez.');
    const entries = row.entries as unknown as EntrySpec[];
    const entry = entries.find((e) => e.index === entryIndex);
    if (!entry || entry.section !== 'MAIN') throw notFound('ENTRY_NOT_FOUND', 'Değiştirilebilir hareket bulunamadı.');
    const done = await this.prisma.planEntryLog.count({ where: { instanceId, dayNumber, entryIndex, status: 'DONE' } });
    if (done > 0) throw conflict('ALREADY_DONE', 'Yapılmış hareket değiştirilemez.');
    const intake = intakeSchema.parse((await this.prisma.planIntake.findUniqueOrThrow({ where: { id: inst.intakeId } })).data);
    const params = this.paramsOf(inst, intake);
    // Sadece sunucunun güvenli bulduğu alternatiflere izin verilir
    if (!alternativesFor(entry.itemId, params, new Set(entries.map((e) => e.itemId))).includes(itemId)) throw badRequest('INVALID_ALTERNATIVE', 'Bu hareket alternatif olarak uygun değil.');
    const swapped: EntrySpec = { ...entry, itemId, ...prescribe(itemId, params, 'MAIN'), originalItemId: entry.originalItemId ?? entry.itemId, rationale: 'Anlık uyarlama: seçtiğin alternatif hareket.' };
    const next = entries.map((e) => (e.index === entryIndex ? swapped : e));
    const est = dayEstimates(next, intake.weightKg);
    await this.prisma.$transaction([
      this.prisma.planDay.update({ where: { id: row.id }, data: { entries: asJson(next), estimatedMinutes: est.estimatedMinutes, estimatedKcal: est.estimatedKcal } }),
      this.prisma.planEntryLog.deleteMany({ where: { instanceId, dayNumber, entryIndex } }),
    ]);
    return this.day(userId, instanceId, dayNumber);
  }

  // ───── Rapor ─────

  private async computeReport(inst: { id: string; userId: string; intakeId: string; startDate: Date; endDate: Date; generatedWeeks: number; params: unknown }): Promise<PlanReport> {
    const [rows, logs, intakeRow] = await Promise.all([
      this.prisma.planDay.findMany({ where: { instanceId: inst.id }, orderBy: { dayNumber: 'asc' } }),
      this.prisma.planEntryLog.findMany({ where: { instanceId: inst.id } }),
      this.prisma.planIntake.findUniqueOrThrow({ where: { id: inst.intakeId } }),
    ]);
    const intake = intakeSchema.parse(intakeRow.data);
    const params = inst.params as StoredParams;
    const startDay = dayStr(inst.startDate);
    const endDay = dayStr(inst.endDate);
    const kinds = { WEIGHT: 'weightKg', WAIST: 'waistCm', HIP: 'hipCm', ARM: 'armCm' } as const;
    const measures = await this.prisma.measurement.findMany({ where: { userId: inst.userId, voidedAt: null, kind: { in: ['WEIGHT', 'WAIST', 'HIP', 'ARM'] } }, orderBy: { takenAt: 'asc' }, select: { kind: true, value: true, takenAt: true } });
    const body: PlanReport['body'] = { weightKg: { start: intake.weightKg, end: null }, waistCm: { start: intake.waistCm ?? null, end: null }, hipCm: { start: intake.hipCm ?? null, end: null }, armCm: { start: intake.armCm ?? null, end: null } };
    for (const [kind, key] of Object.entries(kinds) as [keyof typeof kinds, (typeof kinds)[keyof typeof kinds]][]) {
      const mine = measures.filter((m) => m.kind === kind);
      const before = mine.filter((m) => localDay(m.takenAt) <= startDay).at(-1);
      const within = mine.filter((m) => localDay(m.takenAt) > startDay && localDay(m.takenAt) <= endDay).at(-1);
      if (before) body[key].start = before.value;
      if (within) body[key].end = within.value;
    }
    const energy = dailyEnergyEstimate({ sex: intake.sex, ageYears: params.ageYears, heightCm: intake.heightCm, weightKg: intake.weightKg, dailyActivity: intake.dailyActivity });
    const reportLogs: ReportLog[] = logs.map((l) => ({ dayNumber: l.dayNumber, entryIndex: l.entryIndex, status: l.status, rpe: l.rpe, pain: l.pain, painArea: (l.painArea as BodyArea | null) ?? null, painSharp: l.painSharp, actualReps: l.actualReps, actualSeconds: l.actualSeconds }));
    return buildReport({
      days: rows.map((r) => ({ dayNumber: r.dayNumber, weekNumber: r.weekNumber, kind: r.kind as 'TRAINING' | 'REST', estimatedKcal: r.estimatedKcal, entries: r.entries as unknown as EntrySpec[] })),
      logs: reportLogs,
      body,
      bmr: energy.bmr,
      tdee: energy.tdee,
      needsProfessional: params.needsProfessional,
      adaptationLog: params.adaptationLog ?? [],
      generatedWeeks: inst.generatedWeeks,
    });
  }

  async report(userId: string, instanceId: string) {
    const inst = await this.owned(userId, instanceId);
    const stored = inst.report as unknown as PlanReport | null;
    if (stored) return { final: true, report: stored };
    // Program sürerken anlık (kaydedilmeyen) özet
    return { final: false, report: await this.computeReport(inst) };
  }

  // ───── Görevlerim ─────

  // Verilen günün program görevleri (varsa). Görevlerim ekranında diğer kaynaklarla birlikte listelenir.
  async dayTasks(userId: string, date: string) {
    await this.autoStartExpired(userId);
    const inst = await this.prisma.planInstance.findFirst({ where: { userId, startDate: { lte: asDate(date) }, endDate: { gte: asDate(date) } }, orderBy: { sequence: 'desc' } });
    if (!inst) return null;
    const synced = await this.sync(inst);
    const row = await this.prisma.planDay.findFirst({ where: { instanceId: synced.id, date: asDate(date) } });
    if (!row) return null;
    const logs = await this.prisma.planEntryLog.findMany({ where: { instanceId: synced.id, dayNumber: row.dayNumber } });
    const entries = (row.entries as unknown as EntrySpec[]).map((e) => this.entryView(e, logs.find((l) => l.entryIndex === e.index)));
    const mains = entries.filter((e) => e.section === 'MAIN' && !e.optional);
    return {
      source: { kind: 'SOCIALFIT_PLAN' as const, title: 'SocialFit 28 günlük program', instanceId: synced.id },
      dayNumber: row.dayNumber,
      weekNumber: row.weekNumber,
      title: row.title,
      kind: row.kind,
      estimatedMinutes: row.estimatedMinutes,
      progress: { plannedMain: mains.length, doneMain: mains.filter((e) => e.log?.status === 'DONE').length },
      entries: entries.map((e) => ({ index: e.index, section: e.section, itemId: e.itemId, title: e.title, workText: e.workText, durationSec: e.durationSec, optional: e.optional, status: e.log?.status ?? null })),
    };
  }
}
