// E-posta gönderimi. Şimdilik TEST MODU: e-posta gönderilmez, kod sunucu kaydına yazılır.
// Gerçek bir e-posta servisi seçilince sadece bu dosya değişir (EMAIL_MODE ayarıyla).
import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);

  async sendVerificationCode(to: string, code: string, ttlMinutes: number): Promise<void> {
    // Test modu: kodu kaydeder (gerçek e-posta servisi bağlanınca burası gönderim yapacak)
    this.logger.log(`[E-POSTA TEST MODU] ${to} adresine doğrulama kodu: ${code} (${ttlMinutes} dk geçerli)`);
  }

  async sendPasswordResetCode(to: string, code: string, ttlMinutes: number): Promise<void> {
    this.logger.log(`[E-POSTA TEST MODU] ${to} adresine şifre sıfırlama kodu: ${code} (${ttlMinutes} dk geçerli)`);
  }
}
