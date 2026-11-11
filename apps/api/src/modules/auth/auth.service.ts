import { Inject, Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { createHash, randomBytes } from 'node:crypto';
import { unauthorized } from '../../common/app-error.js';
import { DUMMY_HASH } from '../../common/password.js';
import { PrismaService } from '../../common/prisma/prisma.service.js';
import { env } from '../../config/env.js';
import { UsersService } from '../users/users.service.js';
import type { LoginDto } from './dto/auth.schemas.js';
import { PasswordService } from './password.service.js';

const DAY_MS = 24 * 60 * 60 * 1000;

// Yönetici ve moderatör hesapları normal girişten giremez; ayrı (gizli) yönetici girişi kullanır
export type LoginScope = 'user' | 'admin';

@Injectable()
export class AuthService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(JwtService) private readonly jwt: JwtService,
    @Inject(PasswordService) private readonly passwords: PasswordService,
    @Inject(UsersService) private readonly users: UsersService,
  ) {}

  async login(dto: LoginDto, scope: LoginScope = 'user') {
    const user = await this.prisma.user.findFirst({
      where: { OR: [{ email: dto.identifier }, { username: dto.identifier }] },
      select: {
        id: true,
        passwordHash: true,
        deletionRequestedAt: true,
        roles: { select: { role: true } },
      },
    });
    const passwordOk = await this.passwords.verify(dto.password, user?.passwordHash ?? DUMMY_HASH);
    const isStaffAccount = user?.roles.some((r) => r.role === 'ADMIN' || r.role === 'MODERATOR') ?? false;
    // Yanlış kapıdan gelen (ör. yönetici normal girişten) de aynı genel hatayı alır
    if (!user || !passwordOk || (scope === 'user' ? isStaffAccount : !isStaffAccount)) {
      throw unauthorized('INVALID_CREDENTIALS', 'E-posta/kullanıcı adı veya şifre hatalı.');
    }

    // Silme sürecindeki hesap: süre dolmadıysa giriş yapmak silmeyi iptal eder
    let deletionCancelled = false;
    if (user.deletionRequestedAt) {
      const deadline = user.deletionRequestedAt.getTime() + env.accountDeletionGraceDays * DAY_MS;
      if (Date.now() >= deadline) {
        throw unauthorized('INVALID_CREDENTIALS', 'E-posta/kullanıcı adı veya şifre hatalı.');
      }
      await this.prisma.user.update({ where: { id: user.id }, data: { deletionRequestedAt: null } });
      deletionCancelled = true;
    }

    const tokens = await this.issueSession(user.id, dto.deviceName);
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
    return this.issueSession(session.userId, session.deviceName ?? undefined);
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

  // Yeni oturum açar (giriş ve kayıt tamamlanınca kullanılır)
  async issueSession(userId: string, deviceName?: string) {
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

  private invalidRefresh() {
    return unauthorized('INVALID_REFRESH_TOKEN', 'Oturum süresi doldu. Lütfen tekrar giriş yapın.');
  }
}

// Yenileme anahtarının kendisi saklanmaz, sadece özeti saklanır
function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}
