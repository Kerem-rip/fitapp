// Şikâyet ve itiraz (herkes) ile moderasyon kuyruğu (yönetici / moderatör) adresleri.
import { Body, Controller, Get, HttpCode, Inject, Param, Post, Put, Query, UseGuards } from '@nestjs/common';
import { z } from 'zod';
import type { ReportStatus } from '../../generated/prisma/enums.js';
import { AdminGuard } from '../admin/admin.guard.js';
import { AuthGuard, CurrentUser, type AuthUser } from '../auth/auth.guard.js';
import { CONTENT_TARGETS, ModerationService, REPORT_REASONS, SOCIAL_TARGETS, type ContentTarget, type ReportReason, type SocialTarget } from './moderation.service.js';

const id = z.string().min(1).max(60);
const reportSchema = z.object({ targetType: z.enum(SOCIAL_TARGETS), targetId: id, reason: z.enum(REPORT_REASONS), details: z.string().max(500).nullable().optional() });
const appealSchema = z.object({ targetType: z.enum(CONTENT_TARGETS), targetId: id, text: z.string().min(1).max(500) });
const queueQuery = z.object({ status: z.enum(['OPEN', 'ACTION_TAKEN', 'DISMISSED']).default('OPEN') });
const resolveSchema = z.object({ action: z.enum(['REMOVE', 'DISMISS']), note: z.string().max(500).nullable().optional() });
const appealsQuery = z.object({ status: z.enum(['OPEN', 'ACCEPTED', 'REJECTED']).default('OPEN') });
const decideSchema = z.object({ accept: z.boolean(), note: z.string().max(500).nullable().optional() });
const branchesSchema = z.object({ sportIds: z.array(z.string().min(1).max(30)).max(18) });
const logQuery = z.object({ limit: z.coerce.number().int().min(1).max(200).default(100) });

@Controller('social')
@UseGuards(AuthGuard)
export class ReportsController {
  constructor(@Inject(ModerationService) private readonly moderation: ModerationService) {}

  // POST /api/social/reports { targetType, targetId, reason, details? }
  @Post('reports')
  @HttpCode(201)
  report(@CurrentUser() user: AuthUser, @Body({ schema: reportSchema }) body: { targetType: SocialTarget; targetId: string; reason: ReportReason; details?: string | null }) {
    return this.moderation.report(user.userId, body);
  }

  // GET /api/social/moderation/notices → kaldırılan içeriklerim ve itiraz durumları
  @Get('moderation/notices')
  notices(@CurrentUser() user: AuthUser) {
    return this.moderation.notices(user.userId);
  }

  @Post('appeals')
  @HttpCode(201)
  appeal(@CurrentUser() user: AuthUser, @Body({ schema: appealSchema }) body: { targetType: ContentTarget; targetId: string; text: string }) {
    return this.moderation.appeal(user.userId, body);
  }
}

@Controller('admin/moderation')
@UseGuards(AdminGuard)
export class ModerationController {
  constructor(@Inject(ModerationService) private readonly moderation: ModerationService) {}

  @Get('reports')
  queue(@CurrentUser() user: AuthUser, @Query({ schema: queueQuery }) q: { status: ReportStatus }) {
    return this.moderation.queue(user.userId, q.status);
  }

  @Get('reports/:id')
  detail(@CurrentUser() user: AuthUser, @Param('id') reportId: string) {
    return this.moderation.reportDetail(user.userId, reportId);
  }

  // POST /api/admin/moderation/reports/:id/resolve { action: REMOVE | DISMISS, note }
  @Post('reports/:id/resolve')
  @HttpCode(200)
  resolve(@CurrentUser() user: AuthUser, @Param('id') reportId: string, @Body({ schema: resolveSchema }) body: { action: 'REMOVE' | 'DISMISS'; note?: string | null }) {
    return this.moderation.resolve(user.userId, reportId, body.action, body.note);
  }

  @Get('appeals')
  appeals(@Query({ schema: appealsQuery }) q: { status: 'OPEN' | 'ACCEPTED' | 'REJECTED' }) {
    return this.moderation.appeals(q.status);
  }

  @Post('appeals/:id/decide')
  @HttpCode(200)
  decide(@CurrentUser() user: AuthUser, @Param('id') appealId: string, @Body({ schema: decideSchema }) body: { accept: boolean; note?: string | null }) {
    return this.moderation.decideAppeal(user.userId, appealId, body.accept, body.note);
  }

  // GET /api/admin/moderation/log → kayıt defteri (kim, neyi, ne zaman)
  @Get('log')
  log(@Query({ schema: logQuery }) q: { limit: number }) {
    return this.moderation.actionLog(q.limit);
  }

  // PUT /api/admin/moderation/moderators/:userId/branches { sportIds } → branş ataması (sadece yönetici)
  @Put('moderators/:userId/branches')
  branches(@CurrentUser() user: AuthUser, @Param('userId') moderatorId: string, @Body({ schema: branchesSchema }) body: { sportIds: string[] }) {
    return this.moderation.setBranches(user.userId, moderatorId, body.sportIds);
  }
}
