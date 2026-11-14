// Enerji tahminleri. Sunucunun @fitapp/shared'a bağımlılığı yoktur; formül ve katsayılar
// packages/shared/src/nutrition.ts (Mifflin-St Jeor) ile AYNI tutulmalıdır.
// Tüm değerler TAHMİNDİR; ölçüm ya da garanti değildir.
import { workSeconds } from '../library/library-rules.js';
import type { Work } from '../library/catalog.js';

export type Sex = 'female' | 'male' | 'other';

export const bmiOf = (weightKg: number, heightCm: number) => weightKg / (heightCm / 100) ** 2;

export function basalMetabolicRate(i: { sex: Sex; ageYears: number; heightCm: number; weightKg: number }): number {
  const base = 10 * i.weightKg + 6.25 * i.heightCm - 5 * i.ageYears;
  return base + (i.sex === 'male' ? 5 : i.sex === 'female' ? -161 : -78);
}

// Günlük hareket düzeyi → faaliyet katsayısı (antrenman günleri ayrıca hesaplanır; bu yüzden günlük hareket antrenmansız düzeydir)
export const ACTIVITY_FACTOR = { SEDENTARY: 1.2, LIGHT: 1.375, MODERATE: 1.55, ACTIVE: 1.725 } as const;

export function dailyEnergyEstimate(i: { sex: Sex; ageYears: number; heightCm: number; weightKg: number; dailyActivity: keyof typeof ACTIVITY_FACTOR }) {
  const bmr = basalMetabolicRate(i);
  return { bmr: Math.round(bmr), tdee: Math.round(bmr * ACTIVITY_FACTOR[i.dailyActivity]) };
}

// Bir hareketin tahmini enerji harcaması: MET × kilo × süre(saat). Dinlenme süresi düşük MET sayılır.
export function entryKcal(work: Work, met: number, weightKg: number): number {
  const totalMin = workSeconds(work) / 60;
  const restMin = (Math.max(0, work.sets - 1) * work.restSec) / 60;
  const activeMin = Math.max(0, totalMin - restMin);
  return (met * weightKg * activeMin) / 60 + (1.5 * weightKg * restMin) / 60;
}
