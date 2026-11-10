# Egzersiz kütüphanesi

**Aşama:** 1 · **Backend modülü:** `exercises`

## Kategoriler
| Kategori | Açıklama |
|---|---|
| Fitness | Salon ve ağırlık egzersizleri |
| Evde | Ekipmansız veya az ekipmanla |
| Duruş | Boyun, omuz, sırt, bel, kalça bölgesel egzersizleri |
| Yüz masajı | Rahatlama ve kan dolaşımını destekleyen yüz masajı ve egzersizleri |

## Bir egzersiz sayfası
Sayfa **videosuz da eksiksiz** çalışır. Video sonradan eklenir.

- **Kod** (ör. `squat`, `wall-angel`) — videolar bu kodla eşleşir
- Ad, kategori, zorluk, gereken ekipman
- Adım adım yapılış
- **Kas haritası:** Çalışan kasları renkli gösteren 2D vücut çizimi (ana kaslar koyu, yardımcı kaslar açık)
- Sık yapılan hatalar
- Uyarılar
- **Video alanı:** Boşsa gizlenir. Admin panelinden video yüklenince otomatik görünür.

## Duruş bölümü
- Uygulama **duruş analizi yapmaz, teşhis koymaz.**
  Bu bölüm, kendinde duruş bozukluğundan şüphelenen kullanıcıların egzersiz bulması içindir.
- **Kendi kendine kontrol rehberi** (kamerasız): ör. "Sırtınızı duvara yaslayın; başınız duvara
  değmiyorsa → boyun öne kayması programı".
- Her duruş sayfasında: "Ağrınız varsa veya şikayetiniz sürüyorsa önce doktora başvurun."

## Yüz masajı bölümü — metin kuralları
- ✅ Söylenebilir: "Kan dolaşımını destekler", "Rahatlatır", "Gerginliği azaltmaya yardımcı olur"
- ❌ Söylenmez: "Kırışıklık giderir", "Yüzü inceltir", "Gıdıyı yok eder" veya herhangi bir sonuç vaadi

## İçerik kaynağı
- Videolar proje sahibi tarafından üretilir ve sonradan eklenir. Bkz. [video-guide.md](../content/video-guide.md)
- Başka sitelerden video/animasyon **alınmaz** (telif hakkı).
