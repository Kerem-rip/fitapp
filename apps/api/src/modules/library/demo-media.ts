// GEÇİCİ DEMO MEDYASI: apps/api/demo-media/<hareket-kimliği>.(mp4|webm|gif|webp) dosyaları hareket sayfasında ve oynatıcıda büyük, tekrar eden klip olarak gösterilir.
// Klasör Git'e girmez (yalnızca bilgisayarda kalır); üretimde (NODE_ENV=production) kapalıdır. Gerçek yayında lisanslı/kendi çekimlerinle değiştirilir.
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

export const DEMO_MEDIA_DIR = resolve(process.cwd(), 'demo-media');
const EXTS = ['mp4', 'webm', 'gif', 'webp'] as const;
export const DEMO_FILE = /^[a-z0-9-]{1,80}\.(mp4|webm|gif|webp)$/;
export const DEMO_TYPES: Record<string, string> = { mp4: 'video/mp4', webm: 'video/webm', gif: 'image/gif', webp: 'image/webp' };

export function findDemoMedia(id: string): { kind: 'video' | 'image'; url: string } | null {
  if (process.env.NODE_ENV === 'production') return null;
  for (const ext of EXTS) {
    if (existsSync(resolve(DEMO_MEDIA_DIR, `${id}.${ext}`))) return { kind: ext === 'mp4' || ext === 'webm' ? 'video' : 'image', url: `/api/demo-media/${id}.${ext}` };
  }
  return null;
}
