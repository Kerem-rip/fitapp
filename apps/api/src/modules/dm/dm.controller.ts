// Sosyal mesajlaşma ve grup adresleri (/api/social/dm/...). Uzman–danışan yazışması bu adreslerden geçmez.
import { Body, Controller, Delete, Get, HttpCode, Inject, Param, Patch, Post, Query, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { SkipThrottle } from '@nestjs/throttler';
import { z } from 'zod';
import { AuthGuard, CurrentUser, type AuthUser } from '../auth/auth.guard.js';
import type { UploadedFileLike } from '../files/documents.service.js';
import { MAX_IMAGE_BYTES, MAX_VIDEO_BYTES } from '../media/media.service.js';
import { DmEventsService } from './dm-events.service.js';
import { DmService, MAX_DM_TEXT, MAX_GROUP_MEMBERS, type SendInput } from './dm.service.js';

const id = z.string().min(1).max(60);
const sendSchema = z.object({
  text: z.string().max(MAX_DM_TEXT).nullable().optional(),
  mediaId: id.nullable().optional(),
  replyToId: id.nullable().optional(),
  postId: id.nullable().optional(),
  storyId: id.nullable().optional(),
});
const groupSchema = z.object({ title: z.string().min(1).max(60), memberIds: z.array(id).min(2).max(MAX_GROUP_MEMBERS - 1) });
const membersSchema = z.object({ memberIds: z.array(id).min(1).max(MAX_GROUP_MEMBERS) });
const renameSchema = z.object({ title: z.string().min(1).max(60) });
const adminSchema = z.object({ admin: z.boolean() });
const muteSchema = z.object({ muted: z.boolean() });
const listQuery = z.object({ box: z.enum(['inbox', 'requests']).default('inbox') });
const pageQuery = z.object({ cursor: z.string().max(200).optional() });
const eventsQuery = z.object({ boot: z.string().max(20).optional(), after: z.coerce.number().int().min(0).default(0) });

@Controller('social/dm')
@UseGuards(AuthGuard)
export class DmController {
  constructor(
    @Inject(DmService) private readonly dm: DmService,
    @Inject(DmEventsService) private readonly events: DmEventsService,
  ) {}

  // GET /api/social/dm/events?boot=&after= → yeni olay gelene kadar (en fazla ~25 sn) bekler
  @Get('events')
  @SkipThrottle()
  async wait(@CurrentUser() user: AuthUser, @Query({ schema: eventsQuery }) q: { boot?: string; after: number }) {
    void this.dm.touch(user.userId);
    if (q.boot !== this.events.boot) return { boot: this.events.boot, seq: this.events.currentSeq, reset: true, events: [] };
    const events = await this.events.wait(user.userId, q.after);
    return { boot: this.events.boot, seq: events.at(-1)?.seq ?? q.after, reset: false, events };
  }

  @Get('conversations')
  list(@CurrentUser() user: AuthUser, @Query({ schema: listQuery }) q: { box: 'inbox' | 'requests' }) {
    return this.dm.list(user.userId, q.box);
  }

  @Get('unread')
  unread(@CurrentUser() user: AuthUser) {
    return this.dm.unreadTotal(user.userId);
  }

  // POST /api/social/dm/direct/:userId → iki kişilik sohbeti aç (yoksa oluşturur)
  @Post('direct/:userId')
  @HttpCode(200)
  direct(@CurrentUser() user: AuthUser, @Param('userId') userId: string) {
    return this.dm.openDirect(user.userId, userId);
  }

  // POST /api/social/dm/users/:userId/messages → kişiye doğrudan gönder (gönderi paylaşma, hikâyeye yanıt)
  @Post('users/:userId/messages')
  @HttpCode(201)
  sendToUser(@CurrentUser() user: AuthUser, @Param('userId') userId: string, @Body({ schema: sendSchema }) body: SendInput) {
    return this.dm.sendToUser(user.userId, userId, body);
  }

  @Post('media')
  @HttpCode(201)
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: MAX_VIDEO_BYTES + 1024, files: 1 } }))
  upload(@CurrentUser() user: AuthUser, @UploadedFile() file: UploadedFileLike | undefined) {
    return this.dm.uploadMedia(user.userId, file);
  }

  @Post('groups')
  @HttpCode(201)
  createGroup(@CurrentUser() user: AuthUser, @Body({ schema: groupSchema }) body: { title: string; memberIds: string[] }) {
    return this.dm.createGroup(user.userId, body.title, body.memberIds);
  }

  @Get('conversations/:id')
  detail(@CurrentUser() user: AuthUser, @Param('id') cid: string) {
    return this.dm.detail(user.userId, cid);
  }

  @Get('conversations/:id/messages')
  messages(@CurrentUser() user: AuthUser, @Param('id') cid: string, @Query({ schema: pageQuery }) q: { cursor?: string }) {
    return this.dm.messages(user.userId, cid, q.cursor);
  }

  @Post('conversations/:id/messages')
  @HttpCode(201)
  send(@CurrentUser() user: AuthUser, @Param('id') cid: string, @Body({ schema: sendSchema }) body: SendInput) {
    return this.dm.send(user.userId, cid, body);
  }

  @Post('conversations/:id/read')
  @HttpCode(200)
  read(@CurrentUser() user: AuthUser, @Param('id') cid: string) {
    return this.dm.markRead(user.userId, cid);
  }

  @Post('conversations/:id/accept')
  @HttpCode(200)
  accept(@CurrentUser() user: AuthUser, @Param('id') cid: string) {
    return this.dm.acceptRequest(user.userId, cid);
  }

  @Post('conversations/:id/decline')
  @HttpCode(200)
  decline(@CurrentUser() user: AuthUser, @Param('id') cid: string) {
    return this.dm.declineRequest(user.userId, cid);
  }

  // Sohbeti benden sil (önceki mesajlar bende görünmez)
  @Post('conversations/:id/clear')
  @HttpCode(200)
  clear(@CurrentUser() user: AuthUser, @Param('id') cid: string) {
    return this.dm.clear(user.userId, cid);
  }

  @Post('conversations/:id/mute')
  @HttpCode(200)
  mute(@CurrentUser() user: AuthUser, @Param('id') cid: string, @Body({ schema: muteSchema }) body: { muted: boolean }) {
    return this.dm.mute(user.userId, cid, body.muted);
  }

  // ───── Mesaj işlemleri ─────

  // Geri al: herkesten kalkar
  @Post('messages/:id/unsend')
  @HttpCode(200)
  unsend(@CurrentUser() user: AuthUser, @Param('id') mid: string) {
    return this.dm.unsend(user.userId, mid);
  }

  // Benden sil
  @Delete('messages/:id')
  hide(@CurrentUser() user: AuthUser, @Param('id') mid: string) {
    return this.dm.hide(user.userId, mid);
  }

  // ───── Grup yönetimi ─────

  @Post('conversations/:id/members')
  @HttpCode(200)
  addMembers(@CurrentUser() user: AuthUser, @Param('id') cid: string, @Body({ schema: membersSchema }) body: { memberIds: string[] }) {
    return this.dm.addMembers(user.userId, cid, body.memberIds);
  }

  @Delete('conversations/:id/members/:userId')
  removeMember(@CurrentUser() user: AuthUser, @Param('id') cid: string, @Param('userId') memberId: string) {
    return this.dm.removeMember(user.userId, cid, memberId);
  }

  @Patch('conversations/:id/members/:userId')
  setAdmin(@CurrentUser() user: AuthUser, @Param('id') cid: string, @Param('userId') memberId: string, @Body({ schema: adminSchema }) body: { admin: boolean }) {
    return this.dm.setAdmin(user.userId, cid, memberId, body.admin);
  }

  @Patch('conversations/:id')
  rename(@CurrentUser() user: AuthUser, @Param('id') cid: string, @Body({ schema: renameSchema }) body: { title: string }) {
    return this.dm.rename(user.userId, cid, body.title);
  }

  @Post('conversations/:id/photo')
  @HttpCode(200)
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: MAX_IMAGE_BYTES + 1024, files: 1 } }))
  photo(@CurrentUser() user: AuthUser, @Param('id') cid: string, @UploadedFile() file: UploadedFileLike | undefined) {
    return this.dm.setGroupPhoto(user.userId, cid, file);
  }

  @Post('conversations/:id/leave')
  @HttpCode(200)
  leave(@CurrentUser() user: AuthUser, @Param('id') cid: string) {
    return this.dm.leave(user.userId, cid);
  }
}
