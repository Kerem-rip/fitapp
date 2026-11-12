// Öğün ve su günlüğü: danışanın kendi kayıtları. Kaydetmek için sağlık verisi rızası gerekir.
// Uzmanın erişimi çağıran tarafta (AccessService, MEALS / WATER kategorisi) kontrol edilir ve denetim kaydına yazılır.
// Kalori ve besin değerleri TAHMİNİDİR; uygulamanın yemek listesinden gelir, burada sadece makul sınırlar denetlenir.
import { Inject, Injectable } from '@nestjs/common';
import { badRequest, forbidden, notFound } from '../../common/app-error.js';
import { addLocalDays, isValidDay, localDay, localDayStart } from '../../common/local-day.js';
import { PrismaService } from '../../common/prisma/prisma.service.js';
import type { MealType } from '../../generated/prisma/enums.js';
import { ConsentsService } from '../consents/consents.service.js';

export interface MealInput {
  date?: string;
  mealType: MealType;
  foodKey?: string;
  name: string;
  portion: string;
  servings: number;
  // Bir porsiyonun tahmini değerleri
  perServing: { kcal: number; proteinG: number; carbsG: number; fatG: number };
}

const MAX_RANGE_DAYS = 31;
// Bir günde en fazla su (ml); yanlış dokunuşla absürt değerlerin önüne geçer
const MAX_WATER_PER_DAY = 10_000;
const MEAL_ORDER: MealType[] = ['BREAKFAST', 'LUNCH', 'SNACK', 'DINNER'];

const round1 = (n: number) => Math.round(n * 10) / 10;

type EntryRow = { id: string; date: string; mealType: MealType; foodKey: string | null; name: string; portion: string; servings: number; kcal: number; proteinG: number; carbsG: number; fatG: number; createdAt: Date };

function totalsOf(entries: readonly EntryRow[]) {
  const t = entries.reduce((s, e) => ({ kcal: s.kcal + e.kcal, proteinG: s.proteinG + e.proteinG, carbsG: s.carbsG + e.carbsG, fatG: s.fatG + e.fatG }), { kcal: 0, proteinG: 0, carbsG: 0, fatG: 0 });
  return { kcal: Math.round(t.kcal), proteinG: round1(t.proteinG), carbsG: round1(t.carbsG), fatG: round1(t.fatG) };
}

@Injectable()
export class FoodLogService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(ConsentsService) private readonly consents: ConsentsService,
  ) {}

  private async requireConsent(userId: string) {
    if (!(await this.consents.hasActive(userId, 'health_data'))) {
      throw forbidden('HEALTH_CONSENT_REQUIRED', 'Kayıt tutmak için önce Profil bölümünden sağlık verisi iznini vermelisin.');
    }
  }

  // Bugün ya da en fazla 30 gün öncesi (ileri tarihe kayıt olmaz)
  private checkDay(day: string) {
    const today = localDay();
    if (!isValidDay(day) || day > today || day < addLocalDays(today, -30)) throw badRequest('INVALID_DATE', 'Tarih bugün ya da son 30 gün içinde olmalı.');
  }

  async addMeal(userId: string, input: MealInput) {
    await this.requireConsent(userId);
    const date = input.date ?? localDay();
    this.checkDay(date);
    const p = input.perServing;
    // Tek porsiyon için makul üst sınırlar (yemek listesindeki en yüksek değerlerin rahatça üstü)
    if (p.kcal > 2500 || p.proteinG > 200 || p.carbsG > 400 || p.fatG > 250) throw badRequest('INVALID_VALUE', 'Besin değerleri geçerli görünmüyor.');
    const row = await this.prisma.mealEntry.create({
      data: {
        userId,
        date,
        mealType: input.mealType,
        foodKey: input.foodKey ?? null,
        name: input.name.trim(),
        portion: input.portion.trim(),
        servings: input.servings,
        kcal: round1(p.kcal * input.servings),
        proteinG: round1(p.proteinG * input.servings),
        carbsG: round1(p.carbsG * input.servings),
        fatG: round1(p.fatG * input.servings),
      },
    });
    return row;
  }

  // Danışan kendi kaydını silebilir (kendi günlüğü; uzman kaydı değildir)
  async removeMeal(userId: string, id: string) {
    const removed = await this.prisma.mealEntry.deleteMany({ where: { id, userId } });
    if (removed.count === 0) throw notFound('MEAL_NOT_FOUND', 'Kayıt bulunamadı.');
    return { id, removed: true };
  }

  // +250 / −250 gibi; günün toplamı eksiye düşmez
  async addWater(userId: string, amountMl: number) {
    await this.requireConsent(userId);
    const today = localDay();
    const current = await this.waterTotal(userId, today);
    const next = current + amountMl;
    if (next < 0) throw badRequest('INVALID_VALUE', 'Bugünkü su kaydı sıfırın altına inemez.');
    if (next > MAX_WATER_PER_DAY) throw badRequest('INVALID_VALUE', 'Bir günde bu kadar su kaydı olamaz.');
    await this.prisma.waterLog.create({ data: { userId, amountMl } });
    return { date: today, waterMl: next };
  }

  private async waterTotal(userId: string, day: string) {
    const agg = await this.prisma.waterLog.aggregate({
      where: { userId, loggedAt: { gte: localDayStart(day), lt: localDayStart(addLocalDays(day, 1)) } },
      _sum: { amountMl: true },
    });
    return Math.max(0, Math.round(agg._sum.amountMl ?? 0));
  }

  // Gün gün öğünler, tahmini toplamlar ve su. include: uzman sadece paylaşılan kategorileri görür.
  async days(userId: string, from: string, to: string, include: { meals: boolean; water: boolean } = { meals: true, water: true }) {
    if (!isValidDay(from) || !isValidDay(to) || from > to || to > addLocalDays(from, MAX_RANGE_DAYS - 1)) {
      throw badRequest('INVALID_RANGE', `Tarih aralığı geçerli değil (en fazla ${MAX_RANGE_DAYS} gün).`);
    }
    const [entries, water] = await Promise.all([
      include.meals
        ? this.prisma.mealEntry.findMany({ where: { userId, date: { gte: from, lte: to } }, orderBy: { createdAt: 'asc' } })
        : Promise.resolve([] as EntryRow[]),
      include.water
        ? this.prisma.waterLog.findMany({ where: { userId, loggedAt: { gte: localDayStart(from), lt: localDayStart(addLocalDays(to, 1)) } }, select: { amountMl: true, loggedAt: true } })
        : Promise.resolve([]),
    ]);
    const result: { date: string; meals: EntryRow[]; totals: ReturnType<typeof totalsOf>; waterMl: number | null }[] = [];
    for (let day = to; day >= from; day = addLocalDays(day, -1)) {
      const meals = entries.filter((e) => e.date === day).sort((a, b) => MEAL_ORDER.indexOf(a.mealType) - MEAL_ORDER.indexOf(b.mealType));
      const waterMl = include.water ? Math.max(0, Math.round(water.filter((w) => localDay(w.loggedAt) === day).reduce((s, w) => s + w.amountMl, 0))) : null;
      result.push({ date: day, meals, totals: totalsOf(meals), waterMl });
    }
    return result;
  }
}
