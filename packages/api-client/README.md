# api-client

Web ve mobilin backend'e istek attığı kod. Ekranlar backend adresini ve oturum anahtarlarını bilmez,
buradaki fonksiyonları çağırır.

| Dosya | İçerik |
|---|---|
| `src/types.ts` | Sunucunun döndürdüğü verilerin tipleri |
| `src/client.ts` | `createApiClient`: istekler, hata biçimi (`ApiError`), erişim anahtarı süresi dolunca otomatik yenileme |
| `src/index.ts` | Dışarı açılanlar |

Bağlandığı sunucu adresi ve anahtarların saklanacağı yer (telefonda güvenli depo) uygulama tarafından verilir.
