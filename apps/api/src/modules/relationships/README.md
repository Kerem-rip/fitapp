# relationships ✅

Danışanlık (profesyonel ↔ danışan), paylaşım izinleri ve denetim kaydı. Sağlık verisi okuyan/yazan her modül danışan verisine **AccessService** üzerinden erişir.

| Adres | Kim | Ne yapar |
|---|---|---|
| `POST /api/relationships/offer` `{ username }` | Onaylı diyetisyen/eğitmen | Danışan teklifi gönderir |
| `GET /api/relationships/as-professional?status=ACTIVE` | Profesyonel | Danışanlarım (sadece ad ve kullanıcı adı; sağlık verisi yok) |
| `GET /api/relationships/as-client` | Danışan | Gelen teklifler ve aktif danışanlıklarım |
| `POST /api/relationships/:id/accept` `{ sharedData, sharedUntil }` | Danışan | Teklifi kabul eder, neyi ne zamana kadar paylaşacağını seçer |
| `POST /api/relationships/:id/decline` | Danışan | Teklifi reddeder |
| `PATCH /api/relationships/:id/sharing` | Danışan | Paylaşımı ve süreyi değiştirir |
| `POST /api/relationships/:id/end` | İkisi de | Danışanlığı bitirir; profesyonelin erişimi anında kapanır |
| `GET /api/relationships/audit?limit=&before=` | Danışan | Verime kim ne yaptı |

## Paylaşım kategorileri
`MEALS`, `WATER`, `WEIGHT`, `MEASUREMENTS`, `PHOTOS`, `ANAMNESIS` (sağlık öyküsü: alerji, hastalık, yaşam tarzı).

## Kurallar
- Teklifi sadece onaylı diyetisyen veya bağımsız eğitmen gönderir (salon hesabı göndermez).
- Veri paylaşmak için danışanın `health_data` rızası geçerli olmalı; 18 yaş altı veri paylaşamaz.
- 18 yaş altına teklif için veli onayı (`contact_professionals`) gerekir.
- Paylaşım süresi en fazla 2 yıl; boşsa danışanlık bitene kadar sürer.
- Yanıt bekleyen en fazla 20 teklif.

## Erişim kapısı (`AccessService.requireAccess`)
Erişim ancak dördü birden doğruysa verilir: aktif danışanlık, süre dolmamış, kategori paylaşılmış, sağlık verisi rızası geçerli.
Rıza geri çekilirse veya süre dolarsa erişim **o anda** kapanır (ayrıca bir iş gerekmez). Başarılı erişim `DATA_VIEWED`/`DATA_CHANGED`,
danışanlık varken reddedilen deneme `ACCESS_DENIED` olarak denetim kaydına yazılır; danışanlığı olmayan birinin denemesi kaydedilmez.

## Denetim kaydı (`AuditLog`)
Sadece eklenir. Kaydın konusu olan kullanıcı kendi kayıtlarını görür; başkasının kaydını kimse okuyamaz.
Kullanıcı hesabı silinince onunla ilgili kayıtlar da silinir; kaydı yazan profesyonelin hesabı silinirse kayıt kalır, kişi alanı boşalır.

## Henüz yok (sonraki aşamalar)
Danışan dosyası (anamnez, ölçümler), uzman inceleme özeti, plan sürümleri: bu kapıyı kullanacak modüller Aşama 1'de eklenecek.
