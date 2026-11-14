// Sosyal profil: görünen ad, fotoğraf, biyografi, spor ilgi alanları, doğrulanmış unvan rozetleri, sayılar.
// - Rozet sadece yönetici onayından geçmiş mesleki yetkiye göre verilir; kullanıcı kendine rozet atayamaz.
// - Doğrulanmış profesyonellerin sosyal profili her zaman herkese açıktır.
// - Sağlık ve danışan verisi sosyal profilde hiçbir zaman yer almaz.
import { Inject, Injectable } from '@nestjs/common';
import { notFound } from '../../common/app-error.js';
import { PrismaService } from '../../common/prisma/prisma.service.js';
import type { ProfessionalType, RoleType } from '../../generated/prisma/enums.js';
import { MediaService } from '../media/media.service.js';
import { badgesOf, displayNameOf, isVerifiedProfessional } from './badges.js';
import { FollowsService } from './follows.service.js';

export interface ProfileLink {
  label: string;
  url: string;
}

const PROFILE_SELECT = {
  id: true,
  username: true,
  firstName: true,
  lastName: true,
  deletionRequestedAt: true,
  roles: { select: { role: true } },
  profile: { select: { bio: true, avatarId: true, isPrivate: true, displayName: true, city: true, goals: true, links: true, sports: true } },
  professionalProfile: { select: { type: true, verification: true } },
} as const;

export { badgesOf, displayNameOf, isVerifiedProfessional, PROFESSIONAL_ROLES, type Badge } from './badges.js';

type ProfileRow = {
  id: string;
  username: string;
  firstName: string | null;
  lastName: string | null;
  roles: { role: RoleType }[];
  profile: { bio: string | null; avatarId: string | null; isPrivate: boolean; displayName: string | null; city: string | null; goals: string | null; links: unknown; sports: string[] } | null;
  professionalProfile: { type: ProfessionalType; verification: string } | null;
};

const linksOf = (value: unknown): ProfileLink[] =>
  Array.isArray(value) ? value.filter((l): l is ProfileLink => typeof l?.label === 'string' && typeof l?.url === 'string').slice(0, 3) : [];

@Injectable()
export class ProfilesService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(MediaService) private readonly media: MediaService,
    @Inject(FollowsService) private readonly follows: FollowsService,
  ) {}

  sports() {
    return this.prisma.sportBranch.findMany({ orderBy: { sortOrder: 'asc' }, select: { id: true, name: true } });
  }

  // İki kişiden biri diğerini engellediyse profiller birbirine görünmez
  blockedBetween(a: string, b: string) {
    return this.follows.blockedBetween(a, b);
  }

  // Kişinin kendi sosyal profil özeti (GET /users/me ve profil düzenleme için)
  async socialOf(row: ProfileRow) {
    const sports = await this.sportNames(row.profile?.sports ?? []);
    const pro = isVerifiedProfessional(row);
    return {
      displayName: displayNameOf(row),
      customDisplayName: row.profile?.displayName ?? null,
      avatarUrl: this.media.url(row.profile?.avatarId),
      city: row.profile?.city ?? null,
      goals: row.profile?.goals ?? null,
      links: linksOf(row.profile?.links),
      sports,
      badges: badgesOf(row),
      isProfessional: pro,
      // Doğrulanmış profesyonelin sosyal profili her zaman açıktır
      effectivePrivate: pro ? false : (row.profile?.isPrivate ?? true),
    };
  }

  private async sportNames(ids: string[]) {
    if (ids.length === 0) return [];
    const rows = await this.prisma.sportBranch.findMany({ where: { id: { in: ids } }, orderBy: { sortOrder: 'asc' }, select: { id: true, name: true } });
    return rows;
  }

  async counts(userId: string) {
    const [followers, following, posts] = await Promise.all([
      this.prisma.follow.count({ where: { followedId: userId, status: 'ACCEPTED' } }),
      this.prisma.follow.count({ where: { followerId: userId, status: 'ACCEPTED' } }),
      this.prisma.post.count({ where: { authorId: userId, deletedAt: null, removedAt: null } }),
    ]);
    return { followers, following, posts };
  }

  async rowByUsername(username: string) {
    return this.prisma.user.findUnique({ where: { username: username.trim().toLowerCase() }, select: PROFILE_SELECT });
  }

  async rowById(id: string) {
    return this.prisma.user.findUnique({ where: { id }, select: PROFILE_SELECT });
  }

  // Başkasının profil başlığı. Gizli hesapta da ad, fotoğraf, biyografi ve sayılar görünür; içerik ayrı kontrol edilir.
  async view(viewerId: string, username: string) {
    const row = await this.rowByUsername(username);
    if (!row || row.deletionRequestedAt || row.roles.some((r) => r.role === 'ADMIN' || r.role === 'MODERATOR')) {
      throw notFound('PROFILE_NOT_FOUND', 'Profil bulunamadı.');
    }
    if (await this.blockedBetween(viewerId, row.id)) throw notFound('PROFILE_NOT_FOUND', 'Profil bulunamadı.');
    const { effectivePrivate, customDisplayName: _own, ...social } = await this.socialOf(row);
    return {
      id: row.id,
      username: row.username,
      isMe: row.id === viewerId,
      bio: row.profile?.bio ?? null,
      isPrivate: effectivePrivate,
      ...social,
      counts: await this.counts(row.id),
      // Bakan kişiyle ilişki (kendi profilinde null) ve gönderi/hikâye/listeleri görebilir mi
      relation: await this.follows.relation(viewerId, row.id),
      canSeeContent: await this.follows.canSeeContent(viewerId, row.id, effectivePrivate),
    };
  }
}
