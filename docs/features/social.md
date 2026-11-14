# Sosyal medya

Sosyal arayüz herkes için aynıdır (profesyoneller dahil). Profesyonel panel ayrı bir dünyadır; "Hesap değiştir" ile geçilir.
Sağlık ve danışan verisi sosyal tarafta hiçbir yerde görünmez; uzman–danışan yazışması sosyal mesajlardan ayrıdır.

## Alt menü

| Sekme | İçerik |
| --- | --- |
| Akış | Arama/Keşfet, hikâye şeridi, "Senin için" ve "Takip ettiklerin" |
| Kütüphane | Ücretsiz programlar, hareketler, yüz masajı, beslenme rehberleri |
| Programım | Uzmandan gelen plan/program + katılınan ücretsiz programın günlük görevleri |
| Profil | Profil, gönderiler, paylaşım (gönderi, hikâye, metin) |

Sağ üstte mesajlar, sol üstte ☰ menü (bildirimler, kaydedilenler, sağlık kayıtları, ayarlar).

## Modüller (sunucu: `apps/api/src/modules`)

| Modül | Klasör | Not |
| --- | --- | --- |
| Profil, takip, engelleme, sessize alma | `social/` | Gizli hesaba takip istek olur; doğrulanmış profesyonel her zaman açık; rozet sadece onaylı başvurudan |
| Gönderiler | `social/posts.*` | Metin + en fazla 5 fotoğraf/video (video ≤ 30 sn), beğeni, yorum/yanıt, kaydet, alıntı, sabitle, #etiket, @bahsetme |
| Akış ve Keşfet | `social/feed.*` | Sıralama kuralı `feed-rules.ts` içinde açık ve testlidir; sağlık verisi kullanılmaz |
| Hikâyeler | `social/stories.*` | 24 saat, arşiv, kitle (herkes/takipçi/yakın arkadaş), anket, soru, tepki, bahsetme, bağlantı, elle konum, doğrulanmış başarı |
| Mesajlar ve gruplar | `dm/` | İstek kutusu, mesaj gizliliği, yanıtla, benden sil, geri al, durumlar, çevrimiçi/son görülme, gruplar. Anlık güncelleme uzun bekleyen istekle (ek servis yok) |
| Bildirimler | `notifications/` | İki merkez: SOCIAL ve PRO. Tercihler ve sessiz saatler. Kilit ekranı metni kişi adı/içerik taşımaz |
| Moderasyon | `moderation/` | Şikâyet, kuyruk, kaldırma, itiraz, branş moderatörü, silinmeyen kayıt defteri. Özel mesajda sadece şikâyet edilen mesaj görünür |
| Medya | `media/` | Tür ilk baytlardan belirlenir, EXIF/GPS ve video konum kutuları temizlenir, adresler süreli ve imzalıdır |
| Kütüphane | `library/` | İçerik kodda (`catalog.ts`), katılım ve görevler veritabanında |

## Bilerek sonraya bırakılanlar

- Telefon bildirimi (push) gönderimi: tercih, sessiz saat ve cihaz kaydı hazır; gönderim servisi bağlanmadı.
- Uygulama içi video oynatma ve sesli mesaj kaydı: `expo-video` / `expo-audio` paketleri kurulunca (`VideoView.tsx`, `VoiceView.tsx`).
- İki adımlı doğrulama (2FA): giriş akışını değiştirdiği için ayrı karar bekliyor. Açık oturumları görme/kapatma hazır.
- Hikâyede müzik, 18 yaş kısıtları, paketler ve satın alma, hukuki metinler.
- Sunucu birden çok kopya çalışırsa mesaj olayları ortak kuyruğa (ör. Redis) taşınmalı (`dm-events.service.ts`).
