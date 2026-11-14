// Gönderi, beğeni, yorum, kaydetme ve sabitleme adresleri.
import { Body, Controller, Delete, Get, HttpCode, Inject, Param, Patch, Post, Query, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { z } from 'zod';
import { AuthGuard, CurrentUser, type AuthUser } from '../auth/auth.guard.js';
import type { UploadedFileLike } from '../files/documents.service.js';
import { MAX_VIDEO_BYTES } from '../media/media.service.js';
import { MAX_COMMENT_TEXT, MAX_POST_TEXT } from './post-text.js';
import { MAX_POST_MEDIA, PostsService } from './posts.service.js';

const pageQuery = z.object({ cursor: z.string().max(200).optional() });
const createSchema = z.object({
  text: z.string().max(MAX_POST_TEXT).nullable().optional(),
  mediaIds: z.array(z.string().min(1).max(60)).max(MAX_POST_MEDIA).optional(),
  quotedPostId: z.string().min(1).max(60).nullable().optional(),
});
const editSchema = z.object({ text: z.string().max(MAX_POST_TEXT).nullable() });
const commentSchema = z.object({ text: z.string().min(1).max(MAX_COMMENT_TEXT), parentId: z.string().min(1).max(60).nullable().optional() });

type CreateBody = z.infer<typeof createSchema>;

@Controller('social')
@UseGuards(AuthGuard)
export class PostsController {
  constructor(@Inject(PostsService) private readonly posts: PostsService) {}

  // POST /api/social/media (çok parçalı, alan adı "file") → gönderi fotoğrafı/videosu yükle; dönen id gönderide kullanılır
  @Post('media')
  @HttpCode(201)
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: MAX_VIDEO_BYTES + 1024, files: 1 } }))
  upload(@CurrentUser() user: AuthUser, @UploadedFile() file: UploadedFileLike | undefined) {
    return this.posts.uploadMedia(user.userId, file);
  }

  @Post('posts')
  @HttpCode(201)
  create(@CurrentUser() user: AuthUser, @Body({ schema: createSchema }) body: CreateBody) {
    return this.posts.create(user.userId, body);
  }

  @Get('posts/:id')
  get(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.posts.get(user.userId, id);
  }

  // PATCH /api/social/posts/:id { text } → açıklamayı düzenle
  @Patch('posts/:id')
  edit(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body({ schema: editSchema }) body: { text: string | null }) {
    return this.posts.edit(user.userId, id, body.text);
  }

  @Delete('posts/:id')
  remove(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.posts.remove(user.userId, id);
  }

  @Post('posts/:id/pin')
  @HttpCode(200)
  pin(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.posts.pin(user.userId, id, true);
  }

  @Delete('posts/:id/pin')
  unpin(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.posts.pin(user.userId, id, false);
  }

  @Post('posts/:id/like')
  @HttpCode(200)
  like(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.posts.like(user.userId, id, true);
  }

  @Delete('posts/:id/like')
  unlike(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.posts.like(user.userId, id, false);
  }

  @Get('posts/:id/likes')
  likers(@CurrentUser() user: AuthUser, @Param('id') id: string, @Query({ schema: pageQuery }) q: { cursor?: string }) {
    return this.posts.likers(user.userId, id, q.cursor);
  }

  @Post('posts/:id/save')
  @HttpCode(200)
  save(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.posts.save(user.userId, id, true);
  }

  @Delete('posts/:id/save')
  unsave(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.posts.save(user.userId, id, false);
  }

  @Get('saved')
  saved(@CurrentUser() user: AuthUser, @Query({ schema: pageQuery }) q: { cursor?: string }) {
    return this.posts.saved(user.userId, q.cursor);
  }

  @Get('users/:id/posts')
  byUser(@CurrentUser() user: AuthUser, @Param('id') id: string, @Query({ schema: pageQuery }) q: { cursor?: string }) {
    return this.posts.byUser(user.userId, id, q.cursor);
  }

  // ───── Yorumlar ─────

  @Get('posts/:id/comments')
  comments(@CurrentUser() user: AuthUser, @Param('id') id: string, @Query({ schema: pageQuery }) q: { cursor?: string }) {
    return this.posts.comments(user.userId, id, null, q.cursor);
  }

  @Get('posts/:id/comments/:commentId/replies')
  replies(@CurrentUser() user: AuthUser, @Param('id') id: string, @Param('commentId') commentId: string, @Query({ schema: pageQuery }) q: { cursor?: string }) {
    return this.posts.comments(user.userId, id, commentId, q.cursor);
  }

  @Post('posts/:id/comments')
  @HttpCode(201)
  comment(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body({ schema: commentSchema }) body: { text: string; parentId?: string | null }) {
    return this.posts.comment(user.userId, id, body.text, body.parentId);
  }

  @Delete('comments/:id')
  removeComment(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.posts.removeComment(user.userId, id);
  }
}
