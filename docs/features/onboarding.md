# Kayıt öncesi sorular (onboarding)

**Aşama:** 1 · **Backend modülü:** `onboarding`

## Amaç
Kullanıcı uygulamayı açınca kayıt olmadan önce kısa sorular cevaplar.
Cevaplara göre ana sayfası kişiselleşir. Kullanıcı tek bir temaya **kilitlenmez**:
hedefini istediği zaman değiştirebilir, ana sayfa yeniden düzenlenir.

## Akış
```
Uygulama açılır → Sorular (kayıtsız, cevaplar telefonda tutulur)
  → "Sana özel planın hazır" → Kayıt ol
  → KVKK açık rıza (sağlık verisi için)
  → Cevaplar backend'e kaydedilir → Kişisel ana sayfa
```
Sağlık verisi sayılan cevaplar (kilo, boy, sağlık durumu) rıza alınmadan sunucuya gönderilmez.

## Soru taslağı
🟡 **Onay bekliyor** — sorular ve seçenekler birlikte son haline getirilecek.

1. **Hedefin ne?** (birden fazla seçilebilir)
   Kilo vermek · Kas yapmak / kilo almak · Formda kalmak · Duruşumu düzeltmek · Sağlıklı beslenmek · Yüz bakımı ve rahatlama
2. **Nerede spor yapmayı tercih edersin?** Evde · Salonda · İkisi de · Henüz spor yapmıyorum
3. **Seviyen?** Yeni başlıyorum · Orta · İleri
4. **Haftada kaç gün, kaç dakika ayırabilirsin?**
5. **Bir uzmandan destek almak ister misin?** Evet, diyetisyen · Evet, eğitmen · Şimdilik kendim yaparım
6. **Beslenme tercihi:** Fark etmez · Vejetaryen · Vegan · Glutensiz · Diğer
7. **Temel bilgiler:** Yaş, cinsiyet, boy, kilo, hedef kilo *(rızadan sonra kaydedilir)*

## Ana sayfa kişiselleştirme
Ana sayfa modüllerden oluşur. Cevaplara göre modüllerin **sırası ve görünürlüğü** değişir:

| Ana hedef | Öne çıkan modüller |
|---|---|
| Kilo vermek | Kalori takibi, su, kilo grafiği, ev egzersizleri, diyetisyen önerisi |
| Kas yapmak | Antrenman programı, protein takibi, eğitmen önerisi |
| Duruş | Duruş programları, kendi kendine kontrol rehberi |
| Yüz bakımı | Yüz masajı rutinleri |
| Sağlıklı beslenme | Diyet türleri rehberi, öğün takibi |

Kural backend'de tutulur; yeni hedef veya modül eklemek için mobil uygulamayı güncellemek gerekmez.
