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
  // Her dersi oluşturma, iptal, üye yazma ve katılım işaretleme. Eğitmen bunları sadece kendi dersinde yapar (bkz. lessons.service).
  'lessons.manage': ['OWNER', 'RECEPTION'],
  'tasks.manage': ['OWNER'],
  'shifts.manage': ['OWNER'],
} as const satisfies Record<string, readonly GymRole[]>;

export type Permission = keyof typeof PERMISSIONS;

export const can = (role: GymRole, permission: Permission) => (PERMISSIONS[permission] as readonly GymRole[]).includes(role);

export const permissionsOf = (role: GymRole) => (Object.keys(PERMISSIONS) as Permission[]).filter((p) => can(role, p));

// ───────────── Tarih ─────────────

const DAY_MS = 86_400_000;
export const toDay = (d: Date) => d.toISOString().slice(0, 10);
export const parseDay = (s: string) => new Date(`${s}T00:00:00Z`);

// Salonun günü Türkiye saatine göredir (UTC+3; Türkiye 2016'dan beri yaz saati uygulamıyor).
// Sunucu saati UTC olduğu için gece 00:00–03:00 arası aksi halde bir önceki gün sayılırdı.
const TR_OFFSET_MS = 3 * 60 * 60 * 1000;
export const localDay = (at: Date = new Date()) => toDay(new Date(at.getTime() + TR_OFFSET_MS));
// Türkiye saatiyle o günün başladığı an
export const localDayStart = (day: string) => new Date(parseDay(day).getTime() - TR_OFFSET_MS);

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

// ───────────── Dersler ─────────────

export const addDays = (day: string, n: number) => toDay(new Date(parseDay(day).getTime() + n * DAY_MS));

// "18:30" → 1110 (dakika); geçersizse null
export function timeToMin(time: string): number | null {
  const m = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(time);
  return m ? Number(m[1]) * 60 + Number(m[2]) : null;
}

// Aynı gün iki ders çakışıyor mu (bitiş anı ile başlangıç anı aynıysa çakışmaz)
export function overlaps(a: { startTime: string; durationMin: number }, b: { startTime: string; durationMin: number }): boolean {
  const as = timeToMin(a.startTime) ?? 0;
  const bs = timeToMin(b.startTime) ?? 0;
  return as < bs + b.durationMin && bs < as + a.durationMin;
}

// 0 = Pazartesi … 6 = Pazar
export const weekdayOf = (day: string) => (parseDay(day).getUTCDay() + 6) % 7;

export interface CoverMembership {
  id: string;
  status: 'ACTIVE' | 'CANCELLED';
  startDate: string;
  endDate: string;
  sessionsLeft: number | null;
}

export type Coverage =
  | { kind: 'SESSION'; membershipId: string } // Bu üyelikten 1 ders hakkı düşer
  | { kind: 'UNLIMITED'; membershipId: string } // Sınırsız üyelik kapsar; hak düşmez
  | { kind: 'NONE'; reason: 'NO_ACTIVE_MEMBERSHIP' | 'NO_SESSIONS_LEFT' };

// Katılımın hangi üyelikten karşılanacağı:
// - Grup dersi önce sınırsız üyelikten karşılanır (ders paketini harcamaz), yoksa ders hakkından düşer.
// - Özel ders sadece ders hakkı olan üyelikten düşer.
// - Birden çok ders paketi varsa önce süresi en erken biten kullanılır.
// Uygun üyelik yoksa NONE döner; bu bir uyarıdır, karar salonundur.
export function pickCoverage(kind: 'GROUP' | 'PRIVATE', day: string, memberships: readonly CoverMembership[]): Coverage {
  const valid = memberships.filter((m) => m.status === 'ACTIVE' && m.startDate <= day && day <= m.endDate);
  if (valid.length === 0) return { kind: 'NONE', reason: 'NO_ACTIVE_MEMBERSHIP' };
  const unlimited = valid.find((m) => m.sessionsLeft === null);
  if (kind === 'GROUP' && unlimited) return { kind: 'UNLIMITED', membershipId: unlimited.id };
  const withSessions = valid.filter((m) => m.sessionsLeft !== null && m.sessionsLeft > 0).sort((a, b) => a.endDate.localeCompare(b.endDate));
  if (withSessions[0]) return { kind: 'SESSION', membershipId: withSessions[0].id };
  // Geçerli üyeliği var ama düşülecek ders hakkı yok (hak bitmiş ya da özel derste sadece sınırsız üyelik var)
  return { kind: 'NONE', reason: 'NO_SESSIONS_LEFT' };
}