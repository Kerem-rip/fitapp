// Web: sesli mesaj tarayıcının ses oynatıcısıyla çalınır.
import { createElement } from 'react';
import { mediaUrl } from '@/api/media';

export function VoiceView({ url }: { url: string; durationMs?: number | null; light?: boolean }) {
  return createElement('audio', { src: mediaUrl(url) ?? undefined, controls: true, preload: 'metadata', 'aria-label': 'Sesli mesaj', style: { width: 220, height: 36 } });
}
