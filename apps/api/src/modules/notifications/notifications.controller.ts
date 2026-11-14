import { Body, Controller, Delete, Get, HttpCode, Inject, Param, Post, Put, Query, UseGuards } from '@nestjs/common';
import { z } from 'zod';
import { badRequest } from '../../common/app-error.js';
import { AuthGuard, CurrentUser, type AuthUser } from '../auth/auth.guard.js';
import { NotificationsService, type Center, type PreferencesInput } from './notifications.service.js';

const center = z.enum(['SOCIAL', 'PRO']).optional();
const listSchema = z.object({ limit: z.coerce.number().int().min(1).max(100).default(50), center });
const readSchema = z.object({ ids: z.array(z.string().min(1).max(64)).max(100).optional(), center });
const hour = z.number().int().min(0).max(23).nullable();
const prefsSchema = z.object({
  likes: z.boolean().optional(),
  comments: z.boolean().optional(),
  follows: z.boolean().optional(),
  mentions: z.boolean().optional(),
  stories: z.boolean().optional(),
  messages: z.boolean().optional(),
  pushEnabled: z.boolean().optional(),
  quietFrom: hour.optional(),
  quietTo: hour.optional(),
});
const deviceSchema = z.object({ token: z.string().min(10).max(300), platform: z.enum(['ios', 'android', 'web']) });

@Controller('notifications')
@UseGuards(AuthGuard)
export class NotificationsController {
  constructor(@Inject(NotificationsService) private readonly notifications: NotificationsService) {}

  // GET /api/notifications?limit=50&center=SOCIAL|PRO → en yeniden eskiye, okunur metinle
  @Get()
  async list(@CurrentUser() user: AuthUser, @Query({ schema: listSchema }) query: { limit: number; center?: Center }) {
    const [items, unread] = await Promise.all([this.notifications.list(user.userId, query.limit, query.center), this.notifications.unreadCount(user.userId, query.center)]);
    return { unread, items };
  }

  // GET /api/notifications/counts → sosyal ve uzman merkezlerinin okunmamış sayıları
  @Get('counts')
  counts(@CurrentUser() user: AuthUser) {
    return this.notifications.counts(user.userId);
  }

  // POST /api/notifications/read { ids?, center? } → verilenleri (boşsa hepsini) okundu yap
  @Post('read')
  @HttpCode(200)
  read(@CurrentUser() user: AuthUser, @Body({ schema: readSchema }) body: { ids?: string[]; center?: Center }) {
    return this.notifications.markRead(user.userId, body.ids, body.center);
  }

  @Get('preferences')
  preferences(@CurrentUser() user: AuthUser) {
    return this.notifications.preferences(user.userId);
  }

  @Put('preferences')
  setPreferences(@CurrentUser() user: AuthUser, @Body({ schema: prefsSchema }) body: PreferencesInput) {
    // Sessiz saat ya ikisi birden verilir ya da ikisi birden kaldırılır
    if ((body.quietFrom === undefined) !== (body.quietTo === undefined) || (body.quietFrom === null) !== (body.quietTo === null)) {
      throw badRequest('INVALID_QUIET_HOURS', 'Sessiz saat için başlangıç ve bitiş birlikte verilmeli.');
    }
    return this.notifications.setPreferences(user.userId, body);
  }

  // POST /api/notifications/devices { token, platform } → anlık bildirim için cihaz kaydı (kişi izin verince)
  @Post('devices')
  @HttpCode(200)
  registerDevice(@CurrentUser() user: AuthUser, @Body({ schema: deviceSchema }) body: { token: string; platform: string }) {
    return this.notifications.registerDevice(user.userId, body.token, body.platform);
  }

  @Delete('devices/:token')
  removeDevice(@CurrentUser() user: AuthUser, @Param('token') token: string) {
    return this.notifications.removeDevice(user.userId, token);
  }
}