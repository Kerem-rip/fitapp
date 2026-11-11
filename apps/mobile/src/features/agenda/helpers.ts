// Randevu ve hatırlatma için tarih/saat yardımcıları (cihazın yerel saatiyle).
import type { AppointmentMode, AppointmentStatus } from '@fitapp/api-client';

// "12.03.2026" + "14:30" → ISO. Geçersizse null.
export function parseDateTime(date: string, time: string): string | null {
  const d = /^(\d{1,2})\.(\d{1,2})\.(\d{4})$/.exec(date.trim());
  const t = /^([01]?\d|2[0-3]):([0-5]\d)$/.exec(time.trim());
  if (!d || !t) return null;
  const value = new Date(Number(d[3]), Number(d[2]) - 1, Number(d[1]), Number(t[1]), Number(t[2]));
  if (value.getDate() !== Number(d[1]) || value.getMonth() !== Number(d[2]) - 1) return null;
  return value.toISOString();
}

export const todayText = (offsetDays = 0) => {
  const d = new Date(Date.now() + offsetDays * 86_400_000);
  return `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}.${d.getFullYear()}`;
};

export const startOfDay = (offsetDays = 0) => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + offsetDays);
  return d;
};

export const formatWhen = (iso: string) =>
  new Date(iso).toLocaleString('tr-TR', { weekday: 'short', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' });

export const formatTime = (iso: string) => new Date(iso).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });

export const MODE_LABELS: Record<AppointmentMode, string> = { ONLINE: 'Online', IN_PERSON: 'Yüz yüze' };

export const STATUS_TAGS: Record<AppointmentStatus, { label: string; kind: 'accent' | 'success' | 'neutral' | 'danger' }> = {
  SCHEDULED: { label: 'Planlı', kind: 'accent' },
  COMPLETED: { label: 'Tamamlandı', kind: 'success' },
  CANCELLED: { label: 'İptal', kind: 'neutral' },
  NO_SHOW: { label: 'Gelmedi', kind: 'danger' },
};
