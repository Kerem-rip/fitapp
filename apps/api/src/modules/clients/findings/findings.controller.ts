// Uzman inceleme özeti adresleri. Maddeleri görmek denetim kaydına yazılır; karar/not/görev işlemleri
// aktif danışanlık ve ilgili paylaşım kategorileri açıkken yapılabilir.
import { Body, Controller, Get, HttpCode, Inject, Param, Post, Query, UseGuards } from '@nestjs/common';
import { z } from 'zod';
import { AuthGuard, CurrentUser, type AuthUser } from '../../auth/auth.guard.js';
import { FINDING_DECISIONS, FindingsService, type FindingDecision } from './findings.service.js';
import { TasksService } from './tasks.service.js';

const dueSchema = z.iso.datetime().transform((v) => new Date(v));
const taskSchema = z.object({ title: z.string().trim().min(2, 'Görevi yaz').max(200), dueAt: dueSchema.optional() });
const viewSchema = z.object({ view: z.enum(['open', 'closed', 'all']).default('open') });
const noteSchema = z.object({ text: z.string().trim().min(1, 'Notu yaz').max(1000) });
const closeSchema = z.object({ decision: z.enum(FINDING_DECISIONS), reason: z.string().trim().min(3, 'Gerekçeni yaz').max(500) });
const taskListSchema = z.object({ status: z.enum(['OPEN', 'DONE']).default('OPEN') });

@Controller('clients/:clientId')
@UseGuards(AuthGuard)
export class FindingsController {
  constructor(
    @Inject(FindingsService) private readonly findings: FindingsService,
    @Inject(TasksService) private readonly tasks: TasksService,
  ) {}

  // GET /api/clients/:clientId/findings?view=open|closed|all
  @Get('findings')
  list(@CurrentUser() user: AuthUser, @Param('clientId') clientId: string, @Query({ schema: viewSchema }) query: { view: 'open' | 'closed' | 'all' }) {
    return this.findings.list(user.userId, clientId, query.view);
  }

  // POST /api/clients/:clientId/findings/:id/notes { text }
  @Post('findings/:id/notes')
  @HttpCode(201)
  note(@CurrentUser() user: AuthUser, @Param('clientId') clientId: string, @Param('id') id: string, @Body({ schema: noteSchema }) body: { text: string }) {
    return this.findings.addNote(user.userId, clientId, id, body.text);
  }

  // POST /api/clients/:clientId/findings/:id/close { decision, reason }
  @Post('findings/:id/close')
  @HttpCode(200)
  close(
    @CurrentUser() user: AuthUser,
    @Param('clientId') clientId: string,
    @Param('id') id: string,
    @Body({ schema: closeSchema }) body: { decision: FindingDecision; reason: string },
  ) {
    return this.findings.close(user.userId, clientId, id, body.decision, body.reason);
  }

  // POST /api/clients/:clientId/findings/:id/reopen
  @Post('findings/:id/reopen')
  @HttpCode(200)
  reopen(@CurrentUser() user: AuthUser, @Param('clientId') clientId: string, @Param('id') id: string) {
    return this.findings.reopen(user.userId, clientId, id);
  }

  // POST /api/clients/:clientId/findings/:id/task { title, dueAt? } → maddeden takip görevi
  @Post('findings/:id/task')
  @HttpCode(201)
  findingTask(
    @CurrentUser() user: AuthUser,
    @Param('clientId') clientId: string,
    @Param('id') id: string,
    @Body({ schema: taskSchema }) body: { title: string; dueAt?: Date },
  ) {
    return this.findings.createTask(user.userId, clientId, id, body);
  }

  // GET /api/clients/:clientId/tasks?status=OPEN
  @Get('tasks')
  clientTasks(@CurrentUser() user: AuthUser, @Param('clientId') clientId: string, @Query({ schema: taskListSchema }) query: { status: 'OPEN' | 'DONE' }) {
    return this.tasks.list(user.userId, { status: query.status, clientId });
  }

  // POST /api/clients/:clientId/tasks { title, dueAt? } → kendiliğinden takip görevi
  @Post('tasks')
  @HttpCode(201)
  addTask(@CurrentUser() user: AuthUser, @Param('clientId') clientId: string, @Body({ schema: taskSchema }) body: { title: string; dueAt?: Date }) {
    return this.tasks.create(user.userId, clientId, body);
  }
}

// Uzmanın tüm danışanlarındaki işler ("bugün ne yapmalıyım")
@Controller('review')
@UseGuards(AuthGuard)
export class ReviewOverviewController {
  constructor(
    @Inject(FindingsService) private readonly findings: FindingsService,
    @Inject(TasksService) private readonly tasks: TasksService,
  ) {}

  // GET /api/review/overview → danışan başına açık madde sayıları (içerik yok)
  @Get('overview')
  overview(@CurrentUser() user: AuthUser) {
    return this.findings.overview(user.userId);
  }

  // GET /api/review/tasks?status=OPEN → vadesi yakın olandan başlayarak tüm görevlerim
  @Get('tasks')
  allTasks(@CurrentUser() user: AuthUser, @Query({ schema: taskListSchema }) query: { status: 'OPEN' | 'DONE' }) {
    return this.tasks.list(user.userId, { status: query.status });
  }

  // POST /api/review/tasks/:id/done
  @Post('tasks/:id/done')
  @HttpCode(200)
  done(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.tasks.done(user.userId, id);
  }
}
