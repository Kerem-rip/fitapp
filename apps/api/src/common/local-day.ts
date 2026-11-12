// Uygulamadaki "gün" Türkiye saatine göredir (UTC+3; Türkiye 2016'dan beri yaz saati uygulamıyor).
// Sunucu saati UTC olduğu için gece 00:00–03:00 arası aksi halde bir önceki gün sayılırdı.
const TR_OFFSET_MS = 3 * 60 * 60 * 1000;
const DAY_MS = 86_400_000;

export const localDay = (at: Date = new Date()) => new Date(at.getTime() + TR_OFFSET_MS).toISOString().slice(0, 10);

// Türkiye saatiyle o günün başladığı an
export const localDayStart = (day: string) => new Date(new Date(`${day}T00:00:00Z`).getTime() - TR_OFFSET_MS);

export const addLocalDays = (day: string, n: number) => new Date(new Date(`${day}T00:00:00Z`).getTime() + n * DAY_MS).toISOString().slice(0, 10);

const DAY = /^\d{4}-\d{2}-\d{2}$/;
export const isValidDay = (s: string) => DAY.test(s) && new Date(`${s}T00:00:00Z`).toISOString().slice(0, 10) === s;
