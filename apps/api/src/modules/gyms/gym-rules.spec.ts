import { addDays, balanceOf, localDay, localDayStart, can, membershipDue, membershipEnd, membershipState, overlaps, permissionsOf, pickCoverage, summarizePayments, timeToMin, weekdayOf, type CoverMembership, type PaymentRow } from './gym-rules.js';

describe('salon yetkileri', () => {
  it('sahip her şeyi yapar; resepsiyon üye ve ödeme kaydı yapar ama iptal ve rapor yapamaz', () => {
    expect(permissionsOf('OWNER')).toHaveLength(15);
    expect(can('RECEPTION', 'lessons.manage')).toBe(true);
    expect(can('RECEPTION', 'tasks.manage')).toBe(false);
    expect(can('RECEPTION', 'shifts.manage')).toBe(false);
    expect(can('RECEPTION', 'payments.record')).toBe(true);
    expect(can('RECEPTION', 'payments.void')).toBe(false);
    expect(can('RECEPTION', 'reports.view')).toBe(false);
    expect(can('RECEPTION', 'staff.manage')).toBe(false);
  });

  it('salon eğitmeni sadece üye listesini görür; iletişim ve para bilgisine erişemez', () => {
    expect(permissionsOf('TRAINER')).toEqual(['members.view']);
    expect(can('TRAINER', 'members.contact')).toBe(false);
    expect(can('TRAINER', 'payments.view')).toBe(false);
  });
});

describe('üyelik tarihleri', () => {
  it('başladığı gün dahil süre hesaplanır; ay ve yıl geçişleri doğru', () => {
    expect(membershipEnd('2026-11-01', 30)).toBe('2026-11-30');
    expect(membershipEnd('2026-12-15', 30)).toBe('2027-01-13');
    expect(membershipEnd('2026-02-01', 1)).toBe('2026-02-01');
  });

  it('durum: başlamadı, aktif, hakkı bitti, süresi doldu, iptal', () => {
    const base = { status: 'ACTIVE' as const, startDate: '2026-11-01', endDate: '2026-11-30', sessionsLeft: null };
    expect(membershipState(base, '2026-10-31')).toBe('UPCOMING');
    expect(membershipState(base, '2026-11-30')).toBe('ACTIVE');
    expect(membershipState(base, '2026-12-01')).toBe('EXPIRED');
    expect(membershipState({ ...base, sessionsLeft: 0 }, '2026-11-10')).toBe('USED_UP');
    expect(membershipState({ ...base, status: 'CANCELLED' }, '2026-11-10')).toBe('CANCELLED');
  });
});

describe('bakiye ve tahsilat', () => {
  const payments: PaymentRow[] = [
    { membershipId: 'm1', amountKurus: 100_000, method: 'CASH', voided: false },
    { membershipId: 'm1', amountKurus: 50_000, method: 'CARD', voided: true },
    { membershipId: null, amountKurus: 20_000, method: 'TRANSFER', voided: false },
  ];

  it('iptal edilen üyelik ve iptal edilen ödeme bakiyeye girmez', () => {
    const memberships = [
      { id: 'm1', status: 'ACTIVE' as const, priceKurus: 150_000 },
      { id: 'm2', status: 'CANCELLED' as const, priceKurus: 90_000 },
    ];
    expect(balanceOf(memberships, payments)).toEqual({ chargedKurus: 150_000, paidKurus: 120_000, balanceKurus: 30_000 });
    expect(membershipDue(memberships[0]!, payments)).toBe(50_000);
    expect(membershipDue(memberships[1]!, payments)).toBe(0);
  });

  it('tahsilat özeti yönteme göre ayrılır', () => {
    expect(summarizePayments(payments)).toEqual({ totalKurus: 120_000, count: 2, byMethod: { CASH: 100_000, CARD: 0, TRANSFER: 20_000, OTHER: 0 } });
  });
});

describe('dersler', () => {
  it('saat ve çakışma: bitişe denk gelen başlangıç çakışmaz', () => {
    expect(timeToMin('18:30')).toBe(1110);
    expect(timeToMin('24:00')).toBeNull();
    expect(overlaps({ startTime: '18:00', durationMin: 60 }, { startTime: '18:30', durationMin: 30 })).toBe(true);
    expect(overlaps({ startTime: '18:00', durationMin: 60 }, { startTime: '19:00', durationMin: 60 })).toBe(false);
    expect(addDays('2026-12-29', 7)).toBe('2027-01-05');
    expect(weekdayOf('2026-11-16')).toBe(0); // Pazartesi
    expect(weekdayOf('2026-11-22')).toBe(6); // Pazar
  });

  const monthly: CoverMembership = { id: 'aylik', status: 'ACTIVE', startDate: '2026-11-01', endDate: '2026-11-30', sessionsLeft: null };
  const pack = (id: string, endDate: string, sessionsLeft: number): CoverMembership => ({ id, status: 'ACTIVE', startDate: '2026-11-01', endDate, sessionsLeft });

  it('grup dersi önce sınırsız üyelikten karşılanır, ders paketini harcamaz', () => {
    expect(pickCoverage('GROUP', '2026-11-10', [pack('p', '2026-12-31', 5), monthly])).toEqual({ kind: 'UNLIMITED', membershipId: 'aylik' });
    expect(pickCoverage('GROUP', '2026-11-10', [pack('p', '2026-12-31', 5)])).toEqual({ kind: 'SESSION', membershipId: 'p' });
  });

  it('özel ders sadece ders hakkından düşer; önce süresi erken biten paket kullanılır', () => {
    expect(pickCoverage('PRIVATE', '2026-11-10', [pack('gec', '2026-12-31', 5), pack('erken', '2026-11-20', 2), monthly])).toEqual({ kind: 'SESSION', membershipId: 'erken' });
    expect(pickCoverage('PRIVATE', '2026-11-10', [monthly])).toEqual({ kind: 'NONE', reason: 'NO_SESSIONS_LEFT' });
  });

  it('hakkı bitmiş, süresi dolmuş ya da iptal edilmiş üyelik kapsamaz', () => {
    expect(pickCoverage('PRIVATE', '2026-11-10', [pack('p', '2026-12-31', 0)])).toEqual({ kind: 'NONE', reason: 'NO_SESSIONS_LEFT' });
    expect(pickCoverage('GROUP', '2026-12-05', [monthly])).toEqual({ kind: 'NONE', reason: 'NO_ACTIVE_MEMBERSHIP' });
    expect(pickCoverage('GROUP', '2026-11-10', [{ ...monthly, status: 'CANCELLED' }])).toEqual({ kind: 'NONE', reason: 'NO_ACTIVE_MEMBERSHIP' });
  });
});
describe('salonun günü (Türkiye saati)', () => {
  it('UTC gece 21:00 sonrası Türkiye\'de ertesi gündür; gün başlangıcı 21:00 UTC\'dir', () => {
    expect(localDay(new Date('2026-11-12T20:59:00Z'))).toBe('2026-11-12');
    expect(localDay(new Date('2026-11-12T21:30:00Z'))).toBe('2026-11-13');
    expect(localDayStart('2026-11-13').toISOString()).toBe('2026-11-12T21:00:00.000Z');
  });
});