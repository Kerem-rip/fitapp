# admin ✅

Yönetici ve moderatör işlemleri. Sadece `ADMIN` / `MODERATOR` rolündeki hesaplar erişir.
Bu hesaplar **normal girişten giremez**; ayrı yönetici girişi (`POST /api/auth/admin/login`) kullanır ve kayıtla açılamaz,
veritabanında bizim tarafımızdan oluşturulur.

| Adres | Ne yapar |
|---|---|
| `GET /api/admin/applications?status=PENDING` | Profesyonel başvuru listesi (bekleyen / onaylanan / reddedilen) |
| `GET /api/admin/applications/:id` | Başvuru ayrıntısı: bilgiler, belgeler, otomatik işaretler, kontrol listesi, önceki denemeler |
| `GET /api/admin/documents/:id/file` | Belgenin kendisi. **Her açılış kayıt altına alınır** (kim, ne zaman) |
| `POST /api/admin/applications/:id/approve` | Onaylar: kullanıcıya rolü verilir, profesyonel profili açılır |
| `POST /api/admin/applications/:id/reject` | Gerekçeyle reddeder; kişi gerekçeyi görür ve yeniden başvurabilir |

## Otomatik işaretler
Aynı dosyanın başka başvuruda kullanılması, dosyada düzenleme programı izi, çok küçük dosya gibi durumlar
"şüpheli" etiketi alır. **Etiket karar vermez**; sahte belgeyi otomatik ve güvenilir şekilde yakalamak mümkün değildir.
Karar her zaman insan tarafından, kontrol listesiyle ve gerekirse resmi doğrulama sayfasından kontrol edilerek verilir.
