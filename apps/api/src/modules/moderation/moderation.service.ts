// Moderasyon: şikâyet, inceleme kuyruğu, içerik kaldırma, itiraz ve kayıt defteri.
// - Herkes gördüğü gönderi, yorum, hikâye, kişi ya da kendisine gelen mesajı şikâyet edebilir.
// - Moderatör kuyruğu görür; branş moderatörü sadece kendi spor branşlarındaki kişilerin içeriklerini görür.
// - Özel mesaj gizliliği: moderatör sadece şikâyet edilen mesajın kendisini görebilir (sohbetin geri kalanını göremez)
//   ve her görüntüleme kayıt defterine yazılır.
// - Kaldırılan içeriğin sahibi bilgilendirilir ve bir kez itiraz edebilir; itiraz kabul edilirse içerik geri gelir.
// - Her moderasyon işlemi (görüntüleme, kaldırma, reddetme, itiraz kararı) silinmeyen kayıt defterine yazılır.
import { Inject, Injectable } from '@nestjs/common';
import { badRequest, conflict, forbidden, notFound, tooMany } from '../../common/app-error.js';
import { PrismaService } from '../../common/prisma/prisma.service.js';
import type { ReportStatus, ReportTargetType } from '../../generated/prisma/enums.js';
import { NotifyService } from '../notifications/notify.service.js';
import { PostsService } from '../social/posts.service.js';
import { StoriesService } from '../social/stories.service.js';

export const REPORT_REASONS = ['SPAM', 'HARASSMENT', 'HATE', 'NUDITY', 'VIOLENCE', 'SELF_HARM', 'MISINFORMATION', 'IMPERSONATION', 'OTHER'] as const;
export type ReportReason = (typeof REPORT_REASONS)[number];
export const SOCIAL_TARGETS = ['POST', 'COMMENT', 'STORY', 'USER', 'DM_MESSAGE'] as const;
export type SocialTarget = (typeof SOCIAL_TARGETS)[number];
// İtiraz edilebilen (kaldırılabilen) içerik türleri
export const CONTENT_TARGETS = ['POST', 'COMMENT', 'STORY'] as const;
export type ContentTarget = (typeof CONTENT_TARGETS)[number];

const MAX_REPORTS_PER_DAY = 20;

@Injectable()
export class ModerationService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(PostsService) private readonly posts: PostsService,
    @Inject(StoriesService) private readonly stories: StoriesService,
    @Inject(NotifyService) private readonly notify: NotifyService,
  ) {}

  // ───── Şikâyet ─────

  // Şikâyet edilen şeyin sahibi; şikâyet eden onu görebiliyor olmalı
  private async ownerOf(reporterId: string, type: SocialTarget, id: string): Promise<string> {
    switch (type) {
      case 'POST':
        return (await this.posts.get(reporterId, id)).author.id;
      case 'STORY':
        return (await this.stories.get(reporterId, id)).author.id;
      case 'COMMENT': {
        const c = await this.prisma.postComment.findFirst({ where: { id, deletedAt: null, removedAt: null }, select: { authorId: true, postId: true } });
        if (!c) throw notFound('TARGET_NOT_FOUND', 'Yorum bulunamadı.');
        await this.posts.get(reporterId, c.postId);
        return c.authorId;
      }
      case 'USER': {
        const u = await this.prisma.user.findFirst({ where: { id, deletionRequestedAt: null }, select: { id: true } });
        if (!u) throw notFound('TARGET_NOT_FOUND', 'Kişi bulunamadı.');
        return u.id;
      }
      case 'DM_MESSAGE': {
        // Sadece içinde bulunduğun sohbetteki, başkasının yazdığı mesaj
        const m = await this.prisma.dmMessage.findFirst({
          where: { id, unsentAt: null, conversation: { members: { some: { userId: reporterId, status: { in: ['ACTIVE', 'REQUEST'] } } } } },
          select: { senderId: true },
        });
        if (!m) throw notFound('TARGET_NOT_FOUND', 'Mesaj bulunamadı.');
        return m.senderId;
      }
    }
  }

  async report(reporterId: string, input: { targetType: SocialTarget; targetId: string; reason: ReportReason; details?: string | null }) {
    const ownerId = await this.ownerOf(reporterId, input.targetType, input.targetId);
    if (ownerId === reporterId) throw badRequest('OWN_CONTENT', 'Kendi içeriğini şikâyet edemezsin.');
    const [dup, today] = await Promise.all([
      this.prisma.report.count({ where: { reporterId, targetType: input.targetType, targetId: input.targetId, status: 'OPEN' } }),
      this.prisma.report.count({ where: { reporterId, createdAt: { gte: new Date(Date.now() - 86_400_000) } } }),
    ]);
    if (dup > 0) throw conflict('ALREADY_REPORTED', 'Bunu zaten şikâyet ettin; inceleniyor.');
    if (today >= MAX_REPORTS_PER_DAY) throw tooMany('TOO_MANY_REPORTS', 'Bugün çok fazla şikâyet gönderdin. Yarın tekrar dene.');
    const owner = await this.prisma.profile.findUnique({ where: { userId: ownerId }, select: { sports: true } });
    const r = await this.prisma.report.create({
      data: { reporterId, targetType: input.targetType, targetId: input.targetId, reason: input.reason, details: input.details?.trim() || null, targetUserId: ownerId, branches: owner?.sports ?? [] },
      select: { id: true },
    });
    return { id: r.id, received: true };
  }

  // ───── Moderatör: kuyruk ─────

  // Genel moderatör ve yönetici her şeyi görür; branş moderatörü sadece kendi branşlarını
  private async scope(moderatorId: string): Promise<string[] | null> {
    const [isAdmin, branches] = await Promise.all([
      this.prisma.userRole.count({ where: { userId: moderatorId, role: 'ADMIN' } }),
      this.prisma.moderatorBranch.findMany({ where: { userId: moderatorId }, select: { sportId: true } }),
    ]);
    return isAdmin > 0 || branches.length === 0 ? null : branches.map((b) => b.sportId);
  }

  async queue(moderatorId: string, status: ReportStatus) {
    const scope = await this.scope(moderatorId);
    const rows = await this.prisma.report.findMany({
      where: { status, targetType: { in: [...SOCIAL_TARGETS] }, ...(scope ? { branches: { hasSome: scope } } : {}) },
      orderBy: { createdAt: 'asc' },
      take: 100,
      select: { id: true, targetType: true, targetId: true, reason: true, details: true, status: true, createdAt: true, targetUserId: true, branches: true, resolutionNote: true },
    });
    const users = await this.prisma.user.findMany({ where: { id: { in: rows.flatMap((r) => (r.targetUserId ? [r.targetUserId] : [])) } }, select: { id: true, username: true } });
    // Aynı içerik için kaç açık şikâyet var
    const counts = new Map<string, number>();
    for (const r of rows) counts.set(`${r.targetType}:${r.targetId}`, (counts.get(`${r.targetType}:${r.targetId}`) ?? 0) + 1);
    return rows.map((r) => ({
      ...r,
      createdAt: r.createdAt.toISOString(),
      targetUsername: users.find((u) => u.id === r.targetUserId)?.username ?? null,
      sameTargetReports: counts.get(`${r.targetType}:${r.targetId}`) ?? 1,
    }));
  }

  private async scopedReport(moderatorId: string, reportId: string) {
    const r = await this.prisma.report.findUnique({ where: { id: reportId } });
    if (!r || !(SOCIAL_TARGETS as readonly string[]).includes(r.targetType)) throw notFound('REPORT_NOT_FOUND', 'Şikâyet bulunamadı.');
    const scope = await this.scope(moderatorId);
    if (scope && !r.branches.some((b) => scope.includes(b))) throw forbidden('OUT_OF_BRANCH', 'Bu şikâyet senin branşında değil.');
    return r;
  }

  // Şikâyet edilen içeriğin kendisi (moderatörün karar vermesi için). Özel mesajda sadece o mesaj.
  private async content(type: ReportTargetType, id: string) {
    switch (type) {
      case 'POST': {
        const p = await this.prisma.post.findUnique({ where: { id }, select: { text: true, createdAt: true, deletedAt: true, removedAt: true, media: { select: { fileId: true, kind: true } } } });
        return p ? { text: p.text, mediaCount: p.media.length, createdAt: p.createdAt.toISOString(), deleted: p.deletedAt !== null, removed: p.removedAt !== null } : null;
      }
      case 'COMMENT': {
        const c = await this.prisma.postComment.findUnique({ where: { id }, select: { text: true, createdAt: true, deletedAt: true, removedAt: true } });
        return c ? { text: c.text, mediaCount: 0, createdAt: c.createdAt.toISOString(), deleted: c.deletedAt !== null, removed: c.removedAt !== null } : null;
      }
      case 'STORY': {
        const s = await this.prisma.story.findUnique({ where: { id }, select: { text: true, createdAt: true, deletedAt: true, removedAt: true, fileId: true } });
        return s ? { text: s.text, mediaCount: s.fileId ? 1 : 0, createdAt: s.createdAt.toISOString(), deleted: s.deletedAt !== null, removed: s.removedAt !== null } : null;
      }
      case 'DM_MESSAGE': {
        const m = await this.prisma.dmMessage.findUnique({ where: { id }, select: { text: true, createdAt: true, unsentAt: true, kind: true, fileId: true } });
        return m ? { text: m.text, mediaCount: m.fileId ? 1 : 0, createdAt: m.createdAt.toISOString(), deleted: false, removed: m.unsentAt !== null } : null;
      }
      default:
        return null;
    }
  }

  private log(moderatorId: string, action: string, targetType: string, targetId: string, targetUserId: string | null, reportId: string | null, note?: string | null) {
    return this.prisma.moderationAction.create({ data: { moderatorId, action, targetType, targetId, targetUserId, reportId, note: note ?? null } });
  }

  async reportDetail(moderatorId: string, reportId: string) {
    const r = await this.scopedReport(moderatorId, reportId);
    const content = await this.content(r.targetType, r.targetId);
    // Özel mesajın moderatörce görüntülenmesi kayda geçer
    if (r.targetType === 'DM_MESSAGE') await this.log(moderatorId, 'VIEW_REPORTED_MESSAGE', r.targetType, r.targetId, r.targetUserId, r.id);
    const [owner, reporter] = await Promise.all([
      r.targetUserId ? this.prisma.user.findUnique({ where: { id: r.targetUserId }, select: { id: true, username: true } }) : null,
      this.prisma.user.findUnique({ where: { id: r.reporterId }, select: { username: true } }),
    ]);
    return {
      id: r.id,
      targetType: r.targetType,
      targetId: r.targetId,
      reason: r.reason,
      details: r.details,
      status: r.status,
      createdAt: r.createdAt.toISOString(),
      owner,
      reporterUsername: reporter?.username ?? null,
      content,
      resolutionNote: r.resolutionNote,
    };
  }

  private async setRemoved(type: ReportTargetType, id: string, removed: boolean) {
    const at = removed ? new Date() : null;
    if (type === 'POST') await this.prisma.post.update({ where: { id }, data: { removedAt: at, ...(removed ? { pinnedAt: null } : {}) } });
    else if (type === 'COMMENT') await this.prisma.postComment.update({ where: { id }, data: { removedAt: at } });
    else if (type === 'STORY') await this.prisma.story.update({ where: { id }, data: { removedAt: at } });
    // Özel mesaj: herkesten kaldırılır (geri getirilemez)
    else if (type === 'DM_MESSAGE' && removed) await this.prisma.dmMessage.update({ where: { id }, data: { unsentAt: at, text: null } });
  }

  // REMOVE: içerik kaldırılır, aynı içerikteki tüm açık şikâyetler kapanır, sahibi bilgilendirilir.
  // DISMISS: kural ihlali yok; şikâyet kapanır.
  async resolve(moderatorId: string, reportId: string, action: 'REMOVE' | 'DISMISS', note?: string | null) {
    const r = await this.scopedReport(moderatorId, reportId);
    if (r.status !== 'OPEN') throw conflict('ALREADY_RESOLVED', 'Bu şikâyet zaten sonuçlanmış.');
    if (action === 'REMOVE') {
      if (r.targetType === 'USER') throw badRequest('NOT_REMOVABLE', 'Kişi şikâyetinde kaldırılacak içerik yok; hesabı yöneticiye bildir ya da şikâyeti kapat.');
      if (!note?.trim()) throw badRequest('NOTE_REQUIRED', 'Kaldırma gerekçesi yaz.');
      await this.setRemoved(r.targetType, r.targetId, true);
      await this.prisma.report.updateMany({
        where: { targetType: r.targetType, targetId: r.targetId, status: 'OPEN' },
        data: { status: 'ACTION_TAKEN', reviewedBy: moderatorId, reviewedAt: new Date(), resolutionNote: note.trim() },
      });
      await this.log(moderatorId, 'REMOVE', r.targetType, r.targetId, r.targetUserId, r.id, note.trim());
      if (r.targetUserId) await this.notify.social(r.targetUserId, 'moderation_removed', null, { targetType: r.targetType, targetId: r.targetId });
    } else {
      await this.prisma.report.update({ where: { id: r.id }, data: { status: 'DISMISSED', reviewedBy: moderatorId, reviewedAt: new Date(), resolutionNote: note?.trim() || null } });
      await this.log(moderatorId, 'DISMISS', r.targetType, r.targetId, r.targetUserId, r.id, note?.trim());
    }
    return this.reportDetail(moderatorId, reportId);
  }

  async actionLog(limit: number) {
    const rows = await this.prisma.moderationAction.findMany({ orderBy: { createdAt: 'desc' }, take: limit });
    const users = await this.prisma.user.findMany({ where: { id: { in: [...new Set(rows.map((r) => r.moderatorId))] } }, select: { id: true, username: true } });
    return rows.map((r) => ({ ...r, createdAt: r.createdAt.toISOString(), moderatorUsername: users.find((u) => u.id === r.moderatorId)?.username ?? null }));
  }

  // Branş ataması (sadece yönetici): boş liste = genel moderatör
  async setBranches(adminId: string, moderatorId: string, sportIds: string[]) {
    if ((await this.prisma.userRole.count({ where: { userId: adminId, role: 'ADMIN' } })) === 0) throw forbidden('ADMIN_ONLY', 'Branş atamasını sadece yönetici yapabilir.');
    if ((await this.prisma.userRole.count({ where: { userId: moderatorId, role: 'MODERATOR' } })) === 0) throw badRequest('NOT_MODERATOR', 'Bu kişi moderatör değil.');
    const unique = [...new Set(sportIds)];
    if ((await this.prisma.sportBranch.count({ where: { id: { in: unique } } })) !== unique.length) throw badRequest('INVALID_SPORT', 'Geçersiz spor branşı.');
    await this.prisma.$transaction([
      this.prisma.moderatorBranch.deleteMany({ where: { userId: moderatorId } }),
      this.prisma.moderatorBranch.createMany({ data: unique.map((sportId) => ({ userId: moderatorId, sportId })) }),
    ]);
    return { userId: moderatorId, branches: unique };
  }

  // ───── Kullanıcı: kaldırılan içeriklerim ve itiraz ─────

  async notices(userId: string) {
    const [posts, comments, stories, appeals] = await Promise.all([
      this.prisma.post.findMany({ where: { authorId: userId, removedAt: { not: null } }, orderBy: { removedAt: 'desc' }, take: 50, select: { id: true, text: true, removedAt: true } }),
      this.prisma.postComment.findMany({ where: { authorId: userId, removedAt: { not: null } }, orderBy: { removedAt: 'desc' }, take: 50, select: { id: true, text: true, removedAt: true } }),
      this.prisma.story.findMany({ where: { authorId: userId, removedAt: { not: null } }, orderBy: { removedAt: 'desc' }, take: 50, select: { id: true, text: true, removedAt: true } }),
      this.prisma.moderationAppeal.findMany({ where: { userId }, select: { targetType: true, targetId: true, status: true, note: true } }),
    ]);
    const item = (targetType: ContentTarget, r: { id: string; text: string | null; removedAt: Date | null }) => {
      const appeal = appeals.find((a) => a.targetType === targetType && a.targetId === r.id);
      return { targetType, targetId: r.id, preview: (r.text ?? '').slice(0, 140), removedAt: r.removedAt!.toISOString(), appeal: appeal ? { status: appeal.status, note: appeal.note } : null };
    };
    return [...posts.map((p) => item('POST', p)), ...comments.map((c) => item('COMMENT', c)), ...stories.map((s) => item('STORY', s))].sort((a, b) => b.removedAt.localeCompare(a.removedAt));
  }

  private async removedOwner(type: ContentTarget, id: string): Promise<string | null> {
    const where = { id, removedAt: { not: null } } as const;
    const row =
      type === 'POST'
        ? await this.prisma.post.findFirst({ where, select: { authorId: true } })
        : type === 'COMMENT'
          ? await this.prisma.postComment.findFirst({ where, select: { authorId: true } })
          : await this.prisma.story.findFirst({ where, select: { authorId: true } });
    return row?.authorId ?? null;
  }

  async appeal(userId: string, input: { targetType: ContentTarget; targetId: string; text: string }) {
    if ((await this.removedOwner(input.targetType, input.targetId)) !== userId) throw notFound('TARGET_NOT_FOUND', 'Kaldırılmış bir içeriğin bulunamadı.');
    const text = input.text.trim();
    if (!text) throw badRequest('TEXT_REQUIRED', 'İtiraz gerekçeni yaz.');
    try {
      const a = await this.prisma.moderationAppeal.create({ data: { userId, targetType: input.targetType, targetId: input.targetId, text }, select: { id: true } });
      return { id: a.id, status: 'OPEN' as const };
    } catch {
      throw conflict('ALREADY_APPEALED', 'Bu içerik için zaten itiraz ettin.');
    }
  }

  async appeals(status: 'OPEN' | 'ACCEPTED' | 'REJECTED') {
    const rows = await this.prisma.moderationAppeal.findMany({ where: { status }, orderBy: { createdAt: 'asc' }, take: 100, include: { user: { select: { username: true } } } });
    const out = [];
    for (const a of rows) {
      out.push({
        id: a.id,
        targetType: a.targetType,
        targetId: a.targetId,
        text: a.text,
        status: a.status,
        note: a.note,
        createdAt: a.createdAt.toISOString(),
        username: a.user.username,
        content: await this.content(a.targetType as ReportTargetType, a.targetId),
      });
    }
    return out;
  }

  // İtiraz kararı: itirazı, içeriği kaldıran moderatörden başka biri karara bağlar
  async decideAppeal(moderatorId: string, appealId: string, accept: boolean, note?: string | null) {
    const a = await this.prisma.moderationAppeal.findUnique({ where: { id: appealId } });
    if (!a) throw notFound('APPEAL_NOT_FOUND', 'İtiraz bulunamadı.');
    if (a.status !== 'OPEN') throw conflict('ALREADY_DECIDED', 'Bu itiraz zaten sonuçlanmış.');
    const remover = await this.prisma.moderationAction.findFirst({ where: { action: 'REMOVE', targetType: a.targetType, targetId: a.targetId }, orderBy: { createdAt: 'desc' }, select: { moderatorId: true } });
    const others = await this.prisma.userRole.count({ where: { role: { in: ['ADMIN', 'MODERATOR'] }, userId: { not: moderatorId } } });
    if (remover?.moderatorId === moderatorId && others > 0) throw forbidden('SAME_MODERATOR', 'İtirazı, içeriği kaldıran kişiden başka bir moderatör karara bağlamalı.');
    await this.prisma.moderationAppeal.update({ where: { id: appealId }, data: { status: accept ? 'ACCEPTED' : 'REJECTED', reviewedBy: moderatorId, reviewedAt: new Date(), note: note?.trim() || null } });
    if (accept) await this.setRemoved(a.targetType as ReportTargetType, a.targetId, false);
    await this.log(moderatorId, accept ? 'APPEAL_ACCEPTED' : 'APPEAL_REJECTED', a.targetType, a.targetId, a.userId, null, note?.trim());
    await this.notify.social(a.userId, accept ? 'moderation_restored' : 'appeal_rejected', null, { targetType: a.targetType, targetId: a.targetId });
    return { id: appealId, status: accept ? ('ACCEPTED' as const) : ('REJECTED' as const) };
  }
}
