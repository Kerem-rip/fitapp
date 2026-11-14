// Gönderiler: metin + en fazla 5 fotoğraf, beğeni, yorum/yanıt, kaydetme, alıntı, sabitleme, etiket ve bahsetme.
// - Gönderiyi görebilen: yazarın kendisi; açık hesap ya da doğrulanmış profesyonelse herkes; gizliyse kabul edilmiş takipçiler.
// - Engel varsa iki taraf da birbirinin gönderisini, yorumunu göremez.
// - Silinen gönderinin fotoğrafları depodan da silinir.
import { Inject, Injectable } from '@nestjs/common';
import { badRequest, conflict, forbidden, notFound } from '../../common/app-error.js';
import { PrismaService } from '../../common/prisma/prisma.service.js';
import type { Prisma } from '../../generated/prisma/client.js';
import type { UploadedFileLike } from '../files/documents.service.js';
import { MediaService } from '../media/media.service.js';
import { NotifyService } from '../notifications/notify.service.js';
import { decodeCursor, encodeCursor } from './cursor.js';
import { CARD_SELECT, FollowsService } from './follows.service.js';
import { hashtagsOf, MAX_COMMENT_TEXT, MAX_POST_TEXT, mentionsOf } from './post-text.js';

const PAGE = 20;
export const MAX_POST_MEDIA = 5;
const MAX_PINNED = 3;

// Bakan kişinin görebileceği yazarlar (gönderi, yorum ve akış sorgularında ortak)
export function visibleAuthor(viewerId: string): Prisma.UserWhereInput {
  return {
    deletionRequestedAt: null,
    blocking: { none: { blockedId: viewerId } },
    blockedBy: { none: { blockerId: viewerId } },
    OR: [
      { id: viewerId },
      { profile: { isPrivate: false } },
      { professionalProfile: { verification: 'APPROVED' } },
      { followers: { some: { followerId: viewerId, status: 'ACCEPTED' } } },
    ],
  };
}

export const visiblePost = (viewerId: string): Prisma.PostWhereInput => ({ deletedAt: null, removedAt: null, author: visibleAuthor(viewerId) });

const postInclude = (viewerId: string) =>
  ({
    author: { select: CARD_SELECT },
    media: { orderBy: { sortOrder: 'asc' }, select: { fileId: true, kind: true, durationMs: true } },
    likes: { where: { userId: viewerId }, select: { userId: true }, take: 1 },
    saves: { where: { userId: viewerId }, select: { userId: true }, take: 1 },
    mentions: { select: { user: { select: { username: true } } } },
    quoted: { select: { id: true, text: true, createdAt: true, author: { select: CARD_SELECT }, media: { orderBy: { sortOrder: 'asc' }, take: 1, select: { fileId: true, kind: true } } } },
    _count: { select: { likes: true, comments: { where: { deletedAt: null, removedAt: null, OR: [{ parentId: null }, { parent: { deletedAt: null, removedAt: null } }] } } } },
  }) satisfies Prisma.PostInclude;

type PostRow = Prisma.PostGetPayload<{ include: ReturnType<typeof postInclude> }>;

const clean = (text: string | null | undefined) => (text?.trim() ? text.trim() : null);

@Injectable()
export class PostsService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(MediaService) private readonly media: MediaService,
    @Inject(FollowsService) private readonly follows: FollowsService,
    @Inject(NotifyService) private readonly notify: NotifyService,
  ) {}

  // Birden çok gönderiyi bakan kişiye göre biçimlendirir (alıntılananı görmeye yetkisi yoksa gizlenir)
  async present(viewerId: string, rows: PostRow[]) {
    const quotedIds = [...new Set(rows.map((r) => r.quoted?.id).filter((x): x is string => Boolean(x)))];
    const visibleQuoted = new Set(
      quotedIds.length ? (await this.prisma.post.findMany({ where: { id: { in: quotedIds }, ...visiblePost(viewerId) }, select: { id: true } })).map((q) => q.id) : [],
    );
    return rows.map((r) => ({
      id: r.id,
      author: this.follows.card(r.author),
      text: r.text,
      media: r.media.map((m) => ({ id: m.fileId, kind: m.kind, url: this.media.url(m.fileId), durationMs: m.durationMs })),
      createdAt: r.createdAt.toISOString(),
      editedAt: r.editedAt?.toISOString() ?? null,
      pinned: r.pinnedAt !== null,
      isMine: r.authorId === viewerId,
      liked: r.likes.length > 0,
      saved: r.saves.length > 0,
      counts: { likes: r._count.likes, comments: r._count.comments },
      mentions: r.mentions.map((m) => m.user.username),
      // Alıntı: silinmiş ya da görülemiyorsa sadece "görüntülenemiyor" bilgisi
      quoted: r.quotedPostId
        ? r.quoted && visibleQuoted.has(r.quoted.id)
          ? {
              id: r.quoted.id,
              available: true as const,
              author: this.follows.card(r.quoted.author),
              text: r.quoted.text,
              createdAt: r.quoted.createdAt.toISOString(),
              media: r.quoted.media.map((m) => ({ id: m.fileId, kind: m.kind, url: this.media.url(m.fileId) })),
            }
          : { id: r.quotedPostId, available: false as const }
        : null,
    }));
  }

  async findMany(viewerId: string, where: Prisma.PostWhereInput, options: { cursor?: string; take?: number; orderBy?: Prisma.PostOrderByWithRelationInput[] } = {}) {
    const take = options.take ?? PAGE;
    const c = decodeCursor(options.cursor);
    const rows = await this.prisma.post.findMany({
      where: { AND: [where, visiblePost(viewerId), c ? { OR: [{ createdAt: { lt: c.at } }, { createdAt: c.at, id: { lt: c.id } }] } : {}] },
      orderBy: options.orderBy ?? [{ createdAt: 'desc' }, { id: 'desc' }],
      take: take + 1,
      include: postInclude(viewerId),
    });
    const page = rows.slice(0, take);
    const last = page.at(-1);
    return { items: await this.present(viewerId, page), nextCursor: rows.length > take && last ? encodeCursor(last.createdAt, last.id) : null };
  }

  // Verilen sırayla gönderiler (sıralı akış ve keşfet için); görülemeyenler atlanır
  async byIds(viewerId: string, ids: string[]) {
    if (ids.length === 0) return [];
    const rows = await this.prisma.post.findMany({ where: { id: { in: ids }, ...visiblePost(viewerId) }, include: postInclude(viewerId) });
    const byId = new Map(rows.map((r) => [r.id, r]));
    return this.present(viewerId, ids.flatMap((id) => { const r = byId.get(id); return r ? [r] : []; }));
  }

  private async visibleRow(viewerId: string, id: string) {
    const row = await this.prisma.post.findFirst({ where: { id, ...visiblePost(viewerId) }, include: postInclude(viewerId) });
    if (!row) throw notFound('POST_NOT_FOUND', 'Gönderi bulunamadı.');
    return row;
  }

  async get(viewerId: string, id: string) {
    return (await this.present(viewerId, [await this.visibleRow(viewerId, id)]))[0]!;
  }

  // ───── Oluşturma, düzenleme, silme ─────

  // Fotoğraf (JPG/PNG) ya da video (MP4/MOV, en fazla 30 sn) yükler; dönen kimlik gönderide kullanılır
  async uploadMedia(userId: string, file: UploadedFileLike | undefined) {
    const saved = await this.media.saveMedia(userId, file, 'POST');
    return { id: saved.id, url: this.media.url(saved.id), kind: saved.kind, durationMs: saved.durationMs };
  }

  // Bahsedilen kullanıcı adlarından var olan, silinmemiş ve aramızda engel olmayanlar
  private async mentionIds(authorId: string, text: string | null) {
    const names = mentionsOf(text);
    if (!names.length) return [];
    const users = await this.prisma.user.findMany({
      where: { username: { in: names }, deletionRequestedAt: null, blocking: { none: { blockedId: authorId } }, blockedBy: { none: { blockerId: authorId } } },
      select: { id: true },
    });
    return users.map((u) => u.id).filter((id) => id !== authorId);
  }

  async create(userId: string, input: { text?: string | null; mediaIds?: string[]; quotedPostId?: string | null }) {
    const text = clean(input.text);
    const mediaIds = [...new Set(input.mediaIds ?? [])];
    // Videoların süresi (gönderide gösterilir)
    const videos = new Map<string, number | null>();
    if (!text && mediaIds.length === 0) throw badRequest('EMPTY_POST', 'Bir metin yaz ya da fotoğraf/video ekle.');
    if (text && text.length > MAX_POST_TEXT) throw badRequest('TEXT_TOO_LONG', `Metin en fazla ${MAX_POST_TEXT} karakter olabilir.`);
    if (mediaIds.length > MAX_POST_MEDIA) throw badRequest('TOO_MANY_MEDIA', `Bir gönderiye en fazla ${MAX_POST_MEDIA} fotoğraf ya da video eklenebilir.`);
    if (mediaIds.length) {
      // Sadece kişinin kendi yüklediği, başka gönderide kullanılmamış gönderi dosyaları
      const files = await this.prisma.file.findMany({ where: { id: { in: mediaIds }, ownerId: userId, purpose: 'POST', postMedia: { none: {} } }, select: { id: true, mimeType: true } });
      if (files.length !== mediaIds.length) throw badRequest('INVALID_MEDIA', 'Fotoğraf ya da videolardan biri bulunamadı. Tekrar yükle.');
      for (const f of files) {
        if (f.mimeType.startsWith('video/')) videos.set(f.id, await this.media.videoDuration(f.id));
      }
    }
    if (input.quotedPostId) await this.visibleRow(userId, input.quotedPostId);
    const mentions = await this.mentionIds(userId, text);
    const post = await this.prisma.post.create({
      data: {
        authorId: userId,
        text,
        quotedPostId: input.quotedPostId ?? null,
        media: { create: mediaIds.map((fileId, i) => (videos.has(fileId) ? { fileId, sortOrder: i, kind: 'VIDEO' as const, durationMs: videos.get(fileId) ?? null } : { fileId, sortOrder: i, kind: 'IMAGE' as const })) },
        hashtags: { create: hashtagsOf(text).map((tag) => ({ tag })) },
        mentions: { create: mentions.map((id) => ({ userId: id })) },
      },
      select: { id: true },
    });
    for (const id of mentions) await this.notify.social(id, 'social_mention', userId, { postId: post.id });
    return this.get(userId, post.id);
  }

  private async own(userId: string, id: string) {
    const post = await this.prisma.post.findFirst({ where: { id, deletedAt: null }, select: { id: true, authorId: true, removedAt: true, pinnedAt: true, media: { select: { fileId: true } } } });
    if (!post || post.removedAt) throw notFound('POST_NOT_FOUND', 'Gönderi bulunamadı.');
    if (post.authorId !== userId) throw forbidden('NOT_YOUR_POST', 'Bu gönderi senin değil.');
    return post;
  }

  // Açıklamayı düzenler (etiketler ve bahsetmeler yeniden hesaplanır)
  async edit(userId: string, id: string, rawText: string | null) {
    const post = await this.own(userId, id);
    const text = clean(rawText);
    if (!text && post.media.length === 0) throw badRequest('EMPTY_POST', 'Fotoğrafsız gönderinin metni boş olamaz.');
    if (text && text.length > MAX_POST_TEXT) throw badRequest('TEXT_TOO_LONG', `Metin en fazla ${MAX_POST_TEXT} karakter olabilir.`);
    const mentions = await this.mentionIds(userId, text);
    await this.prisma.$transaction([
      this.prisma.postHashtag.deleteMany({ where: { postId: id } }),
      this.prisma.postMention.deleteMany({ where: { postId: id } }),
      this.prisma.post.update({
        where: { id },
        data: {
          text,
          editedAt: new Date(),
          hashtags: { create: hashtagsOf(text).map((tag) => ({ tag })) },
          mentions: { create: mentions.map((u) => ({ userId: u })) },
        },
      }),
    ]);
    return this.get(userId, id);
  }

  async remove(userId: string, id: string) {
    const post = await this.own(userId, id);
    await this.prisma.post.update({ where: { id }, data: { deletedAt: new Date(), pinnedAt: null } });
    for (const m of post.media) await this.media.remove(userId, m.fileId);
    return { id, deleted: true };
  }

  async pin(userId: string, id: string, pinned: boolean) {
    const post = await this.own(userId, id);
    if (pinned && !post.pinnedAt) {
      const count = await this.prisma.post.count({ where: { authorId: userId, deletedAt: null, pinnedAt: { not: null } } });
      if (count >= MAX_PINNED) throw conflict('TOO_MANY_PINNED', `En fazla ${MAX_PINNED} gönderi sabitlenebilir.`);
    }
    await this.prisma.post.update({ where: { id }, data: { pinnedAt: pinned ? (post.pinnedAt ?? new Date()) : null } });
    return { id, pinned };
  }

  // ───── Beğeni ve kaydetme ─────

  async like(userId: string, id: string, liked: boolean) {
    const row = await this.visibleRow(userId, id);
    if (liked) {
      await this.prisma.postLike.upsert({ where: { postId_userId: { postId: id, userId } }, create: { postId: id, userId }, update: {} });
      await this.notify.social(row.authorId, 'social_like', userId, { postId: id });
    }
    else await this.prisma.postLike.deleteMany({ where: { postId: id, userId } });
    return { liked, likes: await this.prisma.postLike.count({ where: { postId: id } }) };
  }

  async save(userId: string, id: string, saved: boolean) {
    if (saved) {
      await this.visibleRow(userId, id);
      await this.prisma.postSave.upsert({ where: { postId_userId: { postId: id, userId } }, create: { postId: id, userId }, update: {} });
    } else {
      await this.prisma.postSave.deleteMany({ where: { postId: id, userId } });
    }
    return { saved };
  }

  async likers(viewerId: string, id: string, cursor?: string) {
    await this.visibleRow(viewerId, id);
    const c = decodeCursor(cursor);
    const rows = await this.prisma.postLike.findMany({
      where: {
        postId: id,
        user: { deletionRequestedAt: null, blocking: { none: { blockedId: viewerId } }, blockedBy: { none: { blockerId: viewerId } } },
        ...(c ? { OR: [{ createdAt: { lt: c.at } }, { createdAt: c.at, userId: { lt: c.id } }] } : {}),
      },
      orderBy: [{ createdAt: 'desc' }, { userId: 'desc' }],
      take: 31,
      select: { createdAt: true, userId: true, user: { select: CARD_SELECT } },
    });
    const page = rows.slice(0, 30);
    const last = page.at(-1);
    return { items: page.map((r) => this.follows.card(r.user)), nextCursor: rows.length > 30 && last ? encodeCursor(last.createdAt, last.userId) : null };
  }

  // Kaydedilenler (sadece kişinin kendisi görür; artık göremediği gönderiler listelenmez)
  async saved(userId: string, cursor?: string) {
    const c = decodeCursor(cursor);
    const rows = await this.prisma.postSave.findMany({
      where: { userId, post: visiblePost(userId), ...(c ? { OR: [{ createdAt: { lt: c.at } }, { createdAt: c.at, postId: { lt: c.id } }] } : {}) },
      orderBy: [{ createdAt: 'desc' }, { postId: 'desc' }],
      take: PAGE + 1,
      select: { createdAt: true, postId: true, post: { include: postInclude(userId) } },
    });
    const page = rows.slice(0, PAGE);
    const last = page.at(-1);
    return { items: await this.present(userId, page.map((r) => r.post)), nextCursor: rows.length > PAGE && last ? encodeCursor(last.createdAt, last.postId) : null };
  }

  // Profildeki gönderiler: ilk sayfada sabitlenenler ayrıca en üstte
  async byUser(viewerId: string, userId: string, cursor?: string) {
    const t = await this.follows.target(viewerId, userId);
    if (!(await this.follows.canSeeContent(viewerId, userId, t.isPrivate))) throw notFound('POSTS_HIDDEN', 'Bu hesap gizli. Gönderileri görmek için takip etmelisin.');
    const page = await this.findMany(viewerId, { authorId: userId, pinnedAt: null }, { cursor });
    const pinned = cursor ? [] : (await this.findMany(viewerId, { authorId: userId, pinnedAt: { not: null } }, { take: MAX_PINNED, orderBy: [{ pinnedAt: 'desc' }] })).items;
    return { pinned, ...page };
  }

  // ───── Yorumlar ─────

  private commentWhere(viewerId: string): Prisma.PostCommentWhereInput {
    return {
      deletedAt: null,
      removedAt: null,
      author: { deletionRequestedAt: null, blocking: { none: { blockedId: viewerId } }, blockedBy: { none: { blockerId: viewerId } } },
      // Silinen yorumun yanıtları da görünmez
      OR: [{ parentId: null }, { parent: { deletedAt: null, removedAt: null } }],
    };
  }

  private presentComment(viewerId: string, postAuthorId: string, c: { id: string; text: string; createdAt: Date; parentId: string | null; authorId: string; author: Parameters<FollowsService['card']>[0]; _count?: { replies: number } }) {
    return {
      id: c.id,
      parentId: c.parentId,
      text: c.text,
      createdAt: c.createdAt.toISOString(),
      author: this.follows.card(c.author),
      isMine: c.authorId === viewerId,
      // Yorumu yazan ya da gönderinin sahibi silebilir
      canDelete: c.authorId === viewerId || postAuthorId === viewerId,
      replyCount: c._count?.replies ?? 0,
    };
  }

  async comments(viewerId: string, postId: string, parentId: string | null, cursor?: string) {
    const post = await this.visibleRow(viewerId, postId);
    const c = decodeCursor(cursor);
    const rows = await this.prisma.postComment.findMany({
      where: { postId, parentId, ...this.commentWhere(viewerId), ...(c ? { OR: [{ createdAt: { gt: c.at } }, { createdAt: c.at, id: { gt: c.id } }] } : {}) },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      take: 31,
      include: { author: { select: CARD_SELECT }, _count: { select: { replies: { where: this.commentWhere(viewerId) } } } },
    });
    const page = rows.slice(0, 30);
    const last = page.at(-1);
    return { items: page.map((r) => this.presentComment(viewerId, post.authorId, r)), nextCursor: rows.length > 30 && last ? encodeCursor(last.createdAt, last.id) : null };
  }

  async comment(userId: string, postId: string, rawText: string, parentId?: string | null) {
    const post = await this.visibleRow(userId, postId);
    const text = rawText.trim();
    if (!text) throw badRequest('EMPTY_COMMENT', 'Yorum boş olamaz.');
    if (text.length > MAX_COMMENT_TEXT) throw badRequest('TEXT_TOO_LONG', `Yorum en fazla ${MAX_COMMENT_TEXT} karakter olabilir.`);
    let parent: string | null = null;
    let parentAuthor: string | null = null;
    if (parentId) {
      const p = await this.prisma.postComment.findFirst({ where: { id: parentId, postId, ...this.commentWhere(userId) }, select: { id: true, parentId: true, authorId: true } });
      if (!p) throw notFound('COMMENT_NOT_FOUND', 'Yanıtlanan yorum bulunamadı.');
      parentAuthor = p.authorId;
      // Yanıtın yanıtı, aynı ana yorumun altına eklenir (tek seviye)
      parent = p.parentId ?? p.id;
    }
    const created = await this.prisma.postComment.create({ data: { postId, authorId: userId, parentId: parent, text }, include: { author: { select: CARD_SELECT } } });
    // Yanıtsa yorumun sahibine, ayrıca gönderinin sahibine (aynı kişi değilse) bildirim
    if (parentAuthor) await this.notify.social(parentAuthor, 'social_reply', userId, { postId, commentId: created.id });
    if (post.authorId !== parentAuthor) await this.notify.social(post.authorId, 'social_comment', userId, { postId, commentId: created.id });
    return this.presentComment(userId, post.authorId, created);
  }

  async removeComment(userId: string, commentId: string) {
    const c = await this.prisma.postComment.findFirst({ where: { id: commentId, deletedAt: null }, select: { id: true, authorId: true, post: { select: { authorId: true } } } });
    if (!c) throw notFound('COMMENT_NOT_FOUND', 'Yorum bulunamadı.');
    if (c.authorId !== userId && c.post.authorId !== userId) throw forbidden('NOT_YOUR_COMMENT', 'Bu yorumu silemezsin.');
    await this.prisma.postComment.update({ where: { id: commentId }, data: { deletedAt: new Date() } });
    return { id: commentId, deleted: true };
  }
}
