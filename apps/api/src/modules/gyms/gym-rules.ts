// Salon kuralları: görev bazlı yetki, üyelik tarihleri, bakiye ve tahsilat özeti. SAF fonksiyonlar.
// Tutarlar kuruş cinsinden tamsayıdır. Uygulama ödeme almaz; bunlar salonun kendi kayıtlarıdır.

export type GymRole = 'OWNER' | 'TRAINER' | 'RECEPTION';

// Personelin erişimi göreviyle sınırlıdır
export const PERMISSIONS = {
  'gym.edit': ['OWNER'],
  'staff.manage': ['OWNER'],
  'plans.manage': ['OWNER'],
  'plans.view': ['OWNER', 'RECEPTION'],
  'members.view': ['OWNER', 'RECEPTION', 'TRAINER'],
  // Telefon gibi iletişim bilgileri
  'members.contact': ['OWNER', 'RECEPTION'],
  'members.manage': ['OWNER', 'RECEPTION'],
  'memberships.manage': ['OWNER', 'RECEPTION'],
  'payments.view': ['OWNER', 'RECEPTION'],
  'payments.record': ['OWNER', 'RECEPTION'],
  'payments.void': ['OWNER'],
  'reports.view': ['OWNER'],
} as const satisfies Record<string, readonly GymRole[]>;

export type Permission = keyof typeof PERMISSIONS;

export const can = (role: GymRole, permission: Permission) => (PERMISSIONS[permission] as readonly GymRole[]).includes(role);

export const permissionsOf = (role: GymRole) => (Object.keys(PERMISSIONS) as Permission[]).filter((p) => can(role, p));

// ───────────── Tarih ─────────────

const DAY_MS = 86_400_000;
export const toDay = (d: Date) => d.toISOString().slice(0, 10);
export const parseDay = (s: string) => new Date(`${s}T00:00:00Z`);

// "30 günlük" üyelik başladığı gün dahil 30 gün sürer: 1 Kasım → 30 Kasım
export function membershipEnd(startDay: string, durationDays: number): string {
  return toDay(new Date(parseDay(startDay).getTime() + (durationDays - 1) * DAY_MS));
}

export type MembershipState = 'UPCOMING' | 'ACTIVE' | 'USED_UP' | 'EXPIRED' | 'CANCELLED';

export function membershipState(
  m: { status: 'ACTIVE' | 'CANCELLED'; startDate: string; endDate: string; sessionsLeft: number | null },
  today: string,
): MembershipState {
  if (m.status === 'CANCELLED') return 'CANCELLED';
  if (today < m.startDate) return 'UPCOMING';
  if (today > m.endDate) return 'EXPIRED';
  if (m.sessionsLeft !== null && m.sessionsLeft <= 0) return 'USED_UP';
  return 'ACTIVE';
}

export const daysBetween = (fromDay: string, toDayStr: string) => Math.round((parseDay(toDayStr).getTime() - parseDay(fromDay).getTime()) / DAY_MS);

// ───────────── Para ─────────────

export interface Charge {
  id: string;
  status: 'ACTIVE' | 'CANCELLED';
  priceKurus: number;
}

export interface PaymentRow {
  membershipId: string | null;
  amountKurus: number;
  method: 'CASH' | 'CARD' | 'TRANSFER' | 'OTHER';
  voided: boolean;
}

// İptal edilmemiş üyeliklerin toplamı − iptal edilmemiş ödemelerin toplamı. Pozitifse üyenin borcu vardır.
export function balanceOf(memberships: readonly Charge[], payments: readonly PaymentRow[]) {
  const chargedKurus = memberships.filter((m) => m.status !== 'CANCELLED').reduce((sum, m) => sum + m.priceKurus, 0);
  const paidKurus = payments.filter((p) => !p.voided).reduce((sum, p) => sum + p.amountKurus, 0);
  return { chargedKurus, paidKurus, balanceKurus: chargedKurus - paidKurus };
}

// Üyelik başına kalan tutar (o üyeliğe bağlanmış ödemelere göre)
export function membershipDue(m: Charge, payments: readonly PaymentRow[]) {
  if (m.status === 'CANCELLED') return 0;
  const paid = payments.filter((p) => !p.voided && p.membershipId === m.id).reduce((sum, p) => sum + p.amountKurus, 0);
  return m.priceKurus - paid;
}

export function summarizePayments(payments: readonly PaymentRow[]) {
  const valid = payments.filter((p) => !p.voided);
  const byMethod = { CASH: 0, CARD: 0, TRANSFER: 0, OTHER: 0 };
  for (const p of valid) byMethod[p.method] += p.amountKurus;
  return { totalKurus: valid.reduce((sum, p) => sum + p.amountKurus, 0), count: valid.length, byMethod };
}
