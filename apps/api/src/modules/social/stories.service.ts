// Hikâyeler: 24 saat görünür, sonra sadece sahibinin arşivinde kalır.
// - Kitle: EVERYONE (hesap gizliyse kabul edilmiş takipçiler), FOLLOWERS, CLOSE_FRIENDS (yakın arkadaş listesi).
// - Çıkartmalar: anket (2 seçenek), soru, emoji tepkisi, bahsetme, bağlantı, elle yazılan konum, başarı paylaşımı.
// - Başarı paylaşımı sunucuda doğrulanır ve sağlık ölçümü (kilo, kalori vb.) içermez.
// - İzleyenler ve soru yanıtları sadece hikâyenin sahibine görünür. Müzik şimdilik yok.
import { Inject, Injectable } from '@nestjs/common';
import { badRequest, conflict, forbidden, notFound } from '../../common/app-error.js';
import { PrismaService } from '../../common/prisma/prisma.service.js';
import type { Prisma } from '../../generated/prisma/client.js';
import type { StoryAudience } from '../../generated/prisma/enums.js';
import { findProgram } from '../library/catalog.js';
import { MediaService } from '../media/media.service.js';
import { NotifyService } from '../notifications/notify.service.js';
import { decodeCursor, encodeCursor } from './cursor.js';
import { CARD_SELECT, FollowsService } from './follows.service.js';
import { visibleAuthor } from './posts.service.js';

export const STORY_HOURS = 24;
export const STORY_BACKGROUNDS = ['sunset', 'ocean', 'forest', 'night', 'berry'] as const;
export const STORY_REACTIONS = ['❤️', '🔥', '👏', '😂', '😮', '😢', '💪'] as const;
export const MAX_STORY_TEXT = 300;
export const MAX_CLOSE_FRIENDS = 300;

export type Achievement = { kind: 'LIBRARY_PROGRAM_COMPLETED' | 'LIBRARY_DAY_DONE'; enrollmentId: string; dayIndex?: number };

export interface StoryInput {
  mediaId?: string | null;
  text?: string | null;
  background?: (typeof STORY_BACKGROUNDS)[number] | null;
  audience?: StoryAudience;
  poll?: { question: string; options: [string, string] } | null;
  question?: string | null;
  mentions?: string[];
  link?: { url: string; label?: string | null } | null;
  location?: string | null;
  achievement?: Achievement | null;
}

const clean = (v: string | null | undefined) => (v?.trim() ? v.trim() : null);

@Injectable()
export class StoriesService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(MediaService) private readonly media: MediaService,
    @Inject(FollowsService) private readonly follows: FollowsService,
    @Inject(NotifyService) private readonly notify: NotifyService,
  ) {}

  // Bakan kişinin görebileceği, süresi dolmamış hikâyeler
  visible(viewerId: string): Prisma.StoryWhereInput {
    return {
      deletedAt: null,
      removedAt: null,
      expiresAt: { gt: new Date() },
      AND: [
        { author: visibleAuthor(viewerId) },
        {
          OR: [
            { authorId: viewerId },
            { audience: 'EVERYONE' },
            { audience: 'FOLLOWERS', author: { followers: { some: { followerId: viewerId, status: 'ACCEPTED' } } } },
            { audience: 'CLOSE_FRIENDS', author: { closeFriends: { some: { friendId: viewerId } } } },
          ],
        },
      ],
    };
  }

  private include(viewerId: string) {
    return {
      author: { select: CARD_SELECT },
      views: { where: { viewerId }, select: { reaction: true }, take: 1 },
      votes: { select: { userId: true, option: true } },
      _count: { select: { views: true, answers: true } },
    } satisfies Prisma.StoryInclude;
  }

  private async present(viewerId: string, rows: Prisma.StoryGetPayload<{ include: ReturnType<StoriesService['include']> }>[]) {
    const mentionIds = [...new Set(rows.flatMap((r) => r.mentions))];
    const mentioned = mentionIds.length ? await this.prisma.user.findMany({ where: { id: { in: mentionIds }, deletionRequestedAt: null }, select: { id: true, username: true } }) : [];
    return rows.map((r) => {
      const mine = r.authorId === viewerId;
      const myVote = r.votes.find((v) => v.userId === viewerId)?.option ?? null;
      const poll = r.poll as { question: string; options: string[] } | null;
      return {
        id: r.id,
        author: this.follows.card(r.author),
        isMine: mine,
        media: r.fileId ? { id: r.fileId, kind: r.mediaKind ?? 'IMAGE', url: this.media.url(r.fileId), durationMs: r.durationMs } : null,
        text: r.text,
        background: r.background,
        audience: mine ? r.audience : undefined,
        createdAt: r.createdAt.toISOString(),
        expiresAt: r.expiresAt.toISOString(),
        viewed: r.views.length > 0,
        myReaction: r.views[0]?.reaction ?? null,
        // Anket sonucu: sahibi ve oy verenler görür
        poll: poll
          ? {
              question: poll.question,
              options: poll.options,
              myVote,
              results: mine || myVote !== null ? poll.options.map((_, i) => r.votes.filter((v) => v.option === i).length) : null,
            }
          : null,
        question: r.question,
        mentions: r.mentions.flatMap((id) => {
          const u = mentioned.find((m) => m.id === id);
          return u ? [u.username] : [];
        }),
        link: r.linkUrl ? { url: r.linkUrl, label: r.linkLabel } : null,
        location: r.locationText,
        achievement: r.achievement as { kind: string; title: string } | null,
        // Sayılar sadece sahibine
        counts: mine ? { views: r._count.views, answers: r._count.answers } : undefined,
      };
    });
  }

  // ───── Oluşturma ve silme ─────

  async uploadMedia(userId: string, file: Parameters<MediaService['saveMedia']>[1]) {
    const saved = await this.media.saveMedia(userId, file, 'STORY');
    return { id: saved.id, url: this.media.url(saved.id), kind: saved.kind, durationMs: saved.durationMs };
  }

  // Paylaşılabilecek başarılar: tamamlanan ücretsiz programlar ve tamamen bitirilen program günleri (son 2 gün)
  async achievements(userId: string) {
    const enrollments = await this.prisma.libraryEnrollment.findMany({
      where: { userId, status: { in: ['ACTIVE', 'COMPLETED'] } },
      select: { id: true, programId: true, status: true, completions: { where: { doneAt: { gte: new Date(Date.now() - 2 * 86_400_000) } }, select: { dayIndex: true } } },
    });
    const out: (Achievement & { title: string })[] = [];
    for (const e of enrollments) {
      const p = findProgram(e.programId);
      if (!p) continue;
      if (e.status === 'COMPLETED') out.push({ kind: 'LIBRARY_PROGRAM_COMPLETED', enrollmentId: e.id, title: `${p.title} programını tamamladı` });
      for (const dayIndex of new Set(e.completions.map((c) => c.dayIndex))) {
        const a = await this.verifyAchievement(userId, { kind: 'LIBRARY_DAY_DONE', enrollmentId: e.id, dayIndex });
        if (a) out.push({ kind: 'LIBRARY_DAY_DONE', enrollmentId: e.id, dayIndex, title: a.title });
      }
    }
    return out;
  }

  private async verifyAchievement(userId: string, a: Achievement): Promise<{ kind: string; title: string } | null> {
    const e = await this.prisma.libraryEnrollment.findFirst({ where: { id: a.enrollmentId, userId }, select: { programId: true, status: true, completions: { select: { dayIndex: true, stepIndex: true } } } });
    const p = e ? findProgram(e.programId) : undefined;
    if (!e || !p) return null;
    if (a.kind === 'LIBRARY_PROGRAM_COMPLETED') return e.status === 'COMPLETED' ? { kind: a.kind, title: `${p.title} programını tamamladı` } : null;
    const day = a.dayIndex !== undefined ? p.days[a.dayIndex] : undefined;
    if (!day) return null;
    const done = day.steps.every((_, i) => e.completions.some((c) => c.dayIndex === a.dayIndex && c.stepIndex === i));
    return done ? { kind: a.kind, title: `${p.title} · ${a.dayIndex! + 1}. gün tamam` } : null;
  }

  async create(userId: string, input: StoryInput) {
    const text = clean(input.text);
    if (!input.mediaId && !text && !input.achievement) throw badRequest('EMPTY_STORY', 'Fotoğraf, video ya da yazı ekle.');
    if (text && text.length > MAX_STORY_TEXT) throw badRequest('TEXT_TOO_LONG', `Yazı en fazla ${MAX_STORY_TEXT} karakter olabilir.`);
    let media: { id: string; kind: 'IMAGE' | 'VIDEO'; durationMs: number | null } | null = null;
    if (input.mediaId) {
      const f = await this.prisma.file.findFirst({ where: { id: input.mediaId, ownerId: userId, purpose: 'STORY', stories: { none: {} } }, select: { id: true, mimeType: true } });
      if (!f) throw badRequest('INVALID_MEDIA', 'Fotoğraf ya da video bulunamadı. Tekrar yükle.');
      const video = f.mimeType.startsWith('video/');
      media = { id: f.id, kind: video ? 'VIDEO' : 'IMAGE', durationMs: video ? await this.media.videoDuration(f.id) : null };
    }
    const poll = input.poll ? { question: input.poll.question.trim(), options: input.poll.options.map((o) => o.trim()) } : null;
    if (poll && (!poll.question || poll.options.some((o) => !o))) throw badRequest('INVALID_POLL', 'Anket sorusu ve iki seçenek dolu olmalı.');
    const achievement = input.achievement ? await this.verifyAchievement(userId, input.achievement) : null;
    if (input.achievement && !achievement) throw badRequest('INVALID_ACHIEVEMENT', 'Bu başarı doğrulanamadı.');
    const mentionNames = [...new Set((input.mentions ?? []).map((m) => m.replace(/^@/, '').trim().toLowerCase()).filter(Boolean))].slice(0, 10);
    const mentions = mentionNames.length
      ? (
          await this.prisma.user.findMany({
            where: { username: { in: mentionNames }, deletionRequestedAt: null, blocking: { none: { blockedId: userId } }, blockedBy: { none: { blockerId: userId } } },
            select: { id: true },
          })
        ).map((u) => u.id)
      : [];
    const story = await this.prisma.story.create({
      data: {
        authorId: userId,
        fileId: media?.id ?? null,
        mediaKind: media?.kind ?? null,
        durationMs: media?.durationMs ?? null,
        text,
        background: media ? null : (input.background ?? 'sunset'),
        audience: input.audience ?? 'EVERYONE',
        poll: poll ?? undefined,
        question: clean(input.question),
        mentions,
        linkUrl: input.link?.url ?? null,
        linkLabel: clean(input.link?.label),
        locationText: clean(input.location),
        achievement: achievement ?? undefined,
        expiresAt: new Date(Date.now() + STORY_HOURS * 3_600_000),
      },
      select: { id: true },
    });
    for (const id of mentions) await this.notify.social(id, 'social_story_mention', userId, { storyId: story.id });
    return this.get(userId, story.id);
  }

  async get(viewerId: string, id: string) {
    const row = await this.prisma.story.findFirst({ where: { id, ...this.visible(viewerId) }, include: this.include(viewerId) });
    if (!row) throw notFound('STORY_NOT_FOUND', 'Hikâye bulunamadı ya da süresi doldu.');
    return (await this.present(viewerId, [row]))[0]!;
  }

  async remove(userId: string, id: string) {
    const s = await this.prisma.story.findFirst({ where: { id, deletedAt: null }, select: { authorId: true, fileId: true } });
    if (!s) throw notFound('STORY_NOT_FOUND', 'Hikâye bulunamadı.');
    if (s.authorId !== userId) throw forbidden('NOT_YOUR_STORY', 'Bu hikâye senin değil.');
    await this.prisma.story.update({ where: { id }, data: { deletedAt: new Date() } });
    if (s.fileId) await this.media.remove(userId, s.fileId);
    return { id, deleted: true };
  }

  // ───── Görüntüleme ─────

  // Hikâye şeridi: kendisi ve takip ettikleri (sessize alınanlar hariç); görülmemişler önde
  async tray(viewerId: string) {
    const rows = await this.prisma.story.findMany({
      where: {
        AND: [
          this.visible(viewerId),
          { OR: [{ authorId: viewerId }, { author: { followers: { some: { followerId: viewerId, status: 'ACCEPTED' } }, mutedBy: { none: { muterId: viewerId } } } }] },
        ],
      },
      orderBy: { createdAt: 'asc' },
      select: { authorId: true, createdAt: true, author: { select: CARD_SELECT }, views: { where: { viewerId }, select: { viewerId: true }, take: 1 } },
    });
    const byAuthor = new Map<string, { author: ReturnType<FollowsService['card']>; count: number; unseen: number; latestAt: Date; isMe: boolean }>();
    for (const r of rows) {
      const e = byAuthor.get(r.authorId) ?? { author: this.follows.card(r.author), count: 0, unseen: 0, latestAt: r.createdAt, isMe: r.authorId === viewerId };
      e.count += 1;
      if (r.views.length === 0 && r.authorId !== viewerId) e.unseen += 1;
      if (r.createdAt > e.latestAt) e.latestAt = r.createdAt;
      byAuthor.set(r.authorId, e);
    }
    return [...byAuthor.values()]
      .sort((a, b) => Number(b.isMe) - Number(a.isMe) || Number(b.unseen > 0) - Number(a.unseen > 0) || b.latestAt.getTime() - a.latestAt.getTime())
      .map((e) => ({ author: e.author, isMe: e.isMe, count: e.count, hasUnseen: e.unseen > 0, latestAt: e.latestAt.toISOString() }));
  }

  async byUser(viewerId: string, userId: string) {
    const rows = await this.prisma.story.findMany({ where: { authorId: userId, ...this.visible(viewerId) }, orderBy: { createdAt: 'asc' }, include: this.include(viewerId) });
    return this.present(viewerId, rows);
  }

  async view(viewerId: string, id: string) {
    const s = await this.get(viewerId, id);
    if (!s.isMine) await this.prisma.storyView.upsert({ where: { storyId_viewerId: { storyId: id, viewerId } }, create: { storyId: id, viewerId }, update: {} });
    return { viewed: true };
  }

  async react(viewerId: string, id: string, emoji: string | null) {
    const s = await this.get(viewerId, id);
    if (s.isMine) throw badRequest('OWN_STORY', 'Kendi hikâyene tepki veremezsin.');
    if (emoji !== null && !(STORY_REACTIONS as readonly string[]).includes(emoji)) throw badRequest('INVALID_REACTION', 'Bu tepki kullanılamaz.');
    await this.prisma.storyView.upsert({ where: { storyId_viewerId: { storyId: id, viewerId } }, create: { storyId: id, viewerId, reaction: emoji }, update: { reaction: emoji } });
    if (emoji) await this.notify.social(s.author.id, 'social_story_reaction', viewerId, { storyId: id, emoji });
    return { reaction: emoji };
  }

  async vote(viewerId: string, id: string, option: number) {
    const s = await this.get(viewerId, id);
    if (!s.poll) throw badRequest('NO_POLL', 'Bu hikâyede anket yok.');
    if (s.isMine) throw badRequest('OWN_STORY', 'Kendi anketine oy veremezsin.');
    if (option < 0 || option >= s.poll.options.length) throw badRequest('INVALID_OPTION', 'Geçersiz seçenek.');
    try {
      await this.prisma.storyPollVote.create({ data: { storyId: id, userId: viewerId, option } });
    } catch {
      throw conflict('ALREADY_VOTED', 'Bu ankete zaten oy verdin.');
    }
    return (await this.get(viewerId, id)).poll;
  }

  async answer(viewerId: string, id: string, raw: string) {
    const s = await this.get(viewerId, id);
    if (!s.question) throw badRequest('NO_QUESTION', 'Bu hikâyede soru yok.');
    if (s.isMine) throw badRequest('OWN_STORY', 'Kendi sorunu yanıtlayamazsın.');
    const text = raw.trim();
    if (!text || text.length > 300) throw badRequest('INVALID_ANSWER', 'Yanıt 1-300 karakter olmalı.');
    await this.prisma.storyAnswer.create({ data: { storyId: id, userId: viewerId, text } });
    await this.notify.social(s.author.id, 'social_story_answer', viewerId, { storyId: id });
    return { answered: true };
  }

  // Sahibine: izleyenler (tepkileriyle), soru yanıtları ve anket sonucu
  async insights(userId: string, id: string) {
    const s = await this.prisma.story.findFirst({ where: { id, deletedAt: null }, select: { authorId: true } });
    if (!s) throw notFound('STORY_NOT_FOUND', 'Hikâye bulunamadı.');
    if (s.authorId !== userId) throw forbidden('NOT_YOUR_STORY', 'İzleyenleri sadece hikâyenin sahibi görür.');
    const [views, answers] = await Promise.all([
      this.prisma.storyView.findMany({ where: { storyId: id, viewer: { deletionRequestedAt: null } }, orderBy: { viewedAt: 'desc' }, select: { viewedAt: true, reaction: true, viewer: { select: CARD_SELECT } } }),
      this.prisma.storyAnswer.findMany({ where: { storyId: id, user: { deletionRequestedAt: null } }, orderBy: { createdAt: 'desc' }, select: { id: true, text: true, createdAt: true, user: { select: CARD_SELECT } } }),
    ]);
    return {
      views: views.map((v) => ({ person: this.follows.card(v.viewer), viewedAt: v.viewedAt.toISOString(), reaction: v.reaction })),
      answers: answers.map((a) => ({ id: a.id, person: this.follows.card(a.user), text: a.text, createdAt: a.createdAt.toISOString() })),
    };
  }

  // Arşiv: süresi dolanlar dahil kendi hikâyeleri (sadece sahibi)
  async archive(userId: string, cursor?: string) {
    const c = decodeCursor(cursor);
    const rows = await this.prisma.story.findMany({
      where: { authorId: userId, deletedAt: null, removedAt: null, ...(c ? { OR: [{ createdAt: { lt: c.at } }, { createdAt: c.at, id: { lt: c.id } }] } : {}) },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: 31,
      include: this.include(userId),
    });
    const page = rows.slice(0, 30);
    const last = page.at(-1);
    return { items: await this.present(userId, page), nextCursor: rows.length > 30 && last ? encodeCursor(last.createdAt, last.id) : null };
  }

  // ───── Yakın arkadaşlar ─────

  async closeFriends(userId: string) {
    const rows = await this.prisma.closeFriend.findMany({ where: { ownerId: userId, friend: { deletionRequestedAt: null } }, orderBy: { createdAt: 'desc' }, select: { friend: { select: CARD_SELECT } } });
    return rows.map((r) => this.follows.card(r.friend));
  }

  async setCloseFriend(userId: string, friendId: string, on: boolean) {
    if (on) {
      if (friendId === userId) throw badRequest('SELF', 'Kendini ekleyemezsin.');
      await this.follows.target(userId, friendId);
      if ((await this.prisma.closeFriend.count({ where: { ownerId: userId } })) >= MAX_CLOSE_FRIENDS) throw conflict('TOO_MANY', `En fazla ${MAX_CLOSE_FRIENDS} yakın arkadaş eklenebilir.`);
      await this.prisma.closeFriend.upsert({ where: { ownerId_friendId: { ownerId: userId, friendId } }, create: { ownerId: userId, friendId }, update: {} });
    } else {
      await this.prisma.closeFriend.deleteMany({ where: { ownerId: userId, friendId } });
    }
    return { closeFriend: on };
  }
}
