# Profesyoneller

**Aşama:** 1 · **Backend modülleri:** `professionals`, `clients`

Profesyonel türleri: Diyetisyen · Eğitmen (personal trainer) · Spor salonu (salon tarafı Aşama 2'de genişler)

## Başvuru ve doğrulama
```
Web'den başvuru → Diploma / sertifika yükleme → Admin inceler → Onay → Profesyonel abonelik (web)
```
- Onaylanmamış kişi profesyonel olarak görünemez, danışan alamaz.
- Profilde "Doğrulanmış" rozeti gösterilir.
- Profesyonel abonelik **sadece web'den** satılır (fiyatlandırma sonra konuşulacak).

## Keşfet
Kullanıcı profesyonelleri arar ve filtreler:
- Tür (diyetisyen / eğitmen), uzmanlık alanı
- Şehir, online / yüz yüze
- Fiyat aralığı (profesyonelin kendi beyanı)

## Profesyonel profili
Fotoğraf, tanıtım, uzmanlık alanları, sertifikalar, hizmet şekli, fiyat aralığı, yorumlar, takipçiler.

## Danışan bağlantısı
```
Kullanıcı profesyonele doğrudan mesaj atar → sohbet
  → profesyonel "Danışanım yap" teklifi → kullanıcı kabul eder + veri paylaşım izni verir
```
- Kullanıcı hangi verilerin paylaşılacağını seçer (öğün kayıtları, kilo, ölçüler, fotoğraflar).
- İzni istediği zaman geri çekebilir; bağlantıyı sonlandırabilir.
- Profesyonel danışanına plan/program atayabilir, hedef belirleyebilir, kayıtlara yorum yapabilir.

## Ücretler
- Kullanıcı ile profesyonel arasındaki seans/hizmet ücretleri **platformu ilgilendirmez**,
  uygulama üzerinden ödeme alınmaz.
- Kullanım koşullarında platformun bu ilişkide taraf olmadığı açıkça yazılır.

## Ücretsiz kullanıcılar
Ücretsiz kullanıcılar da profesyonelleri bulabilir ve iletişime geçebilir. Amaç profesyonellere iş bağlamaktır.

## Bağlantı sona erince
Danışan ilişkisi biterse profesyonel, danışanın verilerine **erişimi hemen kaybeder**.
Kullanıcının verisi kullanıcınındır.

## Yorumlar
- Sadece o profesyonelden **hizmet almış** kullanıcılar yorum yazabilir.
  "Hizmet almış" = uygulamada danışan bağlantısı kurulmuş (profesyonel teklif etmiş, kullanıcı kabul etmiş).
  Ücretler uygulama dışında ödendiği için hizmeti kanıtlamanın tek yolu budur.
- Bağlantı bittikten sonra da yorum yazılabilir / düzenlenebilir.
- Her yorumda **"Danışan" rozeti** ve danışanlık süresi görünür (ör. "Danışan · 3 ay").
- Bir kullanıcı bir profesyonele bir yorum yazar (sonradan düzenleyebilir).
- Puan (1–5 yıldız) + yazılı yorum. Profesyonel yoruma bir kez cevap yazabilir.
- Uygunsuz yorumlar şikayet üzerine admin tarafından incelenir.
