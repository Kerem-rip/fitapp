// Tüm ayarlar buradan okunur. Kodun başka hiçbir yerinde process.env kullanılmaz.
import { existsSync } from 'node:fs';

if (existsSync('.env')) {
  process.loadEnvFile('.env');
}

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Eksik ayar: ${name} (.env dosyasını kontrol edin)`);
  }
  return value;
}

function number(name: string, fallback: number): number {
  const value = process.env[name];
  return value ? Number(value) : fallback;
}

const jwtSecret = required('JWT_SECRET');
if (jwtSecret.length < 32) {
  throw new Error('JWT_SECRET en az 32 karakter olmalı');
}

export const env = {
  port: number('PORT', 3000),
  databaseUrl: required('DATABASE_URL'),
  jwtSecret,
  // Erişim anahtarı kısa ömürlüdür; oturum, yenileme anahtarıyla uzatılır
  accessTokenTtlSec: number('ACCESS_TOKEN_TTL_SEC', 15 * 60),
  refreshTokenTtlDays: number('REFRESH_TOKEN_TTL_DAYS', 30),
  // Hesap silme talebinden sonra geri dönüş süresi
  accountDeletionGraceDays: number('ACCOUNT_DELETION_GRACE_DAYS', 30),
  // Giriş/kayıt denemesi sınırı (dakikada, IP başına)
  authRateLimitPerMinute: number('AUTH_RATE_LIMIT_PER_MINUTE', 10),
} as const;
