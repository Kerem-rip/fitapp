// Sunucunun başladığı yer.
import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';
import { configureApp } from './app.setup.js';
import { env } from './config/env.js';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  configureApp(app);
  // Geliştirme: tarayıcıdaki önizleme de sunucuya bağlanabilsin. Yayında kapalıdır.
  if (env.nodeEnv !== 'production') app.enableCors({ origin: true });
  // Aynı ağdaki cihazlar (telefon, BlueStacks) bağlanabilsin diye tüm ağ arayüzlerinde dinler
  await app.listen(env.port, '0.0.0.0');
  new Logger('Sunucu').log(`Hazır: http://0.0.0.0:${env.port}/api  (e-posta modu: ${env.emailMode})`);
}
await bootstrap();
