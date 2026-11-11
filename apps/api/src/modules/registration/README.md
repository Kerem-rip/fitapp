# registration ✅

Kayıt: e-postaya doğrulama kodu gider; kod girilince hesap oluşur. **Kod girilmeden hesap oluşmaz.**

| Adres | Ne yapar |
|---|---|
| `POST /api/auth/register/start` | Bilgileri doğrular, kod gönderir. Kullanıcı adı ve e-posta kısa süre rezerve edilir. |
| `POST /api/auth/register/:id/documents` | Profesyonel başvuru belgesi yükler (PDF/JPG/PNG, en fazla 10 MB, en fazla 5 dosya) |
| `POST /api/auth/register/verify` | Kodu doğrular; hesabı (ve profesyonelse başvuruyu) oluşturur, oturum açar |
| `POST /api/auth/register/resend` | Yeni kod (60 sn bekleme, en fazla 5 kez) |
| `GET /api/auth/register/username-available` | Kullanıcı adı boş mu |

## Kurallar
- 13 yaş altı kayıt olamaz; profesyonel hesap için 18+ gerekir.
- Geçici e-posta servisleri (mailinator vb.) engellenir.
- Kod 10 dakika geçerlidir, 5 yanlış denemede kayıt silinir.
- Bekleyen kayıtlar 30 dakika sonra otomatik silinir (belgeleriyle birlikte).
- Profesyonel hesap, onaylanana kadar **sadece standart kullanıcıdır** (bkz. `modules/applications`).
- Test modunda (`EMAIL_MODE=console`) kod, cevapta `devCode` olarak da döner. Yayında kapatılır.
