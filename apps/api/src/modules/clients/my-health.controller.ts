// Kişinin kendi sağlık bilgileri: ölçümlerini ve anamnez yanıtlarını kendisi girer ve görür.
// Kaydetmek için sağlık verisi rızası gerekir (18 yaş altı bu rızayı veremediği için kaydedemez).
import { Body, Controller, Get, HttpCode, Inject, Param, Post, Put, Query, UseGuards } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service.js';
import { AuthGuard, CurrentUser, type AuthUser } from '../auth/auth.guard.js';
import { AnamnesisService } from './anamnesis.service.js';
import {
  answerSchema,
  measurementListSchema,
  measurementSchema,
  voidSchema,
  type MeasurementBody,
  type MeasurementListQuery,
} from './clients.controller.js';
import { FindingsService } from './findings/findings.service.js';
import { TEMPLATE_STATUS } from './intake-template.js';
import { MeasurementsService } from './measurements.service.js';

@Controller('me/health')
@UseGuards(AuthGuard)
export class MyHealthController {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(MeasurementsService) private readonly measurements: MeasurementsService,
    @Inject(AnamnesisService) private readonly anamnesis: AnamnesisService,
    @Inject(FindingsService) private readonly findings: FindingsService,
  ) {}

  // GET /api/me/health/measurements
  @Get('measurements')
  list(@CurrentUser() user: AuthUser, @Query({ schema: measurementListSchema }) query: MeasurementListQuery) {
    return this.measurements.list(user.userId, {
      kinds: query.kind ? [query.kind] : undefined,
      limit: query.limit,
      includeVoided: query.includeVoided,
    });
  }

  // POST /api/me/health/measurements
  @Post('measurements')
  @HttpCode(201)
  async add(@CurrentUser() user: AuthUser, @Body({ schema: measurementSchema }) body: MeasurementBody) {
    const created = await this.measurements.add(user.userId, { id: user.userId, source: 'SELF' }, body);
    await this.findings.refreshForClient(user.userId);
    return created;
  }

  // POST /api/me/health/measurements/:id/void
  @Post('measurements/:id/void')
  @HttpCode(200)
  async voidOne(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body({ schema: voidSchema }) body: { reason?: string }) {
    const voided = await this.measurements.void(user.userId, id, user.userId, body.reason);
    await this.findings.refreshForClient(user.userId);
    return voided;
  }

  // GET /api/me/health/anamnesis → standart sorular + aktif uzmanlarımın soruları
  @Get('anamnesis')
  async anamnesisView(@CurrentUser() user: AuthUser) {
    const relationships = await this.prisma.clientRelationship.findMany({
      where: { clientId: user.userId, status: 'ACTIVE' },
      select: { professionalId: true },
    });
    return {
      templateStatus: TEMPLATE_STATUS,
      questions: await this.anamnesis.view(user.userId, relationships.map((r) => r.professionalId)),
    };
  }

  // PUT /api/me/health/anamnesis/:questionKey { value }
  @Put('anamnesis/:questionKey')
  async answer(@CurrentUser() user: AuthUser, @Param('questionKey') questionKey: string, @Body({ schema: answerSchema }) body: { value?: unknown }) {
    const result = await this.anamnesis.setAnswer(user.userId, questionKey, body.value, { id: user.userId, source: 'SELF' });
    if (result.changed) await this.findings.refreshForClient(user.userId);
    return result;
  }
}
