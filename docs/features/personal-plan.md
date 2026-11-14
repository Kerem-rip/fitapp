# Kişisel 28 günlük program (çalışma adı: SocialFit)

Kullanıcıya özel hazırlanan, ilerlemeye göre güncellenen, tek seferlik satın alınan 28 günlük egzersiz programı.
Sunucu modülü: `apps/api/src/modules/personal-plan/`. Mobil: `apps/mobile/src/features/plan/`.

## Kurallar (onaylı kararlar)

- Süre kesin **28 takvim günü**; duraklatma yok; kaçırılan antrenman sonraki güne yığılmaz; bitiş tarihi değişmez; yeni dönem otomatik başlamaz.
- Tek seferlik satın alma, otomatik yenileme yok. Başlangıç tarihi satın almadan sonra **14 gün içinde** seçilir (en geç satın alma günü + 14). Bir kez seçilir. Tarih seçilmeden 14 gün geçerse program **son günde (satın alma günü + 14) otomatik başlar** (karar); süre o günden itibaren 28 gün kesintisiz ilerler.
- İlk sürüm **18 yaş ve üzeri** içindir.
- Riskli ya da belirsiz sağlık durumunda **program üretilmez**, uzmana yönlendirilir.
- **Gerçek ödeme yok.** Satın alma `DEV` sağlayıcısıyla kaydedilir (üretimde 503 döner), fiyat yer tutucudur (`Fiyat yakında`).
- Bütün programlar Görevlerim'de tek yerdedir; her kaynağın etiketi ayrıdır (SocialFit programı, Ücretsiz program, Diyetisyen, Antrenör, Eklediğin hareketler). Uzman görevlerinin sırası ve saati değiştirilmez.

## Durumlar (`lifecycle.ts`)

`AWAITING_START` (satın alındı / başlangıç bekleniyor) → `ACTIVE` → `COMPLETED` ya da `EXPIRED`; ayrıca `START_WINDOW_MISSED`.
Bitince `awaitingRepurchase` işareti yeniden satın alma bekleyen durumu gösterir.

- **Tamamlandı**: 4 hafta da üretilmiş ve her antrenman gününün ana hareketlerinin hepsi yapılmış. 28 günün dolması tamamlandı demek değildir.
- **Süresi doldu**: 28 gün bitti, tamamlanmadı. Her ikisinde gelişim raporu otomatik üretilip kaydedilir.
- Tüm günler Türkiye takvim günüdür (UTC+3); sunucu saati ve cihaz saat dilimi sonucu değiştirmez.

## Akış

1. `GET /plan/catalog` — 7 kategori + alt kategoriler, form seçenekleri, sağlık soruları.
2. `POST /plan/intake` — form + güvenlik taraması (`intake.ts`). Hepsi cevaplanmalı.
3. `POST /plan/purchases { idempotencyKey }` — aynı anahtar çift kayıt oluşturmaz; kullanıcı başına kilit (`pg_advisory_xact_lock`).
4. `POST /plan/purchases/:id/start { startDate }` — 1. hafta üretilir.
5. `GET /plan/instances/:id`, `/days/:n` — takvim ve günlük görev. Haftalar 2-4, haftanın başladığı gün önceki haftanın performansına göre **tembel** üretilir.
6. `POST .../entries/:i/log` (yapıldı/atlandı, zorlanma, ağrı), `.../swap` (anlık alternatif).
7. `GET /plan/instances/:id/report` — gelişim raporu.

## Güvenlik kapısı (TASLAK — sağlık uzmanı onayı bekliyor)

Evet ya da "emin değilim": kalp/tansiyon kısıtı, göğüs ağrısı, baş dönmesi/bayılma, hamilelik/doğum (6 ay), ameliyat (6 ay), akut sakatlık, şu an engelleyici ağrı, tedavi gören kronik hastalık, doktorun egzersiz kısıtı → **engellenir**. BMI < 17 engellenir; BMI ≥ 35 ve 55+ yaş zıplamasız ve hafif programla devam eder; ağrı bölgesi o bölgeyi yükleyen hareketleri eler. Vücut ölçüleri tek başına hareket seçimini belirlemez.

## Haftalık uyarlama kuralları (TASLAK — antrenör onayı bekliyor)

Kural özeti `engine/adapt.ts` başındadır. Tamamlama < %50 gerile; %50-80 aynı; ≥ %80 ve RPE ≥ 9 aynı; RPE ≤ 5 ilerle (2 adım), aksi halde 1 adım. Hafta 2 en fazla 1 adım; hafta 4 değerlendirmedir (artış yok). Ağrı: hareket ve bölge çıkarılır, artış yapılmaz; şiddetli ağrı ya da bir haftada 3 bildirim → "uzmana danış" ve hacim %30 azalır. Hiçbir hafta daha zor olmak zorunda değildir.

## Veri

`PlanIntake` (her dönem ayrı, değişmez) → `PlanPurchase` → `PlanInstance` (algoritma sürümü `engineVersion`, parametreler ve açıklama kaydı) → `PlanDay` (hareketler JSON) + `PlanEntryLog`. Önceki dönem silinmez ya da üzerine yazılmaz. Yeni dönem formu yeniden doğrulatır ve önceki raporu (başlangıç seviyesi, kaçınılan hareketler, ağrı bölgeleri) kullanır; eski programın kopyası olmaz.

## Hareket kütüphanesi

7 kategori ve alt kategorileri `plan-types.ts` içinde hazırdır. Hareket içeriği `library/catalog.ts` (hareket) + `plan-meta.ts` (kategori, ortam, ekipman, kalıp, bölge, alternatif, MET) içindedir; aynı hareket tek kayıttır. **Eklenen ~35 hareket taslaktır**, antrenör incelemesi ve genişletme bekler; video alanı (`videoUrl`) boştur. Kategorisi boş kalanlar arayüzde "İçerik yakında" görünür.

## Henüz yapılmayanlar

- Gerçek ödeme sağlayıcısı, fiyat, fatura/vergi.
- Başlangıç tarihi seçildikten sonra değiştirilemez (karar bekliyor).
- Videolar; hareket içeriğinin genişletilmesi.
- Sunucu `@fitapp/shared`'a bağımlı olmadığı için Mifflin-St Jeor formülü `energy.ts` içinde kopyadır (iki yer aynı tutulmalı).
