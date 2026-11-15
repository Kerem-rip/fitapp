# Kalori aracı, premium, günün düzeni ve kullanıcı geçmişi

Tüm sağlık değerleri **tahmindir**, tıbbi tavsiye değildir. Öneriler tanı koymaz.

## Kalori aracı (ana sayfanın altında)

Akış: profil onayı (boy, kilo, yaş, cinsiyet) → güvenlik soruları → amaç kartları (kilo vermek, almak, korumak, kas, sporcu, emzirme) → sonuç → kaydet.
- Hesap ortak pakette (`packages/shared/src/calorie-tool.ts`), testleri `calorie-tool.test.ts`.
- **Haftalık hedef en fazla ~1 kg** (günlük açık en fazla 1100 kcal); güvenli alt sınır (kadın 1200, erkek 1500, belirtilmemiş 1350) korunur. Kullanıcı kendi isteğiyle daha az yerse bu onun tercihidir; hedef olarak daha düşüğü önerilmez.
- 18 yaş altı, hamilelik, doktor kısıtı ve yeme bozukluğu geçmişinde **hedef verilmez**, uzmana yönlendirilir. Zayıf (VKİ < 18,5) kişiye kilo verme uygulanmaz. Emzirmede ek enerji (+330 / +400) eklenir, açık verilmez, alt sınır 1800.
- Sunucu (`PUT /me/calorie-profile`) güvenlik sınırlarını ayrıca denetler (yaş, alt kalori, haftalık 1 kg, makro uyumu).
- **Premium (deneme):** bel, boyun, kalça çevresiyle tahmini yağ/kas oranı (ABD Donanması formülü, `body.ts`) ve yağsız kütleye göre (Katch-McArdle) daha doğru hesap.

## Premium işareti

`PremiumGrant` tablosu. Gerçek ödeme yok: `PUT /me/premium` yalnızca geliştirmede çalışır, üretimde 403. Premium kısmının kapsamı sonradan değişecek.

## Görevlerim

"Uzmanından" bölümü kalktı. Tüm görevler tek listede madde madde, her birinin yanında yuvarlak işaret; sayfa sonunda hepsi bitince "Tüm görevler tamamlandı". Uzman görevleri (diyetisyen öğünleri, antrenör programı) aynı listede, etiketle ayrı; işaretleri `TaskCheck` ile tutulur.
- **Ücretsiz:** kendi görevlerini ekler (hareket, bakım, öğün). Öneri çıkmaz.
- **Premium + profil tamam:** sabah, öğle, ikindi ve akşam rutinleri. Her saat diliminde **kişisel bakım, egzersiz ve yemek şeritleri ayrıdır**. Öneriler (cinsiyete, amaca ve spora göre; yemekler besin değerleriyle) seçenek olarak gelir; kullanıcı seçer ya da kendi öğününü/egzersizini girer (`packages/shared/src/routines.ts`).
- Yemek öğesi işaretlenince öğün günlüğüne yazılır (analizde sayılır), geri alınınca silinir. Sağlık verisi rızası gerekir.
- Önerilen (SUGGESTED) rutinler yalnızca premiumdadır (sunucuda `PREMIUM_REQUIRED`).

## Günün analizi (herkese açık)

`packages/shared/src/day-analysis.ts`: yenen, içilen su ve tamamlanan antrenmanlar hedefle karşılaştırılır. Az yemek engellenmez, sakin bir uyarı verilir. Ekran: "Günün analizi" (menüden ve Görevlerim'den).

## Geçmişim ("beyin")

`GET /me/history`: kalori hedefi, premium, rutin, program katılımı, antrenman tamamlama, ölçüm ve öğün kayıtlarını tek akışta birleştirir (`UserEvent` + mevcut tablolar). Hesap silinince hepsi silinir (cascade).
