# KVKK

Sağlık verileri (kilo, hastalık, tahlil vb.) KVKK'ya göre **özel nitelikli kişisel veridir**.

Temel kurallar:
- Sağlık verisi toplamadan önce **açık rıza** alınır ve kaydedilir (`apps/api/src/modules/consents`).
- Diyetisyen/eğitmen bir danışanın verisini **sadece danışan izin verirse** görür.
- Hassas alanlar veritabanında şifreli saklanır.
- Kullanıcı hesabını ve verilerini silebilir.
- Sunucu yeri (yurt içi / yurt dışı) yayından önce hukuki şartlara göre seçilecek.
