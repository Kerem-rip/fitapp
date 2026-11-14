// İçerik kütüphanesi ve Programım (kütüphane görevleri) adresleri.
import { Body, Controller, Delete, Get, HttpCode, Inject, Param, Post, Query, UseGuards } from '@nestjs/common';
import { z } from 'zod';
import { AuthGuard, CurrentUser, type AuthUser } from '../auth/auth.guard.js';
import { LibraryService } from './library.service.js';

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
