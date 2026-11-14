// Sosyal bildirim kuralları: hangi tercih hangi türü kapatır, sessiz saatler ve kilit ekranı metni. SAF fonksiyonlar.

export type PrefKey = 'likes' | 'comments' | 'follows' | 'mentions' | 'stories' | 'messages';

export const SOCIAL_TYPES = [
  'social_follow',
  'social_follow_request',
  'social_follow_accepted',
  'social_like',
  'social_comment',
  'social_reply',
  'social_mention',
  'social_story_mention',
  'social_story_reaction',
  'social_story_answer',
  'moderation_removed',
  'moderation_restored',
  'appeal_rejected',
] as const;
export type SocialType = (typeof SOCIAL_TYPES)[number];

// Tercihle kapatılabilen türler (moderasyon bildirimleri kapatılamaz)
export function prefKeyOf(type: string): PrefKey | null {
  if (type.startsWith('social_follow')) return 'follows';
  if (type === 'social_like') return 'likes';
  if (type === 'social_comment' || type === 'social_reply') return 'comments';
  if (type === 'social_mention' || type === 'social_story_mention') return 'mentions';
  if (type.startsWith('social_story_')) return 'stories';
  if (type === 'dm_message') return 'messages';
  return null;
}

// Sessiz saat aralığı gece yarısını aşabilir (ör. 23 → 7)
export function inQuietHours(hour: number, from: number | null | undefined, to: number | null | undefined): boolean {
  if (from === null || from === undefined || to === null || to === undefined || from === to) return false;
  return from < to ? hour >= from && hour < to : hour >= from || hour < to;
}

// Türkiye saati (UTC+3, yaz saati yok)
export const turkeyHour = (now: Date) => (now.getUTCHours() + 3) % 24;

// Kilit ekranında görünebilecek metin: kişi adı, mesaj içeriği ve sağlık bilgisi içermez
export function lockScreenText(type: string): string {
  const key = prefKeyOf(type);
  switch (key) {
    case 'follows':
      return 'Yeni bir takip bildirimin var';
    case 'likes':
      return 'Gönderin beğenildi';
    case 'comments':
      return 'Yeni bir yorum var';
    case 'mentions':
      return 'Senden bahsedildi';
    case 'stories':
      return 'Hikâyene yanıt var';
    case 'messages':
      return 'Yeni mesajın var';
    default:
      return 'Yeni bir bildirimin var';
  }
}
