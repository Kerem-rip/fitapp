# web — Web sitesi

Next.js ile web sitesi. Asıl kullanım mobilde; web'in görevi sınırlı:

- `src/app/(marketing)/` → Tanıtım ana sayfası, amacı uygulamayı indirtmek.
- `src/app/(account)/` → Giriş, hesap bilgileri, temel bilgiler.
- `src/app/(pro-signup)/` → Profesyonel başvuru ve abonelik (profesyonel abonelik **sadece web'den** satılır).
- `src/app/admin/` → Yönetim paneli (sadece admin rolü).

**Kural:** Sayfalar renk/yazı tipi yazmaz, sadece `@fitapp/ui-web` parçalarını kullanır.

## Komutlar
| Komut | Ne yapar |
|---|---|
| `pnpm dev` | Siteyi geliştirme modunda başlatır (http://localhost:3001) |
| `pnpm build` | Derler |

> Durum: Next.js kurulu, geçici tanıtım sayfası var.
