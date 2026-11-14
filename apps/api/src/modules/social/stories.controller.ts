// Hikâye ve yakın arkadaş adresleri.
import { Body, Controller, Delete, Get, HttpCode, Inject, Param, Post, Query, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { z } from 'zod';
import { AuthGuard, CurrentUser, type AuthUser } from '../auth/auth.guard.js';
import type { UploadedFileLike } from '../files/documents.service.js';
import { MAX_VIDEO_BYTES } from '../media/media.service.js';
import { MAX_STORY_TEXT, STORY_BACKGROUNDS, StoriesService, type StoryInput } from './stories.service.js';

const createSchema = z.object({
  mediaId: z.string().min(1).max(60).nullable().optional(),
  text: z.string().max(MAX_STORY_TEXT).nullable().optional(),
  background: z.enum(STORY_BACKGROUNDS).nullable().optional(),
  audience: z.enum(['EVERYONE', 'FOLLOWERS', 'CLOSE_FRIENDS']).optional(),
  poll: z.object({ question: z.string().min(1).max(80), options: z.tuple([z.string().min(1).max(30), z.string().min(1).max(30)]) }).nullable().optional(),
  question: z.string().max(80).nullable().optional(),
  mentions: z.array(z.string().max(31)).max(10).optional(),
  link: z.object({ url: z.string().max(300).regex(/^https?:\/\/[^\s]+$/i, 'Bağlantı http:// ya da https:// ile başlamalı'), label: z.string().max(40).nullable().optional() }).nullable().optional(),
  location: z.string().max(60).nullable().optional(),
  achievement: z
    .object({ kind: z.enum(['LIBRARY_PROGRAM_COMPLETED', 'LIBRARY_DAY_DONE']), enrollmentId: z.string().min(1).max(60), dayIndex: z.number().int().min(0).max(500).optional() })
    .nullable()
    .optional(),
});
const reactSchema = z.object({ emoji: z.string().max(8).nullable() });
const voteSchema = z.object({ option: z.number().int().min(0).max(1) });
const answerSchema = z.object({ text: z.string().min(1).max(300) });
const pageQuery = z.object({ cursor: z.string().max(200).optional() });

@Controller('social')
@UseGuards(AuthGuard)
export class StoriesController {
  constructor(@Inject(StoriesService) private readonly stories: StoriesService) {}

  // POST /api/social/stories/media (çok parçalı, alan adı "file") → hikâye fotoğrafı/videosu
  @Post('stories/media')
  @HttpCode(201)
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: MAX_VIDEO_BYTES + 1024, files: 1 } }))
  upload(@CurrentUser() user: AuthUser, @UploadedFile() file: UploadedFileLike | undefined) {
    return this.stories.uploadMedia(user.userId, file);
  }

  @Get('stories/achievements')
  achievements(@CurrentUser() user: AuthUser) {
    return this.stories.achievements(user.userId);
  }

  @Post('stories')
  @HttpCode(201)
  create(@CurrentUser() user: AuthUser, @Body({ schema: createSchema }) body: StoryInput) {
    return this.stories.create(user.userId, body);
  }

  // GET /api/social/stories/tray → hikâye şeridi
  @Get('stories/tray')
  tray(@CurrentUser() user: AuthUser) {
    return this.stories.tray(user.userId);
  }

  @Get('stories/archive')
  archive(@CurrentUser() user: AuthUser, @Query({ schema: pageQuery }) q: { cursor?: string }) {
    return this.stories.archive(user.userId, q.cursor);
  }

  @Get('users/:id/stories')
  byUser(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.stories.byUser(user.userId, id);
  }

  @Get('stories/:id')
  get(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.stories.get(user.userId, id);
  }

  @Delete('stories/:id')
  remove(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.stories.remove(user.userId, id);
  }

  @Post('stories/:id/view')
  @HttpCode(200)
  view(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.stories.view(user.userId, id);
  }

  @Post('stories/:id/react')
  @HttpCode(200)
  react(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body({ schema: reactSchema }) body: { emoji: string | null }) {
    return this.stories.react(user.userId, id, body.emoji);
  }

  @Post('stories/:id/vote')
  @HttpCode(200)
  vote(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body({ schema: voteSchema }) body: { option: number }) {
    return this.stories.vote(user.userId, id, body.option);
  }

  @Post('stories/:id/answer')
  @HttpCode(201)
  answer(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body({ schema: answerSchema }) body: { text: string }) {
    return this.stories.answer(user.userId, id, body.text);
  }

  // GET /api/social/stories/:id/insights → izleyenler ve yanıtlar (sadece sahibi)
  @Get('stories/:id/insights')
  insights(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.stories.insights(user.userId, id);
  }

  // ───── Yakın arkadaşlar ─────

  @Get('close-friends')
  closeFriends(@CurrentUser() user: AuthUser) {
    return this.stories.closeFriends(user.userId);
  }

  @Post('close-friends/:id')
  @HttpCode(200)
  addClose(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.stories.setCloseFriend(user.userId, id, true);
  }

  @Delete('close-friends/:id')
  removeClose(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.stories.setCloseFriend(user.userId, id, false);
  }
}
