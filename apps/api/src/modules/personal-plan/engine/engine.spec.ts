import { intakeSchema, screen, SCREENING_QUESTIONS, startLevel, type PlanIntake } from '../intake.js';
import { PLAN_META } from '../plan-meta.js';
import { decideWeek, deriveWeek, stepDown, stepUp, weekStats, type EntryLog } from './adapt.js';
import { alternativesFor, isEligible, type DaySpec, type PlanParams } from './base.js';
import { generateWeek1 } from './generate.js';

const intakeOf = (over: Record<string, unknown> = {}): PlanIntake =>
  intakeSchema.parse({
    goal: 'GENERAL_HEALTH',
    experience: 'BEGINNER',
    capacity: 'MEDIUM',
    setting: 'HOME_NONE',
    daysPerWeek: 3,
    minutesPerSession: 40,
    dailyActivity: 'LIGHT',
    heightCm: 172,
    weightKg: 72,
    screening: Object.fromEntries(SCREENING_QUESTIONS.map((q) => [q.key, 'NO'])),
    ...over,
  });

const paramsOf = (over: Record<string, unknown> = {}, extra: Partial<PlanParams> = {}): PlanParams => {
  const intake = intakeOf(over);
  const screening = screen(intake, 30);
  return { intake, ageYears: 30, screening, level: startLevel(intake), seed: 'u1:1', avoid: [], restrictedAreas: screening.restrictedAreas, needsProfessional: false, ...extra };
};

const mains = (days: DaySpec[]) => days.flatMap((d) => d.entries.filter((e) => e.section === 'MAIN').map((e) => ({ day: d.dayNumber, ...e })));
const logsFor = (days: DaySpec[], f: (d: DaySpec, idx: number) => Partial<EntryLog> & { status: 'DONE' | 'SKIPPED' }): EntryLog[] =>
  days.flatMap((d) =>
    d.kind === 'TRAINING' ? d.entries.filter((e) => e.section === 'MAIN').map((e) => ({ dayNumber: d.dayNumber, entryIndex: e.index, rpe: null, painArea: null, painSharp: false, pain: false, ...f(d, e.index) })) : [],
  );

describe('1. hafta üretimi', () => {
  it('antrenman günü sayısı ve her günün yapısı doğru: ısınma → ana çalışma → soğuma', () => {
    for (const daysPerWeek of [2, 3, 4, 5, 6]) {
      const week = generateWeek1(paramsOf({ daysPerWeek }));
      expect(week).toHaveLength(7);
      expect(week.filter((d) => d.kind === 'TRAINING')).toHaveLength(daysPerWeek);
      for (const d of week.filter((x) => x.kind === 'TRAINING')) {
        const sections = d.entries.map((e) => e.section);
        expect(sections[0]).toBe('WARMUP');
        expect(sections.at(-1)).toBe('COOLDOWN');
        expect(sections.filter((s) => s === 'MAIN').length).toBeGreaterThanOrEqual(3);
        expect(sections.join(',')).toBe([...sections].sort((a, b) => ['WARMUP', 'MAIN', 'COOLDOWN'].indexOf(a) - ['WARMUP', 'MAIN', 'COOLDOWN'].indexOf(b)).join(','));
        expect(d.entries.map((e) => e.index)).toEqual(d.entries.map((_, i) => i));
        expect(new Set(d.entries.map((e) => e.itemId)).size).toBe(d.entries.length);
        expect(d.estimatedMinutes).toBeGreaterThan(5);
      }
      // Aynı gün üst üste dizilmiş en fazla 3 antrenman (toparlanma payı)
      let run = 0;
      let worst = 0;
      for (const d of week) {
        run = d.kind === 'TRAINING' ? run + 1 : 0;
        worst = Math.max(worst, run);
      }
      expect(worst).toBeLessThanOrEqual(3);
    }
  });

  it('süre bütçesine uyar', () => {
    for (const minutesPerSession of [20, 30, 45, 60]) {
      const week = generateWeek1(paramsOf({ minutesPerSession, daysPerWeek: 3 }));
      for (const d of week.filter((x) => x.kind === 'TRAINING')) expect(d.estimatedMinutes, `${minutesPerSession} dk`).toBeLessThanOrEqual(minutesPerSession + 8);
    }
  });

  it('seçilen her hareket ortam, ekipman, seviye, ağrı ve etki kurallarına uyar', () => {
    const cases: Record<string, unknown>[] = [
      { setting: 'HOME_NONE' },
      { setting: 'HOME_EQUIP', equipment: ['DUMBBELL'] },
      { setting: 'HOME_EQUIP', equipment: ['BAND', 'STEP'], experience: 'INTERMEDIATE' },
      { setting: 'GYM', experience: 'ADVANCED', goal: 'BUILD_MUSCLE', daysPerWeek: 4 },
      { painAreas: ['KNEE', 'WRIST'], goal: 'LOSE_FAT' },
      { painAreas: ['LOW_BACK', 'SHOULDER'], experience: 'ADVANCED', daysPerWeek: 5 },
      { heightCm: 165, weightKg: 100, goal: 'ENDURANCE' },
    ];
    for (const c of cases) {
      const p = paramsOf(c);
      for (const e of generateWeek1(p).flatMap((d) => d.entries)) {
        expect(isEligible(e.itemId, p), `${JSON.stringify(c)} → ${e.itemId}`).toBe(true);
      }
    }
    // Ekipmansız evde dambıl/bant/makine hareketi yok
    const none = generateWeek1(paramsOf({ setting: 'HOME_NONE', experience: 'ADVANCED' })).flatMap((d) => d.entries);
    expect(none.some((e) => PLAN_META[e.itemId]!.equipment.length > 0)).toBe(false);
    // Diz ağrısında zıplamalı ve dizi yükleyen hareket yok
    const knee = generateWeek1(paramsOf({ painAreas: ['KNEE'], goal: 'LOSE_FAT' })).flatMap((d) => d.entries);
    expect(knee.some((e) => PLAN_META[e.itemId]!.stress.includes('KNEE') || PLAN_META[e.itemId]!.highImpact)).toBe(false);
  });

  it('aynı girdi aynı programı, farklı tohum farklı seçimleri üretir; önceki dönemin hareketleri geri plana itilir', () => {
    // Kısa seanslarda seçenek havuzu geniştir; çeşitlilik burada gözlenir (uzun seanslar havuzun tamamını kullanabilir)
    const a = generateWeek1(paramsOf({ minutesPerSession: 20 }));
    expect(generateWeek1(paramsOf({ minutesPerSession: 20 }))).toEqual(a);
    const prevMains = new Set(mains(a).map((m) => m.itemId));
    const b = generateWeek1(paramsOf({ minutesPerSession: 20 }, { seed: 'u1:2', avoid: [...prevMains] }));
    const bMains = mains(b).map((m) => m.itemId);
    expect(bMains.filter((id) => prevMains.has(id)).length).toBeLessThan(bMains.length);
    expect(JSON.stringify(b)).not.toEqual(JSON.stringify(a));
  });

  it('hedef programın yapısını değiştirir: kilo verme ve dayanıklılık kardiyo, güç kas odaklıdır', () => {
    const focusOf = (goal: string) => generateWeek1(paramsOf({ goal, daysPerWeek: 4 })).filter((d) => d.kind === 'TRAINING').map((d) => d.focus);
    expect(focusOf('BUILD_MUSCLE')).toEqual(['UPPER', 'LOWER', 'UPPER', 'LOWER']);
    expect(focusOf('LOSE_FAT').filter((f) => f === 'CARDIO')).toHaveLength(2);
    expect(focusOf('ENDURANCE').filter((f) => f === 'CARDIO')).toHaveLength(2);
    expect(focusOf('MOBILITY_POSTURE')).toContain('MOBILITY');
  });

  it('seviye ve hacim çarpanı başlangıç yükünü belirler', () => {
    const rep = (over: Record<string, unknown>) => mains(generateWeek1(paramsOf(over))).find((m) => m.itemId === 'squat')?.reps;
    const lo = rep({ experience: 'NONE', capacity: 'LOW', daysPerWeek: 3, goal: 'BUILD_MUSCLE' });
    const hi = rep({ experience: 'ADVANCED', daysPerWeek: 3, goal: 'BUILD_MUSCLE' });
    if (lo !== undefined && hi !== undefined) expect(hi).toBeGreaterThanOrEqual(lo);
  });

  it('toparlanma günlerinde sadece isteğe bağlı hafif hareket vardır', () => {
    for (const d of generateWeek1(paramsOf()).filter((x) => x.kind === 'REST')) {
      expect(d.entries.every((e) => e.optional === true && e.section === 'RECOVERY')).toBe(true);
    }
  });

  it('yüz bakımı ek olarak istenirse soğumaya eklenir', () => {
    const entries = generateWeek1(paramsOf({ extras: ['FACE_CARE'] })).flatMap((d) => d.entries);
    expect(entries.some((e) => e.itemId.startsWith('face-'))).toBe(true);
  });
});

describe('haftalık uyarlama', () => {
  const week1 = generateWeek1(paramsOf({ daysPerWeek: 3 }));
  const p = paramsOf({ daysPerWeek: 3 });
  const rxKey = (d: DaySpec[]) => mains(d).map((m) => `${m.itemId}:${m.sets}x${m.reps ?? m.seconds}`);

  it('karar kuralları: tamamlama, zorlanma ve hafta sınırları', () => {
    const s = (done: number, avgRpe: number | null, painCount = 0, sharpPain = false) => ({ planned: 10, done, avgRpe, painCount, sharpPain });
    expect(decideWeek(s(4, 7), 1)).toMatchObject({ action: 'REGRESS' });
    expect(decideWeek(s(6, 7), 1)).toMatchObject({ action: 'HOLD' });
    expect(decideWeek(s(9, 9.5), 1)).toMatchObject({ action: 'HOLD' });
    expect(decideWeek(s(9, 4), 2)).toMatchObject({ action: 'PROGRESS', steps: 2 });
    expect(decideWeek(s(9, 4), 1)).toMatchObject({ action: 'PROGRESS', steps: 1 });
    expect(decideWeek(s(9, 7), 2)).toMatchObject({ action: 'PROGRESS', steps: 1 });
    // Değerlendirme haftasına giren karar artış içermez
    expect(decideWeek(s(10, 5), 3)).toMatchObject({ action: 'HOLD' });
    // Ağrı artışı engeller; şiddetli ya da 3 ağrı uzmana yönlendirir
    expect(decideWeek(s(10, 5, 1), 2).action).toBe('HOLD');
    expect(decideWeek(s(10, 5, 3), 2).needsProfessional).toBe(true);
    expect(decideWeek(s(10, 5, 1, true), 2).needsProfessional).toBe(true);
    expect(decideWeek({ planned: 0, done: 0, avgRpe: null, painCount: 0, sharpPain: false }, 1).action).toBe('HOLD');
  });

  it('adım yukarı/aşağı sınırları: tekrar → set → bir üst basamak', () => {
    let rx = { sets: 3, reps: 12, restSec: 45 } as { sets: number; reps?: number; seconds?: number; restSec: number };
    for (let i = 0; i < 30; i++) {
      const r = stepUp('squat', rx);
      if (r.atCeiling) break;
      rx = r.rx;
    }
    expect(rx.sets).toBe(4);
    expect(rx.reps).toBe(18);
    expect(stepUp('squat', rx).atCeiling).toBe(true);
    expect(stepDown('squat', { sets: 2, reps: 6, restSec: 45 }).atFloor).toBe(true);
    expect(stepDown('squat', { sets: 3, reps: 12, restSec: 45 }).rx.sets).toBe(2);
  });

  it('her şey tamam ve orta zorlanma → ilerleme; hiçbir hareket gerilemez', () => {
    const logs = logsFor(week1, () => ({ status: 'DONE', rpe: 7 }));
    const w2 = deriveWeek(week1, logs, p, 2);
    expect(w2.days.map((d) => d.dayNumber)).toEqual([8, 9, 10, 11, 12, 13, 14]);
    expect(w2.days.every((d) => d.weekNumber === 2)).toBe(true);
    expect(rxKey(w2.days)).not.toEqual(rxKey(week1));
    const volume = (d: DaySpec[]) => mains(d).reduce((a, m) => a + m.sets * (m.reps ?? Math.round((m.seconds ?? 0) / 3)), 0);
    expect(volume(w2.days)).toBeGreaterThan(volume(week1));
  });

  it('düşük tamamlamada hafifler; orta tamamlamada ve çok yüksek zorlanmada aynı kalır (her hafta zorlaşmaz)', () => {
    const volume = (d: DaySpec[]) => mains(d).reduce((a, m) => a + m.sets * (m.reps ?? Math.round((m.seconds ?? 0) / 3)), 0);
    const low = deriveWeek(week1, logsFor(week1, (d, i) => ({ status: i === d.entries.findIndex((e) => e.section === 'MAIN') ? 'DONE' : 'SKIPPED' })), p, 2);
    expect(volume(low.days)).toBeLessThan(volume(week1));
    // Ana hareketlerin ~%60'ı yapıldı
    let n = 0;
    const mid = deriveWeek(week1, logsFor(week1, () => ({ status: n++ % 10 < 6 ? 'DONE' : 'SKIPPED', rpe: 7 })), p, 2);
    expect(rxKey(mid.days)).toEqual(rxKey(week1));
    const hard = deriveWeek(week1, logsFor(week1, () => ({ status: 'DONE', rpe: 10 })), p, 2);
    expect(rxKey(hard.days)).toEqual(rxKey(week1));
    expect(hard.log.join(' ')).toContain('zorlanman');
  });

  it('hiç kayıt yoksa (hepsi kaçırıldı) gerileme, ilerleme değil', () => {
    const none = deriveWeek(week1, [], p, 2);
    const volume = (d: DaySpec[]) => mains(d).reduce((a, m) => a + m.sets * (m.reps ?? Math.round((m.seconds ?? 0) / 3)), 0);
    expect(volume(none.days)).toBeLessThanOrEqual(volume(week1));
  });

  it('ağrı bildirilen hareket ve aynı bölgeyi yükleyenler çıkar; yerine güvenli alternatif gelir; artış olmaz', () => {
    const target = mains(week1).find((m) => PLAN_META[m.itemId]!.stress.length > 0)!;
    const area = PLAN_META[target.itemId]!.stress[0]!;
    const logs = logsFor(week1, (d, i) => (d.dayNumber === target.day && i === target.index ? { status: 'DONE', rpe: 5, pain: true, painArea: area } : { status: 'DONE', rpe: 5 }));
    const w2 = deriveWeek(week1, logs, p, 2);
    expect(w2.restrictedAreas).toContain(area);
    for (const e of w2.days.flatMap((d) => d.entries)) expect(PLAN_META[e.itemId]!.stress, e.itemId).not.toContain(area);
    const changed = w2.days.flatMap((d) => d.entries).find((e) => e.originalItemId === target.itemId);
    expect(changed?.rationale).toContain('uygun alternatif');
    // Aynı hafta başka hareketlerde artış yok
    const keep = mains(w2.days).filter((m) => !m.originalItemId).map((m) => `${m.itemId}:${m.sets}x${m.reps ?? m.seconds}`);
    const before = new Set(rxKey(week1));
    expect(keep.every((k) => before.has(k))).toBe(true);
  });

  it('3 ağrı ya da şiddetli ağrı uzmana yönlendirir ve hacmi düşürür', () => {
    const ms = mains(week1).slice(0, 3);
    const logs = logsFor(week1, (d, i) => (ms.some((m) => m.day === d.dayNumber && m.index === i) ? { status: 'DONE', rpe: 6, pain: true } : { status: 'DONE', rpe: 6 }));
    const w2 = deriveWeek(week1, logs, p, 2);
    expect(w2.needsProfessional).toBe(true);
    const sharp = deriveWeek(week1, logsFor(week1, (d, i) => (d.dayNumber === week1.find((x) => x.kind === 'TRAINING')!.dayNumber && i === 2 ? { status: 'DONE', painSharp: true } : { status: 'DONE', rpe: 6 })), p, 2);
    expect(sharp.needsProfessional).toBe(true);
  });

  it('4. hafta değerlendirmedir: 3. haftaya göre yük artmaz', () => {
    const w2 = deriveWeek(week1, logsFor(week1, () => ({ status: 'DONE', rpe: 6 })), p, 2).days;
    const w3 = deriveWeek(w2, logsFor(w2, () => ({ status: 'DONE', rpe: 6 })), p, 3).days;
    const w4 = deriveWeek(w3, logsFor(w3, () => ({ status: 'DONE', rpe: 5 })), p, 4);
    expect(rxKey(w4.days)).toEqual(rxKey(w3));
    expect(w4.log[0]).toContain('değerlendirme');
    expect(w4.days.map((d) => d.dayNumber)).toEqual([22, 23, 24, 25, 26, 27, 28]);
  });

  it('hafta istatistikleri ve alternatifler', () => {
    const logs = logsFor(week1, (d, i) => ({ status: i === d.entries.findIndex((e) => e.section === 'MAIN') ? 'SKIPPED' : 'DONE', rpe: 8 }));
    const st = weekStats(week1, logs);
    expect(st.done).toBeLessThan(st.planned);
    expect(st.avgRpe).toBe(8);
    const alts = alternativesFor('squat', p);
    expect(alts.length).toBeGreaterThan(0);
    expect(alts.every((a) => isEligible(a, p))).toBe(true);
    const knee = paramsOf({ painAreas: ['KNEE'] });
    expect(alternativesFor('squat', knee)).not.toContain('step-up');
  });
});
