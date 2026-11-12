import type { SharedDataType } from '../../../generated/prisma/enums.js';
import type { AnswerValue } from '../intake-template.js';
import { evaluate, RULES, RULE_PARAMS, type MeasurementPoint, type RuleInput } from './rules.js';

const NOW = new Date('2026-06-01T12:00:00Z');
const daysAgo = (n: number) => new Date(NOW.getTime() - n * 86_400_000);

const ALL: SharedDataType[] = ['WEIGHT', 'MEASUREMENTS', 'ANAMNESIS'];

function input(overrides: {
  allowed?: SharedDataType[];
  answers?: Record<string, { value: AnswerValue; daysAgo?: number }>;
  measurements?: Partial<MeasurementPoint>[];
  sharedUntil?: Date | null;
  plan?: RuleInput['plan'];
} = {}): RuleInput {
  return {
    plan: overrides.plan ?? null,
    now: NOW,
    allowed: new Set(overrides.allowed ?? ALL),
    sharedUntil: overrides.sharedUntil ?? null,
    answers: new Map(
      Object.entries(overrides.answers ?? {}).map(([key, a]) => [key, { value: a.value, answeredAt: daysAgo(a.daysAgo ?? 1) }]),
    ),
    measurements: (overrides.measurements ?? []).map((m, i) => ({
      id: `m${i}`,
      kind: 'WEIGHT',
      value: 70,
      method: 'SCALE',
      takenAt: daysAgo(1),
      ...m,
    })),
  };
}

const codes = (i: RuleInput) => evaluate(i).map((c) => c.ruleCode);
const find = (i: RuleInput, code: string) => evaluate(i).filter((c) => c.ruleCode === code);

// Önemli soruların hepsi yanıtlı (eksik maddesi çıkmasın)
const IMPORTANT = {
  'std.allergies': { value: ['none'] as string[] },
  'std.conditions': { value: ['none'] as string[] },
  'std.medications': { value: 'yok' },
  'std.pregnancy': { value: 'no' },
  'std.eating_disorder_history': { value: 'no' },
};

describe('inceleme kuralları', () => {
  it('kural kodları benzersiz; şimdilik hepsi mekanik (klinik kural yok)', () => {
    const list = RULES.map((r) => r.code);
    expect(new Set(list).size).toBe(list.length);
    expect(RULES.every((r) => r.kind === 'MECHANICAL')).toBe(true);
  });

  it('hiç veri yokken paylaşım kapalıysa sadece "paylaşılmıyor" maddeleri çıkar (kesin sonuç üretilmez)', () => {
    const result = evaluate(input({ allowed: [] }));
    expect(result.map((c) => c.ruleCode)).toEqual(['Y-NOT-SHARED', 'Y-NOT-SHARED', 'Y-NOT-SHARED']);
    expect(result.every((c) => c.level === 'YELLOW' && c.categories.length === 0)).toBe(true);
  });

  it('kırmızı: yeme bozukluğu beyanı; her maddenin dayanağı vardır', () => {
    const r = find(input({ answers: { ...IMPORTANT, 'std.eating_disorder_history': { value: 'yes' } } }), 'R-EATING-DISORDER');
    expect(r).toHaveLength(1);
    expect(r[0]).toMatchObject({ level: 'RED', categories: ['ANAMNESIS'] });
    expect(r[0]!.basis[0]).toMatchObject({ type: 'ANSWER', display: 'Evet' });
    expect(find(input({ answers: IMPORTANT }), 'R-EATING-DISORDER')).toHaveLength(0);
    // Yanıt yoksa kırmızı değil, sarı "sorulmadı" maddesi çıkar
    expect(find(input({ answers: {} }), 'R-EATING-DISORDER')).toHaveLength(0);
  });

  it('kırmızı: yayındaki plan, danışanın (sonradan değişen) alerjisiyle çakışıyorsa; dayanakta plan ve alerji yanıtı vardır', () => {
    const plan = {
      versionNumber: 2,
      content: {
        meals: [
          {
            id: 'm1',
            name: 'Kahvaltı',
            pick: 1,
            options: [
              { id: 'o1', name: 'Omlet', portion: '2 adet', allergens: ['egg'] },
              { id: 'o2', name: 'Meyve', portion: '1 porsiyon', allergens: [] },
              { id: 'o3', name: 'Bilinmeyen', portion: '1', allergens: null },
            ],
          },
        ],
      },
    };
    const r = find(input({ answers: { ...IMPORTANT, 'std.allergies': { value: ['egg'] } }, plan }), 'R-PLAN-ALLERGEN');
    expect(r.map((c) => c.key.split(':')[2]).sort((a, b) => a.localeCompare(b))).toEqual(['o1', 'o3']);
    expect(r[0]).toMatchObject({ level: 'RED', categories: ['ANAMNESIS'] });
    expect(r[0]!.detail).toContain('Yumurta');
    expect(r[0]!.basis.map((b) => b.type)).toEqual(['ANSWER', 'PLAN']);

    // Alerji yok ya da plan yoksa madde çıkmaz
    expect(find(input({ answers: IMPORTANT, plan }), 'R-PLAN-ALLERGEN')).toHaveLength(0);
    expect(find(input({ answers: { ...IMPORTANT, 'std.allergies': { value: ['egg'] } } }), 'R-PLAN-ALLERGEN')).toHaveLength(0);
  });

  describe('hedef ve gelişim', () => {
    const goal = (over: Partial<import('./rules.js').GoalPoint> = {}) => ({
      id: 'g1',
      title: 'Kilo hedefi',
      measurementKind: 'WEIGHT' as const,
      startValue: 80,
      targetValue: 72,
      startDate: daysAgo(30),
      targetDate: null,
      ...over,
    });

    it('yeterli süre geçtiği hâlde hedefe yaklaşılmadıysa plan dayatmadan inceleme soruları önerir', () => {
      const i = input({ measurements: [{ id: 'w2', value: 80.5, takenAt: daysAgo(2) }, { id: 'w1', value: 79, takenAt: daysAgo(15) }] });
      const r = find({ ...i, goals: [goal()], adherence: { daysWithChoices: 4, windowDays: 14 } }, 'Y-GOAL-NO-PROGRESS');
      expect(r).toHaveLength(1);
      expect(r[0]!.detail).toContain('Yeni bir plan yazmadan önce');
      expect(r[0]!.detail).toContain('14 günde 4 gün');
      expect(r[0]!.detail).not.toMatch(/yeni plan (hazırla|uygula)/i);
      expect(r[0]!.basis.map((b) => b.type)).toEqual(['MEASUREMENT', 'MEASUREMENT', 'PLAN']);
    });

    it('hedefe yaklaşılıyorsa, süre kısaysa ya da kategori paylaşılmıyorsa madde çıkmaz', () => {
      const closer = input({ measurements: [{ value: 77, takenAt: daysAgo(2) }] });
      expect(find({ ...closer, goals: [goal()] }, 'Y-GOAL-NO-PROGRESS')).toHaveLength(0);
      const early = input({ measurements: [{ value: 81, takenAt: daysAgo(2) }] });
      expect(find({ ...early, goals: [goal({ startDate: daysAgo(10) })] }, 'Y-GOAL-NO-PROGRESS')).toHaveLength(0);
      const hidden = input({ allowed: ['ANAMNESIS'], measurements: [{ value: 81, takenAt: daysAgo(2) }] });
      expect(find({ ...hidden, goals: [goal()] }, 'Y-GOAL-NO-PROGRESS')).toHaveLength(0);
    });

    it('hedeften sonra ölçüm yoksa ve hedef tarihi geçtiyse uyarır; hedefe ulaşılınca yeşil öneri çıkar', () => {
      const none = input({ measurements: [{ value: 80, takenAt: daysAgo(40) }] });
      expect(find({ ...none, goals: [goal({ startDate: daysAgo(20) })] }, 'Y-GOAL-NO-MEASUREMENT')).toHaveLength(1);
      expect(find({ ...none, goals: [goal({ targetDate: daysAgo(1) })] }, 'Y-GOAL-OVERDUE')).toHaveLength(1);
      const reached = input({ measurements: [{ value: 71.8, takenAt: daysAgo(1) }] });
      expect(find({ ...reached, goals: [goal()] }, 'G-GOAL-REACHED')).toHaveLength(1);
      // Kilo alma hedefi (yukarı yönlü)
      const up = input({ measurements: [{ value: 61, takenAt: daysAgo(1) }] });
      expect(find({ ...up, goals: [goal({ startValue: 55, targetValue: 60 })] }, 'G-GOAL-REACHED')).toHaveLength(1);
    });
  });

  describe('antrenman', () => {
    const log = (over: Partial<import('./rules.js').WorkoutPoint> = {}) => ({ id: 'l1', date: daysAgo(2).toISOString().slice(0, 10), pain: false, painNote: null, rpe: 6, ...over });

    it('ağrı bildirimi kırmızı madde olur; eski bildirim ve paylaşılmayan kayıtlar madde üretmez', () => {
      const base = input();
      const r = find({ ...base, workouts: { logs: [log({ pain: true, painNote: 'Dizimde ağrı' })], programApprovedAt: null } }, 'R-PAIN-REPORTED');
      expect(r).toHaveLength(1);
      expect(r[0]).toMatchObject({ level: 'RED', categories: ['WORKOUTS'] });
      expect(r[0]!.detail).toContain('Dizimde ağrı');
      const old = log({ pain: true, date: daysAgo(40).toISOString().slice(0, 10) });
      expect(find({ ...base, workouts: { logs: [old], programApprovedAt: null } }, 'R-PAIN-REPORTED')).toHaveLength(0);
      expect(find({ ...base, workouts: null }, 'R-PAIN-REPORTED')).toHaveLength(0);
    });

    it('program yayında ve son 14 günde kayıt yoksa sorulacakları önerir; yeni yayınlanmış programda bekler', () => {
      const base = input();
      const stale = { logs: [log({ date: daysAgo(20).toISOString().slice(0, 10) })], programApprovedAt: daysAgo(30) };
      const r = find({ ...base, workouts: stale }, 'Y-NO-WORKOUT-LOGS');
      expect(r).toHaveLength(1);
      expect(r[0]!.detail).toContain('Programı değiştirmeden önce');
      expect(find({ ...base, workouts: { logs: [log()], programApprovedAt: daysAgo(30) } }, 'Y-NO-WORKOUT-LOGS')).toHaveLength(0);
      expect(find({ ...base, workouts: { logs: [], programApprovedAt: daysAgo(3) } }, 'Y-NO-WORKOUT-LOGS')).toHaveLength(0);
      expect(find({ ...base, workouts: { logs: [], programApprovedAt: null } }, 'Y-NO-WORKOUT-LOGS')).toHaveLength(0);
    });
  });

  describe('öğün kaydı', () => {
    const today = NOW.toISOString().slice(0, 10);
    const day = (n: number) => daysAgo(n).toISOString().slice(0, 10);

    it('son 3 günde öğün kaydı yoksa sorulacakları önerir; kayıt varsa, danışanlık yeniyse ya da paylaşılmıyorsa çıkmaz', () => {
      const base = { ...input(), professionalType: 'DIETITIAN' as const };
      const r = find({ ...base, meals: { lastDay: day(4), today, relationshipSince: daysAgo(20) } }, 'Y-NO-MEAL-LOGS');
      expect(r).toHaveLength(1);
      expect(r[0]!.detail).toContain('yemediği anlamına gelmez');
      expect(find({ ...base, meals: { lastDay: null, today, relationshipSince: daysAgo(20) } }, 'Y-NO-MEAL-LOGS')[0]!.basis[0]!.type).toBe('MISSING');
      expect(find({ ...base, meals: { lastDay: day(2), today, relationshipSince: daysAgo(20) } }, 'Y-NO-MEAL-LOGS')).toHaveLength(0);
      expect(find({ ...base, meals: { lastDay: null, today, relationshipSince: daysAgo(1) } }, 'Y-NO-MEAL-LOGS')).toHaveLength(0);
      expect(find({ ...base, meals: null }, 'Y-NO-MEAL-LOGS')).toHaveLength(0);
    });

    it('sadece diyetisyene çıkar', () => {
      const meals = { lastDay: null, today, relationshipSince: daysAgo(20) };
      expect(find({ ...input(), professionalType: 'TRAINER', meals }, 'Y-NO-MEAL-LOGS')).toHaveLength(0);
    });
  });

  it('beslenmeye özel maddeler antrenöre çıkmaz, diyetisyene çıkar', () => {
    const i = input({ answers: { ...IMPORTANT, 'std.allergies': { value: ['egg'] }, 'std.diet_preference': { value: 'vegan' } } });
    expect(codes({ ...i, professionalType: 'TRAINER' })).not.toContain('G-ALLERGY-FILTER');
    expect(codes({ ...i, professionalType: 'TRAINER' })).not.toContain('G-DIET-PREFERENCE');
    expect(codes({ ...i, professionalType: 'DIETITIAN' })).toContain('G-ALLERGY-FILTER');
    // Sağlık beyanları herkese çıkar
    expect(codes({ ...input({ answers: { ...IMPORTANT, 'std.pregnancy': { value: 'pregnant' } } }), professionalType: 'TRAINER' })).toContain('Y-PREGNANCY');
  });

  it('kırmızı madde en başta sıralanır', () => {
    const result = evaluate(input({ answers: { ...IMPORTANT, 'std.eating_disorder_history': { value: 'yes' } } }));
    expect(result[0]!.level).toBe('RED');
  });

  it('sarı: eksik önemli sorular tek tek "danışana sor" maddesi olur', () => {
    const missing = find(input({ answers: { 'std.allergies': { value: ['egg'] } } }), 'Y-ANAMNESIS-MISSING');
    expect(missing.map((c) => c.key).sort()).toEqual(['std.conditions', 'std.eating_disorder_history', 'std.medications', 'std.pregnancy']);
    expect(missing[0]!.basis[0]!.type).toBe('MISSING');
    expect(missing.every((c) => c.detail.includes('kesin bir değerlendirme yapma'))).toBe(true);
  });

  it('sarı: sağlık durumu, hamilelik, ilaç ve ek alerji beyanları', () => {
    const i = input({
      answers: {
        ...IMPORTANT,
        'std.conditions': { value: ['diabetes', 'thyroid'] },
        'std.pregnancy': { value: 'pregnant' },
        'std.medications': { value: 'Metformin' },
        'std.allergy_other': { value: 'Laktoz' },
      },
    });
    expect(find(i, 'Y-CONDITIONS')[0]!.detail).toContain('Diyabet, Tiroid hastalığı');
    expect(find(i, 'Y-PREGNANCY')[0]!.title).toBe('Hamilelik beyan edildi');
    expect(find(i, 'Y-MEDICATIONS')[0]!.detail).toContain('Metformin');
    expect(find(i, 'Y-ALLERGY-OTHER')).toHaveLength(1);
  });

  it('anlamsız serbest metin ("yok", "Hayır.") madde üretmez; "Yok" seçeneği sağlık durumu maddesi üretmez', () => {
    const i = input({ answers: { ...IMPORTANT, 'std.medications': { value: 'Yok.' }, 'std.allergy_other': { value: ' hayır ' } } });
    expect(codes(i)).not.toContain('Y-MEDICATIONS');
    expect(codes(i)).not.toContain('Y-ALLERGY-OTHER');
    expect(codes(i)).not.toContain('Y-CONDITIONS');
  });

  it('sarı: eski sağlık öyküsü ve eski/eksik ölçümler', () => {
    const stale = input({ answers: Object.fromEntries(Object.entries(IMPORTANT).map(([k, v]) => [k, { ...v, daysAgo: RULE_PARAMS.anamnesisStaleDays + 5 }])) });
    expect(find(stale, 'Y-ANAMNESIS-STALE')).toHaveLength(1);
    expect(find(input({ answers: IMPORTANT }), 'Y-ANAMNESIS-STALE')).toHaveLength(0);

    expect(find(input({ measurements: [] }), 'Y-NO-WEIGHT')).toHaveLength(1);
    expect(find(input({ measurements: [] }), 'Y-NO-HEIGHT')).toHaveLength(1);
    const oldWeight = input({ measurements: [{ takenAt: daysAgo(RULE_PARAMS.weightStaleDays + 1) }] });
    expect(find(oldWeight, 'Y-WEIGHT-STALE')[0]!.detail).toContain('31 gün');
    expect(find(input({ measurements: [{ takenAt: daysAgo(2) }] }), 'Y-WEIGHT-STALE')).toHaveLength(0);
  });

  it('paylaşılmayan kategori için o kategoriye ait madde üretilmez', () => {
    const i = input({ allowed: ['ANAMNESIS'], measurements: [] });
    expect(codes(i)).not.toContain('Y-NO-WEIGHT');
    expect(codes(i)).not.toContain('Y-NO-HEIGHT');
    expect(find(i, 'Y-NOT-SHARED').map((c) => c.key).sort()).toEqual(['MEASUREMENTS', 'WEIGHT']);
  });

  it('sarı: ani kilo farkı sadece kısa sürede ve eşik üstündeyse', () => {
    const jump = input({ measurements: [{ value: 80, takenAt: daysAgo(1) }, { value: 70, takenAt: daysAgo(5) }] });
    expect(find(jump, 'Y-WEIGHT-JUMP')[0]!.detail).toContain('%14');
    const slow = input({ measurements: [{ value: 80, takenAt: daysAgo(1) }, { value: 70, takenAt: daysAgo(60) }] });
    expect(find(slow, 'Y-WEIGHT-JUMP')).toHaveLength(0);
    const small = input({ measurements: [{ value: 71, takenAt: daysAgo(1) }, { value: 70, takenAt: daysAgo(5) }] });
    expect(find(small, 'Y-WEIGHT-JUMP')).toHaveLength(0);
  });

  it('sarı: aynı ölçüm türü farklı yöntemlerle alındıysa uyarır', () => {
    const mixed = input({
      measurements: [
        { kind: 'BODY_FAT_PERCENT', value: 25, method: 'BIA', takenAt: daysAgo(3) },
        { kind: 'BODY_FAT_PERCENT', value: 22, method: 'CALIPER', takenAt: daysAgo(20) },
      ],
    });
    const r = find(mixed, 'Y-MIXED-METHODS');
    expect(r).toHaveLength(1);
    expect(r[0]).toMatchObject({ categories: ['MEASUREMENTS'] });
    expect(r[0]!.detail).toContain('BIA cihazı ve Kaliper');

    const same = input({
      measurements: [
        { kind: 'BODY_FAT_PERCENT', method: 'BIA', takenAt: daysAgo(3) },
        { kind: 'BODY_FAT_PERCENT', method: 'BIA', takenAt: daysAgo(20) },
      ],
    });
    expect(find(same, 'Y-MIXED-METHODS')).toHaveLength(0);
  });

  it('sarı: paylaşım süresi yakında bitiyorsa', () => {
    expect(find(input({ sharedUntil: new Date(NOW.getTime() + 3 * 86_400_000) }), 'Y-SHARING-EXPIRING')[0]!.detail).toContain('3 gün');
    expect(find(input({ sharedUntil: new Date(NOW.getTime() + 30 * 86_400_000) }), 'Y-SHARING-EXPIRING')).toHaveLength(0);
    expect(find(input({ sharedUntil: null }), 'Y-SHARING-EXPIRING')).toHaveLength(0);
  });

  it('yeşil: alerjen, beslenme tercihi, sevilmeyenler', () => {
    const i = input({
      answers: {
        ...IMPORTANT,
        'std.allergies': { value: ['egg', 'milk'] },
        'std.diet_preference': { value: 'vegetarian' },
        'std.dislikes': { value: 'Brokoli' },
      },
    });
    expect(find(i, 'G-ALLERGY-FILTER')[0]!.detail).toContain('Yumurta, Süt');
    expect(find(i, 'G-DIET-PREFERENCE')[0]!.detail).toContain('Vejetaryen');
    expect(find(i, 'G-DISLIKES')[0]!.detail).toContain('Brokoli');
    expect(find(input({ answers: IMPORTANT }), 'G-ALLERGY-FILTER')).toHaveLength(0);
  });

  it('yeşil "temel bilgiler tamam" sadece her şey eksiksiz ve güncelse çıkar', () => {
    const complete = input({
      answers: IMPORTANT,
      measurements: [
        { kind: 'WEIGHT', value: 70, takenAt: daysAgo(2) },
        { kind: 'HEIGHT', value: 170, method: 'TAPE', takenAt: daysAgo(40) },
      ],
    });
    const ready = find(complete, 'G-BASICS-READY');
    expect(ready).toHaveLength(1);
    expect(ready[0]!.categories).toEqual(['ANAMNESIS', 'WEIGHT', 'MEASUREMENTS']);
    expect(ready[0]!.basis.length).toBeGreaterThan(5);

    // Boy yoksa, eski kilo varsa ya da önemli soru eksikse çıkmaz
    expect(find(input({ answers: IMPORTANT, measurements: [{ takenAt: daysAgo(2) }] }), 'G-BASICS-READY')).toHaveLength(0);
    const staleWeight = input({
      answers: IMPORTANT,
      measurements: [{ takenAt: daysAgo(45) }, { kind: 'HEIGHT', value: 170, method: 'TAPE', takenAt: daysAgo(45) }],
    });
    expect(find(staleWeight, 'G-BASICS-READY')).toHaveLength(0);
    const { 'std.pregnancy': _drop, ...partial } = IMPORTANT;
    expect(find(input({ answers: partial, measurements: complete.measurements.map((m) => ({ ...m })) }), 'G-BASICS-READY')).toHaveLength(0);
  });

  it('aynı girdiye her zaman aynı sonuç (deterministik)', () => {
    const i = input({ answers: { 'std.allergies': { value: ['egg'] } }, measurements: [{}] });
    expect(JSON.stringify(evaluate(i))).toBe(JSON.stringify(evaluate(i)));
  });

  it('hiçbir maddenin metninde tanı/tedavi dili geçmez', () => {
    const i = input({
      answers: {
        ...IMPORTANT,
        'std.conditions': { value: ['diabetes'] },
        'std.pregnancy': { value: 'pregnant' },
        'std.eating_disorder_history': { value: 'yes' },
        'std.medications': { value: 'ilaç' },
      },
      measurements: [{ value: 90, takenAt: daysAgo(1) }, { value: 70, takenAt: daysAgo(3) }],
    });
    const text = evaluate(i).map((c) => `${c.title} ${c.detail}`.toLocaleLowerCase('tr')).join(' ');
    for (const banned of ['tanı konul', 'tedavi et', 'teşhis', 'kesinlikle', 'mutlaka', 'riskli değil']) {
      expect(text).not.toContain(banned);
    }
  });
});
