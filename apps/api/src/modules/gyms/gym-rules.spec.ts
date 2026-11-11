import { balanceOf, can, membershipDue, membershipEnd, membershipState, permissionsOf, summarizePayments, type PaymentRow } from './gym-rules.js';

describe('salon yetkileri', () => {
  it('sahip her şeyi yapar; resepsiyon üye ve ödeme kaydı yapar ama iptal ve rapor yapamaz', () => {
    expect(permissionsOf('OWNER')).toHaveLength(12);
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
