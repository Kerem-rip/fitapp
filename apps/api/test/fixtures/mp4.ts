// Test için küçük, yapısı geçerli bir MP4 üretir: ftyp + moov(mvhd, udta[konum]) + mdat. Oynatılabilir değildir;
// sadece kutu yapısı, süre ve kişisel bilgi temizliği sınanır.

const box = (type: string, payload: Buffer) => {
  const head = Buffer.alloc(8);
  head.writeUInt32BE(payload.length + 8, 0);
  head.write(type, 4, 'latin1');
  return Buffer.concat([head, payload]);
};

export function buildTestMp4(opts: { seconds: number; brand?: string; location?: string }): Buffer {
  const ftyp = box('ftyp', Buffer.concat([Buffer.from(opts.brand ?? 'isom', 'latin1'), Buffer.alloc(4), Buffer.from('isommp42', 'latin1')]));
  // mvhd sürüm 0: 4 bayt sürüm/bayrak, oluşturma, değiştirme, zaman ölçeği, süre, + kalan alanlar
  const mvhd = Buffer.alloc(100);
  mvhd.writeUInt32BE(1000, 12);
  mvhd.writeUInt32BE(opts.seconds * 1000, 16);
  const udta = box('udta', box('©xyz', Buffer.from(opts.location ?? '+00.0000+000.0000/', 'latin1')));
  const moov = box('moov', Buffer.concat([box('mvhd', mvhd), box('trak', box('tkhd', Buffer.alloc(84))), udta]));
  const mdat = box('mdat', Buffer.from('VIDEO-PAYLOAD'.repeat(4), 'latin1'));
  return Buffer.concat([ftyp, moov, mdat]);
}
