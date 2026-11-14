// Takip, takip istekleri, engelleme ve sessize alma adresleri. Kişiler kimlikleriyle (id) belirtilir.
import { Controller, Delete, Get, HttpCode, Inject, Param, Post, Query, UseGuards } from '@nestjs/common';
import { z } from 'zod';
import { AuthGuard, CurrentUser, type AuthUser } from '../auth/auth.guard.js';
import { FollowsService } from './follows.service.js';

const pageQuery = z.object({ cursor: z.string().max(200).optional() });

@Controller('social')
@UseGuards(AuthGuard)
export class FollowsController {
  constructor(@Inject(FollowsService) private readonly follows: FollowsService) {}

  // POST /api/social/users/:id/follow → açık hesapta ACCEPTED, gizli hesapta PENDING (istek)
  @Post('users/:id/follow')
  @HttpCode(200)
  follow(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.follows.follow(user.userId, id);
  }

  // DELETE /api/social/users/:id/follow → takibi bırak ya da isteği geri çek
  @Delete('users/:id/follow')
  unfollow(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.follows.unfollow(user.userId, id);
  }

  // DELETE /api/social/users/:id/follower → takipçiyi çıkar
  @Delete('users/:id/follower')
  removeFollower(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.follows.removeFollower(user.userId, id);
  }

  @Get('users/:id/followers')
  followers(@CurrentUser() user: AuthUser, @Param('id') id: string, @Query({ schema: pageQuery }) q: { cursor?: string }) {
    return this.follows.list(user.userId, id, 'followers', q.cursor);
  }

  @Get('users/:id/following')
  following(@CurrentUser() user: AuthUser, @Param('id') id: string, @Query({ schema: pageQuery }) q: { cursor?: string }) {
    return this.follows.list(user.userId, id, 'following', q.cursor);
  }

  // ───── Gelen takip istekleri ─────

  @Get('follow-requests')
  requests(@CurrentUser() user: AuthUser, @Query({ schema: pageQuery }) q: { cursor?: string }) {
    return this.follows.requests(user.userId, q.cursor);
  }

  @Get('follow-requests/count')
  requestCount(@CurrentUser() user: AuthUser) {
    return this.follows.requestCount(user.userId);
  }

  @Post('follow-requests/:id/accept')
  @HttpCode(200)
  accept(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.follows.accept(user.userId, id);
  }

  @Post('follow-requests/:id/decline')
  @HttpCode(200)
  decline(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.follows.decline(user.userId, id);
  }

  // ───── Engelleme ve sessize alma ─────

  @Post('users/:id/block')
  @HttpCode(200)
  block(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.follows.block(user.userId, id);
  }

  @Delete('users/:id/block')
  unblock(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.follows.unblock(user.userId, id);
  }

  @Get('blocks')
  blocks(@CurrentUser() user: AuthUser) {
    return this.follows.blocks(user.userId);
  }

  @Post('users/:id/mute')
  @HttpCode(200)
  mute(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.follows.mute(user.userId, id);
  }

  @Delete('users/:id/mute')
  unmute(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.follows.unmute(user.userId, id);
  }

  @Get('mutes')
  mutes(@CurrentUser() user: AuthUser) {
    return this.follows.mutes(user.userId);
  }
}
