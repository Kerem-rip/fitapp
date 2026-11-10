# mobile — Mobil uygulama

iOS ve Android uygulaması (React Native + Expo). **Herkesin ana ekranı burası**, profesyoneller dahil.
Telefon ve tablette düzgün görünmeli.

- `src/app/` → Ekranlar. Dosya adı = ekranın adresi.
- `src/features/` → Ekranların arkasındaki mantık, özellik özellik.
- `src/hooks/` → Tekrar kullanılan küçük mantık parçaları.
- `src/store/` → Uygulamanın hafızası (giriş yapan kim, seçili hedef vb.).

**Kural:** Ekranlar renk/yazı tipi yazmaz, sadece `@fitapp/ui-mobile` parçalarını kullanır.

> Durum: İskelet. Expo kurulumu bir sonraki adımda yapılacak.
