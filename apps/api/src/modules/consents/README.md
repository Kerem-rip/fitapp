# consents ✅

KVKK rızaları: alma, kaydetme, geri çekme. Sağlık verisi bu modülden izin almadan toplanmaz.

| Adres | Ne yapar |
|---|---|
| `GET /api/consents` | Geçerli rızalar |
| `PUT /api/consents/:type` | Rıza ver (`health_data`, `marketing`) |
| `DELETE /api/consents/:type` | Rızayı geri çek |

## Rıza türleri
| Tür | Açıklama |
|---|---|
| `terms`, `privacy_notice` | Kayıt şartı. Geri çekmek için hesap silinir. |
| `health_data` | Sağlık verisi (kilo, ölçü, öğün kayıtları) için açık rıza. İsteğe bağlı, geri çekilebilir. |
| `marketing` | Tanıtım iletileri. İsteğe bağlı. |

## Kurallar
- Her rıza metin sürümü ve tarihiyle kaydedilir. Geri çekilen rıza silinmez, `revokedAt` ile işaretlenir.
- 18 yaş altı `health_data` rızasını kendisi veremez (veli onayı gerekir).
- Sağlık verisi kaydeden modüller önce `ConsentsService.hasActive(userId, 'health_data')` ile kontrol eder.

## Henüz yok
- Veli onayı akışı (veliye e-posta ile onay bağlantısı) — e-posta servisiyle birlikte gelecek
- Rıza metinlerinin kendisi (hukukçu yazacak; sürümler şimdilik "taslak")
