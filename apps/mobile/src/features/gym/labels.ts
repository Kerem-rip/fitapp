// Salon ekranlarının ortak metinleri ve para biçimi. Tutarlar sunucuda kuruş (tam sayı) olarak durur.
import type { GymRole, MembershipItem, MembershipState, PaymentMethod } from '@fitapp/api-client';

export const GYM_ROLE_LABELS: Record<GymRole, string> = {
  OWNER: 'Salon sahibi',
  TRAINER: 'Eğitmen',
  RECEPTION: 'Resepsiyon',
};

export const METHOD_LABELS: Record<PaymentMethod, string> = {
  CASH: 'Nakit',
  CARD: 'Kart',
  TRANSFER: 'Havale/EFT',
  OTHER: 'Diğer',
};

export const STATE_LABELS: Record<MembershipState, string> = {
  UPCOMING: 'Başlamadı',
  ACTIVE: 'Aktif',
  USED_UP: 'Dersleri bitti',
  EXPIRED: 'Süresi doldu',
  CANCELLED: 'İptal',
};

type TagKind = 'success' | 'warning' | 'danger' | 'neutral' | 'info' | 'accent';

// Üyeliğin etiketi: aktifse ve 7 günden az kaldıysa uyarı rengi
export function membershipTag(m: MembershipItem | null): { label: string; kind: TagKind } {
  if (!m) return { label: 'Üyelik yok', kind: 'neutral' };
  if (m.state === 'ACTIVE' && m.daysLeft <= 7) return { label: m.daysLeft === 0 ? 'Bugün bitiyor' : `${m.daysLeft} gün kaldı`, kind: 'warning' };
  const kind: Record<MembershipState, TagKind> = { UPCOMING: 'info', ACTIVE: 'success', USED_UP: 'warning', EXPIRED: 'danger', CANCELLED: 'neutral' };
  return { label: STATE_LABELS[m.state], kind: kind[m.state] };
}

// 150000 → "1.500 TL", 150050 → "1.500,50 TL"
export function formatTL(kurus: number): string {
  const tl = kurus / 100;
  return `${tl.toLocaleString('tr-TR', { minimumFractionDigits: kurus % 100 === 0 ? 0 : 2, maximumFractionDigits: 2 })} TL`;
}

// "1.500" / "1500,50" / "1500.5" → kuruş; geçersiz ya da sıfır/eksi ise null
export function parseTL(text: string): number | null {
  let t = text.trim().replace(/\s|TL/gi, '');
  if (!t) return null;
  // Türkçe yazım: nokta binlik, virgül ondalık. Sadece nokta varsa ve ardından 1-2 hane geliyorsa ondalık sayılır.
  if (t.includes(',')) t = t.replace(/\./g, '').replace(',', '.');
  else if (!/^\d+\.\d{1,2}$/.test(t)) t = t.replace(/\./g, '');
  if (!/^\d+(\.\d{1,2})?$/.test(t)) return null;
  const kurus = Math.round(Number(t) * 100);
  return kurus > 0 ? kurus : null;
}

// "2026-11-11" → "11 Kasım 2026"
export function formatDate(day: string): string {
  return new Date(`${day.slice(0, 10)}T12:00:00Z`).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
}

// "GG.AA.YYYY" → "YYYY-MM-DD" (ileri tarih olabilir); boşsa undefined, hatalıysa null
export function parseDayInput(text: string): string | undefined | null {
  const trimmed = text.trim();
  if (!trimmed) return undefined;
  const m = /^(\d{1,2})\.(\d{1,2})\.(\d{4})$/.exec(trimmed);
  if (!m) return null;
  const date = new Date(Date.UTC(Number(m[3]), Number(m[2]) - 1, Number(m[1])));
  if (date.getUTCDate() !== Number(m[1]) || date.getUTCMonth() !== Number(m[2]) - 1) return null;
  return date.toISOString().slice(0, 10);
}
