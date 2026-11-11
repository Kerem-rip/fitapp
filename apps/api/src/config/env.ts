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

const nodeEnv = process.env['NODE_ENV'] ?? 'development';
// "console": e-postalar gönderilmez, doğrulama kodu sunucu kaydına yazılır (sadece test için)
const emailMode = (process.env['EMAIL_MODE'] ?? 'console') as 'console';

export const env = {
  nodeEnv,
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

  // E-posta doğrulama
  emailMode,
  // Test modunda doğrulama kodu cevapta da döner (uygulama "test kodu" gösterir). Yayında ASLA.
  exposeDevCodes: emailMode === 'console' && nodeEnv !== 'production',
  registrationTtlMinutes: number('REGISTRATION_TTL_MINUTES', 30),
  codeTtlMinutes: number('CODE_TTL_MINUTES', 10),
  codeMaxAttempts: number('CODE_MAX_ATTEMPTS', 5),
  resendCooldownSec: number('RESEND_COOLDOWN_SEC', 60),
  resendMaxCount: number('RESEND_MAX_COUNT', 5),

  // Profesyonel belgeler (gizli klasör; yayında şifreli nesne depolamaya taşınır)
  storageDir: process.env['STORAGE_DIR'] ?? './storage',
  maxDocumentBytes: number('MAX_DOCUMENT_BYTES', 10 * 1024 * 1024),
  maxDocumentsPerApplication: number('MAX_DOCUMENTS', 5),
  maxApplicationAttempts: number('MAX_APPLICATION_ATTEMPTS', 3),
} as const;
