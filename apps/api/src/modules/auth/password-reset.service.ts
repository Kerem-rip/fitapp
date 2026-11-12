// Şifremi unuttum: e-postaya 6 haneli kod gider, kodla yeni şifre belirlenir.
// Güvenlik:
//  - "Bu e-postayla hesap var mı?" sorusu yanıtlanmaz: kod isteği her durumda aynı cevabı verir.
//  - Kodun kendisi saklanmaz; deneme ve gönderim sayısı sınırlıdır, kod kısa süre geçerlidir.
//  - Şifre değişince bütün cihazlardaki oturumlar kapanır.
//  - Yönetici/moderatör hesapları bu yoldan sıfırlanmaz (ayrı ve sıkı süreç gerekir).
import { Inject, Injectable } from '@nestjs/common';
import { createHmac, randomInt, timingSafeEqual } from 'node:crypto';
import { badRequest } from '../../common/app-error.js';
import { PrismaService } from '../../common/prisma/prisma.service.js';
import { env } from '../../config/env.js';
import { EmailService } from '../email/email.service.js';
import { PasswordService } from './password.service.js';

const MINUTE_MS = 60_000;
// Gönderim sayacı bu süre sonra sıfırlanır
const SEND_WINDOW_MS = 24 * 60 * MINUTE_MS;

const GENERIC_INVALID = () => badRequest('CODE_INVALID', 'Kod hatalı ya da süresi dolmuş. Yeni kod isteyebilirsin.');

@Injectable()
export class PasswordResetService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(PasswordService) private readonly passwords: PasswordService,
    @Inject(EmailService) private readonly email: EmailService,
  ) {}

  private codeHash(code: string, userId: string) {
    return createHmac('sha256', env.jwtSecret).update(`reset:${userId}:${code}`).digest('hex');
  }

  // Her durumda aynı cevap: { sent: true, codeTtlMinutes }. Test modunda gerçekten kod üretildiyse devCode da döner.
  async request(email: string) {
    const generic = { sent: true as const, codeTtlMinutes: env.codeTtlMinutes };
    const user = await this.prisma.user.findUnique({
      where: { email },
      select: { id: true, roles: { select: { role: true } } },
    });
    if (!user || user.roles.some((r) => r.role === 'ADMIN' || r.role === 'MODERATOR')) return generic;

    const existing = await this.prisma.passwordReset.findUnique({ where: { userId: user.id } });
    const now = Date.now();
    const windowReset = !existing || now - existing.createdAt.getTime() > SEND_WINDOW_MS;
    // Bekleme süresi dolmadıysa ya da çok fazla kod istendiyse sessizce yeni kod gönderilmez
    if (existing && !windowReset) {
      if (now - existing.lastSentAt.getTime() < env.resendCooldownSec * 1000) return generic;
      if (existing.sendCount >= env.resendMaxCount) return generic;
    }

    const code = String(randomInt(0, 1_000_000)).padStart(6, '0');
    const data = {
      codeHash: this.codeHash(code, user.id),
      codeExpiresAt: new Date(now + env.codeTtlMinutes * MINUTE_MS),
      attempts: 0,
      lastSentAt: new Date(now),
    };
    await this.prisma.passwordReset.upsert({
      where: { userId: user.id },
      create: { userId: user.id, ...data },
      update: windowReset ? { ...data, sendCount: 1, createdAt: new Date(now) } : { ...data, sendCount: { increment: 1 } },
    });
    await this.email.sendPasswordResetCode(email, code, env.codeTtlMinutes);
    return { ...generic, ...(env.exposeDevCodes ? { devCode: code } : {}) };
  }

  async reset(email: string, code: string, newPassword: string) {
    const user = await this.prisma.user.findUnique({ where: { email }, select: { id: true, passwordReset: true } });
    const record = user?.passwordReset;
    if (!user || !record || record.codeExpiresAt.getTime() < Date.now()) throw GENERIC_INVALID();
    if (record.attempts >= env.codeMaxAttempts) {
      throw badRequest('CODE_LOCKED', 'Çok fazla hatalı deneme. Yeni kod iste.');
    }
    const expected = Buffer.from(record.codeHash, 'hex');
    const actual = Buffer.from(this.codeHash(code, user.id), 'hex');
    if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) {
      const attempts = record.attempts + 1;
      await this.prisma.passwordReset.update({ where: { userId: user.id }, data: { attempts } });
      if (attempts >= env.codeMaxAttempts) throw badRequest('CODE_LOCKED', 'Çok fazla hatalı deneme. Yeni kod iste.');
      throw badRequest('CODE_INVALID', `Kod hatalı. ${env.codeMaxAttempts - attempts} deneme hakkın kaldı.`);
    }

    const passwordHash = await this.passwords.hash(newPassword);
    await this.prisma.$transaction([
      this.prisma.user.update({ where: { id: user.id }, data: { passwordHash } }),
      this.prisma.passwordReset.delete({ where: { userId: user.id } }),
      // Eski şifreyle açılmış bütün oturumlar kapanır
      this.prisma.session.updateMany({ where: { userId: user.id, revokedAt: null }, data: { revokedAt: new Date() } }),
    ]);
    return { reset: true as const };
  }
}
