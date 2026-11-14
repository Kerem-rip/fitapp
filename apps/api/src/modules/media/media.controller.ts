// GET /api/media/:id?e=&s= → sosyal medya dosyası (süreli imzalı adres; adresi yetkili kişi alır).
// Videolar için parça parça okuma (Range) desteklenir; telefon oynatıcıları bunu ister.
import { Controller, Get, Headers, Inject, Param, Query, Res } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import type { Response } from 'express';
import { MediaService } from './media.service.js';

// "bytes=100-199" / "bytes=100-" / "bytes=-500" → [başlangıç, bitiş] ya da geçersizse null
export function parseRange(header: string | undefined, size: number): [number, number] | null {
  const m = header ? /^bytes=(\d*)-(\d*)$/.exec(header.trim()) : null;
  if (!m || (m[1] === '' && m[2] === '')) return null;
  let start: number;
  let end: number;
  if (m[1] === '') {
    start = Math.max(0, size - Number(m[2]));
    end = size - 1;
  } else {
    start = Number(m[1]);
    end = m[2] === '' ? size - 1 : Math.min(Number(m[2]), size - 1);
  }
  return start <= end && start < size ? [start, end] : null;
}

// Akışta çok sayıda görsel yüklenir; adresler imzalı olduğu için genel istek sınırı uygulanmaz
@SkipThrottle()
@Controller('media')
export class MediaController {
  constructor(@Inject(MediaService) private readonly media: MediaService) {}

  @Get(':id')
  async file(@Param('id') id: string, @Query('e') exp: string | undefined, @Query('s') sig: string | undefined, @Headers('range') range: string | undefined, @Res() res: Response) {
    const file = await this.media.read(id, exp, sig);
    res.setHeader('Content-Type', file.mime);
    // Sadece bu cihazda, imzanın süresi kadar önbelleğe alınır
    res.setHeader('Cache-Control', `private, max-age=${Math.max(0, file.expiresAt - Math.floor(Date.now() / 1000))}`);
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Accept-Ranges', 'bytes');
    if (range) {
      const r = parseRange(range, file.data.length);
      if (!r) {
        res.status(416).setHeader('Content-Range', `bytes */${file.data.length}`);
        res.end();
        return;
      }
      res.status(206).setHeader('Content-Range', `bytes ${r[0]}-${r[1]}/${file.data.length}`);
      res.send(file.data.subarray(r[0], r[1] + 1));
      return;
    }
    res.send(file.data);
  }
}
