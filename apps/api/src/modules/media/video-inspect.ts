// Yüklenen videonun (MP4 / MOV) türünü ve süresini dosyanın kutularından (box) okur, içindeki
// kullanıcı bilgisi kutularını (udta, meta: konum, cihaz, tarih) etkisiz hale getirir. SAF fonksiyonlar.
// Kutular silinmez, "free" (boş) kutuya çevrilip içi sıfırlanır: dosyadaki konumlar (stco) bozulmaz, oynatıcılar
// "free" kutuyu yok sayar. Harici araç (ffmpeg vb.) kullanılmaz.

// audio/mp4: sesli mesaj (M4A), aynı kutu yapısını kullanır
export type VideoMime = 'video/mp4' | 'video/quicktime' | 'audio/mp4';

export interface VideoInfo {
  mime: VideoMime;
  durationMs: number;
}

// İçine girilen kap kutuları (udta ve meta da kap, ama onlar zaten etkisizleştirilir)
const CONTAINERS = new Set(['moov', 'trak', 'mdia', 'minf', 'stbl', 'edts', 'dinf']);
// Kişisel bilgi taşıyabilen kutular
const PRIVATE_BOXES = new Set(['udta', 'meta', 'uuid', 'XMP_']);

interface Box {
  type: string;
  start: number; // kutunun başlangıcı (başlık dahil)
  headerSize: number;
  size: number; // başlık dahil toplam boy
}

function readBoxes(buf: Buffer, from: number, to: number): Box[] | null {
  const boxes: Box[] = [];
  let i = from;
  while (i + 8 <= to) {
    let size = buf.readUInt32BE(i);
    const type = buf.toString('latin1', i + 4, i + 8);
    let headerSize = 8;
    if (size === 1) {
      if (i + 16 > to) return null;
      const big = buf.readBigUInt64BE(i + 8);
      if (big > BigInt(Number.MAX_SAFE_INTEGER)) return null;
      size = Number(big);
      headerSize = 16;
    } else if (size === 0) {
      size = to - i; // dosya sonuna kadar
    }
    if (size < headerSize || i + size > to) return null;
    boxes.push({ type, start: i, headerSize, size });
    i += size;
  }
  return i === to ? boxes : null;
}

export function detectVideo(buf: Buffer): VideoMime | null {
  if (buf.length < 12 || buf.toString('latin1', 4, 8) !== 'ftyp') return null;
  const brand = buf.toString('latin1', 8, 12);
  if (brand === 'M4A ' || brand === 'M4B ') return 'audio/mp4';
  return brand === 'qt  ' ? 'video/quicktime' : 'video/mp4';
}

// mvhd: sürüm 0 → 32 bit, sürüm 1 → 64 bit zaman ölçeği ve süre
function readMvhd(buf: Buffer, box: Box): number | null {
  const p = box.start + box.headerSize;
  const version = buf[p];
  if (version === 0 && box.size >= box.headerSize + 20) {
    const timescale = buf.readUInt32BE(p + 12);
    const duration = buf.readUInt32BE(p + 16);
    return timescale ? Math.round((duration / timescale) * 1000) : null;
  }
  if (version === 1 && box.size >= box.headerSize + 32) {
    const timescale = buf.readUInt32BE(p + 20);
    const duration = Number(buf.readBigUInt64BE(p + 24));
    return timescale ? Math.round((duration / timescale) * 1000) : null;
  }
  return null;
}

// Dosyayı inceler ve kişisel bilgi kutularını etkisizleştirilmiş bir kopya döner. Bozuk ya da desteklenmeyen dosyada null.
export function sanitizeVideo(input: Buffer): { data: Buffer; info: VideoInfo } | null {
  const mime = detectVideo(input);
  if (!mime) return null;
  const data = Buffer.from(input);
  const top = readBoxes(data, 0, data.length);
  if (!top) return null;
  let durationMs: number | null = null;
  let sawMoov = false;

  const walk = (boxes: Box[]): boolean => {
    for (const b of boxes) {
      if (b.type === 'mvhd') durationMs = readMvhd(data, b);
      if (PRIVATE_BOXES.has(b.type) && b.type !== 'uuid') {
        data.write('free', b.start + 4, 'latin1');
        data.fill(0, b.start + b.headerSize, b.start + b.size);
        continue;
      }
      if (CONTAINERS.has(b.type)) {
        if (b.type === 'moov') sawMoov = true;
        const inner = readBoxes(data, b.start + b.headerSize, b.start + b.size);
        if (!inner || !walk(inner)) return false;
      }
    }
    return true;
  };
  // En üst seviyedeki meta/udta/uuid/XMP kutuları da etkisizleştirilir
  for (const b of top) {
    if (PRIVATE_BOXES.has(b.type)) {
      data.write('free', b.start + 4, 'latin1');
      data.fill(0, b.start + b.headerSize, b.start + b.size);
    }
  }
  if (!walk(top.filter((b) => !PRIVATE_BOXES.has(b.type))) || !sawMoov || durationMs === null) return null;
  return { data, info: { mime, durationMs } };
}
