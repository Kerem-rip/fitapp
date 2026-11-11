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

## Uzman inceleme özeti (1B) — `findings/`
Kırmızı (uzmanın incelemesi gereken olası risk) / sarı (eksik, eski veya şüpheli bilgi, danışana sorulacak) / yeşil (değerlendirilebilecek öneri) maddeler.

| Adres | Ne yapar |
|---|---|
| `GET /api/clients/:clientId/findings?view=open\|closed\|all` | Maddeler (dayanak, geçmiş, görevler). Bakış denetim kaydına yazılır |
| `POST .../findings/:id/notes` `{ text }` | Maddeye not |
| `POST .../findings/:id/close` `{ decision, reason }` | Kararı ve gerekçesiyle kapat (`EVALUATED`, `NOT_APPLICABLE`, `CLIENT_INFORMED`, `OTHER`) |
| `POST .../findings/:id/reopen` | Kapatılmış maddeyi yeniden aç |
| `POST .../findings/:id/task` `{ title, dueAt? }` | Maddeden takip görevi; madde "takipte" olur, görev bitince yeniden açılır |
| `GET/POST .../tasks` | Danışana özel görevler |
| `GET /api/review/overview` | Panel: danışan başına açık madde SAYILARI (içerik yok, denetim kaydı yazmaz) |
| `GET /api/review/tasks`, `POST /api/review/tasks/:id/done` | Tüm görevlerim / tamamla |

### İlkeler
- Maddeler **otomatik tutarlılık kontrolleridir** (eksik/eski bilgi, danışanın kendi beyanı, ölçüm tutarsızlığı). Tanı koymaz, tedavi veya diyet kararı vermez.
- **Eksik bilgi varsa kesin sonuç çıkmaz:** onun yerine "önce şu bilgiyi doğrula" maddesi çıkar. Yeşil "temel bilgiler tamam" maddesi ancak önemli sorular yanıtlı ve kilo/boy güncelse çıkar.
- Her maddenin **dayanağı** (`basis`) gösterilir.
- **Klinik kural şimdilik YOK.** Kurallar `rules.ts` içinde `kind: 'MECHANICAL' | 'CLINICAL'` ile işaretlidir; klinik kural, `reviewed: true` olmadan çalışmaz. Şu an hepsi mekanik ve `reviewed: false` (yani uzman gözden geçirmesi bekliyor). API yanıtı `rulesStatus: "UNREVIEWED"` döner, arayüz bunu belirtir.
- **Madde yaşam döngüsü:** parmak izi = kural + dayanak değerleri. Dayanak değişirse yeni madde açılır; dayanak ortadan kalkarsa açık madde otomatik `SUPERSEDED` olur; kapatılmış madde aynı dayanakla yeniden açılmaz; `SUPERSEDED` madde dayanak geri gelirse yeniden `OPEN` olur.
- Maddeler **uzmana özeldir**; danışan görmez, iki uzmanın maddeleri birbirinden bağımsızdır. Bir madde, gerektirdiği paylaşım kategorisi kapanırsa gizlenir (silinmez).
- Danışanın verisi değişince (kendi yazması ya da uzmanın girişi) aktif uzmanlarının maddeleri arka planda tazelenir; böylece panel dosyayı açmadan güncel kalır.

### Doğrulanacaklar (uzman gözden geçirmesi bekleyen ayarlar — `RULE_PARAMS`)
Bunlar klinik eşik değil, veri kalitesi ayarlarıdır; yine de bir diyetisyenle gözden geçirilmeli:
- Kilo ölçümü "eski" sayılma süresi: **30 gün**
- Sağlık öyküsü "güncellenmedi" sayılma süresi: **180 gün**
- Ani kilo farkı uyarısı: **14 gün içinde %10'dan fazla**
- Farklı yöntem uyarısı penceresi: **120 gün**
- Paylaşım bitiyor uyarısı: **7 gün**
- Hangi anamnez soruları "önemli" sayılacak (alerji, sağlık durumu, ilaç, hamilelik/emzirme, yeme bozukluğu öyküsü)
- Madde metinlerinin dili (tanı/tedavi dili geçmemeli; birim testi bazı ifadeleri yasaklar)
- "İlaç/ek alerji" serbest metninde "yok", "hayır" gibi yanıtların madde üretmemesi (basit metin eşleşmesi)

## Beslenme planı (1C) — `plans/`
Uzman taslak hazırlar → kontrol eder → **onaylar**; onaylanmadan danışana gitmez. Onaylanan sürüm değişmez; düzenleme yeni taslakla yapılır, her onay yeni sürüm numarası alır.

| Adres | Kim | Ne yapar |
|---|---|---|
| `GET /api/clients/:clientId/plan` | Uzman | Yayındaki sürüm, açık taslak, sürüm geçmişi (her sürümde "ne değişti") |
| `POST/PUT/DELETE .../plan/draft` | Uzman (onaylı diyetisyen) | Taslak aç (boş / yayındakinden / verilen içerikle), kaydet, sil |
| `GET .../plan/draft/check` | Uzman | Engeller ve uyarılar |
| `POST .../plan/draft/approve` `{ changeNote?, confirmWarnings }` | Uzman | Onayla ve danışana yayınla |
| `GET .../plan/versions/:number` | Uzman | Bir sürümün içeriği ve önceki sürüme göre farkı |
| `GET .../plan/choices?from=&to=` | Uzman | Danışanın seçimleri (öğün kayıtları paylaşılıyorsa) |
| `GET /api/me/plans`, `GET /api/me/plans/:planId?date=` | Danışan | Yayındaki planlarım, o günkü seçimlerim |
| `PUT /api/me/plans/:planId/choices` `{ date, mealId, optionIds }` | Danışan | İzinli alternatiflerden seçim (en fazla `pick` tane, ±7 gün) |

### Kurallar
- İçerik: öğünler; her öğünde uzmanın tanımladığı **alternatifler** (ad, porsiyon, isteğe bağlı kalori, alerjenler, not), danışanın kaç seçeneği seçeceği (`pick`) ve serbest metin **değiştirme kuralı**. Değerler uzmanındır; sistem tıbbi doğruluk iddia etmez, kalori hesaplamaz.
- **Onay engelleri:** boş plan, seçeneksiz öğün, seçenekten fazla `pick`, danışanın **alerji bilgisi yoksa/paylaşılmıyorsa**, danışanın alerjenini içeren seçenek, danışanın alerjisi varken **alerjeni belirtilmemiş** seçenek.
- **Uyarılar:** yeme bozukluğu öyküsü, hamilelik/emzirme, sağlık durumu, ilaç beyanı, eksik önemli sorular açık madde olarak duruyorsa uzman `confirmWarnings: true` ile açıkça onaylamalı; geçtiği uyarılar sürüme kaydedilir.
- **Alerji değişince yeniden inceleme:** danışan yayından sonra yeni alerji beyan ederse çakışan seçenekler danışana **seçilemez** gösterilir ve uzmana kırmızı `R-PLAN-ALLERGEN` maddesi düşer. Uzman yeni sürüm yayınlayınca madde kendiliğinden kapanır.
- Danışanlık bitince danışan planı göremez; uzman kendi plan geçmişini okumaya devam eder (saklama süresi hukuki karar bekliyor).
- Plan yalnızca onaylı **diyetisyen** tarafından hazırlanır (eğitmen programları Aşama 2).

## Randevu, hedef, hatırlatma ve gelişim takibi (1D) — `agenda/`
| Adres | Kim | Ne yapar |
|---|---|---|
| `GET/POST /api/clients/:clientId/appointments` | Uzman | Danışanla randevular / randevu ver (çakışma kontrolü, danışana bildirim) |
| `PATCH /api/appointments/:id`, `POST /api/appointments/:id/status` | Uzman | Ertele / tamamlandı (görüşme özetiyle), gelmedi, iptal |
| `GET /api/agenda?from=&to=` | Uzman | Aralıktaki randevular ve vadesi gelen/geçen görevler |
| `GET/POST /api/clients/:clientId/goals`, `POST /api/goals/:id/status` | Uzman | Hedefler ve ilerleme / ulaşıldı, bırakıldı |
| `GET/POST /api/clients/:clientId/reminders`, `POST /api/reminders/:id/cancel` | Uzman | Danışana zamanlı hatırlatma |
| `GET /api/me/appointments`, `POST /api/me/appointments/:id/cancel`, `GET /api/me/goals` | Danışan | Randevularım (notlar olmadan), iptal, hedeflerim |
| `GET /api/notifications`, `POST /api/notifications/read` | Herkes | Okunur metinli bildirimler, okundu işaretleme (`modules/notifications`) |

### Kurallar
- Uzmanın hazırlık notu ve görüşme özeti danışana gösterilmez. "Tamamlandı/gelmedi" randevu saati gelmeden işaretlenemez.
- Randevudan 24 saat önce danışana bir kez otomatik hatırlatma gider (10 dakikada bir çalışan iş). Zaman değişirse yeniden gider.
- Uzmanın hatırlatmaları zamanı gelince bildirim olur (dakikada bir). Danışanlık o an aktif değilse gönderilmez, iptal edilir.
- Bildirim metinlerine sağlık verisi yazılmaz (kilit ekranında görünebilir).
- Hedef değerleri uzmanındır; sistem hedef önermez. Ölçüm hedefinin başlangıcı son ölçümdür; ilerleme sadece ilgili kategori paylaşılıyorsa görünür.
- **Beklenen değişim yoksa** (`Y-GOAL-NO-PROGRESS`): hedef 21 günden eskiyse ve son ölçüm hedefe başlangıçtan daha yakın değilse, sistem yeni plan **önermez**; uzmana inceleme soruları sunar: ölçüm yöntemi, planın uygulanma durumu (öğün kayıtları paylaşılıyorsa son 14 günde kaç gün seçim yapıldığı), danışanın geri bildirimi, hedefin gerçekçiliği. Uzman maddeyi gerekçesiyle kapatır (1B).
- Ayrıca: hedeften sonra 14 gün ölçüm yoksa, hedef tarihi geçtiyse sarı; hedef değere ulaşıldıysa yeşil madde çıkar.
- Ölçüm listelerinde her değer bir önceki aynı tür ölçümle karşılaştırılır; yöntem farklıysa belirtilir.

## Henüz yok (sonraki aşamalar)
Bildirim tercihleri (sıklık, kapatma), uzman–danışan mesajlaşmasının sunucuya taşınması, telefona anlık bildirim (push), ölçüm cihazı entegrasyonu, uzmana özel değerlendirme soruları ve kişiye uygun hesaplama araçları (5. madde), danışanın günlük kayıtlarının (öğün, su, kilo) demo depodan sunucuya taşınması.
