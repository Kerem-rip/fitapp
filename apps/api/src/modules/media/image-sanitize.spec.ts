import { detectImage, sanitizeImage, stripJpegMetadata, stripPngMetadata } from './image-sanitize.js';

const seg = (marker: number, payload: Buffer) => {
  const head = Buffer.alloc(4);
  head[0] = 0xff;
  head[1] = marker;
  head.writeUInt16BE(payload.length + 2, 2);
  return Buffer.concat([head, payload]);
};

// SOI + APP0 (JFIF) + APP1 (EXIF, GPS içerir) + COM + DQT + SOS + veri + EOI
const jpeg = Buffer.concat([
  Buffer.from([0xff, 0xd8]),
  seg(0xe0, Buffer.from('JFIF\0')),
  seg(0xe1, Buffer.from('Exif\0\0GPS-41.0,29.0')),
  seg(0xfe, Buffer.from('yorum')),
  seg(0xdb, Buffer.alloc(10, 1)),
  seg(0xda, Buffer.alloc(6, 2)),
  Buffer.from([0x12, 0x34, 0xff, 0x00, 0x56]),
  Buffer.from([0xff, 0xd9]),
]);

const chunk = (type: string, data: Buffer) => {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  return Buffer.concat([len, Buffer.from(type, 'latin1'), data, Buffer.alloc(4)]);
};
const png = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  chunk('IHDR', Buffer.alloc(13)),
  chunk('tEXt', Buffer.from('Author\0Ayse')),
  chunk('eXIf', Buffer.from('GPS')),
  chunk('IDAT', Buffer.alloc(5, 7)),
  chunk('IEND', Buffer.alloc(0)),
]);

describe('fotoğraf temizleme', () => {
  it('türü ilk baytlardan anlar; uzantıya bakmaz', () => {
    expect(detectImage(jpeg)).toBe('image/jpeg');
    expect(detectImage(png)).toBe('image/png');
    expect(detectImage(Buffer.from('%PDF-1.4'))).toBeNull();
    expect(detectImage(Buffer.from('GIF89a'))).toBeNull();
  });

  it('JPEG içindeki EXIF (GPS) ve yorum çıkar; görüntü verisi aynen kalır', () => {
    const out = stripJpegMetadata(jpeg)!;
    expect(out.includes(Buffer.from('GPS'))).toBe(false);
    expect(out.includes(Buffer.from('yorum'))).toBe(false);
    expect(out.includes(Buffer.from('JFIF'))).toBe(true);
    expect(out.subarray(-7).equals(Buffer.from([0x12, 0x34, 0xff, 0x00, 0x56, 0xff, 0xd9]))).toBe(true);
  });

  it('PNG metin ve EXIF parçaları çıkar', () => {
    const out = stripPngMetadata(png)!;
    expect(out.includes(Buffer.from('Ayse'))).toBe(false);
    expect(out.includes(Buffer.from('eXIf'))).toBe(false);
    expect(out.includes(Buffer.from('IDAT'))).toBe(true);
  });

  it('bozuk ya da desteklenmeyen dosya reddedilir', () => {
    expect(sanitizeImage(jpeg.subarray(0, 12))).toBeNull();
    expect(sanitizeImage(png.subarray(0, 20))).toBeNull();
    expect(sanitizeImage(Buffer.from('merhaba'))).toBeNull();
  });
});
