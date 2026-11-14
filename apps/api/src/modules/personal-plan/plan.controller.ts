// Kişisel 28 günlük program adresleri (/api/plan/...). Her adres oturum ister ve sahiplik sunucuda denetlenir.
import { Body, Controller, Get, HttpCode, Inject, Param, ParseIntPipe, Post, UseGuards } from '@nestjs/common';
import { z } from 'zod';
import { AuthGuard, CurrentUser, type AuthUser } from '../auth/auth.guard.js';
import { intakeSchema, type PlanIntake } from './intake.js';
import { BODY_AREAS, type BodyArea } from './plan-types.js';
import { PlanService } from './plan.service.js';

const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Tarih YYYY-AA-GG olmalı');
const purchaseSchema = z.object({ idempotencyKey: z.string().min(8).max(80) });
const startSchema = z.object({ startDate: day });
const logSchema = z.object({
  status: z.enum(['DONE', 'SKIPPED']),
  rpe: z.number().int().min(1).max(10).nullable().optional(),
  pain: z.boolean().optional(),
  painArea: z.enum(BODY_AREAS).nullable().optional(),
  painSharp: z.boolean().optional(),
  note: z.string().max(300).nullable().optional(),
  actualReps: z.number().int().min(0).max(500).nullable().optional(),
  actualSeconds: z.number().int().min(0).max(7200).nullable().optional(),
});
const swapSchema = z.object({ itemId: z.string().min(1).max(60) });
const dayPipe = new ParseIntPipe();

@Controller('plan')
@UseGuards(AuthGuard)
export class PlanController {
  constructor(@Inject(PlanService) private readonly plan: PlanService) {}

  // GET /api/plan/catalog → 7 kategori ve alt kategoriler, form seçenekleri, sağlık soruları, fiyat (yer tutucu)
  @Get('catalog')
  catalog() {
    return this.plan.catalog();
  }

  @Get('intake/prefill')
  prefill(@CurrentUser() user: AuthUser) {
    return this.plan.prefill(user.userId);
  }

  // POST /api/plan/intake → formu kaydeder, güvenlik taramasını çalıştırır
  @Post('intake')
  @HttpCode(201)
  intake(@CurrentUser() user: AuthUser, @Body({ schema: intakeSchema }) body: PlanIntake) {
    return this.plan.submitIntake(user.userId, body);
  }

  // GET /api/plan/current → durum (satın alma, başlangıç, aktif program, yeniden satın alma)
  @Get('current')
  current(@CurrentUser() user: AuthUser) {
    return this.plan.current(user.userId);
  }

  // POST /api/plan/purchases { idempotencyKey } → (geliştirme modunda) satın alma; aynı anahtar çift kayıt oluşturmaz
  @Post('purchases')
  @HttpCode(201)
  purchase(@CurrentUser() user: AuthUser, @Body({ schema: purchaseSchema }) body: { idempotencyKey: string }) {
    return this.plan.purchase(user.userId, body.idempotencyKey);
  }

  // POST /api/plan/purchases/:id/start { startDate } → başlangıç tarihi (satın almadan sonra 14 gün içinde)
  @Post('purchases/:id/start')
  @HttpCode(200)
  start(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body({ schema: startSchema }) body: { startDate: string }) {
    return this.plan.chooseStart(user.userId, id, body.startDate);
  }

  @Get('instances/:id')
  overview(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.plan.overview(user.userId, id);
  }

  @Get('instances/:id/days/:day')
  dayOf(@CurrentUser() user: AuthUser, @Param('id') id: string, @Param('day', dayPipe) dayNumber: number) {
    return this.plan.day(user.userId, id, dayNumber);
  }

  // POST .../entries/:index/log → tamamlandı / atlandı, zorlanma, ağrı bildirimi
  @Post('instances/:id/days/:day/entries/:index/log')
  @HttpCode(200)
  log(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Param('day', dayPipe) dayNumber: number,
    @Param('index', new ParseIntPipe()) index: number,
    @Body({ schema: logSchema }) body: { status: 'DONE' | 'SKIPPED'; rpe?: number | null; pain?: boolean; painArea?: BodyArea | null; painSharp?: boolean; note?: string | null; actualReps?: number | null; actualSeconds?: number | null },
  ) {
    return this.plan.logEntry(user.userId, id, dayNumber, index, body);
  }

  // POST .../entries/:index/swap { itemId } → anlık uyarlama: sunucunun uygun bulduğu alternatif hareket
  @Post('instances/:id/days/:day/entries/:index/swap')
  @HttpCode(200)
  swap(@CurrentUser() user: AuthUser, @Param('id') id: string, @Param('day', dayPipe) dayNumber: number, @Param('index', new ParseIntPipe()) index: number, @Body({ schema: swapSchema }) body: { itemId: string }) {
    return this.plan.swapEntry(user.userId, id, dayNumber, index, body.itemId);
  }

  @Get('instances/:id/report')
  report(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.plan.report(user.userId, id);
  }
}
