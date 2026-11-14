import { Inject, Injectable } from '@nestjs/common';
import { ageGroupOf } from '../../common/age.js';
import { badRequest, conflict, forbidden, unauthorized } from '../../common/app-error.js';
import { PrismaService } from '../../common/prisma/prisma.service.js';
import { env } from '../../config/env.js';
import { Prisma } from '../../generated/prisma/client.js';
import { PasswordService } from '../auth/password.service.js';
import type { UploadedFileLike } from '../files/documents.service.js';
import { MediaService } from '../media/media.service.js';
import { FollowsService } from '../social/follows.service.js';
import { isVerifiedProfessional, ProfilesService } from '../social/profiles.service.js';
import type { UpdateMeDto } from './dto/users.schemas.js';

const DAY_MS = 24 * 60 * 60 * 1000;

@Injectable()
export class UsersService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(PasswordService) private readonly passwords: PasswordService,
    @Inject(ProfilesService) private readonly profiles: ProfilesService,
    @Inject(MediaService) private readonly media: MediaService,
    @Inject(FollowsService) private readonly follows: FollowsService,
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
        gender: true,
        roles: { select: { role: true } },
        profile: { select: { bio: true, avatarId: true, isPrivate: true, displayName: true, city: true, goals: true, links: true, sports: true, dmPolicy: true, showActivity: true } },
        professionalProfile: { select: { type: true, verification: true } },
        // Son profesyonel başvurusu (varsa)
        professionalApplications: {
          orderBy: { submittedAt: 'desc' },
          take: 1,
          select: { id: true, field: true, status: true, rejectionReason: true, submittedAt: true, attemptNumber: true },
        },
        gymOwned: { select: { id: true, name: true } },
        gymStaffRoles: { where: { status: 'ACTIVE' }, take: 1, select: { role: true, gym: { select: { id: true, name: true } } } },
      },
    });
    const staff = user.gymStaffRoles[0];
    // Salondaki görevi: sahip ya da ekip (rozet: "<Salon> eğitmeni")
    const gym = user.gymOwned
      ? { id: user.gymOwned.id, name: user.gymOwned.name, role: 'OWNER' as const }
      : staff
        ? { id: staff.gym.id, name: staff.gym.name, role: staff.role }
        : null;
    const application = user.professionalApplications[0] ?? null;
    const social = await this.profiles.socialOf(user);
    return {
      id: user.id,
      email: user.email,
      username: user.username,
      firstName: user.firstName,
      lastName: user.lastName,
      birthDate: user.birthDate.toISOString().slice(0, 10),
      // TEEN ise uygulama genç modunda açılır
      ageGroup: ageGroupOf(user.birthDate),
      gender: user.gender,
      roles: user.roles.map((r) => r.role),
      // Başvuru onaylanana kadar kişi sadece standart kullanıcıdır; durum bilgisi ekranda "onay sürecinde" için kullanılır
      application: application
        ? {
            ...application,
            canResubmit: application.status === 'REJECTED' && application.attemptNumber < env.maxApplicationAttempts,
          }
        : null,
      bio: user.profile?.bio ?? null,
      // Doğrulanmış profesyonelin sosyal profili her zaman açıktır
      isPrivate: social.effectivePrivate,
      displayName: social.displayName,
      customDisplayName: social.customDisplayName,
      avatarUrl: social.avatarUrl,
      city: social.city,
      goals: social.goals,
      links: social.links,
      sports: social.sports,
      badges: social.badges,
      isProfessional: social.isProfessional,
      // Mesaj gizliliği ve çevrimiçi durumu paylaşımı
      dmPolicy: user.profile?.dmPolicy ?? 'EVERYONE',
      showActivity: user.profile?.showActivity ?? true,
      gym,
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

    if (dto.isPrivate === true) {
      const row = await this.profiles.rowById(userId);
      // Doğrulanmış profesyonelin sosyal profili herkese açıktır
      if (row && isVerifiedProfessional(row)) {
        throw forbidden('PRO_PROFILE_PUBLIC', 'Doğrulanmış profesyonel profiller herkese açıktır.');
      }
    }
    if (dto.sports) {
      const unique = [...new Set(dto.sports)];
      if ((await this.prisma.sportBranch.count({ where: { id: { in: unique } } })) !== unique.length) {
        throw badRequest('INVALID_SPORT', 'Geçersiz spor branşı.');
      }
      dto.sports = unique;
    }

    const { bio, isPrivate, displayName, city, goals, links, sports, dmPolicy, showActivity, ...account } = dto;
    // Boş metin "kaldır" demektir
    const blank = (v: string | null | undefined) => (v === undefined ? undefined : v?.trim() ? v.trim() : null);
    const profile = Object.fromEntries(
      Object.entries({ bio, isPrivate, displayName: blank(displayName), city: blank(city), goals: blank(goals), links, sports, dmPolicy, showActivity }).filter(([, v]) => v !== undefined),
    );
    try {
      await this.prisma.user.update({
        where: { id: userId },
        data: {
          ...account,
          profile: Object.keys(profile).length ? { upsert: { create: profile, update: profile } } : undefined,
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
    // Hesap açığa çevrilince bekleyen takip istekleri kabul edilmiş olur
    if (isPrivate === false) await this.follows.acceptAllPending(userId);
    return this.getMe(userId);
  }

  // Profil fotoğrafı: eskisi silinir, yenisi kaydedilir (gizli bilgiler temizlenmiş olarak)
  async setAvatar(userId: string, file: UploadedFileLike | undefined) {
    const saved = await this.media.saveImage(userId, file, 'AVATAR');
    const previous = await this.prisma.profile.findUnique({ where: { userId }, select: { avatarId: true } });
    await this.prisma.profile.upsert({ where: { userId }, create: { userId, avatarId: saved.id }, update: { avatarId: saved.id } });
    if (previous?.avatarId) await this.media.remove(userId, previous.avatarId);
    return this.getMe(userId);
  }

  async removeAvatar(userId: string) {
    const previous = await this.prisma.profile.findUnique({ where: { userId }, select: { avatarId: true } });
    if (previous?.avatarId) {
      await this.prisma.profile.update({ where: { userId }, data: { avatarId: null } });
      await this.media.remove(userId, previous.avatarId);
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
