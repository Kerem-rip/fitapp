# email

E-posta gönderimi (şimdilik doğrulama kodu).

**Test modu (`EMAIL_MODE=console`):** E-posta gönderilmez; doğrulama kodu sunucu kaydına yazılır ve geliştirme ortamında
API cevabında da döner (uygulama "test kodu" olarak gösterir). Bu mod yayında kapatılır.

Gerçek e-posta servisi seçildiğinde sadece `email.service.ts` değişir.
