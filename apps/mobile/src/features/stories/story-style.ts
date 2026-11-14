// Hikâye görünümü: metin hikâyesi arka planları, kitle etiketleri ve tepki emojileri (sunucudaki listeyle aynı).
import type { StoryAudience, StoryBackground } from '@fitapp/api-client';

export const BACKGROUNDS: { key: StoryBackground; label: string; color: string }[] = [
  { key: 'sunset', label: 'Gün batımı', color: '#F2734B' },
  { key: 'ocean', label: 'Okyanus', color: '#1F7AE0' },
  { key: 'forest', label: 'Orman', color: '#1E9E6A' },
  { key: 'night', label: 'Gece', color: '#272B3A' },
  { key: 'berry', label: 'Böğürtlen', color: '#B0367A' },
];

export const backgroundColor = (key: StoryBackground | null) => BACKGROUNDS.find((b) => b.key === key)?.color ?? '#272B3A';

export const AUDIENCES: { key: StoryAudience; label: string }[] = [
  { key: 'EVERYONE', label: 'Herkes' },
  { key: 'FOLLOWERS', label: 'Takipçiler' },
  { key: 'CLOSE_FRIENDS', label: 'Yakın arkadaşlar' },
];

export const REACTIONS = ['❤️', '🔥', '👏', '😂', '😮', '😢', '💪'] as const;

// Fotoğraf hikâyesi bu kadar, video kendi süresi kadar görünür
export const PHOTO_MS = 5000;
