# applications ✅

Profesyonel hesap başvurusu (başvuru kayıt sırasında oluşur, bkz. `modules/registration`).

| Adres | Ne yapar |
|---|---|
| `GET /api/applications/me` | Son başvurunun durumu: `PENDING` / `APPROVED` / `REJECTED` (+ red gerekçesi) |
| `POST /api/applications/me/resubmit` | Reddedilen başvuruyu yeni belgelerle tekrar gönderir (toplam en fazla 3 başvuru) |

## Kurallar
- Başvuru onaylanana kadar kişi **sadece standart kullanıcıdır**; profesyonel alanı görmez, istersen aynı e-posta ve
  kullanıcı adıyla standart kullanıcı olarak devam eder.
- Belgelerin üzerindeki otomatik işaretler (kopya dosya, düzenleme programı izi...) başvurana gösterilmez.
- Onay/red kararını yönetici veya moderatör verir (bkz. `modules/admin`).
