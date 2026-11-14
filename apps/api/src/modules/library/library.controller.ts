// İçerik kütüphanesi ve Programım (kütüphane görevleri) adresleri.
import { Body, Controller, Delete, Get, HttpCode, Inject, Param, Post, Query, UseGuards } from '@nestjs/common';
import { z } from 'zod';
import { AuthGuard, CurrentUser, type AuthUser } from '../auth/auth.guard.js';
import { BODY_AREAS, type BodyArea } from '../personal-plan/plan-types.js';
import { LibraryService, parseAvoid } from './library.service.js';

const avoidQuery = z.object({ avoid: z.string().max(100).optional() });
const avoidList = z.array(z.enum(BODY_AREAS)).max(BODY_AREAS.length);
const cardTaskSchema = z.object({ cardId: z.string().min(1).max(60), date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Tarih YYYY-AA-GG olmalı').optional(), avoid: avoidList.optional() });
const completeSchema = z.object({ avoid: avoidList.optional(), completedMoves: z.number().int().min(0).max(60), totalMoves: z.number().int().min(1).max(60) });

const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Tarih YYYY-AA-GG olmalı');
const joinSchema = z.object({ startDate: day.optional() });
const stepSchema = z.object({ dayIndex: z.number().int().min(0).max(500), stepIndex: z.number().int().min(0).max(50), done: z.boolean() });
const taskSchema = z.object({ itemId: z.string().min(1).max(60), date: day.optional() });
const doneSchema = z.object({ done: z.boolean() });
const dayQuery = z.object({ date: day });

@Controller()
@UseGuards(AuthGuard)
export class LibraryController {
  constructor(@Inject(LibraryService) private readonly library: LibraryService) {}

  // GET /api/library → hareket, masaj ve rehber kartları ile ücretsiz programlar
  @Get('library')
  catalog() {
    return this.library.catalog();
  }

  @Get('library/items/:id')
  item(@Param('id') id: string) {
    return this.library.item(id);
  }

  // GET /api/workout-cards?avoid=KNEE,LOW_BACK → antrenman kartları (kısıtlı bölgeyi yükleyen hareketler değiştirilir)
  @Get('workout-cards')
  cards(@Query({ schema: avoidQuery }) q: { avoid?: string }) {
    return this.library.cards(parseAvoid(q.avoid ?? ''));
  }

  @Get('workout-cards/:id')
  card(@Param('id') id: string, @Query({ schema: avoidQuery }) q: { avoid?: string }) {
    return this.library.card(id, parseAvoid(q.avoid ?? ''));
  }

  // POST /api/me/workout-cards/tasks { cardId, date?, avoid? } → "Takvime ekle"
  @Post('me/workout-cards/tasks')
  @HttpCode(201)
  addCardTask(@CurrentUser() user: AuthUser, @Body({ schema: cardTaskSchema }) body: { cardId: string; date?: string; avoid?: BodyArea[] }) {
    return this.library.addCardTask(user.userId, body.cardId, body.date, body.avoid ?? []);
  }

  @Delete('me/workout-cards/tasks/:id')
  removeCardTask(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.library.removeCardTask(user.userId, id);
  }

  @Post('me/workout-cards/tasks/:id/reset')
  @HttpCode(200)
  resetCardTask(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.library.resetCardTask(user.userId, id);
  }

  // POST /api/me/workout-cards/:cardId/complete → "Hemen Başla" bitti; bugünün tamamlama kaydı
  @Post('me/workout-cards/:cardId/complete')
  @HttpCode(200)
  completeCard(@CurrentUser() user: AuthUser, @Param('cardId') cardId: string, @Body({ schema: completeSchema }) body: { avoid?: BodyArea[]; completedMoves: number; totalMoves: number }) {
    return this.library.completeCard(user.userId, cardId, body.avoid ?? [], body.completedMoves, body.totalMoves);
  }

  @Get('library/programs/:id')
  program(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.library.program(user.userId, id);
  }

  // POST /api/library/programs/:id/join { startDate? } → programa katıl
  @Post('library/programs/:id/join')
  @HttpCode(201)
  join(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body({ schema: joinSchema }) body: { startDate?: string }) {
    return this.library.join(user.userId, id, body.startDate);
  }

  @Get('me/library/enrollments')
  enrollments(@CurrentUser() user: AuthUser) {
    return this.library.enrollments(user.userId);
  }

  @Post('me/library/enrollments/:id/leave')
  @HttpCode(200)
  leave(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.library.leave(user.userId, id);
  }

  @Post('me/library/enrollments/:id/steps')
  @HttpCode(200)
  step(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body({ schema: stepSchema }) body: { dayIndex: number; stepIndex: number; done: boolean }) {
    return this.library.setStepDone(user.userId, id, body.dayIndex, body.stepIndex, body.done);
  }

  // POST /api/me/library/tasks { itemId, date? } → "Görevime ekle"
  @Post('me/library/tasks')
  @HttpCode(201)
  addTask(@CurrentUser() user: AuthUser, @Body({ schema: taskSchema }) body: { itemId: string; date?: string }) {
    return this.library.addTask(user.userId, body.itemId, body.date);
  }

  @Delete('me/library/tasks/:id')
  removeTask(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.library.removeTask(user.userId, id);
  }

  @Post('me/library/tasks/:id/done')
  @HttpCode(200)
  taskDone(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body({ schema: doneSchema }) body: { done: boolean }) {
    return this.library.setTaskDone(user.userId, id, body.done);
  }

  // GET /api/me/program?date= → Programım: o günün program adımları ve eklenen görevler
  @Get('me/program')
  day(@CurrentUser() user: AuthUser, @Query({ schema: dayQuery }) query: { date: string }) {
    return this.library.day(user.userId, query.date);
  }
}
