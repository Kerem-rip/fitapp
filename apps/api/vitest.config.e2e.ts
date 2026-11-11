import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: { tsconfigPaths: true },
  test: {
    globals: true,
    root: './',
    include: ['**/*.e2e-spec.ts'],
    env: {
      // Testler art arda çok sayıda giriş/kayıt isteği atar; deneme sınırı testlerde gevşetilir
      AUTH_RATE_LIMIT_PER_MINUTE: '1000',
      // "Yeni kod iste" bekleme süresi testte kısa (test, süreyi veritabanından geriye alır)
      RESEND_COOLDOWN_SEC: '5',
      // Test belgeleri ayrı klasöre yazılır ve test sonunda silinir
      STORAGE_DIR: './storage-test',
      EMAIL_MODE: 'console',
    },
    // Testler aynı veritabanını kullandığı için dosyalar sırayla çalışır
    fileParallelism: false,
  },
});
