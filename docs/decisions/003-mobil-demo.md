# 003 — Mobil demo (APK)

**Tarih:** 2026-11-11 · **Durum:** Kabul edildi

## Kararlar
- **Web sitesi şimdilik durduruldu.** Mevcut dosyalar duruyor; "başla" denince devam edilecek.
- Önce **mobil uygulama** yapıldı. Tasarım dili: modern, sosyal medya havasında (hikâye halkaları, yumuşak kartlar,
  gradyan butonlar, alttan yüzen sekme çubuğu, açık/koyu mod). Her hesap türünün kendi vurgu rengi var.
- **Tek giriş ekranı**, rol hesaba bağlı. Ayrı diyetisyen/salon giriş sayfaları yok.
- 6 hesap türü: bireysel, genç, diyetisyen, **bağımsız eğitmen**, salon yöneticisi, salon eğitmeni.
- Hem diyetisyen hem kullanıcı olan hesap için özel ekran yok (ihtiyaç duyulursa sonra).
- Bir salon eğitmeni **tek bir salona** bağlıdır; salona eğitmen davetle, kendi hesabıyla katılır.
- Danışanın değerleri değişince diyetisyene **taslak** menü hazırlanır; diyetisyen onaylamadan danışana gitmez.
- Otomatik menüde alerjen içeren ve alerjen bilgisi eksik yemekler hiç önerilmez; alerji bilgisi eksikse öneri hazırlanmaz.

## Demo APK'nın kapsamı (dürüst sınırlar)
- Veriler uygulamanın **içinde** (telefonda) durur; sunucuya bağlı değildir. Bilgisayar ve internet gerekmez.
- Gerçek çalışanlar: kalori hesabı, menü önerisi, alerjen filtresi, kayıt kuralları (yaş, kullanıcı adı), KVKK rıza kontrolü,
  danışan veri paylaşımı, yorum kuralı, hesap silme (30 gün geri dönüş).
- Demo veriyle çalışanlar: randevu, mesajlaşma, vardiya, görev, salon, danışanlar. Bunların sunucu tarafı (tablolar ve kod) yazılacak.
- Henüz yok: e-posta doğrulama / şifre sıfırlama / veli onayı e-postası (e-posta servisi gerekir), görüntülü görüşme,
  egzersiz videoları ve kas haritası çizimi (içerik sonradan eklenecek), bildirimlerin telefona push olarak gelmesi.
- APK geliştirme anahtarıyla imzalıdır; sadece deneme içindir.

## Sonraki adım
Demo katmanını (`apps/mobile/src/demo`) gerçek sunucuyla değiştirmek: önce randevu, salon ve mesajlaşma için backend modülleri.
