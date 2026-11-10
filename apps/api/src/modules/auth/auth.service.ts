import { Inject, Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { createHash, randomBytes } from 'node:crypto';
import { ageGroupOf } from '../../common/age.js';
import { conflict, forbidden, unauthorized } from '../../common/app-error.js';
import { PrismaService } from '../../common/prisma/prisma.service.js';
import { env } from '../../config/env.js';
import { Prisma } from '../../generated/prisma/client.js';
import { ConsentsService } from '../consents/consents.service.js';
import { UsersService } from '../users/users.service.js';
import type { LoginDto, RegisterDto } from './dto/auth.schemas.js';
import { PasswordService } from './password.service.js';

const DAY_MS = 24 * 60 * 60 * 1000;

// Kullanıcı bulunamadığında da şifre kontrolü kadar zaman harcamak için kullanılan sahte özet.
// Böylece cevap süresinden "bu e-posta kayıtlı mı" anlaşılamaz.
const DUMMY_HASH =
  'scrypt$32768$8$1$AAAAAAAAAAAAAAAAAAAAAA==$AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=';

@Injectable()
export class AuthService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(JwtService) private readonly jwt: JwtService,
    @Inject(PasswordService) private readonly passwords: PasswordService,
    @Inject(UsersService) private readonly users: UsersService,
    @Inject(ConsentsService) private readonly consents: ConsentsService,
  ) {}

  async register(dto: RegisterDto) {
    const birthDate = new Date(dto.birthDate);
    const ageGroup = ageGroupOf(birthDate);
    if (ageGroup === 'CHILD') {
      throw forbidden('AGE_RESTRICTED', '13 yaşından küçükler kayıt olamaz.');
    }

    const existing = await this.prisma.user.findFirst({
      where: { OR: [{ email: dto.email }, { username: dto.username }] },
      select: { email: true },
    });
    if (existing) throw this.duplicate(existing.email === dto.email);

    const passwordHash = await this.passwords.hash(dto.password);
    // 18 yaş altı sağlık verisi rızasını kendisi veremez; veli onayı gerekir
    const consentTypes = this.consents.registrationConsents(
      ageGroup === 'ADULT' && dto.healthDataConsent,
    );

    let userId: string;
    try {
      const user = await this.prisma.user.create({
        data: {
          email: dto.email,
          username: dto.username,
          passwordHash,
          birthDate,
          firstName: dto.firstName,
          lastName: dto.lastName,
          roles: { create: { role: 'USER' } },
          profile: { create: {} },
          consents: { create: consentTypes },
        },
        select: { id: true },
      });
      userId = user.id;
    } catch (error) {
      // Aynı anda iki kayıt isteği gelirse veritabanındaki benzersizlik kuralı yakalar
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw this.duplicate(String(error.meta?.target).includes('email'));
      }
      throw error;
    }

    const tokens = await this.createSession(userId, dto.deviceName);
    return { ...tokens, user: await this.users.getMe(userId) };
  }

  async login(dto: LoginDto) {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
      select: { id: true, passwordHash: true, deletionRequestedAt: true },
    });
    const passwordOk = await this.passwords.verify(
      dto.password,
      user?.passwordHash ?? DUMMY_HASH,
    );
    if (!user || !passwordOk) {
      throw unauthorized('INVALID_CREDENTIALS', 'E-posta veya şifre hatalı.');
    }

    // Silme sürecindeki hesap: süre dolmadıysa giriş yapmak silmeyi iptal eder
    let deletionCancelled = false;
    if (user.deletionRequestedAt) {
      const deadline =
        user.deletionRequestedAt.getTime() + env.accountDeletionGraceDays * DAY_MS;
      if (Date.now() >= deadline) {
        throw unauthorized('INVALID_CREDENTIALS', 'E-posta veya şifre hatalı.');
      }
      await this.prisma.user.update({
        where: { id: user.id },
        data: { deletionRequestedAt: null },
      });
      deletionCancelled = true;
    }

    const tokens = await this.createSession(user.id, dto.deviceName);
    return { ...tokens, deletionCancelled, user: await this.users.getMe(user.id) };
  }

  // Yenileme anahtarı her kullanımda değişir (eskisi geçersiz olur).
  async refresh(refreshToken: string) {
    const session = await this.prisma.session.findUnique({
      where: { refreshTokenHash: hashToken(refreshToken) },
      include: { user: { select: { deletionRequestedAt: true } } },
    });
    if (!session) throw this.invalidRefresh();

    if (session.revokedAt) {
      // Geçersiz kılınmış bir anahtar tekrar kullanıldı: anahtar çalınmış olabilir.
      // Güvenlik için kullanıcının tüm oturumları kapatılır.
      await this.revokeAllSessions(session.userId);
      throw this.invalidRefresh();
    }
    if (session.expiresAt <= new Date() || session.user.deletionRequestedAt) {
      throw this.invalidRefresh();
    }

    await this.prisma.session.update({
      where: { id: session.id },
      data: { revokedAt: new Date() },
    });
    return this.createSession(session.userId, session.deviceName ?? undefined);
  }

  async logout(sessionId: string) {
    await this.prisma.session.updateMany({
      where: { id: sessionId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  async revokeAllSessions(userId: string) {
    await this.prisma.session.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  private async createSession(userId: string, deviceName?: string) {
    const refreshToken = randomBytes(48).toString('base64url');
    const session = await this.prisma.session.create({
      data: {
        userId,
        deviceName,
        refreshTokenHash: hashToken(refreshToken),
        expiresAt: new Date(Date.now() + env.refreshTokenTtlDays * DAY_MS),
      },
      select: { id: true },
    });
    const accessToken = await this.jwt.signAsync({ sub: userId, sid: session.id });
    return { accessToken, refreshToken, expiresIn: env.accessTokenTtlSec };
  }

  private duplicate(isEmail: boolean) {
    return isEmail
      ? conflict('EMAIL_TAKEN', 'Bu e-posta adresi zaten kayıtlı.')
      : conflict('USERNAME_TAKEN', 'Bu kullanıcı adı alınmış.');
  }

  private invalidRefresh() {
    return unauthorized('INVALID_REFRESH_TOKEN', 'Oturum süresi doldu. Lütfen tekrar giriş yapın.');
  }
}

// Yenileme anahtarının kendisi saklanmaz, sadece özeti saklanır
function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}
