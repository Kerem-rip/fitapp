# auth ✅

Kayıt, giriş, oturum yenileme, çıkış.

| Adres | Ne yapar |
|---|---|
| `POST /api/auth/register` | Kayıt. E-posta, şifre, kullanıcı adı, doğum tarihi, koşulların kabulü. 13 yaş altı reddedilir. |
| `POST /api/auth/login` | Giriş. Silme sürecindeki hesapta giriş, silmeyi iptal eder. |
| `POST /api/auth/refresh` | Yenileme anahtarıyla yeni erişim anahtarı alır. |
| `POST /api/auth/logout` | Bu cihazdaki oturumu kapatır. |

## Dosyalar
- `auth.controller.ts` → Adresler
- `auth.service.ts` → Kayıt, giriş ve oturum mantığı
- `auth.guard.ts` → Korumalı adresler için giriş kontrolü (`@UseGuards(AuthGuard)`)
- `password.service.ts` → Şifre karma (scrypt)
- `auth-core.module.ts` → Diğer modüllerin de kullandığı parçalar (guard, JWT, şifre servisi)
- `dto/auth.schemas.ts` → Gelen veri kuralları (şifre en az 8 karakter, kullanıcı adı biçimi...)

## Güvenlik kuralları
- Şifreler karılarak saklanır, asla açık saklanmaz.
- Erişim anahtarı 15 dakika geçerlidir; oturum 30 günlük yenileme anahtarıyla sürer.
- Yenileme anahtarı her kullanımda değişir. Eski bir anahtar tekrar kullanılırsa (çalınma belirtisi)
  kullanıcının tüm oturumları kapatılır.
- Giriş/kayıt adreslerine IP başına dakikada 10 istek sınırı vardır.
- "E-posta kayıtlı değil" ile "şifre yanlış" aynı cevabı verir (hesap var mı diye yoklanamaz).

## Henüz yok
- E-posta doğrulama ve şifre sıfırlama (e-posta gönderim servisi seçilince eklenecek)
- Google / Apple ile giriş
