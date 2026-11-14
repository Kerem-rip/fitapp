// Gönderi/yorum metninden #etiket ve @bahsetme ayıklama. SAF fonksiyonlar.

export const MAX_POST_TEXT = 2200;
export const MAX_COMMENT_TEXT = 500;
export const MAX_TAGS = 30;
export const MAX_MENTIONS = 20;

// Türkçe harfler dahil: #sabahKoşusu → "sabahkoşusu"
const TAG_RE = /(^|[^\p{L}\p{N}_&])#([\p{L}\p{N}_]{1,50})/gu;
// Kullanıcı adı kuralı kayıttakiyle aynı: küçük harf, rakam, _ ve .
const MENTION_RE = /(^|[^\p{L}\p{N}_.@])@([a-zA-Z0-9_.]{3,30})/gu;

export function hashtagsOf(text: string | null | undefined): string[] {
  if (!text) return [];
  const tags = [...text.matchAll(TAG_RE)].map((m) => m[2]!.toLocaleLowerCase('tr'));
  return [...new Set(tags)].slice(0, MAX_TAGS);
}

export function mentionsOf(text: string | null | undefined): string[] {
  if (!text) return [];
  const names = [...text.matchAll(MENTION_RE)].map((m) => m[2]!.toLowerCase().replace(/\.+$/, ''));
  return [...new Set(names)].filter((n) => n.length >= 3).slice(0, MAX_MENTIONS);
}

// Etiket arama terimi: baştaki # atılır, küçük harfe çevrilir
export function normalizeTag(input: string): string {
  return input.trim().replace(/^#+/, '').toLocaleLowerCase('tr');
}
