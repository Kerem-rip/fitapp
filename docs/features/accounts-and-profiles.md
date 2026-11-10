# Hesap, roller ve profiller

**Aşama:** 1 · **Backend modülleri:** `auth`, `users`, `roles`, `consents`

## Hesap
- E-posta + şifre ile kayıt. Telefonla ve Google/Apple ile giriş sonra eklenebilir.
- Tek hesap, birden fazla rol olabilir: `USER`, `DIETITIAN`, `TRAINER`, `GYM_MANAGER`, `ADMIN`.
  Örneğin bir diyetisyen aynı zamanda normal kullanıcı olarak kendi takibini yapabilir.
- Kullanıcı hesabını ve tüm verilerini silebilir (KVKK).

## Yaş kuralları
🟡 **Onay bekliyor** — 18 yaş altı da kullanabilir, ama "genç modu" ile:

| Yaş | Durum |
|---|---|
| 13 altı | Kayıt olamaz |
| 13–17 | **Genç modu** (aşağıda) |
| 18+ | Tüm özellikler |

**Genç modu:**
- ✅ Açık: egzersizler, duruş, yüz masajı, programlar, sağlıklı beslenme rehberi, öğün kaydı, su takibi
- ❌ Kapalı: kalori açığı / kilo verme hedefi, kalori sayısının ön planda gösterimi
- Profil her zaman gizli, keşfette ve aramada görünmez
- Yetişkin kullanıcılarla mesajlaşma kapalı
- Doğrulanmış profesyonellere ulaşma ve danışan olma **veli onayı** ile
- Sağlık verisi için açık rıza **veliden** alınır

> Yayın öncesi bir hukukçuya doğrulatılacak: 18 yaş altı için KVKK rızası, veli onayı yöntemi,
> profesyonelle hizmet ilişkisi.

## Profil
Her kullanıcının bir profili vardır.

| Alan | Görünürlük |
|---|---|
| Ad, profil fotoğrafı, kısa tanıtım | Herkese açık |
| Hedefler, rozetler | Kullanıcı seçer |
| Kilo, ölçüler, yemek kayıtları, sağlık bilgileri | **Her zaman gizli.** Sadece kullanıcının izin verdiği profesyonel görür. |

- Profesyonellerin profilleri her zaman herkese açıktır (keşfedilebilmeleri için).
- Normal kullanıcı profilleri varsayılan olarak **gizli hesaptır**:
  takip etmek için onay gerekir. Kullanıcı isterse açık hesaba çevirir.

## Takip
- Kullanıcılar birbirini ve profesyonelleri takip edebilir.
- Gizli hesaplarda takip isteği onaylanmalıdır.
- Takipçi / takip edilen listeleri profilde görünür (gizli hesapta sadece takipçilere).

## Engelleme ve şikayet (zorunlu)
- Her profilde **Engelle** ve **Şikayet et** seçeneği bulunur.
- Engellenen kişi profili göremez, takip edemez, mesaj gönderemez.
- Şikayetler admin panelinde incelenir.
- Apple ve Google, kullanıcıların birbiriyle iletişim kurduğu uygulamalarda bunu şart koşar.

## KVKK rızaları
- Sağlık verisi (kilo, boy, alerjiler vb.) toplamadan önce **açık rıza** alınır.
- Her rıza; tür, metin sürümü ve tarih ile kaydedilir. Kullanıcı istediği zaman geri çekebilir.
