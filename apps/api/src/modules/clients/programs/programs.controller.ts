// Egzersiz programı ve antrenman kaydı adresleri.
import { Body, Controller, Delete, Get, HttpCode, Inject, Param, Post, Put, Query, UseGuards } from '@nestjs/common';
import { z } from 'zod';
import { AuthGuard, CurrentUser, type AuthUser } from '../../auth/auth.guard.js';
import { FindingsService } from '../findings/findings.service.js';
import { normalizeProgramContent, programContentSchema, type ProgramContentInput } from './program-content.js';
import { ProgramsService } from './programs.service.js';
import { workoutLogSchema, type WorkoutLogInput } from './workout-log.js';
import { WorkoutsService } from './workouts.service.js';

const createSchema = z.object({ content: programContentSchema.optional(), fromPublished: z.boolean().optional() });
const saveSchema = z.object({ content: programContentSchema, changeNote: z.string().trim().max(300).optional() });
const approveSchema = z.object({ changeNote: z.string().trim().max(300).optional(), confirmWarnings: z.boolean().default(false) });
const limitSchema = z.object({ limit: z.coerce.number().int().min(1).max(100).default(30) });

@Controller('clients/:clientId')
@UseGuards(AuthGuard)
export class ProgramsController {
  constructor(
    @Inject(ProgramsService) private readonly programs: ProgramsService,
    @Inject(WorkoutsService) private readonly workouts: WorkoutsService,
    @Inject(FindingsService) private readonly findings: FindingsService,
  ) {}

  // GET /api/clients/:clientId/program
  @Get('program')
  overview(@CurrentUser() user: AuthUser, @Param('clientId') clientId: string) {
    return this.programs.overview(user.userId, clientId);
  }

  // POST /api/clients/:clientId/program/draft { content?, fromPublished? }
  @Post('program/draft')
  @HttpCode(201)
  createDraft(@CurrentUser() user: AuthUser, @Param('clientId') clientId: string, @Body({ schema: createSchema }) body: { content?: ProgramContentInput; fromPublished?: boolean }) {
    return this.programs.createDraft(user.userId, clientId, { content: body.content ? normalizeProgramContent(body.content) : undefined, fromPublished: body.fromPublished });
  }

  // PUT /api/clients/:clientId/program/draft
  @Put('program/draft')
  saveDraft(@CurrentUser() user: AuthUser, @Param('clientId') clientId: string, @Body({ schema: saveSchema }) body: { content: ProgramContentInput; changeNote?: string }) {
    return this.programs.saveDraft(user.userId, clientId, normalizeProgramContent(body.content), body.changeNote);
  }

  // DELETE /api/clients/:clientId/program/draft
  @Delete('program/draft')
  discard(@CurrentUser() user: AuthUser, @Param('clientId') clientId: string) {
    return this.programs.discardDraft(user.userId, clientId);
  }

  // GET /api/clients/:clientId/program/draft/check
  @Get('program/draft/check')
  check(@CurrentUser() user: AuthUser, @Param('clientId') clientId: string) {
    return this.programs.check(user.userId, clientId);
  }

  // POST /api/clients/:clientId/program/draft/approve { changeNote?, confirmWarnings }
  @Post('program/draft/approve')
  @HttpCode(200)
  approve(@CurrentUser() user: AuthUser, @Param('clientId') clientId: string, @Body({ schema: approveSchema }) body: { changeNote?: string; confirmWarnings: boolean }) {
    return this.programs.approve(user.userId, clientId, body);
  }

  // GET /api/clients/:clientId/workouts → danışanın antrenman kayıtları (paylaşılıyorsa)
  @Get('workouts')
  listWorkouts(@CurrentUser() user: AuthUser, @Param('clientId') clientId: string, @Query({ schema: limitSchema }) query: { limit: number }) {
    return this.workouts.listForProfessional(user.userId, clientId, query.limit);
  }

  // POST /api/clients/:clientId/workouts → yüz yüze seansı danışan adına kaydet
  @Post('workouts')
  @HttpCode(201)
  async addWorkout(@CurrentUser() user: AuthUser, @Param('clientId') clientId: string, @Body({ schema: workoutLogSchema }) body: WorkoutLogInput) {
    const log = await this.workouts.logByProfessional(user.userId, clientId, body);
    await this.findings.refreshForClient(clientId);
    return log;
  }

  // GET /api/clients/:clientId/performance → egzersiz başına özet
  @Get('performance')
  performance(@CurrentUser() user: AuthUser, @Param('clientId') clientId: string) {
    return this.workouts.performance(user.userId, clientId);
  }
}

@Controller('me')
@UseGuards(AuthGuard)
export class MyProgramsController {
  constructor(
    @Inject(ProgramsService) private readonly programs: ProgramsService,
    @Inject(WorkoutsService) private readonly workouts: WorkoutsService,
    @Inject(FindingsService) private readonly findings: FindingsService,
  ) {}

  // GET /api/me/programs
  @Get('programs')
  list(@CurrentUser() user: AuthUser) {
    return this.programs.listForClient(user.userId);
  }

  // GET /api/me/programs/:programId
  @Get('programs/:programId')
  view(@CurrentUser() user: AuthUser, @Param('programId') programId: string) {
    return this.programs.viewForClient(user.userId, programId);
  }

  // POST /api/me/programs/:programId/logs → programın bir gününü kaydet
  @Post('programs/:programId/logs')
  @HttpCode(201)
  async logProgramDay(@CurrentUser() user: AuthUser, @Param('programId') programId: string, @Body({ schema: workoutLogSchema }) body: WorkoutLogInput) {
    const log = await this.workouts.logForSelf(user.userId, body, programId);
    await this.findings.refreshForClient(user.userId);
    return log;
  }

  // GET /api/me/workouts → kendi antrenman kayıtlarım
  @Get('workouts')
  myWorkouts(@CurrentUser() user: AuthUser, @Query({ schema: limitSchema }) query: { limit: number }) {
    return this.workouts.listForSelf(user.userId, query.limit);
  }

  // POST /api/me/workouts → programsız serbest antrenman kaydı
  @Post('workouts')
  @HttpCode(201)
  async logFree(@CurrentUser() user: AuthUser, @Body({ schema: workoutLogSchema }) body: WorkoutLogInput) {
    const log = await this.workouts.logForSelf(user.userId, body);
    await this.findings.refreshForClient(user.userId);
    return log;
  }
}
