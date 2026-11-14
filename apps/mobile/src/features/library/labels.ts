// Kütüphane ekranlarında ortak yazılar.

export const LEVEL_TEXT: Record<string, string> = { beginner: 'Başlangıç', intermediate: 'Orta', advanced: 'İleri' };

// Kaynak doğrulama etiketi (kanıt katmanı)
export const VERIFICATION_TEXT: Record<string, { label: string; kind: 'success' | 'info' | 'warning' | 'neutral' }> = {
  ok: { label: 'Kaynaklarla doğrulandı', kind: 'success' },
  partial: { label: 'Kısmen doğrulandı', kind: 'info' },
  held: { label: 'Doğrulama sürüyor', kind: 'warning' },
  none: { label: 'Henüz taranmadı', kind: 'neutral' },
};

export const ALT_TYPE_TEXT: Record<string, string> = { EASIER: 'Daha kolay', HARDER: 'Daha zor', EQUIVALENT: 'Benzer', NO_EQUIPMENT: 'Ekipmansız' };

// 95 → "1 dk 35 sn", 600 → "10 dk", 40 → "40 sn"
export function durationText(sec: number): string {
  if (sec < 60) return `${sec} sn`;
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return s ? `${m} dk ${s} sn` : `${m} dk`;
}

// Bir program kartının alt satırı: "4 hafta · haftada 3 gün · ~12 dk"
export function programMeta(p: { weeks: number; daysPerWeek: number; minutesPerDay: number }): string {
  return `${p.weeks} hafta · haftada ${p.daysPerWeek} gün · ~${p.minutesPerDay} dk`;
}
