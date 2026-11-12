// Salon dersleri, katılım, ekip görevleri ve vardiyalar. Yetki görev bazlıdır (gym-rules.ts, lessons.service.ts).
import { Body, Controller, Delete, Get, HttpCode, Inject, Param, Patch, Post, Put, Query, UseGuards } from '@nestjs/common';
import { z } from 'zod';
import { badRequest } from '../../common/app-error.js';
import { AuthGuard, CurrentUser, type AuthUser } from '../auth/auth.guard.js';
import { LessonsService, type LessonInput } from './lessons.service.js';
import { WorkService } from './work.service.js';

const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Tarih YYYY-AA-GG olmalı');
const time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Saat SS:DD olmalı');
const flag = z.enum(['true', 'false']).default('false').transform((v) => v === 'true');

const lessonsQuery = z.object({ from: day, to: day, mine: flag });
const lessonSchema = z.object({
  kind: z.enum(['GROUP', 'PRIVATE']),
  title: z.string().trim().max(60).optional(),
  trainerId: z.string().min(1).max(64),
  date: day,
  startTime: time,
  durationMin: z.number().int().min(15).max(240),
  capacity: z.number().int().min(1).max(200).optional(),
  memberId: z.string().min(1).max(64).optional(),
  repeatWeeks: z.number().int().min(1).max(12).optional(),
});
const cancelSchema = z.object({ reason: z.string().trim().min(3, 'Gerekçeyi yaz').max(300), wholeSeries: z.boolean().default(false) });
const bookSchema = z.object({ memberId: z.string().min(1).max(64) });
const markSchema = z.object({ status: z.enum(['BOOKED', 'ATTENDED', 'NO_SHOW']) });
const tasksQuery = z.object({ status: z.enum(['open', 'done', 'all']).default('open'), mine: flag });
const taskSchema = z.object({ title: z.string().trim().min(2, 'Görevi yaz').max(120), assigneeId: z.string().min(1).max(64), dueDate: day.optional() });
const taskPatchSchema = z.object({
  title: z.string().trim().min(2).max(120).optional(),
  assigneeId: z.string().min(1).max(64).optional(),
  dueDate: day.nullable().optional(),
});
const doneSchema = z.object({ done: z.boolean() });
const shiftSchema = z.object({ shift: z.object({ start: time, end: time }).nullable() });

@Controller('gym')
@UseGuards(AuthGuard)
export class GymWorkController {
  constructor(
    @Inject(LessonsService) private readonly lessons: LessonsService,
    @Inject(WorkService) private readonly work: WorkService,
  ) {}

  // ───── Dersler ─────
  // GET /api/gym/lessons?from=&to=&mine= → takvim (en fazla 42 gün)
  @Get('lessons')
  listLessons(@CurrentUser() user: AuthUser, @Query({ schema: lessonsQuery }) query: { from: string; to: string; mine: boolean }) {
    return this.lessons.list(user.userId, query);
  }

  @Post('lessons')
  @HttpCode(201)
  createLesson(@CurrentUser() user: AuthUser, @Body({ schema: lessonSchema }) body: LessonInput) {
    return this.lessons.create(user.userId, body);
  }

  @Get('lessons/:id')
  lesson(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.lessons.detail(user.userId, id);
  }

  @Post('lessons/:id/cancel')
  @HttpCode(200)
  cancelLesson(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body({ schema: cancelSchema }) body: { reason: string; wholeSeries: boolean }) {
    return this.lessons.cancel(user.userId, id, body.reason, body.wholeSeries);
  }

  @Post('lessons/:id/bookings')
  @HttpCode(201)
  book(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body({ schema: bookSchema }) body: { memberId: string }) {
    return this.lessons.book(user.userId, id, body.memberId);
  }

  @Post('bookings/:id/cancel')
  @HttpCode(200)
  unbook(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.lessons.unbook(user.userId, id);
  }

  // POST /api/gym/bookings/:id/mark { status } → katıldı / gelmedi / işareti geri al
  @Post('bookings/:id/mark')
  @HttpCode(200)
  mark(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body({ schema: markSchema }) body: { status: 'BOOKED' | 'ATTENDED' | 'NO_SHOW' }) {
    return this.lessons.mark(user.userId, id, body.status);
  }

  @Get('members/:id/lessons')
  memberLessons(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.lessons.memberLessons(user.userId, id);
  }

  // ───── Görevler ─────
  @Get('tasks')
  tasks(@CurrentUser() user: AuthUser, @Query({ schema: tasksQuery }) query: { status: 'open' | 'done' | 'all'; mine: boolean }) {
    return this.work.listTasks(user.userId, query);
  }

  @Post('tasks')
  @HttpCode(201)
  createTask(@CurrentUser() user: AuthUser, @Body({ schema: taskSchema }) body: { title: string; assigneeId: string; dueDate?: string }) {
    return this.work.createTask(user.userId, body);
  }

  @Patch('tasks/:id')
  updateTask(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body({ schema: taskPatchSchema }) body: { title?: string; assigneeId?: string; dueDate?: string | null }) {
    return this.work.updateTask(user.userId, id, body);
  }

  @Delete('tasks/:id')
  removeTask(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.work.removeTask(user.userId, id);
  }

  @Post('tasks/:id/done')
  @HttpCode(200)
  setDone(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body({ schema: doneSchema }) body: { done: boolean }) {
    return this.work.setDone(user.userId, id, body.done);
  }

  // ───── Vardiyalar ─────
  @Get('shifts')
  shifts(@CurrentUser() user: AuthUser) {
    return this.work.listShifts(user.userId);
  }

  // PUT /api/gym/shifts/:userId/:weekday { shift: { start, end } | null } (0 = Pazartesi)
  @Put('shifts/:userId/:weekday')
  setShift(
    @CurrentUser() user: AuthUser,
    @Param('userId') targetUserId: string,
    @Param('weekday') weekday: string,
    @Body({ schema: shiftSchema }) body: { shift: { start: string; end: string } | null },
  ) {
    const w = Number(weekday);
    if (!/^[0-6]$/.test(weekday)) throw badRequest('INVALID_WEEKDAY', 'Gün 0 (Pazartesi) ile 6 (Pazar) arasında olmalı.');
    return this.work.setShift(user.userId, targetUserId, w, body.shift);
  }
}
