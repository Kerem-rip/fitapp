// Geçici demo medyası: oturum gerektirmez (video/resim etiketleri üstbilgi gönderemez); yalnızca demo-media klasöründeki, adı güvenli dosyalar; üretimde kapalı.
import { Controller, Get, Header, NotFoundException, Param, StreamableFile } from '@nestjs/common';
import { createReadStream, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { DEMO_FILE, DEMO_MEDIA_DIR } from './demo-media.js';

@Controller('demo-media')
export class DemoMediaController {
  @Get(':file')
  @Header('Cache-Control', 'public, max-age=3600')
  file(@Param('file') file: string) {
    if (process.env.NODE_ENV === 'production' || !DEMO_FILE.test(file)) throw new NotFoundException();
    const path = resolve(DEMO_MEDIA_DIR, file);
    if (!existsSync(path)) throw new NotFoundException();
    return new StreamableFile(createReadStream(path));
  }
}
