# Hareket kütüphanesi, kanıt katmanı ve antrenman kartları

Uzman onay mekanizması **yoktur** (karar). Her hareket kaynaklarla karşılaştırılır; durumu arayüzde etiketlenir.

## Kanıt katmanı (`apps/api/src/modules/library/evidence.ts`)

- `SOURCES`: yayıncı, adres, sayfanın tamamının okunup okunmadığı (`read`).
- `EVIDENCE[id]`: İngilizce ad, aile ve varyasyon ilişkisi (`variationOf`), doğrulama durumu, kaynaklar, alternatifler (EASIER / HARDER / EQUIVALENT / NO_EQUIPMENT), kaynak notu.
- `CONTENT[id]`: kaynaktan yazılan adımlar, hatalar, uyarılar ve (varsa) yapılış değeri. Katalogdaki taslak metnin üzerine yazılır; hareket tek kayıttır.
- Doğrulama: `ok` ≥ 2 kaynak, `partial` tek kaynak ya da zayıf ikinci kaynak, `held` kaynak yetersiz (etiketle gösterilir), `none` henüz taranmadı.
- Yüz egzersizi/masajı: `held`; sabit uyarı "sonuç garanti edilmez" (`FACE_EVIDENCE_WARNING`). Hazır yüz antrenman kartı yoktur.
- Görsel/video: lisanslı içerik yoksa `media.status = MISSING`; uydurma bağlantı gösterilmez. Resmî sitelerin (ACE, Cleveland Clinic, NHS) görselleri kullanılmaz.
- Araştırma kaydı: `docs/research/exercise-pilot.json`.

## Antrenman kartları (`workout-cards.ts`)

- Bölümler: hazırlık → ısınma → ana → bitiş. Başlıklar kategoriye göre değişir (yoga: "Ana duruşlar", kardiyo: "Kardiyo bloğu").
- Kural: **ana bölümdeki her hareket en az `partial`** olmalı (birim testi denetler). Isınma/bitiş hareketleri taranmamış olabilir; kartta etiketlenir.
- Açık kurallar `RULES` içindedir (R1 set sayısı, R2 dinlenme, R3 sıra, R4 kısıt). Kaynakta olmayan değerler bunlardır ve kartın "dayanağı" bölümünde yazılıdır.
- Kısıt (R4): seçilen bölgeyi yükleyen hareket (`PLAN_META.stress`, diz/ayak bileğinde yüksek etkili) aynı hedefli alternatifle değiştirilir; uygun alternatif yoksa çıkarılır.

## Uçlar

`GET /workout-cards?avoid=`, `GET /workout-cards/:id?avoid=`, `POST /me/workout-cards/tasks` (Takvime ekle), `DELETE .../tasks/:id`, `POST .../tasks/:id/reset`, `POST /me/workout-cards/:cardId/complete` (Hemen Başla bitişi), `GET /library/items/:id` (kanıt + medya durumu), `GET /me/program?date=` (`cards`).
Veri: `WorkoutCardTask` (kullanıcı, kart, gün, kısıt, `doneAt`, tamamlanan/toplam hareket).

## Mobil

Kütüphane > Antrenmanlar (kısıt seçici), kart detayı (`/workout-card/[id]`), "Hemen Başla" oynatıcısı (`/workout-play/[id]`: set, süre/tekrar, dinlenme sayacı, sonraki hareket, alternatif, atla, bitiş kaydı), Görevlerim'de "Antrenman kartı" satırı.

## Genişletilmiş kütüphane (karar: kaynak doğrulaması beklenmeden eklendi)

`extra-moves.ts`: ~110 ek hareket (ev, salon, yoga, pilates, postür, mobilite, kardiyo, spor). Kaynak taraması yapılmamıştır; arayüzde "Henüz taranmadı" etiketi görünür ve içerik sonradan incelenip gerekmeyenler çıkarılacaktır. Plan motoru meta verisi de buradan üretilir. Hamilelik/özel grup hareketleri eklenmedi.
Kartlar (`workout-cards.ts`): 40'tan fazla kart; ortam ve ekipman hareketlerden çıkar; her kartta sıra numarası, set/tekrar/süre ve hareketler arası dinlenme (R2) açık yazılıdır. Görevlerim'de aynı sıralı liste görünür. Hareket sayfasında "Sıralı antrenmanda yap" listesi, hangi kartta yer aldığını gösterir.

## Eksikler

Tek kaynaklı hareketler, hiçbir hareket için video/görsel, düşük etkili kardiyo kartı (kaynaklı hareket yok), WHO tam metni, birçok mevcut hareketin kaynak taraması.
