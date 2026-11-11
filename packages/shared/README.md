# shared

Backend, web ve mobilin ortak kullandığı kurallar ve hesaplamalar. Burada bir kez yazılır, her yerde aynı çalışır.

| Dosya | İçerik |
|---|---|
| `src/validation.ts` | Kayıt kuralları: şifre, kullanıcı adı, e-posta, yaş grupları (13 altı / genç modu / yetişkin) |
| `src/nutrition.ts` | **Kalori hesabı** ve **örnek menü önerisi**. Güvenlik kuralları: hedef alt sınırın altına inmez, 18 yaş altı ve zayıf kullanıcıya kilo verme hedefi uygulanmaz, alerjenli ve alerjen bilgisi eksik yemekler önerilmez |
| `src/seed/foods.ts` | Başlangıç yemek listesi (Türk mutfağı; değerler tahminidir) |
| `src/nutrition.test.ts` | Testler (`pnpm test`) |
