# mobile — Mobil uygulama

iOS ve Android uygulaması (React Native + Expo). **Herkesin ana ekranı burası**, profesyoneller dahil.
Telefon ve tablette düzgün görünür (içerik tablette ortada, en fazla 680 px genişlikte durur).

## Klasörler
| Klasör | Ne işe yarar |
|---|---|
| `src/app/` | **Ekranlar.** Dosya adı = ekranın adresi. Her hesap türünün kendi klasörü var (aşağıda). |
| `src/features/` | Ekranların asıl içeriği, özellik özellik (beslenme, egzersiz, danışanlar, salon...). Route dosyaları bunları çağırır. |
| `src/components/` | Birden fazla ekranda kullanılan uygulamaya özel parçalar (sekme çubuğu, üst başlık, onay penceresi...). |
| `src/demo/` | **Demo verisi ve yerel depo.** Gerçek sunucu bağlanınca bu klasör `api-client` ile değişir. [Detay](src/demo/README.md) |

## Hesap türüne göre ekran klasörleri (`src/app/`)
| Klasör | Kim için |
|---|---|
| `(auth)` | Girişsiz: karşılama, kayıt öncesi sorular, kayıt, giriş |
| `(user)` | Bireysel ve genç kullanıcı: Bugün, Beslenme, Egzersiz, Keşfet, Profil |
| `(dietitian)` | Diyetisyen: Panel, Danışan, Ajanda, Mesaj, Profil |
| `(trainer)` | Bağımsız eğitmen: Panel, Danışan, Program, Ajanda, Profil |
| `(gym-manager)` | Salon yöneticisi: Genel, Ekip, Görev, Üye, Salon |
| `(gym-staff)` | Salon eğitmeni: Bugün, Görev, Danışan, Ders, Profil |
| `exercise/`, `program/`, `article/`, `professional/`, `client/`, `suggestion/`, `chat/`, `inbox`, `notifications`, `preview` | Her hesap türünden açılabilen detay ekranları |

Giriş yapınca uygulama hesabın rolüne göre doğru klasörü kendiliğinden açar (`src/app/_layout.tsx`).

**Kural:** Ekranlar renk veya yazı tipi yazmaz; sadece `@fitapp/ui-mobile` parçalarını kullanır.
Tasarım değişince `packages/design-tokens` ve `packages/ui-mobile` değişir, ekranlara dokunulmaz.

## Komutlar
| Komut | Ne yapar |
|---|---|
| `pnpm dev` | Uygulamayı başlatır (telefonda **Expo Go** ile QR kodu okutarak açılır) |
| `pnpm web` | Tarayıcıda önizleme (hızlı görsel kontrol için) |
| `pnpm typecheck` | Tip hatası var mı kontrol eder |

## APK (Android) derleme
Gerekenler: JDK 17, Android SDK (Android Studio ile gelir).
```
pnpm exec expo prebuild --platform android --no-install
cd android
.\gradlew.bat assembleRelease
```
Çıktı: `android/app/build/outputs/apk/release/app-release.apk`. Üretilen `android/` klasörü GitHub'a gönderilmez.
Bu APK, geliştirme anahtarıyla imzalıdır; sadece deneme içindir, mağazaya yüklenemez.

## Durum
Demo sürümü çalışıyor: tüm hesap türlerinin ekranları, hesaplayıcılar, diyet önerisi, mesajlaşma, görev ve randevu
akışları uygulamanın içindeki demo verisiyle çalışır. Gerçek sunucuya (apps/api) bağlantı sonraki adımdır.
