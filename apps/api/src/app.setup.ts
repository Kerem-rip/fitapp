// Sunucu ayarları. Hem gerçek sunucu (main.ts) hem testler aynı ayarları kullanır.
import { INestApplication, StandardSchemaValidationPipe } from '@nestjs/common';

export function configureApp(app: INestApplication): void {
  // Tüm adresler /api ile başlar (ör. /api/health)
  app.setGlobalPrefix('api');
  // Gelen veriler dto/ klasörlerindeki şemalara göre doğrulanır
  app.useGlobalPipes(new StandardSchemaValidationPipe());
}
