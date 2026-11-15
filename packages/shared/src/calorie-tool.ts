// Kalori aracı (kullanıcı için): amaç kartlarına göre günlük kalori, makro ve su hedefi. Tüm değerler TAHMİNİDİR, tıbbi tavsiye değildir.
// Kurallar:
//  - Haftalık hedef en fazla ~1 kg (günlük açık en fazla 1100 kcal); güvenli alt kalori sınırının altına inilmez.
//    (Kullanıcı kendi isteğiyle daha az yerse bu onun tercihidir; uygulama ona hedef olarak daha düşüğünü önermez.)
//  - 18 yaş altı, hamilelik, doktor kısıtı ya da yeme bozukluğu geçmişi olanlarda kalori hedefi VERİLMEZ; uzmana yönlendirilir.
//  - Zayıf (BMI < 18,5) kişiye kilo verme hedefi uygulanmaz.
//  - Emzirmede ek enerji eklenir, açık verilmez.
import { ACTIVITY_FACTORS, basalMetabolicRate, bmiOf, MIN_DAILY_KCAL, type ActivityLevel, type Sex } from './nutrition';

export type ToolGoal = 'lose' | 'gain' | 'maintain' | 'muscle' | 'athlete' | 'breastfeeding';
export type SportKind = 'gym' | 'endurance' | 'team' | 'combat' | 'other';

export const MAX_WEEKLY_LOSS_KG = 1;
const KCAL_PER_KG = 7700;
export const MAX_DAILY_DEFICIT = Math.round((MAX_WEEKLY_LOSS_KG * KCAL_PER_KG) / 7);
// Emziren kişi için alt sınır (kcal)
const BREASTFEEDING_FLOOR = 1800;

export interface ToolInput {
  sex: Sex;
  ageYears: number;
  heightCm: number;
  weightKg: number;
  activity: ActivityLevel;
  goal: ToolGoal;
  sport?: SportKind;
  // Emzirme dönemi: bebeğin ayı (0-24)
  breastfeedingMonths?: number;
  // Biliniyorsa yağ oranı (%): hesap Katch-McArdle ile yapılır
  bodyFatPercent?: number | null;
}

export type ToolNote = 'underweight_maintain_only' | 'floor_applied' | 'weekly_cap' | 'breastfeeding_extra' | 'breastfeeding_floor' | 'katch_used';

export interface ToolResult {
  method: 'mifflin' | 'katch';
  bmr: number;
  tdee: number;
  target: number;
  requestedGoal: ToolGoal;
  // Gerçekte uygulanan hedef (güvenlik kuralları değiştirmiş olabilir)
  goal: ToolGoal;
  deltaKcal: number;
  weeklyChangeKg: number;
  bmi: number;
  macros: { proteinG: number; carbsG: number; fatG: number };
  waterMl: number;
  notes: ToolNote[];
}

// Kalori hedefi VERİLEMEYEN durumlar
export type ToolBlock = 'teen' | 'pregnant' | 'medical' | 'eating_disorder';

export interface ToolScreening {
  ageYears: number;
  pregnant?: boolean;
  // Doktorun beslenme/egzersiz kısıtı (kalp, diyabet, böbrek, yüksek tansiyon vb.)
  medicalRestriction?: boolean;
  eatingDisorderHistory?: boolean;
}

export function screenTool(s: ToolScreening): ToolBlock[] {
  const blocks: ToolBlock[] = [];
  if (s.ageYears < 18) blocks.push('teen');
  if (s.pregnant) blocks.push('pregnant');
  if (s.medicalRestriction) blocks.push('medical');
  if (s.eatingDisorderHistory) blocks.push('eating_disorder');
  return blocks;
}

const PROTEIN_PER_KG: Record<Exclude<ToolGoal, 'athlete'>, number> = { lose: 1.8, muscle: 2.0, gain: 1.6, maintain: 1.4, breastfeeding: 1.3 };
const SPORT_PROTEIN: Record<SportKind, number> = { gym: 1.9, endurance: 1.5, team: 1.6, combat: 1.8, other: 1.6 };

const round = (n: number, step = 1) => Math.round(n / step) * step;

// Katch-McArdle: yağsız kütleden bazal metabolizma
export function katchMcArdleBmr(leanMassKg: number): number {
  return 370 + 21.6 * leanMassKg;
}

export function estimateTool(input: ToolInput): ToolResult {
  const notes: ToolNote[] = [];
  const bmi = bmiOf(input.weightKg, input.heightCm);
  const bf = input.bodyFatPercent ?? null;
  const useKatch = bf !== null && bf >= 3 && bf <= 60;
  const bmr = useKatch ? katchMcArdleBmr(input.weightKg * (1 - bf / 100)) : basalMetabolicRate(input);
  if (useKatch) notes.push('katch_used');
  const tdee = bmr * ACTIVITY_FACTORS[input.activity];

  let goal = input.goal;
  if (goal === 'lose' && bmi < 18.5) {
    goal = 'maintain';
    notes.push('underweight_maintain_only');
  }

  let delta = 0;
  if (goal === 'lose') {
    delta = -MAX_DAILY_DEFICIT;
    notes.push('weekly_cap');
  } else if (goal === 'gain') delta = 400;
  else if (goal === 'muscle') delta = 300;
  else if (goal === 'breastfeeding') {
    delta = (input.breastfeedingMonths ?? 0) <= 6 ? 330 : 400;
    notes.push('breastfeeding_extra');
  }

  let target = tdee + delta;
  const floor = MIN_DAILY_KCAL[input.sex];
  if (delta < 0 && target < floor) {
    target = floor;
    notes.push('floor_applied');
  }
  if (goal === 'breastfeeding' && target < BREASTFEEDING_FLOOR) {
    target = BREASTFEEDING_FLOOR;
    notes.push('breastfeeding_floor');
  }

  const perKg = goal === 'athlete' ? SPORT_PROTEIN[input.sport ?? 'other'] : PROTEIN_PER_KG[goal];
  const proteinG = Math.min(input.weightKg * perKg, (target * 0.35) / 4);
  const fatShare = goal === 'breastfeeding' ? 0.3 : goal === 'athlete' && input.sport === 'endurance' ? 0.25 : 0.27;
  const fatG = (target * fatShare) / 9;
  const carbsG = Math.max(0, (target - proteinG * 4 - fatG * 9) / 4);

  // Su: kilo başına 35 ml; emzirmede ve sporcuda ek
  const water = input.weightKg * 35 + (goal === 'breastfeeding' ? 700 : 0) + (goal === 'athlete' ? 500 : 0);
  const waterMl = Math.min(4500, Math.max(1500, round(water, 50)));

  const realDelta = target - tdee;
  return {
    method: useKatch ? 'katch' : 'mifflin',
    bmr: Math.round(bmr),
    tdee: Math.round(tdee),
    target: Math.round(target),
    requestedGoal: input.goal,
    goal,
    deltaKcal: Math.round(realDelta),
    weeklyChangeKg: Math.round(((realDelta * 7) / KCAL_PER_KG) * 100) / 100,
    bmi: Math.round(bmi * 10) / 10,
    macros: { proteinG: Math.round(proteinG), carbsG: Math.round(carbsG), fatG: Math.round(fatG) },
    waterMl,
    notes,
  };
}
