import { availableEquipment, intakeSchema, screen, SCREENING_QUESTIONS, startLevel, type PlanIntake } from './intake.js';

const base = (over: Partial<PlanIntake> = {}): PlanIntake =>
  intakeSchema.parse({
    goal: 'GENERAL_HEALTH',
    experience: 'BEGINNER',
    capacity: 'MEDIUM',
    setting: 'HOME_NONE',
    daysPerWeek: 3,
    minutesPerSession: 30,
    dailyActivity: 'LIGHT',
    heightCm: 170,
    weightKg: 70,
    screening: Object.fromEntries(SCREENING_QUESTIONS.map((q) => [q.key, 'NO'])),
    ...over,
  });

describe('güvenlik kapısı', () => {
  it('her şeye hayır diyen yetişkin uygun bulunur', () => {
    const r = screen(base(), 30);
    expect(r).toMatchObject({ status: 'ELIGIBLE', referToProfessional: false, lowImpactOnly: false, volumeFactor: 1 });
  });

  it('18 yaş altı engellenir', () => {
    const r = screen(base(), 17);
    expect(r.status).toBe('BLOCKED');
    expect(r.referToProfessional).toBe(false);
  });

  it('riskli bir sağlık sorusuna evet ya da emin değilim denirse program üretilmez ve uzmana yönlendirilir', () => {
    for (const q of SCREENING_QUESTIONS) {
      for (const a of ['YES', 'UNSURE'] as const) {
        const r = screen(base({ screening: { ...base().screening, [q.key]: a } }), 30);
        expect(r.status, `${q.key} ${a}`).toBe('BLOCKED');
        expect(r.referToProfessional).toBe(true);
        expect(r.reasons.join(' ')).toContain('uzmana');
      }
    }
  });

  it('çok düşük BMI engellenir; yüksek BMI zıplamasız ve hafif program verir (tek başına engel değildir)', () => {
    expect(screen(base({ heightCm: 180, weightKg: 50 }), 30).status).toBe('BLOCKED');
    const heavy = screen(base({ heightCm: 165, weightKg: 100 }), 30);
    expect(heavy).toMatchObject({ status: 'CAUTION', lowImpactOnly: true });
    expect(heavy.volumeFactor).toBeLessThan(1);
  });

  it('ağrı bölgesi kısıt olur; diz ağrısı zıplamayı kapatır; 55+ hafifletilir', () => {
    const r = screen(base({ painAreas: ['KNEE', 'WRIST'] }), 30);
    expect(r).toMatchObject({ status: 'CAUTION', lowImpactOnly: true });
    expect(r.restrictedAreas.sort()).toEqual(['KNEE', 'WRIST']);
    expect(screen(base(), 60)).toMatchObject({ status: 'CAUTION', lowImpactOnly: true });
  });

  it('cevaplanmamış soru, geçersiz ölçü ve gün sayısı reddedilir', () => {
    const { screening: _s, ...rest } = base();
    expect(intakeSchema.safeParse(rest).success).toBe(false);
    expect(intakeSchema.safeParse({ ...base(), heightCm: 50 }).success).toBe(false);
    expect(intakeSchema.safeParse({ ...base(), daysPerWeek: 7 }).success).toBe(false);
    expect(intakeSchema.safeParse({ ...base(), screening: { ...base().screening, CHEST_PAIN: 'BELKI' } }).success).toBe(false);
  });

  it('ekipman ortama göre belirlenir; başlangıç basamağı deneyim ve kapasiteye göre', () => {
    expect([...availableEquipment('HOME_NONE', ['DUMBBELL'])]).toEqual([]);
    expect([...availableEquipment('HOME_EQUIP', ['DUMBBELL', 'BAND'])].sort()).toEqual(['BAND', 'DUMBBELL']);
    expect(availableEquipment('GYM', []).has('MACHINE')).toBe(true);
    expect(startLevel(base({ experience: 'NONE' }))).toBe(1);
    expect(startLevel(base({ experience: 'ADVANCED' }))).toBe(3);
    expect(startLevel(base({ experience: 'ADVANCED', capacity: 'LOW' }))).toBe(2);
    expect(startLevel(base({ experience: 'INTERMEDIATE' }), 1)).toBe(3);
  });
});
