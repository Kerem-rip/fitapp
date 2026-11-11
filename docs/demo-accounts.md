# Demo hesaplar

Bu hesaplar **sadece demo / geliştirme içindir**; gerçek yayında bulunmaz. Hepsinin şifresi aynıdır: `Demo1234!`

Hesaplar artık **sunucuda** durur (gerçek giriş). Kullanmak için API ve veritabanı çalışıyor olmalı; hesaplar `pnpm --filter api db:seed` ile yüklenir.
Giriş ekranında "Test hesapları" listesine dokunarak şifre yazmadan da girilebilir.

Ek olarak bir **yönetici hesabı** vardır (`yonetici` / `yonetici@demo.test`). Normal girişten giremez; karşılama ekranında logoya uzun basıp "Yönetici girişi" seçilir.

| Hesap | Kullanıcı adı | E-posta | Ne görürsün |
|---|---|---|---|
| Ayşe Korkmaz (bireysel kullanıcı) | `ayse_k` | `ayse@demo.test` | Bugün, beslenme, egzersiz, keşfet, profil. Zeynep'in danışanı. Alerjileri: gluten, yer fıstığı |
| Mert Aksoy (genç kullanıcı, 15 yaş) | `mert_a` | `mert@demo.test` | Genç modu: kalori sayımı yok, profil gizli, veli onayı bekliyor |
| Zeynep Arslan (diyetisyen) | `dyt_zeynep` | `zeynep@demo.test` | Panel, 5 danışan, ajanda, mesajlar, diyet önerisi |
| Burak Yıldız (bağımsız eğitmen) | `burak_pt` | `burak@demo.test` | Panel, 4 danışan, programlar, ajanda |
| Selim Kaya (salon yöneticisi) | `selim_fit` | `selim@demo.test` | Fit Merkez: ekip, vardiya, görev, üyeler, özel dersler |
| Deniz Kaya (salon eğitmeni) | `deniz_pt` | `deniz@demo.test` | Vardiyam, görevlerim, danışanlarım, derslerim |

## Denenecek akışlar
1. **Diyetisyen → danışan:** Zeynep ile gir → Danışan → Ayşe → kilosunu değiştir → Kaydet → "Diyet önerisi hazırla" → "Onayla ve danışana gönder". Sonra Ayşe ile gir: bildirim gelir, Beslenme sekmesinde plan görünür.
2. **Alerji güvenliği:** Zeynep → Elif K. → "Diyet önerisi hazırla": alerji bilgisi eksik olduğu için öneri hazırlanmaz.
3. **Danışan olma ve yorum:** Yeni bir hesap aç → Keşfet → Dyt. Zeynep → Mesaj at. Zeynep ile gir → Mesaj → Yeni mesajlar → sohbet → "Danışan olarak ekle". Yeni hesapla dön: Zeynep'in profilinde yorum yazabilirsin ("Danışan" rozetiyle).
4. **Veri paylaşımı:** Ayşe → Profil → "Uzmanıma paylaştıklarım" kapat → Zeynep'te Ayşe'nin kilosu ve öğünleri görünmez olur.
5. **Genç modu:** Mert ile gir → Beslenme sekmesinde kalori yok; öğün kaydı için sağlık verisi (veli) izni gerekir → Profil → "Demo: velim onayladı".
6. **Salon:** Selim → Görev → "Görev ata" (Deniz'e). Deniz ile gir: görev bildirimi ve görev listesi.
7. **Hesap silme:** Profil → Hesabımı sil (şifreyle). 30 gün içinde giriş yapınca silme iptal olur.
8. **Standart kayıt:** Kayıt ol → Standart kullanıcı → formu doldur → e-posta kodu ekranında "TEST MODU" kutusundaki kodun üstüne dokun → Doğrula. Test modunda kod ekranda görünür; gerçek e-posta servisi bağlanınca görünmez.
9. **Profesyonel başvuru:** Kayıt ol → Profesyonel hesap → alan seç → formu ve belgeyi (PDF/JPG/PNG) ekle → kodu doğrula → "Başvurun onay sürecine alındı" ekranı. Buradan "Normal kullanıcı olarak devam et" ile uygulama kullanılabilir; Profil → "Profesyonel başvurum" ile geri dönülür.
10. **Başvuru onayı:** Yönetici girişi → Başvurular → başvuruyu aç → belgeyi incele → Onayla veya Reddet (neden zorunlu). Reddedilen kişi nedeni görür ve en fazla 3 kez yeniden gönderebilir. Küçük/tekrar eden dosyalar "Şüpheli" işaretlenir; karar yine yöneticiye aittir.
