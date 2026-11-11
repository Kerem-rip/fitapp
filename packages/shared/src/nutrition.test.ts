import { describe, expect, it } from 'vitest';
import {
  ALLERGENS,
  estimateCalories,
  isFoodAllowed,
  MIN_DAILY_KCAL,
  suggestMenu,
  validateCalorieInput,
  type Allergen,
  type CalorieInput,
  type DietPreference,
} from './nutrition';
import { SEED_FOODS } from './seed/foods';
import { ageGroupOf, parseTrDate, validateUsername } from './validation';

const adult: CalorieInput = {
  sex: 'female',
  ageYears: 28,
  heightCm: 165,
  weightKg: 72,
  activity: 'moderate',
  goal: 'lose',
};

describe('kalori hesabı', () => {
  it('Mifflin-St Jeor ile günlük ihtiyacı ve kilo verme hedefini hesaplar', () => {
    const r = estimateCalories(adult);
    expect(r.bmr).toBe(1450);
    expect(r.tdee).toBe(2248);
    expect(r.target).toBeGreaterThan(1700);
    expect(r.target).toBeLessThan(1850);
    expect(r.weeklyChangeKg).toBeLessThan(0);
    expect(r.notes).toContain('fast_loss_capped');
  });

  it('hedef güvenli alt sınırın altına inmez', () => {
    const r = estimateCalories({ ...adult, ageYears: 60, heightCm: 150, weightKg: 52, activity: 'sedentary' });
    expect(r.target).toBeGreaterThanOrEqual(MIN_DAILY_KCAL.female);
    expect(r.notes).toContain('floor_applied');
  });

  it('18 yaş altında kilo verme hedefi uygulanmaz', () => {
    const r = estimateCalories({ ...adult, ageYears: 15 });
    expect(r.goal).toBe('maintain');
    expect(r.target).toBe(r.tdee);
    expect(r.notes).toContain('teen_maintain_only');
  });

  it('zayıf kullanıcıya kilo verme hedefi uygulanmaz', () => {
    const r = estimateCalories({ ...adult, weightKg: 45, heightCm: 170 });
    expect(r.bmi).toBeLessThan(18.5);
    expect(r.goal).toBe('maintain');
    expect(r.notes).toContain('underweight_maintain_only');
  });

  it('kas yapma ve kilo alma hedefleri fazla kalori verir', () => {
    expect(estimateCalories({ ...adult, goal: 'gain' }).deltaKcal).toBe(300);
    expect(estimateCalories({ ...adult, goal: 'muscle' }).deltaKcal).toBe(250);
  });

  it('makrolar hedef kaloriyi yaklaşık olarak tutar', () => {
    const r = estimateCalories(adult);
    const kcal = r.macros.proteinG * 4 + r.macros.carbsG * 4 + r.macros.fatG * 9;
    expect(Math.abs(kcal - r.target)).toBeLessThan(25);
  });

  it('geçersiz girişleri yakalar', () => {
    expect(validateCalorieInput({ ...adult, ageYears: 5 })).toBe('age');
    expect(validateCalorieInput({ ...adult, heightCm: 20 })).toBe('height');
    expect(validateCalorieInput({ ...adult, weightKg: 900 })).toBe('weight');
    expect(validateCalorieInput(adult)).toBeNull();
  });
});

describe('örnek menü', () => {
  const targets = [1400, 1800, 2200, 2800];
  const cases: { name: string; allergens: Allergen[]; diet: DietPreference }[] = [
    { name: 'filtresiz', allergens: [], diet: 'none' },
    { name: 'gluten', allergens: ['gluten'], diet: 'none' },
    { name: 'süt ve yumurta', allergens: ['milk', 'egg'], diet: 'none' },
    { name: 'yemiş ve susam', allergens: ['peanut', 'tree_nut', 'sesame'], diet: 'none' },
    { name: 'vejetaryen', allergens: [], diet: 'vegetarian' },
    { name: 'vegan', allergens: [], diet: 'vegan' },
    { name: 'gluten ve fıstık', allergens: ['gluten', 'peanut'], diet: 'none' },
  ];

  for (const c of cases) {
    it(`${c.name}: alerjen içermez ve hedefe yakın kalır`, () => {
      for (const targetKcal of targets) {
        for (const variant of [0, 1, 2, 3]) {
          const menu = suggestMenu(SEED_FOODS, { targetKcal, allergens: c.allergens, diet: c.diet, variant });
          expect(menu.emptySlots).toEqual([]);
          for (const slot of menu.slots) {
            for (const item of slot.items) {
              expect(isFoodAllowed(item.food, c.allergens, c.diet)).toBe(true);
              expect(item.food.allergens.some((a) => c.allergens.includes(a))).toBe(false);
            }
          }
          expect(Math.abs(menu.totalKcal - targetKcal) / targetKcal).toBeLessThan(0.22);
        }
      }
    });
  }

  it('alerjisi olan kullanıcıya alerjen bilgisi eksik yemek önerilmez', () => {
    const incomplete = SEED_FOODS.filter((f) => !f.allergenInfoComplete);
    expect(incomplete.length).toBeGreaterThan(0);
    for (const food of incomplete) {
      expect(isFoodAllowed(food, ['gluten'], 'none')).toBe(false);
      expect(isFoodAllowed(food, [], 'none')).toBe(true);
    }
  });

  it('aynı gün içinde aynı yemeği tekrar etmez (yeterli seçenek varken)', () => {
    for (const variant of [0, 1, 2, 3]) {
      const menu = suggestMenu(SEED_FOODS, { targetKcal: 1800, variant });
      const ids = menu.slots.flatMap((s) => s.items.map((i) => i.food.id));
      expect(new Set(ids).size).toBe(ids.length);
    }
  });

  it('"başka öner" farklı menü üretir', () => {
    const a = suggestMenu(SEED_FOODS, { targetKcal: 1800, variant: 0 });
    const b = suggestMenu(SEED_FOODS, { targetKcal: 1800, variant: 1 });
    const names = (m: typeof a) => m.slots.flatMap((s) => s.items.map((i) => i.food.id)).join(',');
    expect(names(a)).not.toBe(names(b));
  });

  it('çok sert filtrelerde de alerjen içermez', () => {
    const menu = suggestMenu(SEED_FOODS, { targetKcal: 1800, allergens: [...ALLERGENS], diet: 'vegan' });
    for (const slot of menu.slots) {
      for (const item of slot.items) expect(item.food.allergens).toEqual([]);
    }
  });

  it('hiç uygun yemek kalmazsa çökmez, boş öğünleri bildirir', () => {
    const onlyMilk = SEED_FOODS.filter((f) => f.allergens.includes('milk'));
    const menu = suggestMenu(onlyMilk, { targetKcal: 1800, allergens: ['milk'] });
    expect(menu.emptySlots).toEqual(['breakfast', 'lunch', 'snack', 'dinner']);
    expect(menu.totalKcal).toBe(0);
  });
});

describe('kayıt kuralları', () => {
  it('yaş grubunu doğum tarihinden hesaplar', () => {
    const now = new Date(Date.UTC(2026, 10, 11));
    expect(ageGroupOf(new Date(Date.UTC(2014, 5, 1)), now)).toBe('CHILD');
    expect(ageGroupOf(new Date(Date.UTC(2011, 5, 1)), now)).toBe('TEEN');
    expect(ageGroupOf(new Date(Date.UTC(2008, 10, 11)), now)).toBe('ADULT');
    expect(ageGroupOf(new Date(Date.UTC(2008, 10, 12)), now)).toBe('TEEN');
  });

  it('kullanıcı adı kurallarını uygular', () => {
    expect(validateUsername('ayse_k')).toBeNull();
    expect(validateUsername('a b')).not.toBeNull();
    expect(validateUsername('admin')).not.toBeNull();
  });

  it('GG.AA.YYYY tarihini çözer, geçersizi reddeder', () => {
    expect(parseTrDate('15.03.1998')?.getUTCFullYear()).toBe(1998);
    expect(parseTrDate('31.02.1998')).toBeNull();
    expect(parseTrDate('1998-03-15')).toBeNull();
    expect(parseTrDate('15.03.2999')).toBeNull();
  });
});
