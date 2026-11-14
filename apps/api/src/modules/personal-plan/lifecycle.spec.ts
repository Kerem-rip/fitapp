import { localDay } from '../../common/local-day.js';
import { currentDayNumber, dayDateOf, endDateOf, phaseOf, startDateProblem, weekOfDay } from './lifecycle.js';

describe('program yaşam döngüsü', () => {
  it('süre kesin olarak 28 takvim günüdür; ay ve yıl sınırları doğru geçilir', () => {
    expect(endDateOf('2026-11-16')).toBe('2026-12-13');
    expect(endDateOf('2026-12-10')).toBe('2027-01-06');
    expect(endDateOf('2028-02-10')).toBe('2028-03-08');
    expect(dayDateOf('2026-11-16', 1)).toBe('2026-11-16');
    expect(dayDateOf('2026-11-16', 28)).toBe('2026-12-13');
    expect([1, 7, 8, 14, 15, 21, 22, 28].map(weekOfDay)).toEqual([1, 1, 2, 2, 3, 3, 4, 4]);
  });

  it('bugünün program günü: başlamadan ve bittikten sonra boş', () => {
    expect(currentDayNumber('2026-11-16', '2026-11-15')).toBeNull();
    expect(currentDayNumber('2026-11-16', '2026-11-16')).toBe(1);
    expect(currentDayNumber('2026-11-16', '2026-12-13')).toBe(28);
    expect(currentDayNumber('2026-11-16', '2026-12-14')).toBeNull();
  });

  it('başlangıç tarihi: geçmiş olamaz, satın alma gününden itibaren 14 gün içinde seçilir', () => {
    expect(startDateProblem('2026-11-14', '2026-11-14', '2026-11-14')).toBeNull();
    expect(startDateProblem('2026-11-28', '2026-11-14', '2026-11-14')).toBeNull();
    expect(startDateProblem('2026-11-29', '2026-11-14', '2026-11-14')).toBe('TOO_LATE');
    expect(startDateProblem('2026-11-13', '2026-11-14', '2026-11-14')).toBe('PAST');
    expect(startDateProblem('2026-12-01', '2026-11-30', '2026-11-14')).toBe('WINDOW_MISSED');
  });

  it('durumlar: başlangıç bekleniyor → aktif → tamamlandı / süresi doldu; pencere kaçırılması ayrı', () => {
    const p = (startDate: string | null, today: string, allCompleted = false) => phaseOf({ startDate, purchaseDay: '2026-11-14', today, allCompleted });
    expect(p(null, '2026-11-20')).toBe('AWAITING_START');
    expect(p(null, '2026-11-28')).toBe('AWAITING_START');
    expect(p(null, '2026-11-29')).toBe('START_WINDOW_MISSED');
    expect(p('2026-11-20', '2026-11-19')).toBe('AWAITING_START');
    expect(p('2026-11-20', '2026-11-20')).toBe('ACTIVE');
    expect(p('2026-11-20', '2026-12-17')).toBe('ACTIVE');
    // 28 günün dolması tamamlandı demek değildir
    expect(p('2026-11-20', '2026-12-18')).toBe('EXPIRED');
    expect(p('2026-11-20', '2026-12-18', true)).toBe('COMPLETED');
    expect(p('2026-11-20', '2026-12-10', true)).toBe('COMPLETED');
  });

  it('gün Türkiye saatine göre hesaplanır: UTC gece yarısından önce de ertesi gün olabilir', () => {
    expect(localDay(new Date('2026-11-13T20:59:00Z'))).toBe('2026-11-13');
    expect(localDay(new Date('2026-11-13T21:00:00Z'))).toBe('2026-11-14');
  });
});
