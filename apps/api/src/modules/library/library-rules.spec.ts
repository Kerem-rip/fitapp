import { findProgram, ITEMS, PROGRAMS } from './catalog.js';
import { dayDurationSec, dayIndexOn, nextDayFrom, scheduleDate, workSeconds, workText } from './library-rules.js';

describe('kütüphane programları', () => {
  it('katalog tutarlı: kimlikler benzersiz, programdaki her hareket katalogda', () => {
    expect(new Set(ITEMS.map((i) => i.id)).size).toBe(ITEMS.length);
    for (const p of PROGRAMS) {
      expect(p.days).toHaveLength(p.weeks * p.daysPerWeek);
      for (const d of p.days) for (const s of d.steps) expect(ITEMS.some((i) => i.id === s.itemId)).toBe(true);
    }
  });

  it('süre: setler, iki taraf ve set arası dinlenme hesaba katılır', () => {
    expect(workSeconds({ sets: 3, reps: 12, restSec: 45 })).toBe(3 * 36 + 2 * 45);
    expect(workSeconds({ sets: 3, seconds: 30, restSec: 15, perSide: true })).toBe(3 * 60 + 2 * 15);
    expect(workSeconds({ sets: 1, seconds: 60, restSec: 0 })).toBe(60);
    expect(workText({ sets: 3, reps: 10, restSec: 45, perSide: true })).toBe('3 × 10 tekrar (her taraf) · set arası 45 sn');
    expect(workText({ sets: 1, seconds: 60, restSec: 0 })).toBe('60 sn');
    expect(dayDurationSec(findProgram('yuz-masaji-rutini')!.days[0]!)).toBe(60 + 10 + 60 + 10 + 120);
  });

  it('haftada 3 gün gün aşırı yayılır; program günü tarihten bulunur', () => {
    const p = findProgram('ev-baslangic')!;
    const start = '2026-11-16';
    expect([0, 1, 2, 3].map((i) => scheduleDate(p, start, i))).toEqual(['2026-11-16', '2026-11-18', '2026-11-20', '2026-11-23']);
    expect(dayIndexOn(p, start, '2026-11-18')).toBe(1);
    expect(dayIndexOn(p, start, '2026-11-17')).toBeNull();
    expect(dayIndexOn(p, start, '2026-11-15')).toBeNull();
    expect(nextDayFrom(p, start, '2026-11-17')).toEqual({ dayIndex: 1, date: '2026-11-18' });
    // Son günden sonra program biter
    expect(nextDayFrom(p, start, scheduleDate(p, start, 11))).toBeNull();
  });
});
