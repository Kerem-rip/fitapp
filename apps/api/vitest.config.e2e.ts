import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: { tsconfigPaths: true },
  test: {
    globals: true,
    root: './',
    include: ['**/*.e2e-spec.ts'],
    // Testler art arda çok sayıda giriş/kayıt isteği atar; deneme sınırı testlerde gevşetilir
    env: { AUTH_RATE_LIMIT_PER_MINUTE: '1000' },
    // Testler aynı veritabanını kullandığı için dosyalar sırayla çalışır
    fileParallelism: false,
  },
});
