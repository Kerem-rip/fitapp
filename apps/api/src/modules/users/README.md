# users ✅

Giriş yapan kullanıcının kendi hesabı: görüntüleme, güncelleme, hesap silme.

| Adres | Ne yapar |
|---|---|
| `GET /api/users/me` | Hesap bilgileri. `ageGroup: "TEEN"` ise uygulama genç modunda açılır. |
| `PATCH /api/users/me` | Ad, soyad, kullanıcı adı, tanıtım yazısı, gizli/açık hesap. Genç modunda hesap açık yapılamaz. |
| `POST /api/users/me/delete` | Hesap silme talebi (şifre ile onaylanır). |

## Hesap silme
1. Talep anında tüm oturumlar kapanır.
2. 30 gün içinde giriş yapılırsa silme iptal olur.
3. 30 gün dolunca `account-purge.service.ts` hesabı ve tüm verilerini kalıcı siler (her gece 03:00).

## Henüz yok
- Başka kullanıcıların profilini görüntüleme, takip, engelleme (sosyal özelliklerle gelecek)
- Yüklenen dosyaların depolama servisinden silinmesi (`files` modülüyle gelecek)
