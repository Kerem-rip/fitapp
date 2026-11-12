# gyms ✅ (Aşama 3A)

Spor salonu işletmesi: salon, ekip ve görev bazlı yetki, üyelik paketleri, üyeler, üyelikler, ödeme kayıtları ve "bugün" paneli.
**Ödemeler sadece kayıttır:** nakit/kart/havale masada alınır, uygulama para çekmez. Tutarlar kuruş (tam sayı) olarak tutulur.

## Salon ve görevler
- Salon, salon sahibi başvurusu onaylanınca başvurudaki bilgilerle açılır (`AdminService.approve`). Eski hesaplarda ilk çağrıda son onaylı başvurudan oluşur.
- Görevler: `OWNER` (sahip), `TRAINER` (salon eğitmeni), `RECEPTION` (resepsiyon). Yetki tablosu `gym-rules.ts` → `PERMISSIONS`.

| Yetki | Sahip | Resepsiyon | Eğitmen |
|---|---|---|---|
| Salon bilgisi, ekip yönetimi, paket tanımlama, ödeme iptali, tahsilat raporu | ✅ | — | — |
| Paketleri görme, üye ekleme/düzenleme, telefon görme, üyelik satma/iptal, ödeme kaydetme ve görme | ✅ | ✅ | — |
| Üye adı ve üyelik durumu | ✅ | ✅ | ✅ |

- Bir kişi aynı anda tek salonun ekibinde olabilir; salon sahibi başka salonun ekibine katılamaz.
- Davet kullanıcı adıyla gider; kişi kendi hesabından kabul eder (`GYM_STAFF` rolü o zaman eklenir). Ekipten çıkan ve başka salonu olmayan kişinin `GYM_STAFF` rolü kalkar.
- Salonlar birbirinin verisini göremez (her sorgu `gymId` ile sınırlıdır).

## Adresler
| Adres | Yetki | Ne yapar |
|---|---|---|
| `GET/PATCH /api/gym/me` | herkes / `gym.edit` | Salonum, görevim ve yetkilerim / salon bilgisi |
| `GET /api/gym/today` | herkes | Bugün paneli (para bilgisi sadece `payments.view` ile) |
| `GET /api/gym/staff` | herkes | Ekip (davet bekleyenleri sadece sahip görür) |
| `POST /api/gym/staff/invite` `{ username, role }` | `staff.manage` | Ekibe davet |
| `PATCH /api/gym/staff/:id` `{ role }` · `POST /api/gym/staff/:id/end` | `staff.manage` | Görev değiştir / ekipten çıkar, daveti geri al |
| `GET /api/gym/plans?all=true` · `POST` · `PATCH /:id` | `plans.view` / `plans.manage` | Üyelik paketleri (silinmez, satıştan kaldırılır) |
| `GET /api/gym/members?q=&status=` · `POST` · `GET/PATCH /:id` | `members.view` / `members.manage` | Üyeler (görüntü göreve göre daraltılır) |
| `POST /api/gym/members/:id/memberships` `{ planId, startDate?, priceKurus? }` | `memberships.manage` | Üyelik satışı |
| `POST /api/gym/memberships/:id/cancel` `{ reason }` | `memberships.manage` | Üyelik iptali (gerekçeli) |
| `POST /api/gym/members/:id/payments` | `payments.record` | Ödeme kaydı (ileri tarih olamaz) |
| `POST /api/gym/payments/:id/void` `{ reason }` | `payments.void` | Ödeme kaydını iptal (silinmez) |
| `GET /api/gym/reports/payments?from=&to=` | `reports.view` | Günlere ve ödeme türüne göre tahsilat |
| `GET /api/me/gym-invites` · `POST /:id/accept` · `POST /:id/decline` · `POST /leave` | davet edilen | Davetlerim, kabul, ret, salondan ayrılma |

## Kurallar
- Üyelik satılırken paketin adı, süresi, ders hakkı ve fiyatı üyeliğe **kopyalanır**; paket sonradan değişse de satılmış üyelik değişmez. Fiyat satışta değiştirilebilir (indirim).
- Bitiş tarihi = başlangıç + süre − 1 gün. Durum: başlamadı / aktif / dersleri bitti / süresi doldu / iptal.
- Kalan ödeme = iptal edilmemiş üyeliklerin ücreti − iptal edilmemiş ödemeler.
- Salon üye kaydında sağlık verisi tutulmaz. Üyenin sağlık verisi ancak üye kendi hesabından bir uzmana paylaşırsa görülür (bkz. `relationships`).
- Bildirim metinleri (`gym_invite`, `gym_invite_accepted`, `gym_staff_ended`) para veya sağlık bilgisi içermez.

## Dersler, katılım ve ders hakkı (Aşama 3B)
- Grup dersi (kontenjanlı) ve özel ders (tek üye). Tarih ve saat salonun yerel saatidir (gün + "18:00").
- Haftalık tekrar: 1–12 hafta; her hafta ayrı derstir, aynı `seriesId`'yi taşır. Tek hafta ya da "bu ve sonraki haftalar" iptal edilebilir.
- Aynı eğitmenin çakışan iki dersi olamaz (`TRAINER_BUSY`). Dersi sahip ya da ekipteki eğitmen verir; resepsiyon veremez.
- Sahip ve resepsiyon her derste her şeyi yapar. Eğitmen sadece kendine özel ders açar; kendi derslerine üye yazar ve katılım işaretler.
- **Ders hakkı:** sadece "katıldı" düşer, "gelmedi" düşmez. İşaret geri alınınca hak geri eklenir. Her hareket `GymSessionLog`'a yazılır (kim, ne zaman, hangi ders).
- Hangi üyelikten düşer (`pickCoverage`): grup dersi önce sınırsız üyelikten karşılanır (paket harcanmaz); özel ders sadece ders hakkı olan üyelikten düşer; birden çok paket varsa süresi önce biten kullanılır.
- Ders hakkı ya da geçerli üyelik yoksa yazma ve katılım **engellenmez**; uyarı döner (`NO_ACTIVE_MEMBERSHIP`, `NO_SESSIONS_LEFT`). Karar salonundur.
- Katılımı işaretlenmiş ders iptal edilemez; iptal edilen derste kimsenin hakkı düşmez. İleri tarihli derste katılım işaretlenmez.

| Adres | Ne yapar |
|---|---|
| `GET /api/gym/lessons?from=&to=&mine=` | Takvim (en fazla 42 gün) |
| `POST /api/gym/lessons` | Ders aç (`repeatWeeks` ile seri) |
| `GET /api/gym/lessons/:id` · `POST /:id/cancel` `{ reason, wholeSeries }` | Ayrıntı ve kayıtlı üyeler / iptal |
| `POST /api/gym/lessons/:id/bookings` `{ memberId }` · `POST /api/gym/bookings/:id/cancel` | Üye yaz / dersten çıkar |
| `POST /api/gym/bookings/:id/mark` `{ status: ATTENDED \| NO_SHOW \| BOOKED }` | Katılım işaretle / geri al |
| `GET /api/gym/members/:id/lessons` | Üyenin yaklaşan dersleri ve geçmişi |

## Görevler ve vardiyalar
- Görevi sahip atar (ekipten birine ya da kendine), görevli kişi tamamlar ya da geri açar. Sahip tümünü, diğerleri kendine atananları görür. Atanan kişiye bildirim gider (`gym_task_assigned`).
- Vardiya haftalık şablondur (Pazartesi=0 … Pazar=6; kayıt yoksa izinli). Sahip yazar, ekip görür. Ekipten çıkan kişinin vardiyaları silinir.

| Adres | Ne yapar |
|---|---|
| `GET /api/gym/tasks?status=open\|done\|all&mine=` · `POST` · `PATCH /:id` · `DELETE /:id` | Görevler (yazma: `tasks.manage`) |
| `POST /api/gym/tasks/:id/done` `{ done }` | Tamamla / geri aç |
| `GET /api/gym/shifts` · `PUT /api/gym/shifts/:userId/:weekday` `{ shift: { start, end } \| null }` | Vardiya şablonu (yazma: `shifts.manage`) |

Tarihe özel vardiya değişiklikleri (izin günü, nöbet değişimi) henüz yok.
