// Randevu, hedef, hatırlatma ve ajanda adresleri.
import { Body, Controller, Get, HttpCode, Inject, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { z } from 'zod';
import type { MeasurementKind } from '../../../generated/prisma/enums.js';
import { AuthGuard, CurrentUser, type AuthUser } from '../../auth/auth.guard.js';
import { FindingsService } from '../findings/findings.service.js';
import { TasksService } from '../findings/tasks.service.js';
import { MEASUREMENT_KINDS } from '../measurement-rules.js';
import { AppointmentsService, type AppointmentInput } from './appointments.service.js';
import { GoalsService, type GoalInput } from './goals.service.js';
import { RemindersService } from './reminders.service.js';

const isoDate = z.iso.datetime().transform((v) => new Date(v));
const appointmentSchema = z.object({
  startsAt: isoDate,
  durationMin: z.number().int().min(10).max(240).default(45),
  mode: z.enum(['ONLINE', 'IN_PERSON']),
  title: z.string().trim().max(80).optional(),
  location: z.string().trim().max(120).optional(),
  notes: z.string().trim().max(1000).optional(),
});
const appointmentPatchSchema = appointmentSchema.partial();
const statusSchema = z.object({
  status: z.enum(['COMPLETED', 'NO_SHOW', 'CANCELLED']),
  outcome: z.string().trim().max(2000).optional(),
  reason: z.string().trim().max(300).optional(),
});
const rangeSchema = z.object({ from: isoDate, to: isoDate });
const goalSchema = z.object({
  title: z.string().trim().min(2, 'Hedefi yaz').max(120),
  measurementKind: z.enum(MEASUREMENT_KINDS as [MeasurementKind, ...MeasurementKind[]]).optional(),
  targetValue: z.number().finite().optional(),
  targetDate: isoDate.optional(),
  note: z.string().trim().max(500).optional(),
});
const goalStatusSchema = z.object({ status: z.enum(['ACTIVE', 'ACHIEVED', 'DROPPED']), note: z.string().trim().max(500).optional() });
const reminderSchema = z.object({ text: z.string().trim().min(2, 'Hatırlatmayı yaz').max(300), remindAt: isoDate });
const cancelSchema = z.object({ reason: z.string().trim().max(300).optional() });

type Range = { from: Date; to: Date };

@Controller('clients/:clientId')
@UseGuards(AuthGuard)
export class ClientAgendaController {
  constructor(
    @Inject(AppointmentsService) private readonly appointments: AppointmentsService,
    @Inject(GoalsService) private readonly goals: GoalsService,
    @Inject(RemindersService) private readonly reminders: RemindersService,
    @Inject(FindingsService) private readonly findings: FindingsService,
  ) {}

  // GET /api/clients/:clientId/appointments?from=&to=
  @Get('appointments')
  listAppointments(@CurrentUser() user: AuthUser, @Param('clientId') clientId: string, @Query({ schema: rangeSchema }) query: Range) {
    return this.appointments.listForProfessional(user.userId, { ...query, clientId });
  }

  // POST /api/clients/:clientId/appointments
  @Post('appointments')
  @HttpCode(201)
  addAppointment(@CurrentUser() user: AuthUser, @Param('clientId') clientId: string, @Body({ schema: appointmentSchema }) body: AppointmentInput) {
    return this.appointments.create(user.userId, clientId, body);
  }

  // GET /api/clients/:clientId/goals → hedefler ve ilerleme (paylaşılan kategoriler için)
  @Get('goals')
  listGoals(@CurrentUser() user: AuthUser, @Param('clientId') clientId: string) {
    return this.goals.listForProfessional(user.userId, clientId);
  }

  // POST /api/clients/:clientId/goals
  @Post('goals')
  @HttpCode(201)
  async addGoal(@CurrentUser() user: AuthUser, @Param('clientId') clientId: string, @Body({ schema: goalSchema }) body: GoalInput) {
    const goal = await this.goals.create(user.userId, clientId, body);
    await this.findings.refreshForClient(clientId);
    return goal;
  }

  // GET /api/clients/:clientId/reminders
  @Get('reminders')
  listReminders(@CurrentUser() user: AuthUser, @Param('clientId') clientId: string) {
    return this.reminders.list(user.userId, clientId);
  }

  // POST /api/clients/:clientId/reminders { text, remindAt }
  @Post('reminders')
  @HttpCode(201)
  addReminder(@CurrentUser() user: AuthUser, @Param('clientId') clientId: string, @Body({ schema: reminderSchema }) body: { text: string; remindAt: Date }) {
    return this.reminders.create(user.userId, clientId, body);
  }
}

@Controller()
@UseGuards(AuthGuard)
export class AgendaController {
  constructor(
    @Inject(AppointmentsService) private readonly appointments: AppointmentsService,
    @Inject(GoalsService) private readonly goals: GoalsService,
    @Inject(RemindersService) private readonly reminders: RemindersService,
    @Inject(TasksService) private readonly tasks: TasksService,
    @Inject(FindingsService) private readonly findings: FindingsService,
  ) {}

  // GET /api/agenda?from=&to= → randevularım, (gecikenler dahil) görevlerim
  @Get('agenda')
  async agenda(@CurrentUser() user: AuthUser, @Query({ schema: rangeSchema }) query: Range) {
    const [appointments, open] = await Promise.all([this.appointments.listForProfessional(user.userId, query), this.tasks.list(user.userId, { status: 'OPEN' })]);
    return { appointments, tasks: open.filter((t) => !t.dueAt || t.dueAt < query.to) };
  }

  // PATCH /api/appointments/:id → ertele / güncelle
  @Patch('appointments/:id')
  update(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body({ schema: appointmentPatchSchema }) body: Partial<AppointmentInput>) {
    return this.appointments.update(user.userId, id, body);
  }

  // POST /api/appointments/:id/status { status, outcome?, reason? }
  @Post('appointments/:id/status')
  @HttpCode(200)
  setStatus(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body({ schema: statusSchema }) body: { status: 'COMPLETED' | 'NO_SHOW' | 'CANCELLED'; outcome?: string; reason?: string },
  ) {
    return this.appointments.setStatus(user.userId, id, body);
  }

  // POST /api/goals/:id/status { status, note? }
  @Post('goals/:id/status')
  @HttpCode(200)
  async goalStatus(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body({ schema: goalStatusSchema }) body: { status: 'ACTIVE' | 'ACHIEVED' | 'DROPPED'; note?: string }) {
    const goal = await this.goals.setStatus(user.userId, id, body.status, body.note);
    await this.findings.refreshForClient(goal.clientId);
    return goal;
  }

  // POST /api/reminders/:id/cancel
  @Post('reminders/:id/cancel')
  @HttpCode(200)
  cancelReminder(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.reminders.cancel(user.userId, id);
  }

  // ───── Danışan ─────

  // GET /api/me/appointments
  @Get('me/appointments')
  myAppointments(@CurrentUser() user: AuthUser) {
    return this.appointments.listForClient(user.userId);
  }

  // POST /api/me/appointments/:id/cancel { reason? }
  @Post('me/appointments/:id/cancel')
  @HttpCode(200)
  cancelMine(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body({ schema: cancelSchema }) body: { reason?: string }) {
    return this.appointments.cancelByClient(user.userId, id, body.reason);
  }

  // GET /api/me/goals → uzmanlarımın benimle belirlediği aktif hedefler
  @Get('me/goals')
  myGoals(@CurrentUser() user: AuthUser) {
    return this.goals.listForClient(user.userId);
  }
}
