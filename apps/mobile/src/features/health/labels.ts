// Ölçüm türleri, yöntemleri ve kaynakları için Türkçe etiketler (kurallar sunucudaki measurement-rules ile aynıdır).
import type { DataSource, MeasurementItem, MeasurementKind, MeasurementMethod } from '@fitapp/api-client';

export const KIND_ORDER: MeasurementKind[] = [
  'WEIGHT',
  'HEIGHT',
  'WAIST',
  'HIP',
  'CHEST',
  'ARM',
  'THIGH',
  'BODY_FAT_PERCENT',
  'MUSCLE_MASS',
  'BODY_WATER_PERCENT',
];

export const KIND_LABELS: Record<MeasurementKind, string> = {
  WEIGHT: 'Kilo',
  HEIGHT: 'Boy',
  WAIST: 'Bel çevresi',
  HIP: 'Kalça çevresi',
  CHEST: 'Göğüs çevresi',
  ARM: 'Kol çevresi',
  THIGH: 'Bacak çevresi',
  BODY_FAT_PERCENT: 'Vücut yağ oranı',
  MUSCLE_MASS: 'Kas kütlesi',
  BODY_WATER_PERCENT: 'Vücut su oranı',
};

const CIRCUMFERENCE: MeasurementMethod[] = ['TAPE', 'SELF_REPORT', 'OTHER'];

export const KIND_METHODS: Record<MeasurementKind, MeasurementMethod[]> = {
  WEIGHT: ['SCALE', 'SELF_REPORT', 'OTHER'],
  HEIGHT: ['TAPE', 'SELF_REPORT', 'OTHER'],
  WAIST: CIRCUMFERENCE,
  HIP: CIRCUMFERENCE,
  CHEST: CIRCUMFERENCE,
  ARM: CIRCUMFERENCE,
  THIGH: CIRCUMFERENCE,
  BODY_FAT_PERCENT: ['CALIPER', 'BIA', 'DEXA', 'SELF_REPORT', 'OTHER'],
  MUSCLE_MASS: ['BIA', 'DEXA', 'OTHER'],
  BODY_WATER_PERCENT: ['BIA', 'DEXA', 'OTHER'],
};

export const METHOD_LABELS: Record<MeasurementMethod, string> = {
  SCALE: 'Tartı',
  TAPE: 'Mezura',
  CALIPER: 'Kaliper',
  BIA: 'Vücut analiz cihazı (BIA)',
  DEXA: 'DEXA',
  SELF_REPORT: 'Kendim bildirdim',
  OTHER: 'Diğer',
};

export const SOURCE_LABELS: Record<DataSource, string> = {
  SELF: 'Danışan girdi',
  PROFESSIONAL: 'Uzman girdi',
  DEVICE: 'Cihazdan',
};

export const formatValue = (m: Pick<MeasurementItem, 'value' | 'unit'>) =>
  `${m.value.toLocaleString('tr-TR', { maximumFractionDigits: 1 })} ${m.unit}`;

export const formatShortDate = (iso: string) => new Date(iso).toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' });

export const formatFullDate = (iso: string) => new Date(iso).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' });

// Bir ölçümü, aynı türden bir önceki geçerli ölçümle karşılaştırır: " · önceki ölçüme göre +0,5 kg (yöntem farklı)"
export function changeText(m: MeasurementItem, all: readonly MeasurementItem[]): string {
  const older = all
    .filter((x) => x.kind === m.kind && !x.voided && x.id !== m.id && x.takenAt < m.takenAt)
    .sort((a, b) => b.takenAt.localeCompare(a.takenAt))[0];
  if (!older) return '';
  const diff = Math.round((m.value - older.value) * 10) / 10;
  const sign = diff > 0 ? '+' : '';
  const method = older.method !== m.method ? ' (yöntem farklı)' : '';
  return ` · önceki ölçüme göre ${sign}${diff.toLocaleString('tr-TR')} ${m.unit}${method}`;
}

// Aynı ölçüm serisinde birden fazla yöntem varsa değerler doğrudan karşılaştırılamaz
export const mixedMethods = (items: Pick<MeasurementItem, 'method'>[]) => new Set(items.map((i) => i.method)).size > 1;

// "12.03.2026" → ISO; boşsa undefined (sunucu "şimdi" alır). Geçersizse null.
export function parseDateInput(text: string): string | undefined | null {
  const trimmed = text.trim();
  if (!trimmed) return undefined;
  const m = /^(\d{1,2})\.(\d{1,2})\.(\d{4})$/.exec(trimmed);
  if (!m) return null;
  const date = new Date(Date.UTC(Number(m[3]), Number(m[2]) - 1, Number(m[1]), 12));
  const valid = date.getUTCFullYear() === Number(m[3]) && date.getUTCMonth() === Number(m[2]) - 1 && date.getUTCDate() === Number(m[1]);
  if (!valid || date.getTime() > Date.now()) return null;
  return date.toISOString();
}
