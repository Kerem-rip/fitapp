import { buildTestMp4 } from '../../../test/fixtures/mp4.js';
import { detectVideo, sanitizeVideo } from './video-inspect.js';

describe('video inceleme', () => {
  it('süre okunur, konum içeren kutular etkisizleştirilir, boyut değişmez', () => {
    const file = buildTestMp4({ seconds: 12, location: '+41.0082+028.9784/' });
    expect(file.includes(Buffer.from('+41.0082'))).toBe(true);
    const out = sanitizeVideo(file);
    expect(out?.info).toEqual({ mime: 'video/mp4', durationMs: 12000 });
    expect(out!.data.length).toBe(file.length);
    expect(out!.data.includes(Buffer.from('+41.0082'))).toBe(false);
    expect(out!.data.includes(Buffer.from('udta'))).toBe(false);
    // Görüntü verisi (mdat) aynen kalır
    expect(out!.data.includes(Buffer.from('VIDEO-PAYLOAD'))).toBe(true);
  });

  it('QuickTime tanınır; video olmayan ya da bozuk dosya reddedilir', () => {
    expect(detectVideo(buildTestMp4({ seconds: 3, brand: 'qt  ' }))).toBe('video/quicktime');
    expect(sanitizeVideo(Buffer.from('bu bir video değil'))).toBeNull();
    const broken = buildTestMp4({ seconds: 3 }).subarray(0, 40);
    expect(sanitizeVideo(broken)).toBeNull();
  });
});
