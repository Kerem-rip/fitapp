// Beslenme planı adresleri. Uzman: taslak → kontrol → onay. Danışan: yayındaki planı görür, izinli alternatiflerden seçer.
import { Body, Controller, Delete, Get, HttpCode, Inject, Param, ParseIntPipe, Post, Put, Query, UseGuards } from '@nestjs/common';
import { z } from 'zod';
import { AuthGuard, CurrentUser, type AuthUser } from '../../auth/auth.guard.js';
import { normalizePlanContent, planContentSchema, type PlanContentInput } from './plan-content.js';
import { PlansService } from './plans.service.js';

const createSchema = z.object({ content: planContentSchema.optional(), fromPublished: z.boolean().optional() });
const saveSchema = z.object({ content: planContentSchema, changeNote: z.string().trim().max(300).optional() });
const approveSchema = z.object({ changeNote: z.string().trim().max(300).optional(), confirmWarnings: z.boolean().default(false) });
const rangeSchema = z.object({
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).default('0000-01-01'),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).default('9999-12-31'),
});
const dateQuerySchema = z.object({ date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Tarih YYYY-AA-GG olmalı').default(() => new Date().toISOString().slice(0, 10)) });
const choiceSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Tarih YYYY-AA-GG olmalı'),
  mealId: z.string().min(1).max(64),
  optionIds: z.array(z.string().min(1).max(64)).max(5),
});

@Controller('clients/:clientId/plan')
@UseGuards(AuthGuard)
export class PlansController {
  constructor(@Inject(PlansService) private readonly plans: PlansService) {}

  // GET /api/clients/:clientId/plan → yayındaki sürüm, taslak ve sürüm geçmişi
  @Get()
  overview(@CurrentUser() user: AuthUser, @Param('clientId') clientId: string) {
    return this.plans.overview(user.userId, clientId);
  }

  // POST /api/clients/:clientId/plan/draft { content?, fromPublished? }
  @Post('draft')
  @HttpCode(201)
  createDraft(@CurrentUser() user: AuthUser, @Param('clientId') clientId: string, @Body({ schema: createSchema }) body: { content?: PlanContentInput; fromPublished?: boolean }) {
    return this.plans.createDraft(user.userId, clientId, {
      content: body.content ? normalizePlanContent(body.content) : undefined,
      fromPublished: body.fromPublished,
    });
  }

  // PUT /api/clients/:clientId/plan/draft { content, changeNote? }
  @Put('draft')
  saveDraft(@CurrentUser() user: AuthUser, @Param('clientId') clientId: string, @Body({ schema: saveSchema }) body: { content: PlanContentInput; changeNote?: string }) {
    return this.plans.saveDraft(user.userId, clientId, normalizePlanContent(body.content), body.changeNote);
  }

  // DELETE /api/clients/:clientId/plan/draft
  @Delete('draft')
  discardDraft(@CurrentUser() user: AuthUser, @Param('clientId') clientId: string) {
    return this.plans.discardDraft(user.userId, clientId);
  }

  // GET /api/clients/:clientId/plan/draft/check → engeller ve uyarılar
  @Get('draft/check')
  check(@CurrentUser() user: AuthUser, @Param('clientId') clientId: string) {
    return this.plans.check(user.userId, clientId);
  }

  // POST /api/clients/:clientId/plan/draft/approve { changeNote?, confirmWarnings? } → onayla ve danışana yayınla
  @Post('draft/approve')
  @HttpCode(200)
  approve(@CurrentUser() user: AuthUser, @Param('clientId') clientId: string, @Body({ schema: approveSchema }) body: { changeNote?: string; confirmWarnings: boolean }) {
    return this.plans.approve(user.userId, clientId, body);
  }

  // GET /api/clients/:clientId/plan/versions/:number
  @Get('versions/:number')
  version(@CurrentUser() user: AuthUser, @Param('clientId') clientId: string, @Param('number', ParseIntPipe) number: number) {
    return this.plans.version(user.userId, clientId, number);
  }

  // GET /api/clients/:clientId/plan/choices?from=&to= → danışanın seçimleri (öğün kayıtları paylaşılıyorsa)
  @Get('choices')
  choices(@CurrentUser() user: AuthUser, @Param('clientId') clientId: string, @Query({ schema: rangeSchema }) query: { from: string; to: string }) {
    return this.plans.choices(user.userId, clientId, query.from, query.to);
  }
}

@Controller('me/plans')
@UseGuards(AuthGuard)
export class MyPlansController {
  constructor(@Inject(PlansService) private readonly plans: PlansService) {}

  // GET /api/me/plans → bana yayınlanmış planlar
  @Get()
  list(@CurrentUser() user: AuthUser) {
    return this.plans.listForClient(user.userId);
  }

  // GET /api/me/plans/:planId?date=YYYY-AA-GG → yayındaki plan ve o günkü seçimlerim
  @Get(':planId')
  view(@CurrentUser() user: AuthUser, @Param('planId') planId: string, @Query({ schema: dateQuerySchema }) query: { date: string }) {
    return this.plans.viewForClient(user.userId, planId, query.date);
  }

  // PUT /api/me/plans/:planId/choices { date, mealId, optionIds }
  @Put(':planId/choices')
  choose(@CurrentUser() user: AuthUser, @Param('planId') planId: string, @Body({ schema: choiceSchema }) body: { date: string; mealId: string; optionIds: string[] }) {
    return this.plans.setChoice(user.userId, planId, body.date, body.mealId, body.optionIds);
  }
}
