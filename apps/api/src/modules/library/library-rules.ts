// Kütüphane programı kuralları: hareket süresi tahmini, günlere yayma ve "hangi gün hangi program günü". SAF fonksiyonlar.
import { addLocalDays } from '../../common/local-day.js';
import type { LibraryProgram, ProgramDayDef, Work } from './catalog.js';

// Tekrar başına ortalama süre (tahmini; gösterim içindir)
export const SECONDS_PER_REP = 3;

// Bir setin aktif süresi (tek taraflı hareketlerde iki taraf)
export function setSeconds(work: Work): number {
  const one = work.seconds ?? (work.reps ?? 0) * SECONDS_PER_REP;
  return one * (work.perSide ? 2 : 1);
}

// Hareketin toplam süresi: setler + setler arası dinlenmeler
export function workSeconds(work: Work): number {
  return work.sets * setSeconds(work) + Math.max(0, work.sets - 1) * work.restSec;
}

export function dayDurationSec(day: ProgramDayDef): number {
  return day.steps.reduce((sum, s) => sum + workSeconds(s.work) + s.restAfterSec, 0);
}

// "3 × 12 tekrar (her taraf) · set arası 45 sn"
export function workText(work: Work): string {
  const amount = work.seconds !== undefined ? `${work.seconds} sn` : `${work.reps} tekrar`;
  const side = work.perSide ? ' (her taraf)' : '';
  const sets = work.sets > 1 ? `${work.sets} × ${amount}${side}` : `${amount}${side}`;
  return work.sets > 1 && work.restSec > 0 ? `${sets} · set arası ${work.restSec} sn` : sets;
}

// Haftalık gün dağılımı (başlangıç gününe göre): 3 gün → 0, 2, 4 (gün aşırı); 5 gün → art arda 5 gün, 2 gün ara
const OFFSETS: Record<number, number[]> = {
  1: [0],
  2: [0, 3],
  3: [0, 2, 4],
  4: [0, 1, 3, 4],
  5: [0, 1, 2, 3, 4],
  6: [0, 1, 2, 3, 4, 5],
  7: [0, 1, 2, 3, 4, 5, 6],
};

export function scheduleDate(program: Pick<LibraryProgram, 'daysPerWeek'>, startDate: string, dayIndex: number): string {
  const offsets = OFFSETS[program.daysPerWeek] ?? OFFSETS[3]!;
  const week = Math.floor(dayIndex / offsets.length);
  return addLocalDays(startDate, week * 7 + offsets[dayIndex % offsets.length]!);
}

// Verilen tarihte yapılacak program günü (yoksa null)
export function dayIndexOn(program: Pick<LibraryProgram, 'daysPerWeek' | 'days'>, startDate: string, date: string): number | null {
  if (date < startDate) return null;
  for (let i = 0; i < program.days.length; i++) {
    const d = scheduleDate(program, startDate, i);
    if (d === date) return i;
    if (d > date) return null;
  }
  return null;
}

// Verilen tarihten sonraki ilk program günü (yoksa null)
export function nextDayFrom(program: Pick<LibraryProgram, 'daysPerWeek' | 'days'>, startDate: string, date: string): { dayIndex: number; date: string } | null {
  for (let i = 0; i < program.days.length; i++) {
    const d = scheduleDate(program, startDate, i);
    if (d > date) return { dayIndex: i, date: d };
  }
  return null;
}
