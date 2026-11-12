// Profesyonelin danışan dosyası adresleri. Her adres AccessService'ten geçer:
// aktif danışanlık + süre + paylaşım kategorisi + sağlık verisi rızası yoksa 403 döner.
import { Body, Controller, Get, HttpCode, Inject, Param, Post, Put, Query, UseGuards } from '@nestjs/common';
import { z } from 'zod';
import type { MeasurementKind, MeasurementMethod } from '../../generated/prisma/enums.js';
import { AuthGuard, CurrentUser, type AuthUser } from '../auth/auth.guard.js';
import { AccessService } from '../relationships/access.service.js';
import { AnamnesisService } from './anamnesis.service.js';
import { ClientFileService } from './client-file.service.js';
import { FindingsService } from './findings/findings.service.js';
import { FoodLogService } from './food-log.service.js';
import { TEMPLATE_STATUS } from './intake-template.js';
import { kindsInCategory, MEASUREMENT_KINDS, MEASUREMENT_SPECS } from './measurement-rules.js';
import { MeasurementsService } from './measurements.service.js';
import { NotesService } from './notes.service.js';

export const METHODS = ['SCALE', 'TAPE', 'CALIPER', 'BIA', 'DEXA', 'SELF_REPORT', 'OTHER'] as const;

export const measurementSchema = z.object({
  kind: z.enum(MEASUREMENT_KINDS as [MeasurementKind, ...MeasurementKind[]]),
  value: z.number().finite(),
  method: z.enum(METHODS),
  deviceName: z.string().trim().max(80).optional(),
  takenAt: z.iso.datetime().transform((v) => new Date(v)).optional(),
  note: z.string().trim().max(300).optional(),
});
export type MeasurementBody = {
  kind: MeasurementKind;
  value: number;
  method: MeasurementMethod;
  deviceName?: string;
  takenAt?: Date;
  note?: string;
};

export const measurementListSchema = z.object({
  kind: z.enum(MEASUREMENT_KINDS as [MeasurementKind, ...MeasurementKind[]]).optional(),
  limit: z.coerce.number().int().min(1).max(200).default(100),
  includeVoided: z.enum(['true', 'false']).default('false').transform((v) => v === 'true'),
});
export type MeasurementListQuery = { kind?: MeasurementKind; limit: number; includeVoided: boolean };

export const voidSchema = z.object({ reason: z.string().trim().max(200).optional() });

const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Tarih YYYY-AA-GG olmalı');
export const foodRangeSchema = z.object({ from: day, to: day });
const macro = z.number().finite().min(0);
export const mealSchema = z.object({
  date: day.optional(),
  mealType: z.enum(['BREAKFAST', 'LUNCH', 'SNACK', 'DINNER']),
  foodKey: z.string().trim().max(60).optional(),
  name: z.string().trim().min(1).max(80),
  portion: z.string().trim().min(1).max(60),
  servings: z.number().min(0.5).max(10).multipleOf(0.5),
  perServing: z.object({ kcal: macro, proteinG: macro, carbsG: macro, fatG: macro }),
});
export const waterSchema = z.object({ amountMl: z.number().int().min(-1000).max(1000).refine((v) => v !== 0, 'Miktar sıfır olamaz') });
export const answerSchema = z.object({ value: z.unknown() });

const noteSchema = z.object({ text: z.string().trim().min(1, 'Notu yaz').max(2000) });
const pageSchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(50),
  before: z.iso.datetime().transform((v) => new Date(v)).optional(),
});
const questionSchema = z.object({
  text: z.string().trim().min(3).max(200),
  type: z.enum(['TEXT', 'NUMBER', 'SINGLE_CHOICE', 'MULTI_CHOICE']),
  options: z.array(z.string().trim().max(60)).max(12).default([]),
});

const DEDUPE = { dedupeMinutes: 10 };

@Controller('clients/:clientId')
@UseGuards(AuthGuard)
export class ClientsController {
  constructor(
    @Inject(AccessService) private readonly access: AccessService,
    @Inject(ClientFileService) private readonly file: ClientFileService,
    @Inject(MeasurementsService) private readonly measurements: MeasurementsService,
    @Inject(AnamnesisService) private readonly anamnesis: AnamnesisService,
    @Inject(NotesService) private readonly notes: NotesService,
    @Inject(FindingsService) private readonly findings: FindingsService,
    @Inject(FoodLogService) private readonly foodLog: FoodLogService,
  ) {}

  // GET /api/clients/:clientId/food?from=&to= → öğünler ve su (sadece paylaşılan kategoriler; bakış denetim kaydına yazılır)
  @Get('food')
  async food(@CurrentUser() user: AuthUser, @Param('clientId') clientId: string, @Query({ schema: foodRangeSchema }) query: { from: string; to: string }) {
    const { allowed } = await this.access.accessibleCategories(user.userId, clientId, ['MEALS', 'WATER'], DEDUPE);
    const meals = allowed.has('MEALS');
    const water = allowed.has('WATER');
    return { shared: { meals, water }, days: meals || water ? await this.foodLog.days(clientId, query.from, query.to, { meals, water }) : [] };
  }

  // GET /api/clients/:clientId/file → dosya özeti (sadece paylaşılan kategoriler dolu gelir)
  @Get('file')
  summary(@CurrentUser() user: AuthUser, @Param('clientId') clientId: string) {
    return this.file.summary(user.userId, clientId);
  }

  // GET /api/clients/:clientId/timeline?limit=50&before=...
  @Get('timeline')
  timeline(@CurrentUser() user: AuthUser, @Param('clientId') clientId: string, @Query({ schema: pageSchema }) query: { limit: number; before?: Date }) {
    return this.file.timeline(user.userId, clientId, query.limit, query.before);
  }

  // GET /api/clients/:clientId/measurements?kind=WEIGHT&limit=100&includeVoided=false
  @Get('measurements')
  async listMeasurements(
    @CurrentUser() user: AuthUser,
    @Param('clientId') clientId: string,
    @Query({ schema: measurementListSchema }) query: MeasurementListQuery,
  ) {
    if (query.kind) {
      await this.access.requireAccess(user.userId, clientId, MEASUREMENT_SPECS[query.kind].category, 'DATA_VIEWED', { kind: query.kind }, DEDUPE);
      return this.measurements.list(clientId, { kinds: [query.kind], limit: query.limit, includeVoided: query.includeVoided });
    }
    const acc = await this.access.accessibleCategories(user.userId, clientId, ['WEIGHT', 'MEASUREMENTS'], DEDUPE);
    const kinds = [...(acc.allowed.has('WEIGHT') ? kindsInCategory('WEIGHT') : []), ...(acc.allowed.has('MEASUREMENTS') ? kindsInCategory('MEASUREMENTS') : [])];
    if (kinds.length === 0) return [];
    return this.measurements.list(clientId, { kinds, limit: query.limit, includeVoided: query.includeVoided });
  }

  // POST /api/clients/:clientId/measurements → uzman danışan adına ölçüm girer
  @Post('measurements')
  @HttpCode(201)
  async addMeasurement(@CurrentUser() user: AuthUser, @Param('clientId') clientId: string, @Body({ schema: measurementSchema }) body: MeasurementBody) {
    await this.access.requireAccess(user.userId, clientId, MEASUREMENT_SPECS[body.kind].category, 'DATA_CHANGED', { kind: body.kind, action: 'add' });
    const created = await this.measurements.add(clientId, { id: user.userId, source: 'PROFESSIONAL' }, body);
    await this.findings.refreshForClient(clientId);
    return created;
  }

  // POST /api/clients/:clientId/measurements/:id/void → uzmanın kendi girdiği yanlış ölçümü geçersiz kılar
  @Post('measurements/:id/void')
  @HttpCode(200)
  async voidMeasurement(
    @CurrentUser() user: AuthUser,
    @Param('clientId') clientId: string,
    @Param('id') id: string,
    @Body({ schema: voidSchema }) body: { reason?: string },
  ) {
    const found = await this.measurements.find(clientId, id);
    await this.access.requireAccess(user.userId, clientId, MEASUREMENT_SPECS[found.kind].category, 'DATA_CHANGED', { kind: found.kind, action: 'void' });
    const voided = await this.measurements.void(clientId, id, user.userId, body.reason);
    await this.findings.refreshForClient(clientId);
    return voided;
  }

  // GET /api/clients/:clientId/anamnesis → standart sorular + bu uzmanın soruları ve güncel yanıtlar
  @Get('anamnesis')
  async anamnesisView(@CurrentUser() user: AuthUser, @Param('clientId') clientId: string) {
    await this.access.requireAccess(user.userId, clientId, 'ANAMNESIS', 'DATA_VIEWED', undefined, DEDUPE);
    return { templateStatus: TEMPLATE_STATUS, questions: await this.anamnesis.view(clientId, [user.userId]) };
  }

  // PUT /api/clients/:clientId/anamnesis/:questionKey { value } → uzman, danışanın yanıtını görüşmede kaydeder
  @Put('anamnesis/:questionKey')
  async answer(
    @CurrentUser() user: AuthUser,
    @Param('clientId') clientId: string,
    @Param('questionKey') questionKey: string,
    @Body({ schema: answerSchema }) body: { value?: unknown },
  ) {
    await this.access.requireAccess(user.userId, clientId, 'ANAMNESIS', 'DATA_CHANGED', { questionKey });
    const result = await this.anamnesis.setAnswer(clientId, questionKey, body.value, { id: user.userId, source: 'PROFESSIONAL' });
    if (result.changed) await this.findings.refreshForClient(clientId);
    return result;
  }

  // GET /api/clients/:clientId/notes → sadece yazan uzman görür
  @Get('notes')
  listNotes(@CurrentUser() user: AuthUser, @Param('clientId') clientId: string, @Query({ schema: pageSchema }) query: { limit: number; before?: Date }) {
    return this.notes.list(user.userId, clientId, query.limit, query.before);
  }

  // POST /api/clients/:clientId/notes { text }
  @Post('notes')
  @HttpCode(201)
  addNote(@CurrentUser() user: AuthUser, @Param('clientId') clientId: string, @Body({ schema: noteSchema }) body: { text: string }) {
    return this.notes.add(user.userId, clientId, body.text);
  }
}

// Uzmanın kendi anamnez soruları
@Controller('intake/questions')
@UseGuards(AuthGuard)
export class IntakeQuestionsController {
  constructor(@Inject(AnamnesisService) private readonly anamnesis: AnamnesisService) {}

  // POST /api/intake/questions { text, type, options } → danışanlarına sorulacak yeni soru
  @Post()
  @HttpCode(201)
  add(@CurrentUser() user: AuthUser, @Body({ schema: questionSchema }) body: { text: string; type: 'TEXT' | 'NUMBER' | 'SINGLE_CHOICE' | 'MULTI_CHOICE'; options: string[] }) {
    return this.anamnesis.addCustomQuestion(user.userId, body);
  }

  // POST /api/intake/questions/:id/deactivate → soruyu kapatır (verilen yanıtlar geçmişte kalır)
  @Post(':id/deactivate')
  @HttpCode(200)
  deactivate(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.anamnesis.deactivateCustomQuestion(user.userId, id);
  }
}
