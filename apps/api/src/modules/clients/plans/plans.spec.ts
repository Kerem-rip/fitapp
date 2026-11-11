import { normalizePlanContent, planContentSchema, type PlanContent } from './plan-content.js';
import { diffPlans } from './plan-diff.js';
import { checkPlan, findConflicts } from './plan-rules.js';

const plan = (): PlanContent => ({
  title: 'Plan',
  targetKcal: 1800,
  meals: [
    {
      id: 'm1',
      name: 'Kahvaltı',
      time: '08:00',
      pick: 1,
      options: [
        { id: 'o1', name: 'Yulaf', portion: '1 kase', kcal: 250, allergens: ['gluten'] },
        { id: 'o2', name: 'Yumurta', portion: '2 adet', kcal: 160, allergens: ['egg'] },
        { id: 'o3', name: 'Meyve', portion: '1 porsiyon', allergens: [] },
      ],
    },
    { id: 'm2', name: 'Öğle', pick: 1, options: [{ id: 'o4', name: 'Mercimek', portion: '1 kase', allergens: null }] },
  ],
});

const NONE = { known: true, allergens: [] as string[] };

describe('plan içeriği', () => {
  it('eksik kimlikler üretilir, mevcut kimlikler korunur, alerjenler tekilleşir', () => {
    const parsed = planContentSchema.parse({
      meals: [{ id: 'keep', name: ' Kahvaltı ', pick: 1, options: [{ name: 'Yulaf', portion: '1 kase', allergens: ['gluten', 'gluten'] }] }],
    });
    const out = normalizePlanContent(parsed);
    expect(out.meals[0]!.id).toBe('keep');
    expect(out.meals[0]!.name).toBe('Kahvaltı');
    expect(out.meals[0]!.options[0]!.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(out.meals[0]!.options[0]!.allergens).toEqual(['gluten']);
  });

  it('geçersiz içerik reddedilir: bilinmeyen alerjen, kötü saat, çok öğün, tekrarlı kimlik', () => {
    const base = { name: 'Öğün', pick: 1, options: [{ name: 'A', portion: '1', allergens: [] }] };
    expect(planContentSchema.safeParse({ meals: [{ ...base, options: [{ name: 'A', portion: '1', allergens: ['uzay'] }] }] }).success).toBe(false);
    expect(planContentSchema.safeParse({ meals: [{ ...base, time: '25:00' }] }).success).toBe(false);
    expect(planContentSchema.safeParse({ meals: Array.from({ length: 9 }, () => base) }).success).toBe(false);
    expect(planContentSchema.safeParse({ meals: [{ ...base, pick: 0 }] }).success).toBe(false);
    expect(() => normalizePlanContent(planContentSchema.parse({ meals: [{ ...base, id: 'x' }, { ...base, id: 'x' }] }))).toThrow();
  });
});

describe('plan güvenlik kontrolleri', () => {
  it('alerji bilgisi bilinmiyorsa onaylanamaz', () => {
    const codes = checkPlan(plan(), { known: false, allergens: [] }).map((b) => b.code);
    expect(codes).toContain('ALLERGY_INFO_MISSING');
  });

  it('"Alerjim yok" beyanında alerjen bilgisi girilmemiş seçenek sorun değildir', () => {
    expect(checkPlan(plan(), NONE)).toEqual([]);
  });

  it('beyan edilen alerjeni içeren seçenek ve alerjeni belirtilmemiş seçenek onayı engeller', () => {
    const blockers = checkPlan(plan(), { known: true, allergens: ['egg'] });
    expect(blockers.map((b) => b.code).sort((a, b) => a.localeCompare(b))).toEqual(['ALLERGEN_CONFLICT', 'ALLERGEN_UNKNOWN']);
    expect(blockers.find((b) => b.code === 'ALLERGEN_CONFLICT')).toMatchObject({ mealId: 'm1', optionId: 'o2' });
    expect(blockers.find((b) => b.code === 'ALLERGEN_CONFLICT')!.message).toContain('Yumurta');
    expect(findConflicts(plan(), { known: true, allergens: ['egg', 'gluten'] }).map((c) => c.optionId)).toEqual(['o1', 'o2', 'o4']);
  });

  it('alerji bilinmiyorken çakışma hesaplanmaz', () => {
    expect(findConflicts(plan(), { known: false, allergens: ['egg'] })).toEqual([]);
  });

  it('boş plan, seçeneksiz öğün ve fazla seçim sayısı engellenir', () => {
    expect(checkPlan({ meals: [] }, NONE).map((b) => b.code)).toEqual(['EMPTY_PLAN']);
    const p: PlanContent = { meals: [{ id: 'a', name: 'A', pick: 1, options: [] }, { id: 'b', name: 'B', pick: 3, options: [{ id: 'x', name: 'X', portion: '1', allergens: [] }] }] };
    expect(checkPlan(p, NONE).map((b) => b.code)).toEqual(['MEAL_WITHOUT_OPTIONS', 'PICK_TOO_HIGH']);
  });
});

describe('sürüm farkı', () => {
  it('ilk sürüm', () => {
    expect(diffPlans(null, plan())).toEqual(['İlk sürüm: 2 öğün, 4 seçenek']);
  });

  it('değişiklik yoksa belirtir', () => {
    expect(diffPlans(plan(), plan())).toEqual(['İçerikte değişiklik yok']);
  });

  it('eklenen, kaldırılan ve değişen her şeyi satır satır yazar', () => {
    const after = plan();
    after.targetKcal = 1900;
    after.meals[0]!.options = after.meals[0]!.options.filter((o) => o.id !== 'o2');
    after.meals[0]!.options[0]!.portion = '2 kase';
    after.meals[0]!.options[1]!.allergens = ['milk'];
    after.meals[0]!.options.push({ id: 'o9', name: 'Ceviz', portion: '1 avuç', allergens: ['tree_nut'] });
    after.meals.push({ id: 'm3', name: 'Akşam', pick: 1, options: [] });
    after.meals = after.meals.filter((m) => m.id !== 'm2');
    const lines = diffPlans(plan(), after);
    expect(lines).toEqual(
      expect.arrayContaining([
        'Hedef kalori 1800 → 1900',
        'Öğün kaldırıldı: "Öğle"',
        'Öğün eklendi: "Akşam" (0 seçenek)',
        '"Kahvaltı": seçenek kaldırıldı "Yumurta"',
        '"Kahvaltı" › "Yulaf": porsiyon "1 kase" → "2 kase"',
        '"Kahvaltı" › "Meyve": alerjen yok → Süt',
        '"Kahvaltı": seçenek eklendi "Ceviz"',
      ]),
    );
  });
});
