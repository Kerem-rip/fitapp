# fitapp

> Proje adı geçicidir.

Sağlıklı yaşam, beslenme, egzersiz ve koçluk platformu.
Normal kullanıcılar, diyetisyenler, eğitmenler ve spor salonları aynı uygulamayı kullanır.

## Klasör haritası

| Klasör | Ne işe yarar |
|---|---|
| `apps/api` | Backend. Tüm iş mantığı ve veritabanı burada. |
| `apps/mobile` | Mobil uygulama (iOS + Android). **Herkesin ana ekranı burası.** |
| `apps/web` | Web sitesi: tanıtım, hesap, profesyonel abonelik, admin paneli. |
| `packages/design-tokens` | 🎨 Renkler, yazı tipleri, boşluklar. Tasarım değişince burası değişir. |
| `packages/ui-mobile` | 🎨 Mobil hazır parçalar (Button, Card...). |
| `packages/ui-web` | 🎨 Web hazır parçalar. |
| `packages/shared` | Web, mobil ve backend'in ortak kuralları ve veri tipleri. |
| `packages/api-client` | Web ve mobilin backend ile konuşma kodu. |
| `infra` | Bilgisayarda veritabanı/Redis çalıştırma ayarları. |
| `docs` | Kararlar, özellik tarifleri, KVKK kuralları. |

## Altın kural

Ekranlar (`apps/mobile/src/app`, `apps/web/src/app`) **asla doğrudan renk, yazı tipi veya boyut yazmaz**.
Sadece `ui-mobile` / `ui-web` parçalarını kullanır. Böylece tasarım değişince ekranlara dokunulmaz.

## Teknolojiler

TypeScript (her yerde) · NestJS (backend) · PostgreSQL + Prisma · Redis · React Native + Expo (mobil) · Next.js (web) · Turborepo + pnpm (monorepo)
