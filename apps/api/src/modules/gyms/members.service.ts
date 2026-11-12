// Salon üyeleri, üyelikler, ödeme KAYITLARI ve "bugün" paneli.
// Görünen bilgi görev bazlıdır: eğitmen üyenin adını ve üyelik durumunu görür; telefon ve para bilgisini görmez.
import { Inject, Injectable } from '@nestjs/common';
import { badRequest, conflict, notFound } from '../../common/app-error.js';
import { PrismaService } from '../../common/prisma/prisma.service.js';
import type { GymMemberStatus, PaymentMethod } from '../../generated/prisma/enums.js';
import { addDays, balanceOf, can, daysBetween, localDay, localDayStart, membershipDue, membershipEnd, membershipState, summarizePayments, toDay, type PaymentRow } from './gym-rules.js';
import { GymsService, type GymContext } from './gyms.service.js';

const EXPIRING_DAYS = 7;
const DAY = /^\d{4}-\d{2}-\d{2}$/;

const isValidDay = (s: string) => DAY.test(s) && toDay(new Date(`${s}T00:00:00Z`)) === s;

type MembershipRow = {
  id: string;
  planId: string | null;
  planName: string;
  startDate: Date;
  endDate: Date;
  sessionsTotal: number | null;
  sessionsLeft: number | null;
  priceKurus: number;
  status: 'ACTIVE' | 'CANCELLED';
  createdAt: Date;
  cancelledAt: Date | null;
  cancelReason: string | null;
};

type PaymentDb = {
  id: string;
  membershipId: string | null;
  amountKurus: number;
  method: PaymentMethod;
  paidAt: Date;
  note: string | null;
  voidedAt: Date | null;
  voidReason: string | null;
};

const asRow = (p: PaymentDb): PaymentRow => ({ membershipId: p.membershipId, amountKurus: p.amountKurus, method: p.method, voided: p.voidedAt !== null });

function presentMembership(m: MembershipRow, today: string, payments: PaymentDb[] | null) {
  const start = toDay(m.startDate);
  const end = toDay(m.endDate);
  return {
    ...m,
    startDate: start,
    endDate: end,
    state: membershipState({ status: m.status, startDate: start, endDate: end, sessionsLeft: m.sessionsLeft }, today),
    daysLeft: daysBetween(today, end),
    ...(payments ? { dueKurus: membershipDue(m, payments.map(asRow)) } : {}),
  };
}

@Injectable()
export class MembersService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(GymsService) private readonly gyms: GymsService,
  ) {}

  private today() {
    return localDay();
  }

  private async member(ctx: GymContext, id: string) {
    const m = await this.prisma.gymMember.findFirst({ where: { id, gymId: ctx.gymId } });
    if (!m) throw notFound('MEMBER_NOT_FOUND', 'Üye bulunamadı.');
    return m;
  }

  // ───────────── Üyeler ─────────────

  async list(userId: string, options: { q?: string; status: GymMemberStatus }) {
    const ctx = await this.gyms.context(userId, 'members.view');
    const contact = can(ctx.role, 'members.contact');
    const money = can(ctx.role, 'payments.view');
    const today = this.today();
    const rows = await this.prisma.gymMember.findMany({
      where: { gymId: ctx.gymId, status: options.status, ...(options.q ? { fullName: { contains: options.q.trim(), mode: 'insensitive' } } : {}) },
      orderBy: { fullName: 'asc' },
      take: 200,
      include: {
        memberships: { orderBy: { endDate: 'desc' } },
        ...(money ? { payments: { select: { id: true, membershipId: true, amountKurus: true, method: true, paidAt: true, note: true, voidedAt: true, voidReason: true } } } : {}),
      },
    });
    return rows.map((m) => {
      const current = m.memberships.find((x) => x.status === 'ACTIVE' && toDay(x.endDate) >= today) ?? m.memberships[0] ?? null;
      const payments = 'payments' in m ? (m.payments as PaymentDb[]) : null;
      return {
        id: m.id,
        fullName: m.fullName,
        status: m.status,
        ...(contact ? { phone: m.phone } : {}),
        current: current ? presentMembership(current, today, null) : null,
        ...(payments ? { balanceKurus: balanceOf(m.memberships, payments.map(asRow)).balanceKurus } : {}),
      };
    });
  }

  async create(userId: string, input: { fullName: string; phone?: string; note?: string }) {
    const ctx = await this.gyms.context(userId, 'members.manage');
    return this.prisma.gymMember.create({
      data: { gymId: ctx.gymId, fullName: input.fullName.trim(), phone: input.phone?.trim() || null, note: input.note?.trim() || null, createdById: userId },
    });
  }

  async update(userId: string, id: string, patch: { fullName?: string; phone?: string | null; note?: string | null; status?: GymMemberStatus }) {
    const ctx = await this.gyms.context(userId, 'members.manage');
    await this.member(ctx, id);
    return this.prisma.gymMember.update({ where: { id }, data: patch });
  }

  async detail(userId: string, id: string) {
    const ctx = await this.gyms.context(userId, 'members.view');
    const member = await this.member(ctx, id);
    const money = can(ctx.role, 'payments.view');
    const today = this.today();
    const memberships = await this.prisma.membership.findMany({ where: { memberId: id }, orderBy: { startDate: 'desc' } });
    const payments = money
      ? await this.prisma.gymPayment.findMany({
          where: { memberId: id },
          orderBy: { paidAt: 'desc' },
          select: { id: true, membershipId: true, amountKurus: true, method: true, paidAt: true, note: true, voidedAt: true, voidReason: true },
        })
      : null;
    return {
      member: {
        id: member.id,
        fullName: member.fullName,
        status: member.status,
        createdAt: member.createdAt,
        ...(can(ctx.role, 'members.contact') ? { phone: member.phone, note: member.note } : {}),
      },
      memberships: memberships.map((m) => presentMembership(m, today, payments)),
      ...(payments ? { payments, balance: balanceOf(memberships, payments.map(asRow)) } : {}),
    };
  }

  // ───────────── Üyelikler ─────────────

  async addMembership(userId: string, memberId: string, input: { planId: string; startDate?: string; priceKurus?: number }) {
    const ctx = await this.gyms.context(userId, 'memberships.manage');
    const member = await this.member(ctx, memberId);
    if (member.status !== 'ACTIVE') throw conflict('MEMBER_ARCHIVED', 'Arşivlenmiş üyeye üyelik eklenemez.');
    const plan = await this.prisma.membershipPlan.findFirst({ where: { id: input.planId, gymId: ctx.gymId, active: true } });
    if (!plan) throw notFound('PLAN_NOT_FOUND', 'Paket bulunamadı ya da satışta değil.');
    const start = input.startDate ?? this.today();
    if (!isValidDay(start)) throw badRequest('INVALID_DATE', 'Başlangıç tarihi geçerli değil.');
    const end = membershipEnd(start, plan.durationDays);
    const created = await this.prisma.membership.create({
      data: {
        gymId: ctx.gymId,
        memberId,
        planId: plan.id,
        planName: plan.name,
        startDate: new Date(`${start}T00:00:00Z`),
        endDate: new Date(`${end}T00:00:00Z`),
        sessionsTotal: plan.sessionCount,
        sessionsLeft: plan.sessionCount,
        // İndirim gibi durumlarda fiyat satış anında değiştirilebilir; paket fiyatı etkilenmez
        priceKurus: input.priceKurus ?? plan.priceKurus,
        createdById: userId,
      },
    });
    return presentMembership(created, this.today(), []);
  }

  async cancelMembership(userId: string, id: string, reason: string) {
    const ctx = await this.gyms.context(userId, 'memberships.manage');
    const m = await this.prisma.membership.findFirst({ where: { id, gymId: ctx.gymId } });
    if (!m) throw notFound('MEMBERSHIP_NOT_FOUND', 'Üyelik bulunamadı.');
    if (m.status === 'CANCELLED') throw conflict('ALREADY_CANCELLED', 'Bu üyelik zaten iptal edilmiş.');
    const updated = await this.prisma.membership.update({ where: { id }, data: { status: 'CANCELLED', cancelledAt: new Date(), cancelReason: reason.trim() } });
    return presentMembership(updated, this.today(), null);
  }

  // ───────────── Ödeme kayıtları ─────────────

  async recordPayment(userId: string, memberId: string, input: { amountKurus: number; method: PaymentMethod; paidAt?: Date; membershipId?: string; note?: string }) {
    const ctx = await this.gyms.context(userId, 'payments.record');
    await this.member(ctx, memberId);
    if (input.membershipId) {
      const m = await this.prisma.membership.findFirst({ where: { id: input.membershipId, memberId }, select: { id: true } });
      if (!m) throw badRequest('MEMBERSHIP_NOT_FOUND', 'Bu üyelik bu üyeye ait değil.');
    }
    const paidAt = input.paidAt ?? new Date();
    if (paidAt.getTime() > Date.now() + 5 * 60_000) throw badRequest('INVALID_DATE', 'Ödeme tarihi gelecekte olamaz.');
    return this.prisma.gymPayment.create({
      data: {
        gymId: ctx.gymId,
        memberId,
        membershipId: input.membershipId ?? null,
        amountKurus: input.amountKurus,
        method: input.method,
        paidAt,
        recordedById: userId,
        note: input.note?.trim() || null,
      },
    });
  }

  // Hatalı ödeme kaydı silinmez; gerekçesiyle iptal edilir (sadece salon sahibi)
  async voidPayment(userId: string, id: string, reason: string) {
    const ctx = await this.gyms.context(userId, 'payments.void');
    const p = await this.prisma.gymPayment.findFirst({ where: { id, gymId: ctx.gymId } });
    if (!p) throw notFound('PAYMENT_NOT_FOUND', 'Ödeme kaydı bulunamadı.');
    if (p.voidedAt) throw conflict('ALREADY_VOIDED', 'Bu kayıt zaten iptal edilmiş.');
    return this.prisma.gymPayment.update({ where: { id }, data: { voidedAt: new Date(), voidedById: userId, voidReason: reason.trim() } });
  }

  // ───────────── Bugün ve raporlar ─────────────

  async todayPanel(userId: string) {
    const ctx = await this.gyms.context(userId);
    const today = this.today();
    const soon = addDays(today, EXPIRING_DAYS);
    const weekAgo = addDays(today, -EXPIRING_DAYS);
    const money = can(ctx.role, 'payments.view');

    const [activeMembers, staffCount, memberships] = await Promise.all([
      this.prisma.gymMember.count({ where: { gymId: ctx.gymId, status: 'ACTIVE' } }),
      this.prisma.gymStaffMember.count({ where: { gymId: ctx.gymId, status: 'ACTIVE' } }),
      this.prisma.membership.findMany({
        where: { gymId: ctx.gymId, status: 'ACTIVE', member: { status: 'ACTIVE' }, endDate: { gte: new Date(`${weekAgo}T00:00:00Z`) } },
        select: { id: true, memberId: true, planName: true, endDate: true, sessionsLeft: true, member: { select: { fullName: true } } },
      }),
    ]);

    // Üye başına en geç biten üyelik: yenilenmişse "bitiyor" listesine girmez
    const latest = new Map<string, (typeof memberships)[number]>();
    for (const m of memberships) {
      const cur = latest.get(m.memberId);
      if (!cur || m.endDate > cur.endDate) latest.set(m.memberId, m);
    }
    const row = (m: (typeof memberships)[number]) => ({
      memberId: m.memberId,
      fullName: m.member.fullName,
      planName: m.planName,
      endDate: toDay(m.endDate),
      daysLeft: daysBetween(today, toDay(m.endDate)),
      sessionsLeft: m.sessionsLeft,
    });
    const all = [...latest.values()];
    const expiring = all.filter((m) => toDay(m.endDate) >= today && toDay(m.endDate) <= soon).map(row).sort((a, b) => a.daysLeft - b.daysLeft);
    const expired = all.filter((m) => toDay(m.endDate) < today).map(row).sort((a, b) => b.daysLeft - a.daysLeft);

    // Para bilgisi sadece sahibe ve resepsiyona
    let finance: { todayCollections: ReturnType<typeof summarizePayments>; debts: { memberId: string; fullName: string; balanceKurus: number }[] } | null = null;
    if (money) {
      const start = localDayStart(today);
      const todays = await this.prisma.gymPayment.findMany({ where: { gymId: ctx.gymId, paidAt: { gte: start } }, select: { membershipId: true, amountKurus: true, method: true, voidedAt: true } });
      const members = await this.prisma.gymMember.findMany({
        where: { gymId: ctx.gymId, status: 'ACTIVE' },
        select: {
          id: true,
          fullName: true,
          memberships: { select: { id: true, status: true, priceKurus: true } },
          payments: { select: { membershipId: true, amountKurus: true, method: true, voidedAt: true } },
        },
      });
      const debts = members
        .map((m) => ({
          memberId: m.id,
          fullName: m.fullName,
          balanceKurus: balanceOf(m.memberships, m.payments.map((p) => ({ ...p, voided: p.voidedAt !== null }))).balanceKurus,
        }))
        .filter((d) => d.balanceKurus > 0)
        .sort((a, b) => b.balanceKurus - a.balanceKurus)
        .slice(0, 20);
      finance = { todayCollections: summarizePayments(todays.map((p) => ({ ...p, voided: p.voidedAt !== null }))), debts };
    }

    return { gymName: ctx.gymName, role: ctx.role, today, activeMembers, staffCount, expiring, expired, ...finance };
  }

  // Tarih aralığında tahsilat raporu (sadece salon sahibi)
  async paymentsReport(userId: string, from: string, to: string) {
    const ctx = await this.gyms.context(userId, 'reports.view');
    if (!isValidDay(from) || !isValidDay(to) || from > to) throw badRequest('INVALID_RANGE', 'Tarih aralığı geçerli değil.');
    const rows = await this.prisma.gymPayment.findMany({
      where: { gymId: ctx.gymId, paidAt: { gte: localDayStart(from), lt: localDayStart(addDays(to, 1)) } },
      select: { paidAt: true, membershipId: true, amountKurus: true, method: true, voidedAt: true },
    });
    const byDay = new Map<string, PaymentRow[]>();
    for (const r of rows) {
      const day = localDay(r.paidAt);
      byDay.set(day, [...(byDay.get(day) ?? []), { ...r, voided: r.voidedAt !== null }]);
    }
    return {
      from,
      to,
      total: summarizePayments(rows.map((r) => ({ ...r, voided: r.voidedAt !== null }))),
      days: [...byDay.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([day, list]) => ({ day, ...summarizePayments(list) })),
    };
  }
}
