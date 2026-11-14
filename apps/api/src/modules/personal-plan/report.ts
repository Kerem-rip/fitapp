// Gelişim raporu üretimi. SAF fonksiyon: günler, kayıtlar ve ölçümlerden rapor çıkarır; tahmini değerleri kesin sonuç gibi sunmaz.
import { findItem } from '../library/catalog.js';
import type { DaySpec, EntrySpec } from './engine/base.js';
import type { BodyArea } from './plan-types.js';

export interface ReportLog {
  dayNumber: number;
  entryIndex: number;
  status: 'DONE' | 'SKIPPED';
  rpe: number | null;
  pain: boolean;
  painArea: BodyArea | null;
  painSharp: boolean;
  actualReps: number | null;
  actualSeconds: number | null;
}

export interface ReportDay extends Pick<DaySpec, 'dayNumber' | 'weekNumber' | 'kind' | 'estimatedKcal'> {
  entries: EntrySpec[];
}

export interface BodyPoint {
  start: number | null;
  end: number | null;
}

export interface PlanReport {
  generatedAt: string;
  totals: { trainingDays: number; completedDays: number; plannedMain: number; doneMain: number; skippedMain: number; completionRate: number; avgRpe: number | null; painReports: number };
  weeks: { week: number; trainingDays: number; completedDays: number; plannedMain: number; doneMain: number; avgRpe: number | null; painReports: number }[];
  improvements: { itemId: string; title: string; unit: 'reps' | 'seconds'; firstWeek: number; lastWeek: number; first: number; last: number; change: number }[];
  body: { weightKg: BodyPoint; waistCm: BodyPoint; hipCm: BodyPoint; armCm: BodyPoint };
  energy: { avgSessionKcal: number | null; bmr: number; tdee: number };
  needsProfessional: boolean;
  adaptationLog: string[];
  notes: string[];
  disclaimer: string;
}

const DISCLAIMER =
  'Bu rapor tahmini değerler içerir; ölçüm ya da sonuç garantisi değildir. Otomatik program, tıbbi değerlendirmenin ya da diyetisyenin hazırladığı beslenme planının yerine geçmez.';

const avg = (xs: number[]) => (xs.length ? Math.round((xs.reduce((a, b) => a + b, 0) / xs.length) * 10) / 10 : null);

export function buildReport(input: {
  days: ReportDay[];
  logs: ReportLog[];
  body: PlanReport['body'];
  bmr: number;
  tdee: number;
  needsProfessional: boolean;
  adaptationLog: string[];
  generatedWeeks: number;
  now?: Date;
}): PlanReport {
  const { days, logs } = input;
  const logOf = (d: number, i: number) => logs.find((l) => l.dayNumber === d && l.entryIndex === i);
  const mainsOf = (d: ReportDay) => (d.kind === 'TRAINING' ? d.entries.filter((e) => e.section === 'MAIN' && !e.optional) : []);

  const perDay = days
    .filter((d) => d.kind === 'TRAINING')
    .map((d) => {
      const mains = mainsOf(d);
      const done = mains.filter((e) => logOf(d.dayNumber, e.index)?.status === 'DONE');
      const rpes = done.flatMap((e) => {
        const r = logOf(d.dayNumber, e.index)?.rpe;
        return r === null || r === undefined ? [] : [r];
      });
      const pains = d.entries.filter((e) => {
        const l = logOf(d.dayNumber, e.index);
        return l && (l.pain || l.painArea || l.painSharp);
      }).length;
      return { week: d.weekNumber, planned: mains.length, done: done.length, completed: mains.length > 0 && done.length === mains.length, rpes, pains };
    });

  const weeks = [1, 2, 3, 4].map((week) => {
    const w = perDay.filter((x) => x.week === week);
    return {
      week,
      trainingDays: w.length,
      completedDays: w.filter((x) => x.completed).length,
      plannedMain: w.reduce((a, x) => a + x.planned, 0),
      doneMain: w.reduce((a, x) => a + x.done, 0),
      avgRpe: avg(w.flatMap((x) => x.rpes)),
      painReports: w.reduce((a, x) => a + x.pains, 0),
    };
  });
  const plannedMain = perDay.reduce((a, x) => a + x.planned, 0);
  const doneMain = perDay.reduce((a, x) => a + x.done, 0);

  // Gelişim: aynı hareketin ilk ve son haftadaki değeri (yapılan değer varsa o, yoksa programlanan)
  const valueOf = (d: ReportDay, e: EntrySpec) => {
    const l = logOf(d.dayNumber, e.index);
    if (e.reps !== undefined) return { unit: 'reps' as const, v: l?.actualReps ?? e.reps };
    return e.seconds !== undefined ? { unit: 'seconds' as const, v: l?.actualSeconds ?? e.seconds } : null;
  };
  const seen = new Map<string, { unit: 'reps' | 'seconds'; firstWeek: number; first: number; lastWeek: number; last: number }>();
  for (const d of [...days].sort((a, b) => a.dayNumber - b.dayNumber)) {
    for (const e of mainsOf(d)) {
      if (logOf(d.dayNumber, e.index)?.status !== 'DONE') continue;
      const val = valueOf(d, e);
      if (!val) continue;
      const cur = seen.get(e.itemId);
      if (!cur) seen.set(e.itemId, { unit: val.unit, firstWeek: d.weekNumber, first: val.v, lastWeek: d.weekNumber, last: val.v });
      else seen.set(e.itemId, { ...cur, lastWeek: d.weekNumber, last: val.v });
    }
  }
  const improvements = [...seen.entries()]
    .filter(([, v]) => v.lastWeek > v.firstWeek)
    .map(([itemId, v]) => ({ itemId, title: findItem(itemId)?.title ?? itemId, unit: v.unit, firstWeek: v.firstWeek, lastWeek: v.lastWeek, first: v.first, last: v.last, change: v.last - v.first }));

  const trainingKcal = days.filter((d) => d.kind === 'TRAINING' && d.entries.length).map((d) => d.estimatedKcal);
  const notes: string[] = [];
  if (input.generatedWeeks < 4) notes.push('Program, tüm haftalar oluşturulmadan sona erdi; rapor mevcut haftaları kapsar.');
  if (input.needsProfessional) notes.push('Ağrı bildirimlerin nedeniyle bir uzmana danışmanı öneririz.');
  if (plannedMain > 0 && doneMain / plannedMain < 0.5) notes.push('Tamamlama oranı düşük kaldı; yeni dönemde daha hafif bir başlangıç önerilir.');

  return {
    generatedAt: (input.now ?? new Date()).toISOString(),
    totals: {
      trainingDays: perDay.length,
      completedDays: perDay.filter((x) => x.completed).length,
      plannedMain,
      doneMain,
      skippedMain: plannedMain - doneMain,
      completionRate: plannedMain ? Math.round((doneMain / plannedMain) * 100) / 100 : 0,
      avgRpe: avg(perDay.flatMap((x) => x.rpes)),
      painReports: perDay.reduce((a, x) => a + x.pains, 0),
    },
    weeks,
    improvements,
    body: input.body,
    energy: { avgSessionKcal: trainingKcal.length ? Math.round(trainingKcal.reduce((a, b) => a + b, 0) / trainingKcal.length / 5) * 5 : null, bmr: input.bmr, tdee: input.tdee },
    needsProfessional: input.needsProfessional,
    adaptationLog: input.adaptationLog,
    notes,
    disclaimer: DISCLAIMER,
  };
}
