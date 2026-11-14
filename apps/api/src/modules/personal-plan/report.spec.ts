import { intakeSchema, screen, SCREENING_QUESTIONS, startLevel } from './intake.js';
import { deriveWeek } from './engine/adapt.js';
import { generateWeek1 } from './engine/generate.js';
import type { DaySpec, PlanParams } from './engine/base.js';
import { buildReport, type ReportLog } from './report.js';

const intake = intakeSchema.parse({
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
});
const screening = screen(intake, 30);
const p: PlanParams = { intake, ageYears: 30, screening, level: startLevel(intake), seed: 'u:1', avoid: [], restrictedAreas: [], needsProfessional: false };

const allDone = (days: DaySpec[]): ReportLog[] =>
  days.flatMap((d) => (d.kind === 'TRAINING' ? d.entries.filter((e) => e.section === 'MAIN').map((e) => ({ dayNumber: d.dayNumber, entryIndex: e.index, status: 'DONE' as const, rpe: 6, pain: false, painArea: null, painSharp: false, actualReps: null, actualSeconds: null })) : []));

describe('gelişim raporu', () => {
  const w1 = generateWeek1(p);
  const w2 = deriveWeek(w1, allDone(w1), p, 2).days;
  const w3 = deriveWeek(w2, allDone(w2), p, 3).days;
  const w4 = deriveWeek(w3, allDone(w3), p, 4).days;
  const days = [...w1, ...w2, ...w3, ...w4];
  const body = { weightKg: { start: 72, end: 71.2 }, waistCm: { start: 80, end: null }, hipCm: { start: null, end: null }, armCm: { start: null, end: null } };

  it('hepsi tamamlandığında oranlar ve haftalar doğru; vücut ölçüsü değişimi taşınır', () => {
    const r = buildReport({ days, logs: allDone(days), body, bmr: 1500, tdee: 2000, needsProfessional: false, adaptationLog: ['x'], generatedWeeks: 4 });
    expect(r.totals).toMatchObject({ trainingDays: 12, completedDays: 12, completionRate: 1, skippedMain: 0, avgRpe: 6, painReports: 0 });
    expect(r.weeks).toHaveLength(4);
    expect(r.weeks.every((w) => w.trainingDays === 3 && w.completedDays === 3)).toBe(true);
    expect(r.body.weightKg).toEqual({ start: 72, end: 71.2 });
    expect(r.body.waistCm.end).toBeNull();
    expect(r.energy.avgSessionKcal).toBeGreaterThan(0);
    expect(r.disclaimer).toContain('garantisi değildir');
    expect(r.notes).toEqual([]);
  });

  it('kaçırılanlar kaydedilir ve düşük tamamlama uyarı notu üretir', () => {
    const r = buildReport({ days, logs: allDone(days).filter((_, i) => i % 3 === 0), body, bmr: 1500, tdee: 2000, needsProfessional: false, adaptationLog: [], generatedWeeks: 4 });
    expect(r.totals.skippedMain).toBeGreaterThan(0);
    expect(r.totals.completionRate).toBeLessThan(0.5);
    expect(r.notes.join(' ')).toContain('hafif');
  });

  it('gelişim: ilk ve son haftada yapılan aynı hareketin değişimi; yapılan değer (actual) önceliklidir', () => {
    const logs = allDone(days).map((l) => ({ ...l }));
    const r = buildReport({ days, logs, body, bmr: 1500, tdee: 2000, needsProfessional: false, adaptationLog: [], generatedWeeks: 4 });
    for (const i of r.improvements) {
      expect(i.lastWeek).toBeGreaterThan(i.firstWeek);
      expect(i.change).toBe(i.last - i.first);
    }
    const firstMain = w1.find((d) => d.kind === 'TRAINING')!.entries.find((e) => e.section === 'MAIN' && e.reps !== undefined)!;
    const day1 = w1.find((d) => d.kind === 'TRAINING')!;
    const withActual = logs.map((l) => (l.dayNumber === day1.dayNumber && l.entryIndex === firstMain.index ? { ...l, actualReps: 99 } : l));
    const r2 = buildReport({ days, logs: withActual, body, bmr: 1500, tdee: 2000, needsProfessional: true, adaptationLog: [], generatedWeeks: 4 });
    const imp = r2.improvements.find((x) => x.itemId === firstMain.itemId);
    if (imp) expect(imp.first).toBe(99);
    expect(r2.needsProfessional).toBe(true);
    expect(r2.notes.join(' ')).toContain('uzmana');
  });

  it('eksik haftalarla bitmiş program notla raporlanır', () => {
    const r = buildReport({ days: w1, logs: [], body, bmr: 1500, tdee: 2000, needsProfessional: false, adaptationLog: [], generatedWeeks: 1 });
    expect(r.notes.join(' ')).toContain('tüm haftalar oluşturulmadan');
    expect(r.totals.completionRate).toBe(0);
  });
});
