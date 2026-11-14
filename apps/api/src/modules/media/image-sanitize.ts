// Yüklenen fotoğrafın türünü ilk baytlardan belirler ve içindeki gizli bilgileri (EXIF: GPS konumu, cihaz,
// çekim tarihi; XMP/IPTC; PNG metin parçaları) çıkarır. Görüntü verisine dokunmaz. SAF fonksiyonlar.
// Not: Boyut küçültme ve sıkıştırma uygulamada (telefonda) yapılır; sunucu tür, boyut ve gizlilik denetler.

export type ImageMime = 'image/jpeg' | 'image/png';

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

export function detectImage(buffer: Buffer): ImageMime | null {
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return 'image/jpeg';
  if (buffer.length >= 8 && buffer.subarray(0, 8).equals(PNG_SIGNATURE)) return 'image/png';
  return null;
}

// JPEG: APP1 (EXIF/XMP), APP13 (IPTC/Photoshop) ve yorum (COM) bölümleri atılır; görüntü bölümleri aynen kalır.
// Bozuk dosyada null döner.
export function stripJpegMetadata(input: Buffer): Buffer | null {
  if (detectImage(input) !== 'image/jpeg') return null;
  const parts: Buffer[] = [input.subarray(0, 2)];
  let i = 2;
  while (i < input.length) {
    if (input[i] !== 0xff) return null;
    const marker = input[i + 1];
    if (marker === undefined) return null;
    // Dolgu baytları
    if (marker === 0xff) {
      i += 1;
      continue;
    }
    // Uzunluğu olmayan işaretler
    if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
      parts.push(input.subarray(i, i + 2));
      i += 2;
      continue;
    }
    if (marker === 0xd9) {
      parts.push(input.subarray(i, i + 2));
      return Buffer.concat(parts);
    }
    if (i + 4 > input.length) return null;
    const length = input.readUInt16BE(i + 2);
    if (length < 2 || i + 2 + length > input.length) return null;
    // Tarama başlangıcı: kalan sıkıştırılmış veri olduğu gibi kopyalanır
    if (marker === 0xda) {
      parts.push(input.subarray(i));
      return Buffer.concat(parts);
    }
    const drop = marker === 0xe1 || marker === 0xed || marker === 0xfe;
    if (!drop) parts.push(input.subarray(i, i + 2 + length));
    i += 2 + length;
  }
  return null;
}

// PNG: metin ve EXIF parçaları (tEXt, iTXt, zTXt, eXIf) atılır.
export function stripPngMetadata(input: Buffer): Buffer | null {
  if (detectImage(input) !== 'image/png') return null;
  const parts: Buffer[] = [PNG_SIGNATURE];
  let i = 8;
  while (i < input.length) {
    if (i + 12 > input.length) return null;
    const length = input.readUInt32BE(i);
    const type = input.subarray(i + 4, i + 8).toString('latin1');
    const end = i + 12 + length;
    if (end > input.length) return null;
    if (!['tEXt', 'iTXt', 'zTXt', 'eXIf'].includes(type)) parts.push(input.subarray(i, end));
    i = end;
    if (type === 'IEND') return Buffer.concat(parts);
  }
  return null;
}

export function sanitizeImage(input: Buffer): { mime: ImageMime; data: Buffer } | null {
  const mime = detectImage(input);
  if (mime === 'image/jpeg') {
    const data = stripJpegMetadata(input);
    return data ? { mime, data } : null;
  }
  if (mime === 'image/png') {
    const data = stripPngMetadata(input);
    return data ? { mime, data } : null;
  }
  return null;
}
