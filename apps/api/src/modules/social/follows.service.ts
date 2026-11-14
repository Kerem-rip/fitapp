// Takip, takip istekleri, engelleme ve sessize alma.
// - Açık hesaba takip hemen kabul edilir; gizli hesaba istek gider, hesap sahibi kabul eder ya da reddeder.
// - Engellenen kişi profili göremez, takip edemez; engellenince iki yöndeki takipler silinir.
// - Sessize alma takibi bozmaz; kişinin paylaşımları akışta görünmez ve karşı taraf bunu bilmez.
// - İçerik görme kuralı (gönderi, hikâye, takip listeleri): kendisi, açık hesap ya da kabul edilmiş takipçi.
import { Inject, Injectable } from '@nestjs/common';
import { badRequest, notFound } from '../../common/app-error.js';
import { PrismaService } from '../../common/prisma/prisma.service.js';
import type { ProfessionalType, RoleType } from '../../generated/prisma/enums.js';
import { MediaService } from '../media/media.service.js';
import { NotifyService } from '../notifications/notify.service.js';
import { badgesOf, displayNameOf, isVerifiedProfessional } from './badges.js';
import { decodeCursor, encodeCursor } from './cursor.js';

const PAGE = 30;

export const CARD_SELECT = {
  id: true,
  username: true,
  firstName: true,
  lastName: true,
  roles: { select: { role: true } },
  profile: { select: { displayName: true, avatarId: true } },
  professionalProfile: { select: { type: true, verification: true } },
} as const;

type CardRow = {
  id: string;
  username: string;
  firstName: string | null;
  lastName: string | null;
  roles: { role: RoleType }[];
  profile: { displayName: string | null; avatarId: string | null } | null;
  professionalProfile: { type: ProfessionalType; verification: string } | null;
};

export type FollowState = 'NONE' | 'PENDING' | 'ACCEPTED';

@Injectable()
export class FollowsService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(MediaService) private readonly media: MediaService,
    @Inject(NotifyService) private readonly notify: NotifyService,
  ) {}

  card(row: CardRow) {
    return { id: row.id, username: row.username, displayName: displayNameOf(row), avatarUrl: this.media.url(row.profile?.avatarId), badges: badgesOf(row) };
  }

  // Takip edilebilecek / içeriği listelenebilecek kişi: silinmemiş, yönetici veya moderatör olmayan, aramızda engel olmayan
  async target(viewerId: string, userId: string) {
    const row = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { ...CARD_SELECT, deletionRequestedAt: true, profile: { select: { displayName: true, avatarId: true, isPrivate: true } } },
    });
    if (!row || row.deletionRequestedAt || row.roles.some((r) => r.role === 'ADMIN' || r.role === 'MODERATOR')) throw notFound('USER_NOT_FOUND', 'Kişi bulunamadı.');
    if (await this.blockedBetween(viewerId, userId)) throw notFound('USER_NOT_FOUND', 'Kişi bulunamadı.');
    return { ...row, isPrivate: isVerifiedProfessional(row) ? false : (row.profile?.isPrivate ?? true) };
  }

  async blockedBetween(a: string, b: string) {
    if (a === b) return false;
    return (await this.prisma.block.count({ where: { OR: [{ blockerId: a, blockedId: b }, { blockerId: b, blockedId: a }] } })) > 0;
  }

  // Kişinin içeriğini (gönderi, hikâye, takip listesi) görebilir mi
  async canSeeContent(viewerId: string, ownerId: string, ownerPrivate: boolean) {
    if (viewerId === ownerId) return true;
    if (await this.blockedBetween(viewerId, ownerId)) return false;
    if (!ownerPrivate) return true;
    return (await this.prisma.follow.count({ where: { followerId: viewerId, followedId: ownerId, status: 'ACCEPTED' } })) > 0;
  }

  // Profil sayfasındaki ilişki bilgisi
  async relation(viewerId: string, userId: string) {
    if (viewerId === userId) return null;
    const [out, inc, muted] = await Promise.all([
      this.prisma.follow.findUnique({ where: { followerId_followedId: { followerId: viewerId, followedId: userId } }, select: { status: true } }),
      this.prisma.follow.findUnique({ where: { followerId_followedId: { followerId: userId, followedId: viewerId } }, select: { status: true } }),
      this.prisma.mute.count({ where: { muterId: viewerId, mutedId: userId } }),
    ]);
    return {
      following: (out?.status ?? 'NONE') as FollowState,
      followsMe: inc?.status === 'ACCEPTED',
      requestedMe: inc?.status === 'PENDING',
      muted: muted > 0,
    };
  }

  // ───── Takip ─────

  async follow(me: string, userId: string) {
    if (me === userId) throw badRequest('SELF_FOLLOW', 'Kendini takip edemezsin.');
    const t = await this.target(me, userId);
    const existing = await this.prisma.follow.findUnique({ where: { followerId_followedId: { followerId: me, followedId: userId } } });
    if (existing) return { following: existing.status as FollowState };
    const status = t.isPrivate ? 'PENDING' : 'ACCEPTED';
    await this.prisma.follow.create({ data: { followerId: me, followedId: userId, status } });
    await this.notify.social(userId, status === 'PENDING' ? 'social_follow_request' : 'social_follow', me);
    return { following: status as FollowState };
  }

  // Takibi bırakır ya da bekleyen isteği geri çeker
  async unfollow(me: string, userId: string) {
    await this.prisma.follow.deleteMany({ where: { followerId: me, followedId: userId } });
    await this.notify.retract(userId, ['social_follow', 'social_follow_request'], me);
    return { following: 'NONE' as FollowState };
  }

  // Takipçiyi çıkarır (karşı taraf beni takip etmeyi bırakmış olur)
  async removeFollower(me: string, userId: string) {
    const r = await this.prisma.follow.deleteMany({ where: { followerId: userId, followedId: me } });
    if (r.count === 0) throw notFound('FOLLOWER_NOT_FOUND', 'Bu kişi seni takip etmiyor.');
    return { removed: true };
  }

  async requests(me: string, cursor?: string) {
    const c = decodeCursor(cursor);
    const rows = await this.prisma.follow.findMany({
      where: {
        followedId: me,
        status: 'PENDING',
        ...(c ? { OR: [{ createdAt: { lt: c.at } }, { createdAt: c.at, followerId: { lt: c.id } }] } : {}),
      },
      orderBy: [{ createdAt: 'desc' }, { followerId: 'desc' }],
      take: PAGE + 1,
      select: { createdAt: true, followerId: true, follower: { select: CARD_SELECT } },
    });
    const page = rows.slice(0, PAGE);
    const last = page.at(-1);
    return {
      items: page.map((r) => ({ ...this.card(r.follower), requestedAt: r.createdAt.toISOString() })),
      nextCursor: rows.length > PAGE && last ? encodeCursor(last.createdAt, last.followerId) : null,
    };
  }

  async requestCount(me: string) {
    return { count: await this.prisma.follow.count({ where: { followedId: me, status: 'PENDING' } }) };
  }

  async accept(me: string, userId: string) {
    const r = await this.prisma.follow.updateMany({ where: { followerId: userId, followedId: me, status: 'PENDING' }, data: { status: 'ACCEPTED' } });
    if (r.count === 0) throw notFound('REQUEST_NOT_FOUND', 'Takip isteği bulunamadı.');
    await this.notify.social(userId, 'social_follow_accepted', me);
    return { accepted: true };
  }

  async decline(me: string, userId: string) {
    const r = await this.prisma.follow.deleteMany({ where: { followerId: userId, followedId: me, status: 'PENDING' } });
    if (r.count === 0) throw notFound('REQUEST_NOT_FOUND', 'Takip isteği bulunamadı.');
    return { declined: true };
  }

  // Hesap açığa çevrilince bekleyen istekler kabul edilir
  async acceptAllPending(me: string) {
    await this.prisma.follow.updateMany({ where: { followedId: me, status: 'PENDING' }, data: { status: 'ACCEPTED' } });
  }

  // ───── Takipçi / takip edilen listeleri ─────

  async list(viewerId: string, userId: string, kind: 'followers' | 'following', cursor?: string) {
    const t = await this.target(viewerId, userId);
    if (!(await this.canSeeContent(viewerId, userId, t.isPrivate))) throw notFound('LIST_HIDDEN', 'Bu hesap gizli. Listeyi görmek için takip etmelisin.');
    const c = decodeCursor(cursor);
    const other = kind === 'followers' ? 'followerId' : 'followedId';
    const rows = await this.prisma.follow.findMany({
      where: {
        ...(kind === 'followers' ? { followedId: userId } : { followerId: userId }),
        status: 'ACCEPTED',
        // Silinen hesaplar ve beni engelleyen/engellediğim kişiler listede görünmez
        [kind === 'followers' ? 'follower' : 'followed']: {
          deletionRequestedAt: null,
          blocking: { none: { blockedId: viewerId } },
          blockedBy: { none: { blockerId: viewerId } },
        },
        ...(c ? { OR: [{ createdAt: { lt: c.at } }, { createdAt: c.at, [other]: { lt: c.id } }] } : {}),
      },
      orderBy: [{ createdAt: 'desc' }, { [other]: 'desc' }],
      take: PAGE + 1,
      select: { createdAt: true, followerId: true, followedId: true, follower: { select: CARD_SELECT }, followed: { select: CARD_SELECT } },
    });
    const page = rows.slice(0, PAGE);
    const people = page.map((r) => (kind === 'followers' ? r.follower : r.followed));
    // Bakan kişinin listedekilerle ilişkisi (Takip et / İstek gönderildi / Takiptesin)
    const mine = await this.prisma.follow.findMany({ where: { followerId: viewerId, followedId: { in: people.map((p) => p.id) } }, select: { followedId: true, status: true } });
    const last = page.at(-1);
    return {
      items: people.map((p) => ({ ...this.card(p), isMe: p.id === viewerId, following: (mine.find((m) => m.followedId === p.id)?.status ?? 'NONE') as FollowState })),
      nextCursor: rows.length > PAGE && last ? encodeCursor(last.createdAt, kind === 'followers' ? last.followerId : last.followedId) : null,
    };
  }

  // ───── Engelleme ve sessize alma ─────

  async block(me: string, userId: string) {
    if (me === userId) throw badRequest('SELF_BLOCK', 'Kendini engelleyemezsin.');
    const exists = await this.prisma.user.count({ where: { id: userId } });
    if (!exists) throw notFound('USER_NOT_FOUND', 'Kişi bulunamadı.');
    await this.prisma.$transaction([
      this.prisma.follow.deleteMany({ where: { OR: [{ followerId: me, followedId: userId }, { followerId: userId, followedId: me }] } }),
      this.prisma.mute.deleteMany({ where: { muterId: me, mutedId: userId } }),
      this.prisma.closeFriend.deleteMany({ where: { OR: [{ ownerId: me, friendId: userId }, { ownerId: userId, friendId: me }] } }),
      this.prisma.block.upsert({ where: { blockerId_blockedId: { blockerId: me, blockedId: userId } }, create: { blockerId: me, blockedId: userId }, update: {} }),
    ]);
    return { blocked: true };
  }

  async unblock(me: string, userId: string) {
    await this.prisma.block.deleteMany({ where: { blockerId: me, blockedId: userId } });
    return { blocked: false };
  }

  async blocks(me: string) {
    const rows = await this.prisma.block.findMany({ where: { blockerId: me }, orderBy: { createdAt: 'desc' }, select: { blocked: { select: CARD_SELECT } } });
    return rows.map((r) => this.card(r.blocked));
  }

  async mute(me: string, userId: string) {
    if (me === userId) throw badRequest('SELF_MUTE', 'Kendini sessize alamazsın.');
    await this.target(me, userId);
    await this.prisma.mute.upsert({ where: { muterId_mutedId: { muterId: me, mutedId: userId } }, create: { muterId: me, mutedId: userId }, update: {} });
    return { muted: true };
  }

  async unmute(me: string, userId: string) {
    await this.prisma.mute.deleteMany({ where: { muterId: me, mutedId: userId } });
    return { muted: false };
  }

  async mutes(me: string) {
    const rows = await this.prisma.mute.findMany({ where: { muterId: me }, orderBy: { createdAt: 'desc' }, select: { muted: { select: CARD_SELECT } } });
    return rows.map((r) => this.card(r.muted));
  }
}
