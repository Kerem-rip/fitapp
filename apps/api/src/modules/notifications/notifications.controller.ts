import { Body, Controller, Get, HttpCode, Inject, Post, Query, UseGuards } from '@nestjs/common';
import { z } from 'zod';
import { AuthGuard, CurrentUser, type AuthUser } from '../auth/auth.guard.js';
import { NotificationsService } from './notifications.service.js';

const listSchema = z.object({ limit: z.coerce.number().int().min(1).max(100).default(50) });
const readSchema = z.object({ ids: z.array(z.string().min(1).max(64)).max(100).optional() });

@Controller('notifications')
@UseGuards(AuthGuard)
export class NotificationsController {
  constructor(@Inject(NotificationsService) private readonly notifications: NotificationsService) {}

  // GET /api/notifications?limit=50 → en yeniden eskiye, okunur metinle
  @Get()
  async list(@CurrentUser() user: AuthUser, @Query({ schema: listSchema }) query: { limit: number }) {
    const [items, unread] = await Promise.all([this.notifications.list(user.userId, query.limit), this.notifications.unreadCount(user.userId)]);
    return { unread, items };
  }

  // POST /api/notifications/read { ids? } → verilenleri (boşsa hepsini) okundu yap
  @Post('read')
  @HttpCode(200)
  read(@CurrentUser() user: AuthUser, @Body({ schema: readSchema }) body: { ids?: string[] }) {
    return this.notifications.markRead(user.userId, body.ids);
  }
}
