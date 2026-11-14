// Sosyal mesajlaşma (DM) ve gruplar. Uzman–danışan yazışmasından ayrıdır; sağlık verisi burada işlenmez.
// - Takip ettiğin kişiden mesaj gelen kutuna, takip etmediğinden gelen "İstekler"e düşer. Kabul edilene kadar
//   istek gönderen fotoğraf/video/ses gönderemez. Alıcı yanıt verirse istek kabul edilmiş olur.
// - Mesaj gizliliği: FOLLOWING seçen kişiye sadece takip ettiği kişiler yazabilir. Engel varsa yazışma olmaz.
// - Benden sil (sadece bende gizlenir), geri al (herkesten kalkar, dosyası silinir), yanıtla, gönderi paylaş, hikâyeye yanıt.
// - Durum: gönderildi / iletildi / görüldü. Çevrimiçi ve son görülme, iki taraf da paylaşıyorsa görünür.
import { Inject, Injectable } from '@nestjs/common';
import { badRequest, conflict, forbidden, notFound } from '../../common/app-error.js';
import { PrismaService } from '../../common/prisma/prisma.service.js';
import type { Prisma } from '../../generated/prisma/client.js';
import type { DmMessageKind } from '../../generated/prisma/enums.js';
import type { UploadedFileLike } from '../files/documents.service.js';
import { MediaService } from '../media/media.service.js';
import { decodeCursor, encodeCursor } from '../social/cursor.js';
import { CARD_SELECT, FollowsService } from '../social/follows.service.js';
import { PostsService } from '../social/posts.service.js';
import { StoriesService } from '../social/stories.service.js';
import { DmEventsService } from './dm-events.service.js';

export const MAX_DM_TEXT = 2000;
export const MAX_GROUP_MEMBERS = 32;
const PAGE = 40;

export interface SendInput {
  text?: string | null;
  mediaId?: string | null;
  replyToId?: string | null;
  postId?: string | null;
  storyId?: string | null;
}

const directKey = (a: string, b: string) => [a, b].sort().join(':');

@Injectable()
export class DmService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(MediaService) private readonly media: MediaService,
    @Inject(FollowsService) private readonly follows: FollowsService,
    @Inject(PostsService) private readonly posts: PostsService,
    @Inject(StoriesService) private readonly stories: StoriesService,
    @Inject(DmEventsService) private readonly events: DmEventsService,
  ) {}

  // ───── Kurallar ─────

  // Gönderen bu kişiye yazabilir mi; yazabiliyorsa mesaj istek olarak mı düşer
  private async messageRule(senderId: string, recipientId: string): Promise<{ request: boolean }> {
    if (senderId === recipientId) throw badRequest('SELF_MESSAGE', 'Kendine mesaj gönderemezsin.');
    const r = await this.prisma.user.findUnique({
      where: { id: recipientId },
      select: { deletionRequestedAt: true, roles: { select: { role: true } }, profile: { select: { dmPolicy: true } } },
    });
    if (!r || r.deletionRequestedAt || r.roles.some((x) => x.role === 'ADMIN' || x.role === 'MODERATOR')) throw notFound('USER_NOT_FOUND', 'Kişi bulunamadı.');
    if (await this.follows.blockedBetween(senderId, recipientId)) throw forbidden('DM_NOT_ALLOWED', 'Bu kişiye mesaj gönderemezsin.');
    const recipientFollowsSender = (await this.prisma.follow.count({ where: { followerId: recipientId, followedId: senderId, status: 'ACCEPTED' } })) > 0;
    if (!recipientFollowsSender && r.profile?.dmPolicy === 'FOLLOWING') throw forbidden('DM_NOT_ALLOWED', 'Bu kişi sadece takip ettiklerinden mesaj alıyor.');
    return { request: !recipientFollowsSender };
  }

  private async membership(userId: string, conversationId: string, statuses: ('ACTIVE' | 'REQUEST')[] = ['ACTIVE', 'REQUEST']) {
    const m = await this.prisma.dmMember.findUnique({
      where: { conversationId_userId: { conversationId, userId } },
      include: { conversation: { include: { members: { select: { userId: true, status: true, role: true, lastReadAt: true, lastDeliveredAt: true, joinedAt: true } } } } },
    });
    if (!m || !(statuses as string[]).includes(m.status)) throw notFound('CONVERSATION_NOT_FOUND', 'Sohbet bulunamadı.');
    return m;
  }

  private activeIds(members: { userId: string; status: string }[]) {
    return members.filter((m) => m.status === 'ACTIVE' || m.status === 'REQUEST').map((m) => m.userId);
  }

  // ───── Sohbet listesi ─────

  async list(userId: string, box: 'inbox' | 'requests') {
    const rows = await this.prisma.dmMember.findMany({
      where: { userId, status: box === 'inbox' ? 'ACTIVE' : 'REQUEST', conversation: { messages: { some: {} } } },
      orderBy: { conversation: { lastMessageAt: 'desc' } },
      take: 100,
      include: {
        conversation: {
          include: {
            members: { where: { status: { in: ['ACTIVE', 'REQUEST'] } }, select: { userId: true, status: true, lastReadAt: true, user: { select: { ...CARD_SELECT, profile: { select: { displayName: true, avatarId: true, showActivity: true, lastSeenAt: true } } } } } },
            messages: { orderBy: { createdAt: 'desc' }, take: 1, where: { hiddenFor: { none: { userId } } }, include: { sender: { select: { id: true, username: true } } } },
          },
        },
      },
    });
    const me = await this.prisma.profile.findUnique({ where: { userId }, select: { showActivity: true } });
    const out = [];
    for (const m of rows) {
      const c = m.conversation;
      const last = c.messages[0];
      // Sohbeti silmişse ve sonra mesaj gelmemişse listede görünmez
      if (!last || (m.clearedAt && last.createdAt <= m.clearedAt)) continue;
      const others = c.members.filter((x) => x.userId !== userId);
      // Engellenen kişiyle iki kişilik sohbet listede görünmez
      if (c.kind === 'DIRECT' && others[0] && (await this.follows.blockedBetween(userId, others[0].userId))) continue;
      const unread = await this.prisma.dmMessage.count({
        where: {
          conversationId: c.id,
          senderId: { not: userId },
          kind: { not: 'SYSTEM' },
          unsentAt: null,
          createdAt: { gt: [m.lastReadAt, m.clearedAt].reduce<Date>((a, b) => (b && b > a ? b : a), new Date(0)) },
          hiddenFor: { none: { userId } },
        },
      });
      const other = c.kind === 'DIRECT' ? others[0] : undefined;
      out.push({
        id: c.id,
        kind: c.kind,
        title: c.kind === 'GROUP' ? (c.title ?? 'Grup') : other ? this.follows.card(other.user).displayName : 'Sohbet',
        avatarUrl: c.kind === 'GROUP' ? this.media.url(c.avatarFileId) : other ? this.follows.card(other.user).avatarUrl : null,
        other: other ? { ...this.follows.card(other.user), ...this.presence(me?.showActivity ?? true, other.user) } : null,
        memberCount: c.members.length,
        lastMessage: { preview: this.preview(last, userId), at: last.createdAt.toISOString(), mine: last.senderId === userId },
        unread,
        muted: m.mutedUntil !== null && m.mutedUntil > new Date(),
      });
    }
    return out;
  }

  async unreadTotal(userId: string) {
    const [inbox, requests] = await Promise.all([this.list(userId, 'inbox'), this.prisma.dmMember.count({ where: { userId, status: 'REQUEST', conversation: { messages: { some: {} } } } })]);
    return { unread: inbox.filter((c) => c.unread > 0 && !c.muted).length, requests };
  }

  private preview(m: { kind: DmMessageKind; text: string | null; unsentAt: Date | null; senderId: string }, viewerId: string) {
    if (m.unsentAt) return 'Mesaj geri alındı';
    const prefix = m.senderId === viewerId ? 'Sen: ' : '';
    switch (m.kind) {
      case 'IMAGE':
        return `${prefix}📷 Fotoğraf`;
      case 'VIDEO':
        return `${prefix}🎬 Video`;
      case 'VOICE':
        return `${prefix}🎤 Sesli mesaj`;
      case 'POST':
        return `${prefix}Bir gönderi paylaştı`;
      case 'STORY_REPLY':
        return `${prefix}Hikâyeye yanıt: ${m.text ?? ''}`;
      default:
        return `${prefix}${m.text ?? ''}`;
    }
  }

  // Çevrimiçi / son görülme: iki taraf da paylaşıyorsa
  private presence(viewerShares: boolean, user: { id: string; profile: { showActivity: boolean; lastSeenAt: Date | null } | null }) {
    if (!viewerShares || !(user.profile?.showActivity ?? true)) return { online: null, lastSeenAt: null };
    const online = this.events.isOnline(user.id);
    return { online, lastSeenAt: online ? null : (user.profile?.lastSeenAt?.toISOString() ?? null) };
  }

  // Bekleme isteği geldikçe son görülme güncellenir (en fazla dakikada bir yazılır)
  async touch(userId: string) {
    await this.prisma.profile.updateMany({ where: { userId, OR: [{ lastSeenAt: null }, { lastSeenAt: { lt: new Date(Date.now() - 60_000) } }] }, data: { lastSeenAt: new Date() } });
  }

  // ───── Sohbet açma ─────

  async openDirect(userId: string, otherId: string) {
    const rule = await this.messageRule(userId, otherId);
    const key = directKey(userId, otherId);
    const existing = await this.prisma.dmConversation.findUnique({ where: { directKey: key }, select: { id: true } });
    if (existing) {
      await this.prisma.dmMember.updateMany({ where: { conversationId: existing.id, userId, status: { in: ['LEFT', 'REMOVED'] } }, data: { status: 'ACTIVE' } });
      return this.detail(userId, existing.id);
    }
    const c = await this.prisma.dmConversation.create({
      data: {
        kind: 'DIRECT',
        directKey: key,
        createdById: userId,
        members: { create: [{ userId, status: 'ACTIVE' }, { userId: otherId, status: rule.request ? 'REQUEST' : 'ACTIVE' }] },
      },
      select: { id: true },
    });
    return this.detail(userId, c.id);
  }

  async detail(userId: string, conversationId: string) {
    const m = await this.membership(userId, conversationId);
    const c = await this.prisma.dmConversation.findUniqueOrThrow({
      where: { id: conversationId },
      include: { members: { where: { status: { in: ['ACTIVE', 'REQUEST'] } }, orderBy: { joinedAt: 'asc' }, select: { userId: true, role: true, status: true, user: { select: { ...CARD_SELECT, profile: { select: { displayName: true, avatarId: true, showActivity: true, lastSeenAt: true } } } } } } },
    });
    const meShares = (await this.prisma.profile.findUnique({ where: { userId }, select: { showActivity: true } }))?.showActivity ?? true;
    const other = c.kind === 'DIRECT' ? c.members.find((x) => x.userId !== userId) : undefined;
    return {
      id: c.id,
      kind: c.kind,
      title: c.kind === 'GROUP' ? (c.title ?? 'Grup') : other ? this.follows.card(other.user).displayName : 'Sohbet',
      avatarUrl: c.kind === 'GROUP' ? this.media.url(c.avatarFileId) : other ? this.follows.card(other.user).avatarUrl : null,
      myRole: m.role,
      myStatus: m.status,
      // Karşı taraf isteği henüz kabul etmediyse (gönderen için) medya gönderilemez
      pendingRequest: c.kind === 'DIRECT' && other?.status === 'REQUEST',
      muted: m.mutedUntil !== null && m.mutedUntil > new Date(),
      members: c.members.map((x) => ({ ...this.follows.card(x.user), role: x.role, isMe: x.userId === userId, ...(x.userId === userId ? {} : this.presence(meShares, x.user)) })),
    };
  }

  // ───── Mesajlar ─────

  async messages(userId: string, conversationId: string, cursor?: string) {
    const m = await this.membership(userId, conversationId);
    const c = decodeCursor(cursor);
    const rows = await this.prisma.dmMessage.findMany({
      where: {
        conversationId,
        hiddenFor: { none: { userId } },
        ...(m.clearedAt ? { createdAt: { gt: m.clearedAt } } : {}),
        // Grupta engellediğim/engelleyen kişinin mesajları görünmez
        sender: { blocking: { none: { blockedId: userId } }, blockedBy: { none: { blockerId: userId } } },
        ...(c ? { OR: [{ createdAt: { lt: c.at } }, { createdAt: c.at, id: { lt: c.id } }] } : {}),
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: PAGE + 1,
      include: { sender: { select: CARD_SELECT }, replyTo: { select: { id: true, text: true, kind: true, unsentAt: true, senderId: true, sender: { select: { username: true } } } } },
    });
    const page = rows.slice(0, PAGE);
    const last = page.at(-1);
    // Bu kişiye iletildi bilgisi
    const now = new Date();
    await this.prisma.dmMember.update({ where: { conversationId_userId: { conversationId, userId } }, data: { lastDeliveredAt: now } });
    const others = m.conversation.members.filter((x) => x.userId !== userId && x.status !== 'LEFT' && x.status !== 'REMOVED');
    if (page.some((p) => p.senderId !== userId)) this.events.emit(others.map((o) => o.userId), { type: 'delivered', conversationId, userId, at: now.toISOString() });
    return { items: await this.present(userId, m.conversation.kind, others, page), nextCursor: rows.length > PAGE && last ? encodeCursor(last.createdAt, last.id) : null };
  }

  private async present(
    viewerId: string,
    kind: 'DIRECT' | 'GROUP',
    others: { userId: string; lastReadAt: Date | null; lastDeliveredAt: Date | null }[],
    rows: Prisma.DmMessageGetPayload<{ include: { sender: { select: typeof CARD_SELECT }; replyTo: { select: { id: true; text: true; kind: true; unsentAt: true; senderId: true; sender: { select: { username: true } } } } } }>[],
  ) {
    const postIds = [...new Set(rows.flatMap((r) => (r.postId && !r.unsentAt ? [r.postId] : [])))];
    const posts = new Map((await this.posts.byIds(viewerId, postIds)).map((p) => [p.id, p]));
    const storyIds = [...new Set(rows.flatMap((r) => (r.storyId && !r.unsentAt ? [r.storyId] : [])))];
    const stories = new Map<string, Awaited<ReturnType<StoriesService['get']>>>();
    for (const id of storyIds) {
      const s = await this.stories.get(viewerId, id).catch(() => null);
      if (s) stories.set(id, s);
    }
    return rows.map((r) => {
      const mine = r.senderId === viewerId;
      let status: 'sent' | 'delivered' | 'seen' | null = null;
      let seenBy = 0;
      if (mine && !r.unsentAt && r.kind !== 'SYSTEM') {
        seenBy = others.filter((o) => o.lastReadAt && o.lastReadAt >= r.createdAt).length;
        const delivered = others.some((o) => o.lastDeliveredAt && o.lastDeliveredAt >= r.createdAt);
        status = kind === 'DIRECT' ? (seenBy > 0 ? 'seen' : delivered ? 'delivered' : 'sent') : seenBy > 0 ? 'seen' : delivered ? 'delivered' : 'sent';
      }
      return {
        id: r.id,
        kind: r.kind,
        sender: this.follows.card(r.sender),
        isMine: mine,
        text: r.unsentAt ? null : r.text,
        unsent: r.unsentAt !== null,
        media: !r.unsentAt && r.fileId ? { id: r.fileId, url: this.media.url(r.fileId), kind: r.kind, durationMs: r.durationMs } : null,
        replyTo: r.replyTo ? { id: r.replyTo.id, username: r.replyTo.sender.username, preview: this.preview({ ...r.replyTo, text: r.replyTo.text }, viewerId) } : null,
        post: r.postId && !r.unsentAt ? (posts.get(r.postId) ?? { id: r.postId, available: false as const }) : null,
        story: r.storyId && !r.unsentAt ? (stories.has(r.storyId) ? { id: r.storyId, available: true as const, media: stories.get(r.storyId)!.media, text: stories.get(r.storyId)!.text } : { id: r.storyId, available: false as const }) : null,
        createdAt: r.createdAt.toISOString(),
        status,
        seenBy: kind === 'GROUP' && mine ? seenBy : undefined,
      };
    });
  }

  async uploadMedia(userId: string, file: UploadedFileLike | undefined) {
    const saved = await this.media.saveMedia(userId, file, 'MESSAGE');
    return { id: saved.id, url: this.media.url(saved.id), kind: saved.kind, durationMs: saved.durationMs };
  }

  async send(userId: string, conversationId: string, input: SendInput) {
    const m = await this.membership(userId, conversationId);
    const conv = m.conversation;
    const text = input.text?.trim() || null;
    if (text && text.length > MAX_DM_TEXT) throw badRequest('TEXT_TOO_LONG', `Mesaj en fazla ${MAX_DM_TEXT} karakter olabilir.`);
    if (!text && !input.mediaId && !input.postId && !input.storyId) throw badRequest('EMPTY_MESSAGE', 'Boş mesaj gönderilemez.');

    const other = conv.kind === 'DIRECT' ? conv.members.find((x) => x.userId !== userId) : undefined;
    let otherStatus = other?.status;
    if (other) {
      // Her mesajda kurallar yeniden denetlenir (engel, mesaj gizliliği)
      const rule = await this.messageRule(userId, other.userId);
      if (otherStatus === 'LEFT' || otherStatus === 'REMOVED') otherStatus = rule.request ? 'REQUEST' : 'ACTIVE';
      if (otherStatus === 'REQUEST' && !rule.request) otherStatus = 'ACTIVE';
    }
    const pendingRequest = conv.kind === 'DIRECT' && otherStatus === 'REQUEST';

    let kind: DmMessageKind = 'TEXT';
    let durationMs: number | null = null;
    if (input.mediaId) {
      if (pendingRequest) throw forbidden('MEDIA_NOT_ALLOWED', 'İsteğin kabul edilene kadar fotoğraf, video ya da ses gönderemezsin.');
      const f = await this.prisma.file.findFirst({ where: { id: input.mediaId, ownerId: userId, purpose: 'MESSAGE', dmMessages: { none: {} } }, select: { id: true, mimeType: true } });
      if (!f) throw badRequest('INVALID_MEDIA', 'Dosya bulunamadı. Tekrar yükle.');
      kind = f.mimeType.startsWith('audio/') ? 'VOICE' : f.mimeType.startsWith('video/') ? 'VIDEO' : 'IMAGE';
      if (kind !== 'IMAGE') durationMs = await this.media.videoDuration(f.id);
    }
    if (input.postId) {
      await this.posts.get(userId, input.postId);
      kind = 'POST';
    }
    if (input.storyId) {
      const s = await this.stories.get(userId, input.storyId);
      if (conv.kind !== 'DIRECT' || s.author.id !== other?.userId) throw badRequest('INVALID_STORY_REPLY', 'Hikâyeye yanıt sadece hikâyenin sahibine gider.');
      kind = 'STORY_REPLY';
    }
    if (input.replyToId) {
      const r = await this.prisma.dmMessage.count({ where: { id: input.replyToId, conversationId } });
      if (!r) throw badRequest('INVALID_REPLY', 'Yanıtlanan mesaj bulunamadı.');
    }

    const now = new Date();
    const [msg] = await this.prisma.$transaction([
      this.prisma.dmMessage.create({
        data: { conversationId, senderId: userId, kind, text, fileId: input.mediaId ?? null, durationMs, replyToId: input.replyToId ?? null, postId: input.postId ?? null, storyId: input.storyId ?? null, createdAt: now },
        include: { sender: { select: CARD_SELECT }, replyTo: { select: { id: true, text: true, kind: true, unsentAt: true, senderId: true, sender: { select: { username: true } } } } },
      }),
      this.prisma.dmConversation.update({ where: { id: conversationId }, data: { lastMessageAt: now } }),
      // Alıcı yanıt verdiyse istek kabul edilmiş olur; gönderen okumuş sayılır
      this.prisma.dmMember.update({ where: { conversationId_userId: { conversationId, userId } }, data: { status: 'ACTIVE', lastReadAt: now } }),
      ...(other && otherStatus !== other.status ? [this.prisma.dmMember.update({ where: { conversationId_userId: { conversationId, userId: other.userId } }, data: { status: otherStatus } })] : []),
    ]);
    const recipients = conv.members.filter((x) => x.status === 'ACTIVE' || x.status === 'REQUEST' || x.userId === other?.userId).map((x) => x.userId);
    this.events.emit(recipients, { type: 'message', conversationId, messageId: msg.id });
    const others = conv.members.filter((x) => x.userId !== userId);
    return (await this.present(userId, conv.kind, others, [msg]))[0]!;
  }

  // Bir kişiye doğrudan (gönderi paylaşma, hikâyeye yanıt): sohbet yoksa açılır
  async sendToUser(userId: string, otherId: string, input: SendInput) {
    const c = await this.openDirect(userId, otherId);
    return { conversationId: c.id, message: await this.send(userId, c.id, input) };
  }

  async markRead(userId: string, conversationId: string) {
    const m = await this.membership(userId, conversationId);
    const now = new Date();
    await this.prisma.dmMember.update({ where: { conversationId_userId: { conversationId, userId } }, data: { lastReadAt: now, lastDeliveredAt: now } });
    this.events.emit(this.activeIds(m.conversation.members).filter((id) => id !== userId), { type: 'read', conversationId, userId, at: now.toISOString() });
    return { readAt: now.toISOString() };
  }

  async unsend(userId: string, messageId: string) {
    const msg = await this.prisma.dmMessage.findUnique({ where: { id: messageId }, select: { senderId: true, conversationId: true, fileId: true, unsentAt: true, kind: true } });
    if (!msg || msg.unsentAt) throw notFound('MESSAGE_NOT_FOUND', 'Mesaj bulunamadı.');
    if (msg.senderId !== userId || msg.kind === 'SYSTEM') throw forbidden('NOT_YOUR_MESSAGE', 'Sadece kendi mesajını geri alabilirsin.');
    const m = await this.membership(userId, msg.conversationId);
    await this.prisma.dmMessage.update({ where: { id: messageId }, data: { unsentAt: new Date(), text: null, fileId: null, postId: null, storyId: null } });
    if (msg.fileId) await this.media.remove(userId, msg.fileId);
    this.events.emit(this.activeIds(m.conversation.members), { type: 'unsent', conversationId: msg.conversationId, messageId });
    return { id: messageId, unsent: true };
  }

  async hide(userId: string, messageId: string) {
    const msg = await this.prisma.dmMessage.findUnique({ where: { id: messageId }, select: { conversationId: true } });
    if (!msg) throw notFound('MESSAGE_NOT_FOUND', 'Mesaj bulunamadı.');
    await this.membership(userId, msg.conversationId);
    await this.prisma.dmHidden.upsert({ where: { messageId_userId: { messageId, userId } }, create: { messageId, userId }, update: {} });
    return { id: messageId, hidden: true };
  }

  // ───── İstekler, sessize alma, sohbeti silme ─────

  async acceptRequest(userId: string, conversationId: string) {
    await this.membership(userId, conversationId, ['REQUEST']);
    await this.prisma.dmMember.update({ where: { conversationId_userId: { conversationId, userId } }, data: { status: 'ACTIVE' } });
    return { status: 'ACTIVE' as const };
  }

  // İsteği sil: bende kalkar; gönderen yeniden yazarsa yeni istek olarak gelir
  async declineRequest(userId: string, conversationId: string) {
    await this.membership(userId, conversationId, ['REQUEST']);
    await this.prisma.dmMember.update({ where: { conversationId_userId: { conversationId, userId } }, data: { status: 'LEFT', clearedAt: new Date() } });
    return { status: 'LEFT' as const };
  }

  async clear(userId: string, conversationId: string) {
    await this.membership(userId, conversationId);
    await this.prisma.dmMember.update({ where: { conversationId_userId: { conversationId, userId } }, data: { clearedAt: new Date() } });
    return { cleared: true };
  }

  async mute(userId: string, conversationId: string, muted: boolean) {
    await this.membership(userId, conversationId);
    // Sessiz: bir yıl (kapatılana kadar)
    await this.prisma.dmMember.update({ where: { conversationId_userId: { conversationId, userId } }, data: { mutedUntil: muted ? new Date(Date.now() + 365 * 86_400_000) : null } });
    return { muted };
  }

  // ───── Gruplar ─────

  private async system(conversationId: string, actorId: string, text: string, notify: string[]) {
    const now = new Date();
    const msg = await this.prisma.dmMessage.create({ data: { conversationId, senderId: actorId, kind: 'SYSTEM', text, createdAt: now }, select: { id: true } });
    await this.prisma.dmConversation.update({ where: { id: conversationId }, data: { lastMessageAt: now } });
    this.events.emit(notify, { type: 'message', conversationId, messageId: msg.id });
  }

  private async nameOf(userId: string) {
    const u = await this.prisma.user.findUniqueOrThrow({ where: { id: userId }, select: CARD_SELECT });
    return this.follows.card(u).displayName;
  }

  // Eklenecek kişiler: mesaj kuralına uyanlar. Takip etmeyenler için grup "İstekler"e düşer.
  private async admissible(actorId: string, userIds: string[]) {
    const out: { userId: string; request: boolean }[] = [];
    for (const id of [...new Set(userIds)].filter((x) => x !== actorId)) {
      try {
        out.push({ userId: id, ...(await this.messageRule(actorId, id)) });
      } catch {
        throw forbidden('MEMBER_NOT_ALLOWED', 'Seçtiğin kişilerden biri gruba eklenemiyor (mesaj ayarı ya da engel).');
      }
    }
    return out;
  }

  async createGroup(userId: string, title: string, memberIds: string[]) {
    const name = title.trim();
    if (!name) throw badRequest('TITLE_REQUIRED', 'Grup adı yaz.');
    const members = await this.admissible(userId, memberIds);
    if (members.length < 2) throw badRequest('TOO_FEW_MEMBERS', 'Grup için en az iki kişi seç.');
    if (members.length + 1 > MAX_GROUP_MEMBERS) throw badRequest('TOO_MANY_MEMBERS', `Grupta en fazla ${MAX_GROUP_MEMBERS} kişi olabilir.`);
    const c = await this.prisma.dmConversation.create({
      data: {
        kind: 'GROUP',
        title: name.slice(0, 60),
        createdById: userId,
        members: { create: [{ userId, role: 'ADMIN', status: 'ACTIVE' }, ...members.map((m) => ({ userId: m.userId, status: m.request ? ('REQUEST' as const) : ('ACTIVE' as const) }))] },
      },
      select: { id: true },
    });
    await this.system(c.id, userId, `${await this.nameOf(userId)} grubu oluşturdu`, [userId, ...members.map((m) => m.userId)]);
    return this.detail(userId, c.id);
  }

  private async admin(userId: string, conversationId: string) {
    const m = await this.membership(userId, conversationId, ['ACTIVE']);
    if (m.conversation.kind !== 'GROUP') throw badRequest('NOT_GROUP', 'Bu bir grup değil.');
    if (m.role !== 'ADMIN') throw forbidden('NOT_ADMIN', 'Bu işlemi sadece grup yöneticileri yapabilir.');
    return m;
  }

  async addMembers(userId: string, conversationId: string, memberIds: string[]) {
    const m = await this.admin(userId, conversationId);
    const current = this.activeIds(m.conversation.members);
    const fresh = await this.admissible(userId, memberIds.filter((id) => !current.includes(id)));
    if (current.length + fresh.length > MAX_GROUP_MEMBERS) throw badRequest('TOO_MANY_MEMBERS', `Grupta en fazla ${MAX_GROUP_MEMBERS} kişi olabilir.`);
    for (const f of fresh) {
      await this.prisma.dmMember.upsert({
        where: { conversationId_userId: { conversationId, userId: f.userId } },
        create: { conversationId, userId: f.userId, status: f.request ? 'REQUEST' : 'ACTIVE', joinedAt: new Date() },
        update: { status: f.request ? 'REQUEST' : 'ACTIVE', role: 'MEMBER', joinedAt: new Date(), clearedAt: new Date() },
      });
      await this.system(conversationId, userId, `${await this.nameOf(userId)}, ${await this.nameOf(f.userId)} kişisini ekledi`, [...current, f.userId]);
    }
    return this.detail(userId, conversationId);
  }

  async removeMember(userId: string, conversationId: string, memberId: string) {
    const m = await this.admin(userId, conversationId);
    if (memberId === userId) throw badRequest('USE_LEAVE', 'Gruptan çıkmak için "Gruptan ayrıl"ı kullan.');
    const target = m.conversation.members.find((x) => x.userId === memberId && (x.status === 'ACTIVE' || x.status === 'REQUEST'));
    if (!target) throw notFound('MEMBER_NOT_FOUND', 'Bu kişi grupta değil.');
    await this.prisma.dmMember.update({ where: { conversationId_userId: { conversationId, userId: memberId } }, data: { status: 'REMOVED', role: 'MEMBER' } });
    await this.system(conversationId, userId, `${await this.nameOf(userId)}, ${await this.nameOf(memberId)} kişisini çıkardı`, this.activeIds(m.conversation.members));
    return this.detail(userId, conversationId);
  }

  async setAdmin(userId: string, conversationId: string, memberId: string, isAdmin: boolean) {
    const m = await this.admin(userId, conversationId);
    if (!m.conversation.members.some((x) => x.userId === memberId && x.status === 'ACTIVE')) throw notFound('MEMBER_NOT_FOUND', 'Bu kişi grupta değil.');
    if (!isAdmin && m.conversation.members.filter((x) => x.role === 'ADMIN' && x.status === 'ACTIVE').length <= 1) throw conflict('LAST_ADMIN', 'Grupta en az bir yönetici kalmalı.');
    await this.prisma.dmMember.update({ where: { conversationId_userId: { conversationId, userId: memberId } }, data: { role: isAdmin ? 'ADMIN' : 'MEMBER' } });
    return this.detail(userId, conversationId);
  }

  async rename(userId: string, conversationId: string, title: string) {
    const m = await this.admin(userId, conversationId);
    const name = title.trim().slice(0, 60);
    if (!name) throw badRequest('TITLE_REQUIRED', 'Grup adı yaz.');
    await this.prisma.dmConversation.update({ where: { id: conversationId }, data: { title: name } });
    await this.system(conversationId, userId, `${await this.nameOf(userId)} grup adını "${name}" yaptı`, this.activeIds(m.conversation.members));
    return this.detail(userId, conversationId);
  }

  async setGroupPhoto(userId: string, conversationId: string, file: UploadedFileLike | undefined) {
    const m = await this.admin(userId, conversationId);
    const saved = await this.media.saveImage(userId, file, 'GROUP');
    const before = await this.prisma.dmConversation.findUniqueOrThrow({ where: { id: conversationId }, select: { avatarFileId: true } });
    await this.prisma.dmConversation.update({ where: { id: conversationId }, data: { avatarFileId: saved.id } });
    if (before.avatarFileId) await this.prisma.file.deleteMany({ where: { id: before.avatarFileId, purpose: 'GROUP' } });
    this.events.emit(this.activeIds(m.conversation.members), { type: 'conversation', conversationId });
    return this.detail(userId, conversationId);
  }

  // Gruptan ayrıl: son yönetici ayrılırsa en eski üye yönetici olur
  async leave(userId: string, conversationId: string) {
    const m = await this.membership(userId, conversationId);
    if (m.conversation.kind !== 'GROUP') throw badRequest('NOT_GROUP', 'İki kişilik sohbetten ayrılamazsın; sohbeti silebilirsin.');
    await this.prisma.dmMember.update({ where: { conversationId_userId: { conversationId, userId } }, data: { status: 'LEFT', role: 'MEMBER' } });
    const rest = m.conversation.members.filter((x) => x.userId !== userId && x.status === 'ACTIVE').sort((a, b) => a.joinedAt.getTime() - b.joinedAt.getTime());
    if (m.role === 'ADMIN' && rest.length && !rest.some((x) => x.role === 'ADMIN')) {
      await this.prisma.dmMember.update({ where: { conversationId_userId: { conversationId, userId: rest[0]!.userId } }, data: { role: 'ADMIN' } });
    }
    await this.system(conversationId, userId, `${await this.nameOf(userId)} gruptan ayrıldı`, rest.map((x) => x.userId));
    return { left: true };
  }
}
