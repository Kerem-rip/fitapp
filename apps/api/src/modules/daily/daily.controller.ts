// Kalori aracı kaydı, premium (deneme), günün düzeni, görev işaretleri ve geçmiş adresleri.
import { Body, Controller, Delete, Get, HttpCode, Inject, Param, Post, Put, Query, UseGuards } from '@nestjs/common';
import { z } from 'zod';
import { AuthGuard, CurrentUser, type AuthUser } from '../auth/auth.guard.js';
import { DailyService, LANES, SLOTS, type ProfileInput, type RoutineInput } from './daily.service.js';

const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Tarih YYYY-AA-GG olmalı');
const nutrients = z.object({ name: z.string().min(1).max(120), portion: z.string().min(1).max(80), servings: z.number().positive().max(20), kcal: z.number().min(0).max(3000), proteinG: z.number().min(0).max(300), carbsG: z.number().min(0).max(500), fatG: z.number().min(0).max(300) });

const profileSchema = z.object({
  goal: z.enum(['lose', 'gain', 'maintain', 'muscle', 'athlete', 'breastfeeding']),
  activity: z.enum(['sedentary', 'light', 'moderate', 'active', 'very_active']),
  sport: z.enum(['gym', 'endurance', 'team', 'combat', 'other']).optional(),
  breastfeedingMonths: z.number().int().min(0).max(24).optional(),
  sex: z.enum(['female', 'male', 'other']),
  ageYears: z.number().int().min(18).max(99),
  heightCm: z.number().min(120).max(230),
  weightKg: z.number().min(30).max(300),
  bodyFatPercent: z.number().min(3).max(60).optional(),
  bmr: z.number().int().min(600).max(6000),
  tdee: z.number().int().min(800).max(8000),
  targetKcal: z.number().int().min(1000).max(8000),
  proteinG: z.number().int().min(20).max(500),
  carbsG: z.number().int().min(0).max(1000),
  fatG: z.number().int().min(10).max(400),
  waterMl: z.number().int().min(1000).max(6000),
  screening: z.object({ pregnant: z.boolean(), medicalRestriction: z.boolean(), eatingDisorderHistory: z.boolean() }),
});
const premiumSchema = z.object({ active: z.boolean() });
const routineSchema = z.object({
  date: day.optional(),
  slot: z.enum(SLOTS),
  lane: z.enum(LANES),
  kind: z.enum(['CARD', 'CARE', 'FOOD', 'CUSTOM']),
  refId: z.string().min(1).max(60).optional(),
  title: z.string().trim().min(1).max(120),
  subtitle: z.string().trim().max(200).optional(),
  data: z.object({ items: z.array(nutrients).max(8).optional() }).optional(),
  source: z.enum(['SUGGESTED', 'MANUAL']),
});
const doneSchema = z.object({ done: z.boolean() });
const dateQuery = z.object({ date: day });
const checkSchema = z.object({ key: z.string().regex(/^[a-z]+:[A-Za-z0-9:_-]{1,100}$/), date: day, done: z.boolean() });
const historyQuery = z.object({ limit: z.coerce.number().int().min(1).max(100).default(40) });

@Controller('me')
@UseGuards(AuthGuard)
export class DailyController {
  constructor(@Inject(DailyService) private readonly daily: DailyService) {}

  // GET /api/me/calorie-profile → { profile } (kayıt yoksa profile: null)
  @Get('calorie-profile')
  async profile(@CurrentUser() user: AuthUser) {
    return { profile: await this.daily.calorieProfile(user.userId) };
  }

  // PUT /api/me/calorie-profile → onaylanan profil ve hesaplanan hedefler (sunucu güvenlik sınırlarını denetler)
  @Put('calorie-profile')
  saveProfile(@CurrentUser() user: AuthUser, @Body({ schema: profileSchema }) body: ProfileInput) {
    return this.daily.saveCalorieProfile(user.userId, body);
  }

  @Get('premium')
  premium(@CurrentUser() user: AuthUser) {
    return this.daily.premium(user.userId);
  }

  // Gerçek ödeme yokken yalnızca geliştirmede çalışır (üretimde 403)
  @Put('premium')
  setPremium(@CurrentUser() user: AuthUser, @Body({ schema: premiumSchema }) body: { active: boolean }) {
    return this.daily.setPremium(user.userId, body.active);
  }

  @Get('routine')
  routine(@CurrentUser() user: AuthUser, @Query({ schema: dateQuery }) q: { date: string }) {
    return this.daily.routine(user.userId, q.date);
  }

  @Post('routine')
  @HttpCode(201)
  addRoutine(@CurrentUser() user: AuthUser, @Body({ schema: routineSchema }) body: RoutineInput) {
    return this.daily.addRoutine(user.userId, body);
  }

  @Post('routine/:id/done')
  @HttpCode(200)
  routineDone(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body({ schema: doneSchema }) body: { done: boolean }) {
    return this.daily.setRoutineDone(user.userId, id, body.done);
  }

  @Delete('routine/:id')
  removeRoutine(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.daily.removeRoutine(user.userId, id);
  }

  @Get('task-checks')
  checks(@CurrentUser() user: AuthUser, @Query({ schema: dateQuery }) q: { date: string }) {
    return this.daily.taskChecks(user.userId, q.date);
  }

  @Post('task-checks')
  @HttpCode(200)
  setCheck(@CurrentUser() user: AuthUser, @Body({ schema: checkSchema }) body: { key: string; date: string; done: boolean }) {
    return this.daily.setTaskCheck(user.userId, body.key, body.date, body.done);
  }

  @Get('history')
  history(@CurrentUser() user: AuthUser, @Query({ schema: historyQuery }) q: { limit: number }) {
    return this.daily.history(user.userId, q.limit);
  }
}
