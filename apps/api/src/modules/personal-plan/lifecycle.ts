// Program yaşam döngüsü: sabit 28 takvim günü, başlangıç penceresi ve durumlar. SAF fonksiyonlar.
// Tüm günler Türkiye takvim günüdür (UTC+3); sunucu saati ya da cihaz saat dilimi sonucu değiştirmez.
//   - Duraklatma yok; antrenman kaçırmak bitiş tarihini değiştirmez; yeni dönem otomatik başlamaz.
//   - "Süresi doldu" ile "tamamlandı" ayrıdır: tamamlandı = 4 hafta da üretilmiş ve her antrenman gününün ana hareketleri yapılmış.
import { addLocalDays } from '../../common/local-day.js';

export const PLAN_DAYS = 28;
export const PLAN_WEEKS = 4;
// Satın almadan sonra başlangıç tarihi bu kadar gün içinde seçilir (karar: 14 gün)
export const START_WINDOW_DAYS = 14;
// Güvenlik taraması bu kadar günden eskiyse yenilenmelidir
export const INTAKE_MAX_AGE_DAYS = 30;

export type PlanPhase = 'AWAITING_START' | 'START_WINDOW_MISSED' | 'ACTIVE' | 'COMPLETED' | 'EXPIRED';

export const endDateOf = (startDate: string) => addLocalDays(startDate, PLAN_DAYS - 1);
export const dayDateOf = (startDate: string, dayNumber: number) => addLocalDays(startDate, dayNumber - 1);
export const weekOfDay = (dayNumber: number) => Math.ceil(dayNumber / 7);
export const weekStartDay = (week: number) => (week - 1) * 7 + 1;

// Bugün programın kaçıncı günü (başlamadıysa ya da bittiyse null)
export function currentDayNumber(startDate: string, today: string): number | null {
  const n = Math.round((new Date(`${today}T00:00:00Z`).getTime() - new Date(`${startDate}T00:00:00Z`).getTime()) / 86_400_000) + 1;
  return n >= 1 && n <= PLAN_DAYS ? n : null;
}

// Başlangıç tarihi: bugünden önce olamaz, satın alma gününden itibaren en fazla 14 gün sonrası olabilir
export function startDateProblem(startDate: string, today: string, purchaseDay: string): 'PAST' | 'TOO_LATE' | 'WINDOW_MISSED' | null {
  if (today > addLocalDays(purchaseDay, START_WINDOW_DAYS)) return 'WINDOW_MISSED';
  if (startDate < today) return 'PAST';
  if (startDate > addLocalDays(purchaseDay, START_WINDOW_DAYS)) return 'TOO_LATE';
  return null;
}

export function phaseOf(input: { startDate: string | null; purchaseDay: string; today: string; allCompleted: boolean }): PlanPhase {
  const { startDate, purchaseDay, today } = input;
  if (!startDate) return today > addLocalDays(purchaseDay, START_WINDOW_DAYS) ? 'START_WINDOW_MISSED' : 'AWAITING_START';
  if (today < startDate) return 'AWAITING_START';
  if (today <= endDateOf(startDate)) return input.allCompleted ? 'COMPLETED' : 'ACTIVE';
  return input.allCompleted ? 'COMPLETED' : 'EXPIRED';
}
