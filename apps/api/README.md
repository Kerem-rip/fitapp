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

> Durum: İskelet. NestJS kurulumu bir sonraki adımda yapılacak.
