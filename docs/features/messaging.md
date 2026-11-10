# Mesajlaşma

**Aşama:** 1 · **Backend modülü:** `messaging`

## Kime nasıl mesaj atılır
| Alıcı | Kural |
|---|---|
| **Profesyonel** (diyetisyen, eğitmen, salon) | Herkes **doğrudan** mesaj atabilir, istek yok |
| **Normal kullanıcı** | İlk mesaj **istek** olarak gider; kabul edilirse sohbet açılır |

- Kullanıcıya giden istek kabul edilmeden ikinci mesaj gönderilemez (spam önlemi).
- Reddedilen istek gönderene bildirilmez, sadece kapanır.
- Profesyonelin mesaj kutusu **"Danışanlar"** ve **"Yeni mesajlar"** olarak ayrılır, böylece danışan mesajları kaybolmaz.
- Genç modundaki kullanıcılar profesyonellere sadece veli onayından sonra yazabilir; yetişkin normal kullanıcılarla mesajlaşamaz.

## Sohbet
- Birebir yazılı mesaj, fotoğraf gönderme.
- Okundu bilgisi, yeni mesaj bildirimi.
- Mesajlar uygulama içinde kalır; telefon numarası paylaşmak zorunlu değildir.

## Güvenlik (zorunlu)
- Her sohbette **Engelle** ve **Şikayet et**.
- Engellenen kişi mesaj ve istek gönderemez.
- Şikayet edilen mesajlar admin panelinde incelenir.
- Kısa sürede çok fazla istek gönderen hesaplar otomatik sınırlanır.

## Sonra (Aşama 2)
Görüntülü görüşme, randevu sistemi.
