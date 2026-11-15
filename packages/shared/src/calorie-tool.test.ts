import { describe, expect, it } from 'vitest';
import { analyzeDay } from './day-analysis';
import { bodyFatCategory, estimateBodyComposition, navyBodyFatPercent } from './body';
import { estimateTool, MAX_DAILY_DEFICIT, screenTool, type ToolInput } from './calorie-tool';
import { MIN_DAILY_KCAL } from './nutrition';
import { LANE_LABELS, mealOptions, routineOptions, SLOT_INFO } from './routines';

const woman: ToolInput = { sex: 'female', ageYears: 28, heightCm: 165, weightKg: 72, activity: 'moderate', goal: 'maintain' };
const man: ToolInput = { sex: 'male', ageYears: 30, heightCm: 180, weightKg: 85, activity: 'moderate', goal: 'maintain' };

describe('kalori aracı', () => {
  it('haftalık hedef en fazla ~1 kg: günlük açık 1100 kcal ile sınırlıdır', () => {
    expect(MAX_DAILY_DEFICIT).toBe(1100);
    const r = estimateTool({ ...man, goal: 'lose' });
    expect(r.deltaKcal).toBe(-1100);
    expect(r.weeklyChangeKg).toBeGreaterThanOrEqual(-1);
    expect(r.weeklyChangeKg).toBeLessThan(-0.95);
    expect(r.notes).toContain('weekly_cap');
  });

  it('hedef güvenli alt sınırın altına inmez; gerçek haftalık değişim yeniden hesaplanır', () => {
    const r = estimateTool({ ...woman, goal: 'lose' });
    expect(r.tdee).toBe(2248);
    expect(r.target).toBe(MIN_DAILY_KCAL.female);
    expect(r.notes).toContain('floor_applied');
    expect(r.weeklyChangeKg).toBeGreaterThan(-1);
  });

  it('zayıf kişiye kilo verme hedefi uygulanmaz', () => {
    const r = estimateTool({ ...woman, weightKg: 45, heightCm: 170, goal: 'lose' });
    expect(r.goal).toBe('maintain');
    expect(r.requestedGoal).toBe('lose');
    expect(r.target).toBe(r.tdee);
    expect(r.notes).toContain('underweight_maintain_only');
  });

  it('kilo alma ve kas yapma fazla kalori verir; koruma ihtiyaca eşittir', () => {
    expect(estimateTool({ ...man, goal: 'gain' }).deltaKcal).toBe(400);
    expect(estimateTool({ ...man, goal: 'muscle' }).deltaKcal).toBe(300);
    const m = estimateTool(man);
    expect(m.target).toBe(m.tdee);
  });

  it('emzirmede ek enerji eklenir, açık verilmez ve alt sınır vardır', () => {
    const early = estimateTool({ ...woman, goal: 'breastfeeding', breastfeedingMonths: 3 });
    const late = estimateTool({ ...woman, goal: 'breastfeeding', breastfeedingMonths: 9 });
    expect(early.deltaKcal).toBe(330);
    expect(late.deltaKcal).toBe(400);
    expect(early.notes).toContain('breastfeeding_extra');
    expect(estimateTool({ ...woman, weightKg: 52, heightCm: 158, ageYears: 40, activity: 'sedentary', goal: 'breastfeeding', breastfeedingMonths: 2 }).target).toBeGreaterThanOrEqual(1800);
    expect(early.waterMl).toBeGreaterThan(estimateTool(woman).waterMl);
  });

  it('sporcu türüne göre protein ve su ayarlanır', () => {
    const gym = estimateTool({ ...man, goal: 'athlete', sport: 'gym' });
    const run = estimateTool({ ...man, goal: 'athlete', sport: 'endurance' });
    expect(gym.macros.proteinG).toBeGreaterThan(run.macros.proteinG);
    expect(run.macros.carbsG).toBeGreaterThan(gym.macros.carbsG - 50);
    expect(gym.waterMl).toBeGreaterThan(estimateTool(man).waterMl);
  });

  it('yağ oranı biliniyorsa Katch-McArdle ile hesaplanır', () => {
    const r = estimateTool({ ...man, bodyFatPercent: 20 });
    expect(r.method).toBe('katch');
    expect(r.bmr).toBe(Math.round(370 + 21.6 * 68));
    expect(r.notes).toContain('katch_used');
  });

  it('18 yaş altı, hamilelik, doktor kısıtı ve yeme bozukluğu geçmişinde hedef verilmez', () => {
    expect(screenTool({ ageYears: 16 })).toEqual(['teen']);
    expect(screenTool({ ageYears: 30, pregnant: true })).toEqual(['pregnant']);
    expect(screenTool({ ageYears: 30, medicalRestriction: true, eatingDisorderHistory: true })).toEqual(['medical', 'eating_disorder']);
    expect(screenTool({ ageYears: 30 })).toEqual([]);
  });
});

describe('vücut kompozisyonu tahmini', () => {
  it('ABD Donanması formülü bilinen değerlere yakın sonuç verir', () => {
    expect(navyBodyFatPercent({ sex: 'male', heightCm: 180, weightKg: 85, waistCm: 90, neckCm: 38 })).toBeCloseTo(19.8, 0);
    expect(navyBodyFatPercent({ sex: 'female', heightCm: 165, weightKg: 72, waistCm: 75, neckCm: 32, hipCm: 100 })).toBeCloseTo(30, 0);
  });

  it('kadında kalça gerekir; bel boyundan küçükse ve değerler makul değilse hata döner', () => {
    expect(navyBodyFatPercent({ sex: 'female', heightCm: 165, weightKg: 70, waistCm: 75, neckCm: 32 })).toBe('hip_required');
    expect(navyBodyFatPercent({ sex: 'male', heightCm: 180, weightKg: 80, waistCm: 35, neckCm: 40 })).toBe('range');
    expect(navyBodyFatPercent({ sex: 'male', heightCm: 180, weightKg: 80, waistCm: 80, neckCm: 85 })).toBe('range');
  });

  it('yağ ve yağsız kütle toplamı kiloya eşittir; kategori cinsiyete göre', () => {
    const r = estimateBodyComposition({ sex: 'male', heightCm: 180, weightKg: 85, waistCm: 90, neckCm: 38 });
    if (typeof r === 'string') throw new Error(r);
    expect(r.fatMassKg + r.leanMassKg).toBeCloseTo(85, 0);
    expect(r.waistToHeight).toBe(0.5);
    expect(bodyFatCategory('male', 22)).toBe('average');
    expect(bodyFatCategory('female', 22)).toBe('fit');
  });
});

describe('gün sonu analizi', () => {
  const base = { goal: 'lose' as const, targetKcal: 1800, targetProteinG: 120, waterGoalMl: 2500, floorKcal: 1200, eaten: { kcal: 1750, proteinG: 110, carbsG: 180, fatG: 55 }, mealCount: 3, waterMl: 2500, workoutsDone: 1, workoutMinutes: 30, burnedKcal: 200, tasksDone: 4, tasksTotal: 4 };

  it('kayıt yoksa nazik bir yönlendirme verir', () => {
    const a = analyzeDay({ ...base, mealCount: 0, waterMl: 0, workoutsDone: 0, tasksDone: 0, eaten: { kcal: 0, proteinG: 0, carbsG: 0, fatG: 0 } });
    expect(a.empty).toBe(true);
    expect(a.insights).toHaveLength(1);
  });

  it('hedefe yakın bir gün olumlu bildirimler üretir', () => {
    const a = analyzeDay(base);
    expect(a.insights.some((i) => i.topic === 'kcal' && i.level === 'good')).toBe(true);
    expect(a.insights.some((i) => i.topic === 'water' && i.level === 'good')).toBe(true);
    expect(a.insights.some((i) => i.topic === 'tasks' && i.text.includes('Tüm görevlerini'))).toBe(true);
  });

  it('çok az yemek engellenmez ama sakin bir uyarı verilir; protein ve su da değerlendirilir', () => {
    const a = analyzeDay({ ...base, eaten: { kcal: 900, proteinG: 40, carbsG: 90, fatG: 30 }, waterMl: 800 });
    expect(a.balanceKcal).toBe(-900);
    const warn = a.insights.find((i) => i.topic === 'kcal' && i.level === 'warn')!;
    expect(warn.text).toContain('tercihin');
    expect(a.insights.some((i) => i.topic === 'protein')).toBe(true);
    expect(a.insights.some((i) => i.topic === 'water' && i.level === 'info')).toBe(true);
  });

  it('yorumlar tanı koymaz ve tahmin uyarısı içerir', () => {
    const a = analyzeDay(base);
    expect(a.insights.at(-1)!.text).toContain('tıbbi tavsiye değildir');
  });
});

describe('günün düzeni önerileri', () => {
  const p = { sex: 'female' as const, goal: 'maintain' as const, targetKcal: 1900 };

  it('her saat diliminde üç şerit (bakım, egzersiz, yemek) ayrı ve dolu gelir', () => {
    const all = routineOptions(p);
    for (const slot of SLOT_INFO) {
      for (const lane of Object.keys(LANE_LABELS)) {
        expect(all.some((o) => o.slot === slot.key && o.lane === lane), `${slot.key}/${lane}`).toBe(true);
      }
    }
    expect(new Set(all.map((o) => o.id)).size).toBe(all.length);
  });

  it('yemek önerilerinin besin değerleri kalemlerin toplamıdır ve kahvaltı sabaha düşer', () => {
    const m = mealOptions(p, 'morning');
    expect(m.length).toBeGreaterThan(0);
    for (const o of m) {
      const kcal = o.items!.reduce((s, i) => s + i.kcal, 0);
      expect(Math.abs(o.nutrients!.kcal - kcal)).toBeLessThanOrEqual(o.items!.length);
      expect(o.nutrients!.proteinG).toBeGreaterThan(0);
    }
  });

  it('kadına ve erkeğe farklı sıralanır; sporcu türüne göre değişir', () => {
    const first = (opts: ReturnType<typeof routineOptions>) => opts.find((o) => o.slot === 'afternoon' && o.lane === 'exercise')!.refId;
    expect(first(routineOptions({ ...p, sex: 'female' }))).toBe('hip-beginner');
    expect(first(routineOptions({ ...p, sex: 'male' }))).toBe('chest-home');
    expect(first(routineOptions({ ...p, goal: 'athlete', sport: 'gym', sex: 'male' }))).toBe('chest-gym');
    expect(first(routineOptions({ ...p, goal: 'athlete', sport: 'endurance' }))).toBe('cardio-steady');
  });

  it('alerji ve diyet tercihi yemek önerilerine uygulanır', () => {
    const vegan = mealOptions({ ...p, diet: 'vegan' }, 'morning');
    for (const o of vegan) expect(o.subtitle).not.toMatch(/yumurta|peynir|omlet/i);
  });
});
