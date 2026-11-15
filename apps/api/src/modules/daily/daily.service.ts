// Kalori aracı kaydı, premium işareti, günün düzeni (rutin öğeleri), görev işaretleri ve kullanıcı geçmişi.
// Hesaplama ortak pakettedir (@fitapp/shared); burada GÜVENLİK SINIRLARI sunucuda ayrıca denetlenir:
//  - 18 yaş altı, hamilelik, doktor kısıtı ve yeme bozukluğu geçmişinde kalori hedefi kaydedilmez.
//  - Hedef güvenli alt sınırın altına inemez; günlük açık haftalık ~1 kg'ı (1100 kcal) geçemez.
// Tüm sağlık değerleri TAHMİNİDİR, tıbbi tavsiye değildir. Premium yalnızca geliştirmede elle açılır (gerçek ödeme yok).
import { Inject, Injectable } from '@nestjs/common';
import { badRequest, forbidden, notFound } from '../../common/app-error.js';
import { addLocalDays, isValidDay, localDay } from '../../common/local-day.js';
import { PrismaService } from '../../common/prisma/prisma.service.js';
import type { MealType } from '../../generated/prisma/enums.js';
import { FoodLogService } from '../clients/food-log.service.js';
import { findCard } from '../library/workout-cards.js';
import { findAnyProgram } from '../library/packs.js';

export const SLOTS = ['MORNING', 'NOON', 'AFTERNOON', 'EVENING', 'ANYTIME'] as const;
export const LANES = ['CARE', 'EXERCISE', 'MEAL'] as const;
const SLOT_ORDER: Record<string, number> = { MORNING: 0, NOON: 1, AFTERNOON: 2, EVENING: 3, ANYTIME: 4 };
const MEAL_OF_SLOT: Record<string, MealType> = { MORNING: 'BREAKFAST', NOON: 'LUNCH', AFTERNOON: 'SNACK', EVENING: 'DINNER', ANYTIME: 'SNACK' };

const MIN_KCAL: Record<string, number> = { female: 1200, male: 1500, other: 1350 };
const BREASTFEEDING_FLOOR = 1800;
// Günlük açık sınırı: haftada 1 kg ≈ 7700 kcal / 7 gün (küçük yuvarlama payıyla)
const MAX_DAILY_DEFICIT = 1105;

export interface ProfileInput {
  goal: string;
  activity: string;
  sport?: string;
  breastfeedingMonths?: number;
  sex: string;
  ageYears: number;
  heightCm: number;
  weightKg: number;
  bodyFatPercent?: number;
  bmr: number;
  tdee: number;
  targetKcal: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  waterMl: number;
  screening: { pregnant: boolean; medicalRestriction: boolean; eatingDisorderHistory: boolean };
}

export interface RoutineInput {
  date?: string;
  slot: string;
  lane: string;
  kind: string;
  refId?: string;
  title: string;
  subtitle?: string;
  data?: { items?: { name: string; portion: string; servings: number; kcal: number; proteinG: number; carbsG: number; fatG: number }[] };
  source: 'SUGGESTED' | 'MANUAL';
}

const ageOf = (birth: Date, at = new Date()) => {
  let age = at.getUTCFullYear() - birth.getUTCFullYear();
  const m = at.getUTCMonth() - birth.getUTCMonth();
  if (m < 0 || (m === 0 && at.getUTCDate() < birth.getUTCDate())) age--;
  return age;
};

@Injectable()
export class DailyService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(FoodLogService) private readonly foodLog: FoodLogService,
  ) {}

  private async event(userId: string, kind: string, title: string, data?: object) {
    await this.prisma.userEvent.create({ data: { userId, kind, title, ...(data ? { data } : {}) } });
  }

  // ───── Premium (geliştirme işareti) ─────

  async isPremium(userId: string) {
    return (await this.prisma.premiumGrant.findUnique({ where: { userId } })) !== null;
  }

  async premium(userId: string) {
    const g = await this.prisma.premiumGrant.findUnique({ where: { userId } });
    return { active: g !== null, source: g?.source ?? null, paymentAvailable: false };
  }

  // Gerçek ödeme yokken yalnızca geliştirmede elle açılır/kapanır; üretimde ödeme gerekir
  async setPremium(userId: string, active: boolean) {
    if (process.env.NODE_ENV === 'production') throw forbidden('PREMIUM_PAYMENT_REQUIRED', 'Premium için ödeme gerekir; ödeme henüz aktif değil.');
    if (active) await this.prisma.premiumGrant.upsert({ where: { userId }, create: { userId, source: 'DEV' }, update: {} });
    else await this.prisma.premiumGrant.deleteMany({ where: { userId } });
    await this.event(userId, 'PREMIUM', active ? 'Premium (deneme) açıldı' : 'Premium (deneme) kapatıldı');
    return this.premium(userId);
  }

  // ───── Kalori aracı kaydı ─────

  async calorieProfile(userId: string) {
    const p = await this.prisma.calorieProfile.findUnique({ where: { userId } });
    return p ? { ...p, confirmedAt: p.confirmedAt.toISOString(), updatedAt: p.updatedAt.toISOString() } : null;
  }

  async saveCalorieProfile(userId: string, input: ProfileInput) {
    const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { birthDate: true } });
    if (!user) throw notFound('USER_NOT_FOUND', 'Kullanıcı bulunamadı.');
    const s = input.screening;
    if (ageOf(user.birthDate) < 18) throw forbidden('CALORIE_BLOCKED', 'Kalori hedefi 18 yaş ve üzeri içindir.');
    if (s.pregnant || s.medicalRestriction || s.eatingDisorderHistory) {
      throw forbidden('CALORIE_BLOCKED', 'Bu durumda kalori hedefi hazırlanmaz; bir doktora ya da diyetisyene danışmanı öneririz.');
    }
    if (input.goal === 'athlete' && !input.sport) throw badRequest('SPORT_REQUIRED', 'Sporcu hedefi için branş seç.');
    if (input.goal === 'breastfeeding') {
      if (input.breastfeedingMonths === undefined) throw badRequest('MONTHS_REQUIRED', 'Emzirme döneminde bebeğin ayını gir.');
      if (input.sex === 'male') throw badRequest('INVALID_GOAL', 'Bu hedef bu profil için uygun değil.');
    }
    const floor = MIN_KCAL[input.sex] ?? 1350;
    if (input.targetKcal < input.tdee && input.targetKcal < floor) throw badRequest('TARGET_TOO_LOW', `Günlük hedef ${floor} kcal'nin altına inemez.`);
    if (input.goal === 'breastfeeding' && input.targetKcal < BREASTFEEDING_FLOOR) throw badRequest('TARGET_TOO_LOW', `Emzirme döneminde günlük hedef ${BREASTFEEDING_FLOOR} kcal'nin altına inemez.`);
    if (input.tdee - input.targetKcal > MAX_DAILY_DEFICIT) throw badRequest('DEFICIT_TOO_LARGE', 'Haftalık hedef en fazla yaklaşık 1 kg olabilir.');
    const macroKcal = input.proteinG * 4 + input.carbsG * 4 + input.fatG * 9;
    if (Math.abs(macroKcal - input.targetKcal) > input.targetKcal * 0.12) throw badRequest('MACROS_MISMATCH', 'Makro değerleri günlük hedefle uyuşmuyor.');

    const data = {
      goal: input.goal,
      activity: input.activity,
      sport: input.sport ?? null,
      breastfeedingMonths: input.breastfeedingMonths ?? null,
      sex: input.sex,
      ageYears: input.ageYears,
      heightCm: input.heightCm,
      weightKg: input.weightKg,
      bodyFatPercent: input.bodyFatPercent ?? null,
      bmr: input.bmr,
      tdee: input.tdee,
      targetKcal: input.targetKcal,
      proteinG: input.proteinG,
      carbsG: input.carbsG,
      fatG: input.fatG,
      waterMl: input.waterMl,
      confirmedAt: new Date(),
    };
    await this.prisma.calorieProfile.upsert({ where: { userId }, create: { userId, ...data }, update: data });
    // Uygulamadaki günlük hedef de güncellenir (sistem hesapladı: setById boş)
    await this.prisma.nutritionTarget.create({ data: { userId, kcal: input.targetKcal, proteinG: input.proteinG, carbsG: input.carbsG, fatG: input.fatG, waterMl: input.waterMl } });
    await this.event(userId, 'CALORIE_PROFILE', `Kalori hedefi kaydedildi: ${input.targetKcal} kcal (amaç: ${input.goal})`, { goal: input.goal, targetKcal: input.targetKcal });
    return this.calorieProfile(userId);
  }

  // ───── Günün düzeni (rutin öğeleri) ─────

  private checkDay(day: string) {
    const today = localDay();
    if (!isValidDay(day) || day > addLocalDays(today, 14) || day < addLocalDays(today, -30)) throw badRequest('INVALID_DATE', 'Tarih son 30 gün ile önümüzdeki 14 gün arasında olmalı.');
  }

  async routine(userId: string, date: string) {
    this.checkDay(date);
    const [rows, premium] = await Promise.all([this.prisma.routineItem.findMany({ where: { userId, date }, orderBy: { createdAt: 'asc' } }), this.isPremium(userId)]);
    const items = rows
      .map((r) => ({ id: r.id, date: r.date, slot: r.slot, lane: r.lane, kind: r.kind, refId: r.refId, title: r.title, subtitle: r.subtitle, data: r.data, source: r.source, done: r.doneAt !== null }))
      .sort((a, b) => (SLOT_ORDER[a.slot] ?? 9) - (SLOT_ORDER[b.slot] ?? 9));
    return { date, premium, items };
  }

  async addRoutine(userId: string, input: RoutineInput) {
    const date = input.date ?? localDay();
    this.checkDay(date);
    if (input.source === 'SUGGESTED') {
      if (!(await this.isPremium(userId))) throw forbidden('PREMIUM_REQUIRED', 'Önerilen rutinler premium içindir. Kendi görevini ekleyebilirsin.');
      if (input.slot === 'ANYTIME') throw badRequest('SLOT_REQUIRED', 'Önerilen rutinler bir saat dilimine eklenir.');
    }
    if (input.kind === 'CARD') {
      if (!input.refId || !findCard(input.refId)) throw badRequest('INVALID_CARD', 'Antrenman kartı bulunamadı.');
    }
    if (input.kind === 'FOOD' && input.data?.items && input.lane !== 'MEAL') throw badRequest('INVALID_LANE', 'Yemek öğeleri yemek şeridine eklenir.');
    const exists = await this.prisma.routineItem.findFirst({ where: { userId, date, slot: input.slot, lane: input.lane, kind: input.kind, title: input.title } });
    if (exists) throw badRequest('ALREADY_ADDED', 'Bu öğe zaten eklenmiş.');
    const r = await this.prisma.routineItem.create({
      data: { userId, date, slot: input.slot, lane: input.lane, kind: input.kind, refId: input.refId ?? null, title: input.title, subtitle: input.subtitle ?? null, source: input.source, ...(input.data ? { data: input.data } : {}) },
    });
    await this.event(userId, 'ROUTINE_ADDED', `Rutine eklendi: ${input.title}`, { slot: input.slot, lane: input.lane, source: input.source });
    return { id: r.id };
  }

  private async ownRoutine(userId: string, id: string) {
    const r = await this.prisma.routineItem.findFirst({ where: { id, userId } });
    if (!r) throw notFound('ROUTINE_NOT_FOUND', 'Öğe bulunamadı.');
    return r;
  }

  // Yemek öğesi tamamlanınca öğün günlüğüne yazılır (analizde sayılır); geri alınınca o kayıtlar silinir
  async setRoutineDone(userId: string, id: string, done: boolean) {
    const r = await this.ownRoutine(userId, id);
    if (done && r.date > localDay()) throw badRequest('DAY_IN_FUTURE', 'Henüz gelmemiş günün görevi işaretlenemez.');
    if (done === (r.doneAt !== null)) return { id, done };
    const data = (r.data ?? {}) as { items?: { name: string; portion: string; servings: number; kcal: number; proteinG: number; carbsG: number; fatG: number }[]; mealIds?: string[] };
    let next = data;
    if (r.kind === 'FOOD' && data.items?.length) {
      if (done) {
        const mealIds: string[] = [];
        for (const it of data.items) {
          const created = await this.foodLog.addMeal(userId, {
            date: r.date,
            mealType: MEAL_OF_SLOT[r.slot] ?? 'SNACK',
            name: it.name,
            portion: it.portion,
            servings: it.servings,
            perServing: { kcal: it.kcal / it.servings, proteinG: it.proteinG / it.servings, carbsG: it.carbsG / it.servings, fatG: it.fatG / it.servings },
          });
          mealIds.push((created as { id: string }).id);
        }
        next = { ...data, mealIds };
      } else {
        for (const mealId of data.mealIds ?? []) await this.foodLog.removeMeal(userId, mealId).catch(() => undefined);
        next = { ...data, mealIds: [] };
      }
    }
    await this.prisma.routineItem.update({ where: { id }, data: { doneAt: done ? new Date() : null, ...(r.kind === 'FOOD' ? { data: next } : {}) } });
    return { id, done };
  }

  async removeRoutine(userId: string, id: string) {
    const r = await this.ownRoutine(userId, id);
    const data = (r.data ?? {}) as { mealIds?: string[] };
    for (const mealId of data.mealIds ?? []) await this.foodLog.removeMeal(userId, mealId).catch(() => undefined);
    await this.prisma.routineItem.delete({ where: { id } });
    return { id, removed: true };
  }

  // ───── Görev işaretleri (uzman planı gibi başka kaynaklı görevler) ─────

  async taskChecks(userId: string, date: string) {
    this.checkDay(date);
    const rows = await this.prisma.taskCheck.findMany({ where: { userId, date }, select: { key: true } });
    return { date, keys: rows.map((x) => x.key) };
  }

  async setTaskCheck(userId: string, key: string, date: string, done: boolean) {
    this.checkDay(date);
    if (done && date > localDay()) throw badRequest('DAY_IN_FUTURE', 'Henüz gelmemiş günün görevi işaretlenemez.');
    if (done) await this.prisma.taskCheck.upsert({ where: { userId_key_date: { userId, key, date } }, create: { userId, key, date }, update: {} });
    else await this.prisma.taskCheck.deleteMany({ where: { userId, key, date } });
    return { key, date, done };
  }

  // ───── Kullanıcı geçmişi ─────

  async history(userId: string, limit: number) {
    const [events, enrollments, cards, purchases, measurements, meals, routines] = await Promise.all([
      this.prisma.userEvent.findMany({ where: { userId }, orderBy: { at: 'desc' }, take: limit }),
      this.prisma.libraryEnrollment.findMany({ where: { userId }, orderBy: { createdAt: 'desc' }, take: limit }),
      this.prisma.workoutCardTask.findMany({ where: { userId, doneAt: { not: null } }, orderBy: { doneAt: 'desc' }, take: limit }),
      this.prisma.planPurchase.findMany({ where: { userId }, orderBy: { paidAt: 'desc' }, take: 10 }),
      this.prisma.measurement.findMany({ where: { userId, voidedAt: null }, orderBy: { takenAt: 'desc' }, take: limit }),
      this.prisma.mealEntry.groupBy({ by: ['date'], where: { userId }, _count: { _all: true }, _sum: { kcal: true }, _max: { createdAt: true }, orderBy: { date: 'desc' }, take: 14 }),
      this.prisma.routineItem.findMany({ where: { userId, doneAt: { not: null } }, orderBy: { doneAt: 'desc' }, take: limit }),
    ]);
    type Row = { at: string; kind: string; title: string; detail?: string };
    const rows: Row[] = [];
    for (const e of events) rows.push({ at: e.at.toISOString(), kind: e.kind, title: e.title });
    for (const e of enrollments) {
      const p = findAnyProgram(e.programId);
      rows.push({ at: e.createdAt.toISOString(), kind: 'PROGRAM_JOINED', title: `Programa katıldın: ${p?.title ?? e.programId}` });
      if (e.endedAt) rows.push({ at: e.endedAt.toISOString(), kind: e.status === 'COMPLETED' ? 'PROGRAM_COMPLETED' : 'PROGRAM_LEFT', title: `${e.status === 'COMPLETED' ? 'Programı tamamladın' : 'Programdan ayrıldın'}: ${p?.title ?? e.programId}` });
    }
    for (const c of cards) rows.push({ at: c.doneAt!.toISOString(), kind: 'WORKOUT_DONE', title: `Antrenman: ${findCard(c.cardId)?.title ?? c.cardId}`, detail: c.completedMoves !== null ? `${c.completedMoves}/${c.totalMoves} hareket` : undefined });
    for (const p of purchases) rows.push({ at: p.paidAt.toISOString(), kind: 'PLAN_PURCHASED', title: 'Kişisel 28 günlük program alındı (deneme)' });
    for (const m of measurements) rows.push({ at: m.takenAt.toISOString(), kind: 'MEASUREMENT', title: `Ölçüm: ${KIND_TR[m.kind] ?? m.kind}`, detail: `${m.value}` });
    for (const d of meals) rows.push({ at: (d._max.createdAt ?? new Date(`${d.date}T12:00:00Z`)).toISOString(), kind: 'MEALS', title: `${d.date}: ${d._count._all} öğün kaydedildi`, detail: `~${Math.round(d._sum.kcal ?? 0)} kcal` });
    for (const r of routines) rows.push({ at: r.doneAt!.toISOString(), kind: 'ROUTINE_DONE', title: `Tamamlandı: ${r.title}` });
    rows.sort((a, b) => b.at.localeCompare(a.at));
    return { items: rows.slice(0, limit) };
  }
}

const KIND_TR: Record<string, string> = {
  WEIGHT: 'Kilo',
  HEIGHT: 'Boy',
  WAIST: 'Bel çevresi',
  HIP: 'Kalça çevresi',
  NECK: 'Boyun çevresi',
  CHEST: 'Göğüs çevresi',
  ARM: 'Kol çevresi',
  THIGH: 'Bacak çevresi',
  BODY_FAT_PERCENT: 'Vücut yağ oranı',
  MUSCLE_MASS: 'Kas kütlesi',
  BODY_WATER_PERCENT: 'Vücut su oranı',
};
