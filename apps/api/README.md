# api — Backend

Uygulamanın beyni. Web ve mobil buraya istek atar; veritabanıyla sadece burası konuşur.

- `prisma/schema.prisma` → Veritabanı tabloları
- `prisma/seed/` → Başlangıç verileri
- `src/main.ts` → Sunucunun başladığı yer
- `src/config/` → Ayarlar (.env'den okunur)
- `src/common/` → Tüm modüllerin kullandığı ortak araçlar
- `src/modules/` → Her özellik kendi klasöründe

## Her modülün içi aynı düzendedir
```
<modül>/
├── <modül>.module.ts      → Modülün tanımı
├── <modül>.controller.ts  → Dışarıdan gelen istekleri karşılar
├── <modül>.service.ts     → Asıl iş mantığı
├── dto/                   → Gelen/giden veri kalıpları
└── README.md              → Bu modül ne yapar
```

## Komutlar
| Komut | Ne yapar |
|---|---|
| `pnpm dev` | Sunucuyu geliştirme modunda başlatır (http://localhost:3000/api) |
| `pnpm build` | Derler |
| `pnpm test:e2e` | Uçtan uca testleri çalıştırır |

> Durum: NestJS kurulu, `GET /api/health` çalışıyor. Veritabanı (Prisma) tasarım onayından sonra bağlanacak.
