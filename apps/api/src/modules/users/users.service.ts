import { Inject, Injectable } from '@nestjs/common';
import { ageGroupOf } from '../../common/age.js';
import { conflict, forbidden, unauthorized } from '../../common/app-error.js';
import { PrismaService } from '../../common/prisma/prisma.service.js';
import { env } from '../../config/env.js';
import { Prisma } from '../../generated/prisma/client.js';
import { PasswordService } from '../auth/password.service.js';
import type { UpdateMeDto } from './dto/users.schemas.js';

const DAY_MS = 24 * 60 * 60 * 1000;

@Injectable()
export class UsersService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(PasswordService) private readonly passwords: PasswordService,
  ) {}

  // Giriş yapan kullanıcının kendi bilgileri. Şifre özeti asla dışarı verilmez.
  async getMe(userId: string) {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        username: true,
        firstName: true,
        lastName: true,
        birthDate: true,
        createdAt: true,
        roles: { select: { role: true } },
        profile: { select: { bio: true, isPrivate: true } },
      },
    });
    return {
      id: user.id,
      email: user.email,
      username: user.username,
      firstName: user.firstName,
      lastName: user.lastName,
      birthDate: user.birthDate.toISOString().slice(0, 10),
      // TEEN ise uygulama genç modunda açılır
      ageGroup: ageGroupOf(user.birthDate),
      roles: user.roles.map((r) => r.role),
      bio: user.profile?.bio ?? null,
      isPrivate: user.profile?.isPrivate ?? true,
      createdAt: user.createdAt,
    };
  }

  async updateMe(userId: string, dto: UpdateMeDto) {
    if (dto.isPrivate === false) {
      const user = await this.prisma.user.findUniqueOrThrow({
        where: { id: userId },
        select: { birthDate: true },
      });
      // Genç modunda profil her zaman gizlidir
      if (ageGroupOf(user.birthDate) !== 'ADULT') {
        throw forbidden('TEEN_PROFILE_PRIVATE', '18 yaşından küçüklerin profili gizli kalır.');
      }
    }

    const { bio, isPrivate, ...account } = dto;
    try {
      await this.prisma.user.update({
        where: { id: userId },
        data: {
          ...account,
          profile:
            bio !== undefined || isPrivate !== undefined
              ? { update: { bio, isPrivate } }
              : undefined,
        },
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw conflict('USERNAME_TAKEN', 'Bu kullanıcı adı alınmış.');
      }
      throw error;
    }
    return this.getMe(userId);
  }

  // Hesap silme talebi: hesap hemen kapanır, 30 gün içinde giriş yapılırsa geri gelir,
  // süre dolunca kalıcı silinir (bkz. AccountPurgeService).
  async requestDeletion(userId: string, password: string) {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { passwordHash: true },
    });
    if (!(await this.passwords.verify(password, user.passwordHash))) {
      throw unauthorized('INVALID_PASSWORD', 'Şifre hatalı.');
    }

    const now = new Date();
    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: userId },
        data: { deletionRequestedAt: now },
      }),
      this.prisma.session.updateMany({
        where: { userId, revokedAt: null },
        data: { revokedAt: now },
      }),
    ]);

    return {
      deletionScheduledFor: new Date(
        now.getTime() + env.accountDeletionGraceDays * DAY_MS,
      ),
      graceDays: env.accountDeletionGraceDays,
    };
  }
}
