// Akış ve Keşfet.
// - "Takip ettiklerin": takip ettiğin kişilerin ve senin gönderilerin, en yeniden eskiye.
// - "Senin için": son günlerin görebildiğin gönderileri, açık bir kuralla sıralanır (feed-rules.ts).
// - Sessize alınanlar ve engel olanlar hiçbir akışta görünmez.
// - Keşfet: kişi, gönderi, etiket, uzman ve salon araması; branş ve şehir filtresi; "Topluluklar" = öne çıkan gönderiler.
import { Inject, Injectable } from '@nestjs/common';
import { badRequest } from '../../common/app-error.js';
import { PrismaService } from '../../common/prisma/prisma.service.js';
import type { Prisma } from '../../generated/prisma/client.js';
import { badgesOf } from './badges.js';
import { rankScore, spreadAuthors } from './feed-rules.js';
import { CARD_SELECT, FollowsService } from './follows.service.js';
import { normalizeTag } from './post-text.js';
import { PostsService, visiblePost } from './posts.service.js';

const PAGE = 20;
// Sıralı akış için incelenen en fazla gönderi
const CANDIDATES = 400;
const RANKED_WINDOWS_DAYS = [7, 30];

// Sıralı akışın sayfa imleci: kaçıncı sıradan devam edileceği
const encodeOffset = (n: number) => Buffer.from(`o:${n}`).toString('base64url');
function decodeOffset(cursor?: string) {
  if (!cursor) return 0;
  const m = /^o:(\d{1,5})$/.exec(Buffer.from(cursor, 'base64url').toString());
  if (!m) throw badRequest('INVALID_CURSOR', 'Sayfa bilgisi geçersiz.');
  return Number(m[1]);
}

export type SearchType = 'all' | 'users' | 'posts' | 'tags' | 'pros' | 'gyms';

@Injectable()
export class FeedService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(PostsService) private readonly posts: PostsService,
    @Inject(FollowsService) private readonly follows: FollowsService,
  ) {}

  private notMuted(viewerId: string): Prisma.PostWhereInput {
    return { author: { mutedBy: { none: { muterId: viewerId } } } };
  }

  async following(viewerId: string, cursor?: string) {
    return this.posts.findMany(
      viewerId,
      { AND: [this.notMuted(viewerId), { OR: [{ authorId: viewerId }, { author: { followers: { some: { followerId: viewerId, status: 'ACCEPTED' } } } }] }] },
      { cursor },
    );
  }

  async forYou(viewerId: string, cursor?: string) {
    const offset = decodeOffset(cursor);
    const me = await this.prisma.profile.findUnique({ where: { userId: viewerId }, select: { sports: true } });
    const mySports = new Set(me?.sports ?? []);
    const followed = new Set((await this.prisma.follow.findMany({ where: { followerId: viewerId, status: 'ACCEPTED' }, select: { followedId: true } })).map((f) => f.followedId));

    // Yakın zamanda yeterli gönderi yoksa pencere genişletilir
    let candidates: Awaited<ReturnType<FeedService['candidates']>> = [];
    for (const days of RANKED_WINDOWS_DAYS) {
      candidates = await this.candidates(viewerId, days);
      if (candidates.length >= PAGE) break;
    }
    const now = Date.now();
    const ranked = spreadAuthors(
      candidates
        .map((c) => ({
          id: c.id,
          authorId: c.authorId,
          score: rankScore({
            likes: c._count.likes,
            comments: c._count.comments,
            ageHours: (now - c.createdAt.getTime()) / 3_600_000,
            followed: followed.has(c.authorId),
            sharedSports: (c.author.profile?.sports ?? []).filter((s) => mySports.has(s)).length,
            verifiedAuthor: badgesOf(c.author).length > 0,
            hasMedia: c._count.media > 0,
            mine: c.authorId === viewerId,
          }),
        }))
        .sort((a, b) => b.score - a.score),
    );
    const slice = ranked.slice(offset, offset + PAGE);
    return { items: await this.posts.byIds(viewerId, slice.map((s) => s.id)), nextCursor: offset + PAGE < ranked.length ? encodeOffset(offset + PAGE) : null };
  }

  private candidates(viewerId: string, days: number) {
    return this.prisma.post.findMany({
      where: { AND: [visiblePost(viewerId), this.notMuted(viewerId), { createdAt: { gte: new Date(Date.now() - days * 86_400_000) } }] },
      orderBy: { createdAt: 'desc' },
      take: CANDIDATES,
      select: {
        id: true,
        authorId: true,
        createdAt: true,
        author: { select: { roles: { select: { role: true } }, professionalProfile: { select: { type: true, verification: true } }, profile: { select: { sports: true } } } },
        _count: { select: { likes: true, media: true, comments: { where: { deletedAt: null, removedAt: null } } } },
      },
    });
  }

  // Takip önerileri: ortak spor ilgisi, ortak takip edilenler, doğrulanmış uzmanlar
  async suggestions(viewerId: string) {
    const me = await this.prisma.profile.findUnique({ where: { userId: viewerId }, select: { sports: true } });
    const mySports = me?.sports ?? [];
    const myFollowing = (await this.prisma.follow.findMany({ where: { followerId: viewerId }, select: { followedId: true } })).map((f) => f.followedId);
    const rows = await this.prisma.user.findMany({
      where: {
        id: { notIn: [viewerId, ...myFollowing] },
        ...this.discoverable(viewerId),
        OR: [
          ...(mySports.length ? [{ profile: { sports: { hasSome: mySports } } }] : []),
          ...(myFollowing.length ? [{ followers: { some: { followerId: { in: myFollowing }, status: 'ACCEPTED' as const } } }] : []),
          { professionalProfile: { verification: 'APPROVED' as const } },
        ],
      },
      take: 60,
      select: {
        ...CARD_SELECT,
        profile: { select: { displayName: true, avatarId: true, sports: true } },
        _count: { select: { followers: { where: { status: 'ACCEPTED' } } } },
        followers: { where: { followerId: { in: myFollowing.length ? myFollowing : ['-'] }, status: 'ACCEPTED' }, select: { followerId: true } },
      },
    });
    return rows
      .map((u) => {
        const shared = (u.profile?.sports ?? []).filter((s) => mySports.includes(s)).length;
        const mutual = u.followers.length;
        const pro = badgesOf(u).length > 0;
        const reason = mutual > 0 ? `${mutual} ortak takip` : shared > 0 ? 'Benzer ilgi alanları' : pro ? 'Doğrulanmış uzman' : 'Topluluktan';
        return { person: this.follows.card(u), reason, score: mutual * 3 + shared * 2 + (pro ? 1 : 0) + Math.log2(1 + u._count.followers) * 0.5 };
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, 12)
      .map(({ person, reason }) => ({ ...person, reason }));
  }

  // Aramada ve önerilerde görünebilecek kişiler
  private discoverable(viewerId: string): Prisma.UserWhereInput {
    return {
      deletionRequestedAt: null,
      roles: { none: { role: { in: ['ADMIN', 'MODERATOR'] } } },
      blocking: { none: { blockedId: viewerId } },
      blockedBy: { none: { blockerId: viewerId } },
    };
  }

  // ───── Keşfet ─────

  async search(viewerId: string, input: { q?: string; type: SearchType; sport?: string; city?: string }) {
    const q = input.q?.trim() ?? '';
    const want = (t: SearchType) => input.type === 'all' || input.type === t;
    const take = input.type === 'all' ? 5 : 30;
    const city = input.city?.trim();
    const personText = (text: string): Prisma.UserWhereInput =>
      text
        ? {
            OR: [
              { username: { contains: text.toLowerCase(), mode: 'insensitive' } },
              { firstName: { contains: text, mode: 'insensitive' } },
              { lastName: { contains: text, mode: 'insensitive' } },
              { profile: { displayName: { contains: text, mode: 'insensitive' } } },
            ],
          }
        : {};
    const filters: Prisma.UserWhereInput[] = [
      ...(input.sport ? [{ profile: { sports: { has: input.sport } } }] : []),
      ...(city ? [{ OR: [{ profile: { city: { contains: city, mode: 'insensitive' as const } } }, { professionalProfile: { city: { contains: city, mode: 'insensitive' as const } } }] }] : []),
    ];
    const hasQuery = q.length > 0 || filters.length > 0;

    const [users, pros, gyms, tags, posts] = await Promise.all([
      want('users') && hasQuery
        ? this.prisma.user.findMany({ where: { AND: [this.discoverable(viewerId), personText(q), ...filters, { id: { not: viewerId } }] }, take, orderBy: { username: 'asc' }, select: CARD_SELECT })
        : [],
      want('pros') && (hasQuery || input.type === 'pros')
        ? this.prisma.user.findMany({
            where: { AND: [this.discoverable(viewerId), personText(q), ...filters, { professionalProfile: { verification: 'APPROVED', type: { in: ['DIETITIAN', 'TRAINER'] } } }] },
            take,
            select: { ...CARD_SELECT, professionalProfile: { select: { type: true, verification: true, title: true, city: true, specialties: true } } },
          })
        : [],
      want('gyms') && (hasQuery || input.type === 'gyms')
        ? this.prisma.gym.findMany({
            where: {
              owner: { ...this.discoverable(viewerId), professionalProfile: { verification: 'APPROVED', type: 'GYM' } },
              ...(q ? { OR: [{ name: { contains: q, mode: 'insensitive' } }, { city: { contains: q, mode: 'insensitive' } }] } : {}),
              ...(city ? { city: { contains: city, mode: 'insensitive' } } : {}),
            },
            take,
            select: { id: true, name: true, city: true, owner: { select: CARD_SELECT } },
          })
        : [],
      want('tags') && q
        ? this.prisma.postHashtag.groupBy({
            by: ['tag'],
            where: { tag: { startsWith: normalizeTag(q) }, post: visiblePost(viewerId) },
            _count: { tag: true },
            orderBy: { _count: { tag: 'desc' } },
            take,
          })
        : [],
      want('posts') && q
        ? this.posts.findMany(viewerId, { OR: [{ text: { contains: q, mode: 'insensitive' } }, { hashtags: { some: { tag: normalizeTag(q) } } }] }, { take })
        : { items: [], nextCursor: null },
    ]);

    return {
      users: users.map((u) => this.follows.card(u)),
      pros: pros.map((u) => ({ ...this.follows.card(u), title: u.professionalProfile?.title ?? null, city: u.professionalProfile?.city ?? null, specialties: u.professionalProfile?.specialties ?? [] })),
      gyms: gyms.map((g) => ({ id: g.id, name: g.name, city: g.city, owner: this.follows.card(g.owner) })),
      tags: tags.map((t) => ({ tag: t.tag, posts: t._count.tag })),
      posts: posts.items,
    };
  }

  async tagPosts(viewerId: string, rawTag: string, cursor?: string) {
    const tag = normalizeTag(rawTag);
    if (!tag) throw badRequest('INVALID_TAG', 'Etiket geçersiz.');
    const [page, count] = await Promise.all([
      this.posts.findMany(viewerId, { hashtags: { some: { tag } } }, { cursor }),
      this.prisma.postHashtag.count({ where: { tag, post: visiblePost(viewerId) } }),
    ]);
    return { tag, count, ...page };
  }

  // Keşfet ana sayfası: öne çıkan gönderiler (Topluluklar) ve yükselen etiketler
  async explore(viewerId: string) {
    const since = new Date(Date.now() - 14 * 86_400_000);
    const [popular, tags] = await Promise.all([
      this.prisma.post.findMany({
        where: { AND: [visiblePost(viewerId), this.notMuted(viewerId), { createdAt: { gte: since } }, { authorId: { not: viewerId } }] },
        orderBy: [{ likes: { _count: 'desc' } }, { createdAt: 'desc' }],
        take: 30,
        select: { id: true },
      }),
      this.prisma.postHashtag.groupBy({
        by: ['tag'],
        where: { post: { ...visiblePost(viewerId), createdAt: { gte: since } } },
        _count: { tag: true },
        orderBy: { _count: { tag: 'desc' } },
        take: 12,
      }),
    ]);
    return { posts: await this.posts.byIds(viewerId, popular.map((p) => p.id)), tags: tags.map((t) => ({ tag: t.tag, posts: t._count.tag })) };
  }
}

