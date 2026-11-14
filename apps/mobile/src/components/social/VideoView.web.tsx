// Web: tarayıcının kendi video oynatıcısı (sessiz başlar, dokununca kontroller).
import { createElement } from 'react';
import { mediaUrl } from '@/api/media';

export function VideoView({ url, width, height, label }: { url: string; width: number; height: number; durationMs?: number | null; label: string }) {
  return createElement('video', {
    src: mediaUrl(url) ?? undefined,
    controls: true,
    playsInline: true,
    muted: true,
    preload: 'metadata',
    'aria-label': label,
    style: { width, height, objectFit: 'cover', backgroundColor: '#000', display: 'block' },
  });
}
