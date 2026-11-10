# Beslenme ve kalori takibi

**Aşama:** 1 · **Backend modülü:** `nutrition`

## Temel ilke: Değerler tahminidir
- Gösterilen tüm kalori ve besin değerleri **tahminidir**. Bu her ekranda açıkça yazar.
- Kesin değerler ve kişiye özel plan için kullanıcı **diyetisyene yönlendirilir**
  ("Size özel plan için bir diyetisyenle çalışın" butonu). Bu aynı zamanda profesyonellere danışan kazandırır.

## Yemek veritabanı
| Tür | Kaynak |
|---|---|
| Ham gıdalar (domates, pirinç, tavuk) | USDA FoodData Central (ücretsiz, herkese açık) |
| Paketli ürünler | Open Food Facts (barkod ile) |
| Türk yemekleri (mercimek çorbası, karnıyarık...) | Standart tariflerden hesaplanır. İlk liste: en sık yenen ~300 yemek. |

Her yemekte tutulan bilgiler:
- Ad, kategori
- 100 g başına kalori, protein, karbonhidrat, yağ
- **Ev ölçüleri**: "1 kepçe", "1 dilim", "1 kase", "1 yemek kaşığı" → gram karşılığı
- `source` (kaynak) ve `isEstimate` (tahmini mi). Bir diyetisyen düzeltirse "doğrulanmış" olur.

## Öğün takibi
- Kullanıcı gün içinde öğün ekler: kahvaltı, öğle, akşam, ara öğün.
- Arama, son yenenler, favoriler, barkod okuma.
- Günlük toplam: kalori ve makrolar, hedefe göre kalan miktar.

## Günlük kalori hedefi
- Yaş, cinsiyet, boy, kilo ve hareket düzeyinden **tahmini** hesaplanır (Mifflin-St Jeor formülü).
- Hedefe göre ayarlanır (kilo verme → açık, kas → fazla).
- **Güvenlik sınırı:** Hedef belirli bir alt sınırın altına inmez.
  Çok düşük kalori isteyen kullanıcıya uyarı gösterilir ve diyetisyene yönlendirilir.
- Kullanıcıya atanmış bir diyetisyen varsa, hedefi diyetisyen belirler.

## Diyetisyen bağlantısı
- Danışan izin verirse diyetisyen öğün kayıtlarını görür ve yorum yapabilir.
