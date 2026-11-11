// Tarih yardımcıları. Tarihler "YYYY-AA-GG" metni olarak, cihazın yerel saatine göre tutulur.

const MONTHS = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'];
const WEEKDAYS = ['Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi', 'Pazar'];
export const DAY_SHORT = ['Pt', 'Sa', 'Ça', 'Pe', 'Cu', 'Ct', 'Pz'] as const;

const pad = (n: number) => String(n).padStart(2, '0');

export function toKey(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function fromKey(key: string): Date {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y!, m! - 1, d!);
}

// Bugünden `offset` gün sonrası (negatifse öncesi)
export function dateKey(offset = 0): string {
  const date = new Date();
  date.setDate(date.getDate() + offset);
  return toKey(date);
}

export function addDays(key: string, days: number): string {
  const date = fromKey(key);
  date.setDate(date.getDate() + days);
  return toKey(date);
}

// 0 = Pazartesi ... 6 = Pazar
export function weekdayIndex(key: string): number {
  return (fromKey(key).getDay() + 6) % 7;
}

// Verilen günün haftası: Pazartesi'den Pazar'a
export function weekOf(key: string): string[] {
  const start = addDays(key, -weekdayIndex(key));
  return Array.from({ length: 7 }, (_, i) => addDays(start, i));
}

export function dayNumber(key: string): number {
  return fromKey(key).getDate();
}

// "Çarşamba, 11 Kasım"
export function formatLong(key: string): string {
  const date = fromKey(key);
  return `${WEEKDAYS[weekdayIndex(key)]}, ${date.getDate()} ${MONTHS[date.getMonth()]}`;
}

// "11 Kas"
export function formatShort(key: string): string {
  const date = fromKey(key);
  return `${date.getDate()} ${MONTHS[date.getMonth()]!.slice(0, 3)}`;
}

export function isoNow(): string {
  return new Date().toISOString();
}

// "3 dk", "2 sa", "Dün"
export function timeAgo(iso: string): string {
  const minutes = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (minutes < 1) return 'Şimdi';
  if (minutes < 60) return `${minutes} dk`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} sa`;
  const days = Math.round(hours / 24);
  return days === 1 ? 'Dün' : `${days} gün`;
}

export function clockTime(iso: string): string {
  const date = new Date(iso);
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function newId(prefix: string): string {
  return `${prefix}-${Math.random().toString(36).slice(2, 9)}${Date.now().toString(36).slice(-3)}`;
}

// "3 ay", "2 hafta" gibi danışanlık süresi
export function durationLabel(fromIso: string): string {
  const days = Math.max(1, Math.round((Date.now() - new Date(fromIso).getTime()) / 86400000));
  if (days < 14) return `${days} gün`;
  if (days < 60) return `${Math.round(days / 7)} hafta`;
  return `${Math.round(days / 30)} ay`;
}
