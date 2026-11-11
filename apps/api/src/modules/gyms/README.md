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

## Sonraki aşama (3B)
Grup/özel dersler, katılım ve ders hakkından düşme; ekip görevleri ve vardiyalar. Mobilde bu bölümler şimdilik örnek veriyle çalışır.
