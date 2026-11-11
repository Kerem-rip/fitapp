# demo

**Geçici katman.** Uygulamayı sunucu olmadan, telefonun içinde çalışır göstermek için var.
Gerçek sunucu bağlanınca bu klasör `packages/api-client` çağrılarıyla değişir; ekranların kodu aynı kalacak şekilde yazıldı.

| Dosya | Ne işe yarar |
|---|---|
| `types.ts` | Demo verisinin tipleri (hesap, danışan, plan, randevu, salon...) |
| `seed.ts` | Başlangıç verisi: 6 demo hesap, uzmanlar, danışanlar, mesajlar, salon. Tarihler "bugüne göre" üretilir. |
| `content.ts` | Egzersizler, programlar, beslenme rehberleri, uzman ipuçları |
| `store.ts` | Yerel depo: veriler telefonda saklanır (AsyncStorage), uygulama kapanıp açılsa da korunur |
| `actions.ts` | Veriyi değiştiren tüm işlemler (kayıt, giriş, öğün ekleme, plan onaylama, görev atama...) |
| `selectors.ts` | Veriden türetilen okumalar (danışan görünümü, mesaj sayıları...) |
| `hooks.ts` | Ekranların kullandığı okuma kancaları |
| `labels.ts`, `dates.ts` | Türkçe etiketler ve tarih yardımcıları |

## Gerçek sunucuya geçerken
- `actions.ts` içindeki işlemler API çağrılarına dönüşür; `store.ts` önbelleğe indirgenir.
- `SEED_FOODS`, kalori hesabı ve menü önerisi zaten `packages/shared` içindedir; backend de aynısını kullanacak.
- Demo hesaplar ve şifreleri **sadece demo içindir**; gerçek yayında bu klasör hiç bulunmaz.
- Demo şifreleri: bkz. `docs/demo-accounts.md`

## Önemli kurallar (demo da uyar)
- Sağlık verisi (öğün, kilo) kaydı için açık rıza gerekir; 18 yaş altı bu rızayı veliden alır.
- Uzman, danışanın sadece paylaştığı verileri görür; danışanlık bitince erişim hemen kapanır.
- Yorumu sadece danışan bağlantısı kurulmuş kullanıcı yazabilir.
- Alerjen içeren yemek hiçbir menüye girmez; alerji bilgisi eksikse diyetisyen öneri hazırlayamaz.
