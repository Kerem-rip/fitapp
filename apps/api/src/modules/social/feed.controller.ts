// Akış, öneriler ve Keşfet (arama, etiket, öne çıkanlar) adresleri.
import { Controller, Get, Inject, Param, Query, UseGuards } from '@nestjs/common';
import { z } from 'zod';
import { AuthGuard, CurrentUser, type AuthUser } from '../auth/auth.guard.js';
import { FeedService, type SearchType } from './feed.service.js';

const feedQuery = z.object({ mode: z.enum(['following', 'for_you']).default('for_you'), cursor: z.string().max(200).optional() });
const searchQuery = z.object({
  q: z.string().max(60).optional(),
  type: z.enum(['all', 'users', 'posts', 'tags', 'pros', 'gyms']).default('all'),
  sport: z.string().max(30).optional(),
  city: z.string().max(60).optional(),
});
const pageQuery = z.object({ cursor: z.string().max(200).optional() });

@Controller('social')
@UseGuards(AuthGuard)
export class FeedController {
  constructor(@Inject(FeedService) private readonly feed: FeedService) {}

  // GET /api/social/feed?mode=for_you|following
  @Get('feed')
  list(@CurrentUser() user: AuthUser, @Query({ schema: feedQuery }) q: { mode: 'following' | 'for_you'; cursor?: string }) {
    return q.mode === 'following' ? this.feed.following(user.userId, q.cursor) : this.feed.forYou(user.userId, q.cursor);
  }

  @Get('suggestions')
  suggestions(@CurrentUser() user: AuthUser) {
    return this.feed.suggestions(user.userId);
  }

  @Get('explore')
  explore(@CurrentUser() user: AuthUser) {
    return this.feed.explore(user.userId);
  }

  // GET /api/social/search?q=&type=all|users|posts|tags|pros|gyms&sport=&city=
  @Get('search')
  search(@CurrentUser() user: AuthUser, @Query({ schema: searchQuery }) q: { q?: string; type: SearchType; sport?: string; city?: string }) {
    return this.feed.search(user.userId, q);
  }

  @Get('tags/:tag/posts')
  tag(@CurrentUser() user: AuthUser, @Param('tag') tag: string, @Query({ schema: pageQuery }) q: { cursor?: string }) {
    return this.feed.tagPosts(user.userId, tag, q.cursor);
  }
}
