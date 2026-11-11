// Spor salonu adresleri. Yetki görev bazlıdır: sahip / salon eğitmeni / resepsiyon (gym-rules.ts).
import { Body, Controller, Get, HttpCode, Inject, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { z } from 'zod';
import type { GymMemberStatus, GymStaffRole, PaymentMethod } from '../../generated/prisma/enums.js';
import { AuthGuard, CurrentUser, type AuthUser } from '../auth/auth.guard.js';
import { GymsService } from './gyms.service.js';
import { MembersService } from './members.service.js';

const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Tarih YYYY-AA-GG olmalı');
const kurus = z.number().int().min(0).max(100_000_000);

const gymSchema = z.object({
  name: z.string().trim().min(2).max(80).optional(),
  address: z.string().trim().max(200).nullable().optional(),
  city: z.string().trim().max(60).nullable().optional(),
  phone: z.string().trim().max(30).nullable().optional(),
});
const inviteSchema = z.object({ username: z.string().trim().min(3).max(30), role: z.enum(['TRAINER', 'RECEPTION']) });
const roleSchema = z.object({ role: z.enum(['TRAINER', 'RECEPTION']) });
const planSchema = z.object({
  name: z.string().trim().min(2, 'Paket adını yaz').max(60),
  durationDays: z.number().int().min(1).max(730),
  sessionCount: z.number().int().min(1).max(500).optional(),
  priceKurus: kurus,
});
const planPatchSchema = z.object({ name: z.string().trim().min(2).max(60).optional(), priceKurus: kurus.optional(), active: z.boolean().optional() });
const membersQuery = z.object({ q: z.string().trim().max(60).optional(), status: z.enum(['ACTIVE', 'ARCHIVED']).default('ACTIVE') });
const memberSchema = z.object({
  fullName: z.string().trim().min(2, 'Ad soyad yaz').max(80),
  phone: z.string().trim().max(30).optional(),
  note: z.string().trim().max(300).optional(),
});
const memberPatchSchema = z.object({
  fullName: z.string().trim().min(2).max(80).optional(),
  phone: z.string().trim().max(30).nullable().optional(),
  note: z.string().trim().max(300).nullable().optional(),
  status: z.enum(['ACTIVE', 'ARCHIVED']).optional(),
});
const membershipSchema = z.object({ planId: z.string().min(1).max(64), startDate: day.optional(), priceKurus: kurus.optional() });
const reasonSchema = z.object({ reason: z.string().trim().min(3, 'Gerekçeyi yaz').max(300) });
const paymentSchema = z.object({
  amountKurus: z.number().int().min(1).max(100_000_000),
  method: z.enum(['CASH', 'CARD', 'TRANSFER', 'OTHER']),
  paidAt: z.iso.datetime().transform((v) => new Date(v)).optional(),
  membershipId: z.string().min(1).max(64).optional(),
  note: z.string().trim().max(200).optional(),
});
const rangeSchema = z.object({ from: day, to: day });
const plansQuery = z.object({ all: z.enum(['true', 'false']).default('false').transform((v) => v === 'true') });

@Controller('gym')
@UseGuards(AuthGuard)
export class GymsController {
  constructor(
    @Inject(GymsService) private readonly gyms: GymsService,
    @Inject(MembersService) private readonly members: MembersService,
  ) {}

  // GET /api/gym/me → salonum, görevim ve yetkilerim
  @Get('me')
  me(@CurrentUser() user: AuthUser) {
    return this.gyms.me(user.userId);
  }

  @Patch('me')
  update(@CurrentUser() user: AuthUser, @Body({ schema: gymSchema }) body: { name?: string; address?: string | null; city?: string | null; phone?: string | null }) {
    return this.gyms.update(user.userId, body);
  }

  // GET /api/gym/today → bugünün özeti (para bilgisi görev yetkisine göre)
  @Get('today')
  today(@CurrentUser() user: AuthUser) {
    return this.members.todayPanel(user.userId);
  }

  // ───── Ekip ─────
  @Get('staff')
  staff(@CurrentUser() user: AuthUser) {
    return this.gyms.listStaff(user.userId);
  }

  @Post('staff/invite')
  @HttpCode(201)
  invite(@CurrentUser() user: AuthUser, @Body({ schema: inviteSchema }) body: { username: string; role: GymStaffRole }) {
    return this.gyms.invite(user.userId, body.username, body.role);
  }

  @Patch('staff/:id')
  changeRole(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body({ schema: roleSchema }) body: { role: GymStaffRole }) {
    return this.gyms.changeRole(user.userId, id, body.role);
  }

  @Post('staff/:id/end')
  @HttpCode(200)
  endStaff(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.gyms.endStaff(user.userId, id);
  }

  // ───── Paketler ─────
  @Get('plans')
  plans(@CurrentUser() user: AuthUser, @Query({ schema: plansQuery }) query: { all: boolean }) {
    return this.gyms.listPlans(user.userId, query.all);
  }

  @Post('plans')
  @HttpCode(201)
  addPlan(@CurrentUser() user: AuthUser, @Body({ schema: planSchema }) body: { name: string; durationDays: number; sessionCount?: number; priceKurus: number }) {
    return this.gyms.addPlan(user.userId, body);
  }

  @Patch('plans/:id')
  updatePlan(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body({ schema: planPatchSchema }) body: { name?: string; priceKurus?: number; active?: boolean }) {
    return this.gyms.updatePlan(user.userId, id, body);
  }

  // ───── Üyeler, üyelikler, ödeme kayıtları ─────
  @Get('members')
  listMembers(@CurrentUser() user: AuthUser, @Query({ schema: membersQuery }) query: { q?: string; status: GymMemberStatus }) {
    return this.members.list(user.userId, query);
  }

  @Post('members')
  @HttpCode(201)
  addMember(@CurrentUser() user: AuthUser, @Body({ schema: memberSchema }) body: { fullName: string; phone?: string; note?: string }) {
    return this.members.create(user.userId, body);
  }

  @Get('members/:id')
  member(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.members.detail(user.userId, id);
  }

  @Patch('members/:id')
  updateMember(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body({ schema: memberPatchSchema }) body: { fullName?: string; phone?: string | null; note?: string | null; status?: GymMemberStatus },
  ) {
    return this.members.update(user.userId, id, body);
  }

  @Post('members/:id/memberships')
  @HttpCode(201)
  addMembership(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body({ schema: membershipSchema }) body: { planId: string; startDate?: string; priceKurus?: number }) {
    return this.members.addMembership(user.userId, id, body);
  }

  @Post('memberships/:id/cancel')
  @HttpCode(200)
  cancelMembership(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body({ schema: reasonSchema }) body: { reason: string }) {
    return this.members.cancelMembership(user.userId, id, body.reason);
  }

  @Post('members/:id/payments')
  @HttpCode(201)
  recordPayment(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body({ schema: paymentSchema }) body: { amountKurus: number; method: PaymentMethod; paidAt?: Date; membershipId?: string; note?: string },
  ) {
    return this.members.recordPayment(user.userId, id, body);
  }

  @Post('payments/:id/void')
  @HttpCode(200)
  voidPayment(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body({ schema: reasonSchema }) body: { reason: string }) {
    return this.members.voidPayment(user.userId, id, body.reason);
  }

  // GET /api/gym/reports/payments?from=&to= → tahsilat raporu (sahip)
  @Get('reports/payments')
  report(@CurrentUser() user: AuthUser, @Query({ schema: rangeSchema }) query: { from: string; to: string }) {
    return this.members.paymentsReport(user.userId, query.from, query.to);
  }
}

@Controller('me/gym-invites')
@UseGuards(AuthGuard)
export class GymInvitesController {
  constructor(@Inject(GymsService) private readonly gyms: GymsService) {}

  // GET /api/me/gym-invites → bana gelen salon davetleri
  @Get()
  list(@CurrentUser() user: AuthUser) {
    return this.gyms.myInvites(user.userId);
  }

  @Post(':id/accept')
  @HttpCode(200)
  accept(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.gyms.accept(user.userId, id);
  }

  @Post(':id/decline')
  @HttpCode(200)
  decline(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.gyms.decline(user.userId, id);
  }

  // POST /api/me/gym-invites/leave → bulunduğum salonun ekibinden ayrıl
  @Post('leave')
  @HttpCode(200)
  leave(@CurrentUser() user: AuthUser) {
    return this.gyms.leave(user.userId);
  }
}
