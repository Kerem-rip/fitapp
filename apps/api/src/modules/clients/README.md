# clients ✅ (1A)

Danışan dosyası: ölçümler, anamnez (sağlık öyküsü), uzman notları, özet ve zaman çizelgesi.
Danışanlık, paylaşım izni ve denetim kaydı `relationships` modülündedir; bu modül danışan verisine **her zaman** oradaki `AccessService` üzerinden erişir.

## Uzman adresleri (`/api/clients/:clientId/...`)
| Adres | Ne yapar | Gereken paylaşım |
|---|---|---|
| `GET file` | Özet: son ölçümler, yaş/cinsiyet, anamnez doluluğu ve eksikleri | Kategoriye göre kısmi |
| `GET timeline` | Ölçüm + anamnez yanıtı + not, tek çizelgede | Kategoriye göre kısmi |
| `GET/POST measurements`, `POST measurements/:id/void` | Ölçüm listesi / uzman girişi / kendi girişini geçersiz kılma | `WEIGHT` (kilo), `MEASUREMENTS` (diğerleri) |
| `GET anamnesis`, `PUT anamnesis/:questionKey` | Sorular ve yanıtlar / görüşmede danışan adına yanıt kaydı | `ANAMNESIS` |
| `GET/POST notes` | Görüşme notları (danışana gösterilmez) | Aktif danışanlık (yazmak için) |
| `POST /api/intake/questions`, `POST /api/intake/questions/:id/deactivate` | Uzmanın kendi anamnez sorusu | Onaylı diyetisyen/eğitmen |

## Danışan adresleri (`/api/me/health/...`)
`GET/POST measurements`, `POST measurements/:id/void`, `GET anamnesis`, `PUT anamnesis/:questionKey`.
Kaydetmek için sağlık verisi rızası gerekir (18 yaş altı bu rızayı veremez, dolayısıyla kaydedemez).

## Kurallar
- **Ölçümler silinmez**, yanlış giriş "geçersiz" işaretlenir ve geçmişte kalır. Herkes yalnızca kendi girdiğini geçersiz kılar.
- Her ölçümde **kaynak** (danışan/uzman/cihaz), **yöntem** (tartı, mezura, kaliper, BIA, DEXA…), cihaz adı, ölçüm zamanı ve **kimin girdiği** tutulur. Yöntem türe göre sınırlıdır (`measurement-rules.ts`).
- Değer aralıkları klinik eşik değildir; sadece yazım hatalarını yakalar (ör. 700 kg).
- Anamnez yanıtları **sadece eklenir**; güncel yanıt en yenisidir, eski yanıtlar geçmişte kalır. Aynı yanıt tekrar kaydedilmez.
- Yaş ve cinsiyet `ANAMNESIS` kategorisine bağlıdır.
- Uzmanın kendi sorusunun yanıtı yalnızca o uzmana görünür; danışan sadece aktif uzmanlarının sorularını görür.
- Aynı uzmanın 10 dakika içindeki tekrar bakışı denetim kaydına yeniden yazılmaz; her değişiklik yazılır.
- Danışanlık bitince veya paylaşım kapanınca uzmanın erişimi anında kapanır. Uzman kendi yazdığı notları okumaya devam eder (saklama süresi hukuki karar bekliyor).

## Standart soru seti: TASLAK
`intake-template.ts` içindeki sorular ve seçenekler bir diyetisyen tarafından **gözden geçirilmedi**; tıbbi doğruluk iddiası taşımaz.
Uygulama yanıtlardan otomatik sağlık kararı üretmez, sadece uzmana gösterir ve eksikleri belirtir. API yanıtı `templateStatus: "DRAFT"` döner; arayüz bunu kullanıcıya belirtir.
Alerjen anahtarları mobildeki `@fitapp/shared` listesiyle aynı tutulmalıdır (sunucu bu pakete bağlı değil).

## Henüz yok (sonraki aşamalar)
Uzman inceleme özeti (kırmızı/sarı/yeşil), beslenme planı ve sürümleri, randevu ve hatırlatma, ölçüm cihazı entegrasyonu, danışanın kendi ölçümlerinin demo uygulamayla birleştirilmesi.
