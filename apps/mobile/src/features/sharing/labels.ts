// Paylaşım kategorilerinin ve denetim kaydının Türkçe karşılıkları.
import type { AuditEntry, SharedDataType } from '@fitapp/api-client';

export const SHARED_DATA_ORDER: SharedDataType[] = ['MEALS', 'WATER', 'WEIGHT', 'MEASUREMENTS', 'PHOTOS', 'ANAMNESIS', 'WORKOUTS'];

export const SHARED_DATA_LABELS: Record<SharedDataType, string> = {
  MEALS: 'Öğün kayıtlarım',
  WATER: 'Su takibim',
  WEIGHT: 'Kilo takibim',
  MEASUREMENTS: 'Vücut ölçülerim',
  PHOTOS: 'İlerleme fotoğraflarım',
  ANAMNESIS: 'Sağlık öyküm',
  WORKOUTS: 'Antrenman kayıtlarım',
};

export const SHARED_DATA_HINTS: Partial<Record<SharedDataType, string>> = {
  ANAMNESIS: 'Yaş, cinsiyet, alerji, hastalık ve yaşam tarzı bilgilerin',
  WORKOUTS: 'Setler, yükler, efor ve ağrı bildirimlerin',
};

// Cümle içinde kullanım: "kilo verine baktı"
const SHARED_DATA_IN_SENTENCE: Record<SharedDataType, string> = {
  MEALS: 'öğün kayıtlarına',
  WATER: 'su takibine',
  WEIGHT: 'kilo verine',
  MEASUREMENTS: 'vücut ölçülerine',
  PHOTOS: 'ilerleme fotoğraflarına',
  ANAMNESIS: 'sağlık öyküne',
  WORKOUTS: 'antrenman kayıtlarına',
};

export const SHARE_PERIODS = [
  { key: 'forever', label: 'Süresiz', days: null },
  { key: '1m', label: '1 ay', days: 30 },
  { key: '3m', label: '3 ay', days: 90 },
  { key: '6m', label: '6 ay', days: 180 },
] as const;

export type SharePeriodKey = (typeof SHARE_PERIODS)[number]['key'];

export function periodToIso(key: SharePeriodKey, now = Date.now()): string | null {
  const days = SHARE_PERIODS.find((p) => p.key === key)?.days ?? null;
  return days === null ? null : new Date(now + days * 86_400_000).toISOString();
}

export const formatDay = (iso: string) => new Date(iso).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' });

export const formatDateTime = (iso: string) =>
  new Date(iso).toLocaleString('tr-TR', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' });

export function nameOf(person: { firstName: string | null; lastName: string | null; username: string } | null): string {
  if (!person) return 'Silinmiş bir hesap';
  return [person.firstName, person.lastName].filter(Boolean).join(' ') || person.username;
}

// Denetim kaydını danışanın okuyacağı bir cümleye çevirir
export function auditSentence(entry: AuditEntry, myUsername: string): string {
  const mine = entry.actor?.username === myUsername;
  const who = mine ? 'Sen' : nameOf(entry.actor);
  const what = entry.category ? SHARED_DATA_IN_SENTENCE[entry.category] : 'verilerine';
  switch (entry.action) {
    case 'OFFER_SENT':
      return `${who} danışanlık teklifi gönderdi`;
    case 'OFFER_ACCEPTED':
      return 'Danışanlık teklifini kabul ettin';
    case 'OFFER_DECLINED':
      return 'Danışanlık teklifini reddettin';
    case 'SHARING_CHANGED':
      return 'Paylaşım ayarını değiştirdin';
    case 'RELATIONSHIP_ENDED':
      return mine ? 'Danışanlığı sonlandırdın' : `${who} danışanlığı sonlandırdı`;
    case 'DATA_VIEWED':
      return `${who} ${what} baktı`;
    case 'DATA_CHANGED':
      return `${who} ${what} yeni bilgi ekledi veya değiştirdi`;
    case 'ACCESS_DENIED':
      return `${who} izin vermediğin ${what} erişmeye çalıştı (engellendi)`;
  }
}
