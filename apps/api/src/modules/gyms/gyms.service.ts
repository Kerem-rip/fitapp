// Salon, ekip ve paketler. Her istek önce kişinin salondaki görevini (sahip / eğitmen / resepsiyon) bulur;
// yetki görevine göre sınırlıdır (gym-rules.ts).
import { Inject, Injectable } from '@nestjs/common';
import { badRequest, conflict, forbidden, notFound } from '../../common/app-error.js';
import { PrismaService } from '../../common/prisma/prisma.service.js';
import type { GymStaffRole } from '../../generated/prisma/enums.js';
import { can, permissionsOf, type GymRole, type Permission } from './gym-rules.js';

export interface GymContext {
  userId: string;
  gymId: string;
  gymName: string;
  role: GymRole;
}

const MAX_STAFF = 50;

const nameOf = (p: { firstName: string | null; lastName: string | null; username: string }) =>
  [p.firstName, p.lastName].filter(Boolean).join(' ') || p.username;

export const STAFF_ROLE_LABELS: Record<GymStaffRole, string> = { TRAINER: 'eğitmeni', RECEPTION: 'resepsiyon görevlisi' };

@Injectable()
export class GymsService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  // Onaylı salon sahibinin salonu yoksa başvurusundaki bilgilerle oluşturur
  async ensureGym(userId: string) {
    const owned = await this.prisma.gym.findUnique({ where: { ownerId: userId } });
    if (owned) return owned;
    const profile = await this.prisma.professionalProfile.findUnique({ where: { userId }, select: { type: true, verification: true, city: true } });
    if (!profile || profile.type !== 'GYM' || profile.verification !== 'APPROVED') return null;
    const application = await this.prisma.professionalApplication.findFirst({
      where: { userId, field: 'GYM_OWNER', status: 'APPROVED' },
      orderBy: { submittedAt: 'desc' },
      select: { details: true },
    });
    const details = (application?.details ?? {}) as { gymName?: string; gymAddress?: string; city?: string };
    return this.prisma.gym.upsert({
      where: { ownerId: userId },
      create: { ownerId: userId, name: details.gymName ?? 'Salonum', address: details.gymAddress ?? null, city: details.city ?? profile.city ?? null },
      update: {},
    });
  }

  // Kişinin salondaki görevi (sahip ya da aktif personel). Salonu yoksa null.
  async findContext(userId: string): Promise<GymContext | null> {
    const owned = await this.ensureGym(userId);
    if (owned) return { userId, gymId: owned.id, gymName: owned.name, role: 'OWNER' };
    const staff = await this.prisma.gymStaffMember.findFirst({
      where: { userId, status: 'ACTIVE' },
      select: { role: true, gym: { select: { id: true, name: true } } },
    });
    return staff ? { userId, gymId: staff.gym.id, gymName: staff.gym.name, role: staff.role } : null;
  }

  async context(userId: string, permission?: Permission): Promise<GymContext> {
    const ctx = await this.findContext(userId);
    if (!ctx) throw notFound('NO_GYM', 'Bir salona bağlı değilsin.');
    if (permission && !can(ctx.role, permission)) throw forbidden('GYM_FORBIDDEN', 'Bu işlem için salondaki görevin yetkili değil.');
    return ctx;
  }

  async me(userId: string) {
    const ctx = await this.context(userId);
    const gym = await this.prisma.gym.findUniqueOrThrow({ where: { id: ctx.gymId }, select: { id: true, name: true, address: true, city: true, phone: true } });
    return { gym, userId, role: ctx.role, permissions: permissionsOf(ctx.role) };
  }

  async update(userId: string, patch: { name?: string; address?: string | null; city?: string | null; phone?: string | null }) {
    const ctx = await this.context(userId, 'gym.edit');
    return this.prisma.gym.update({
      where: { id: ctx.gymId },
      data: patch,
      select: { id: true, name: true, address: true, city: true, phone: true },
    });
  }

  // ───────────── Ekip ─────────────

  // Salonda çalışan herkes: sahip + aktif ekip (ders verecek, görev alacak, vardiya yazılacak kişiler)
  async teamOf(gymId: string): Promise<{ userId: string; name: string; username: string; role: GymRole }[]> {
    const gym = await this.prisma.gym.findUniqueOrThrow({
      where: { id: gymId },
      select: {
        owner: { select: { id: true, firstName: true, lastName: true, username: true } },
        staff: { where: { status: 'ACTIVE' }, orderBy: { joinedAt: 'asc' }, select: { role: true, user: { select: { id: true, firstName: true, lastName: true, username: true } } } },
      },
    });
    return [
      { userId: gym.owner.id, name: nameOf(gym.owner), username: gym.owner.username, role: 'OWNER' as const },
      ...gym.staff.map((s) => ({ userId: s.user.id, name: nameOf(s.user), username: s.user.username, role: s.role })),
    ];
  }

  async listStaff(userId: string) {
    const ctx = await this.context(userId);
    const owner = ctx.role === 'OWNER';
    const rows = await this.prisma.gymStaffMember.findMany({
      where: { gymId: ctx.gymId, status: { in: owner ? ['INVITED', 'ACTIVE'] : ['ACTIVE'] } },
      orderBy: [{ status: 'asc' }, { invitedAt: 'asc' }],
      select: { id: true, role: true, status: true, invitedAt: true, joinedAt: true, user: { select: { id: true, firstName: true, lastName: true, username: true } } },
    });
    return rows.map(({ user, ...s }) => ({ ...s, user: { id: user.id, name: nameOf(user), username: user.username } }));
  }

  async invite(userId: string, username: string, role: GymStaffRole) {
    const ctx = await this.context(userId, 'staff.manage');
    const target = await this.prisma.user.findUnique({
      where: { username: username.trim().toLowerCase() },
      select: { id: true, deletionRequestedAt: true, roles: { select: { role: true } } },
    });
    if (!target || target.deletionRequestedAt || target.id === userId || target.roles.some((r) => r.role === 'ADMIN' || r.role === 'MODERATOR')) {
      throw notFound('USER_NOT_FOUND', 'Bu kullanıcı adıyla davet edilebilecek biri bulunamadı.');
    }
    const existing = await this.prisma.gymStaffMember.findFirst({ where: { gymId: ctx.gymId, userId: target.id, status: { in: ['INVITED', 'ACTIVE'] } } });
    if (existing) throw conflict('ALREADY_INVITED', existing.status === 'ACTIVE' ? 'Bu kişi zaten ekibinde.' : 'Bu kişiye zaten davet gönderdin.');
    if ((await this.prisma.gymStaffMember.count({ where: { gymId: ctx.gymId, status: { in: ['INVITED', 'ACTIVE'] } } })) >= MAX_STAFF) {
      throw conflict('TOO_MANY_STAFF', `Ekip en fazla ${MAX_STAFF} kişi olabilir.`);
    }
    const created = await this.prisma.gymStaffMember.create({ data: { gymId: ctx.gymId, userId: target.id, role, invitedById: userId } });
    await this.prisma.notification.create({ data: { userId: target.id, type: 'gym_invite', data: { gymName: ctx.gymName, role } } });
    return created;
  }

  async changeRole(userId: string, id: string, role: GymStaffRole) {
    const ctx = await this.context(userId, 'staff.manage');
    const row = await this.prisma.gymStaffMember.findFirst({ where: { id, gymId: ctx.gymId, status: { in: ['INVITED', 'ACTIVE'] } } });
    if (!row) throw notFound('STAFF_NOT_FOUND', 'Ekip üyesi bulunamadı.');
    return this.prisma.gymStaffMember.update({ where: { id }, data: { role } });
  }

  // Ekipten çıkarma / daveti geri çekme. Başka salonda aktif görevi yoksa personel rolü kalkar.
  async endStaff(userId: string, id: string) {
    const ctx = await this.context(userId, 'staff.manage');
    const row = await this.prisma.gymStaffMember.findFirst({ where: { id, gymId: ctx.gymId, status: { in: ['INVITED', 'ACTIVE'] } } });
    if (!row) throw notFound('STAFF_NOT_FOUND', 'Ekip üyesi bulunamadı.');
    await this.prisma.gymStaffMember.update({ where: { id }, data: { status: 'ENDED', endedAt: new Date() } });
    await this.prisma.gymShift.deleteMany({ where: { gymId: ctx.gymId, userId: row.userId } });
    if (row.status === 'ACTIVE') {
      await this.dropStaffRoleIfIdle(row.userId);
      await this.prisma.notification.create({ data: { userId: row.userId, type: 'gym_staff_ended', data: { gymName: ctx.gymName } } });
    }
    return { id, status: 'ENDED' as const };
  }

  private async dropStaffRoleIfIdle(userId: string) {
    const still = await this.prisma.gymStaffMember.count({ where: { userId, status: 'ACTIVE' } });
    if (still === 0) await this.prisma.userRole.deleteMany({ where: { userId, role: 'GYM_STAFF' } });
  }

  // ───────────── Davet edilen kişi ─────────────

  async myInvites(userId: string) {
    const rows = await this.prisma.gymStaffMember.findMany({
      where: { userId, status: 'INVITED' },
      orderBy: { invitedAt: 'desc' },
      select: { id: true, role: true, invitedAt: true, gym: { select: { name: true, city: true } } },
    });
    return rows;
  }

  async accept(userId: string, id: string) {
    const row = await this.prisma.gymStaffMember.findFirst({ where: { id, userId, status: 'INVITED' }, select: { id: true, gymId: true, gym: { select: { ownerId: true } } } });
    if (!row) throw notFound('INVITE_NOT_FOUND', 'Davet bulunamadı.');
    // Aynı anda tek salonda görev (yetkilerin karışmaması için)
    if (await this.prisma.gymStaffMember.findFirst({ where: { userId, status: 'ACTIVE' }, select: { id: true } })) {
      throw conflict('ALREADY_STAFF', 'Zaten bir salonun ekibindesin. Önce oradan ayrılman gerekir.');
    }
    if (await this.prisma.gym.findUnique({ where: { ownerId: userId }, select: { id: true } })) {
      throw conflict('ALREADY_STAFF', 'Salon sahibi başka bir salonun ekibine katılamaz.');
    }
    await this.prisma.$transaction([
      this.prisma.gymStaffMember.update({ where: { id }, data: { status: 'ACTIVE', joinedAt: new Date() } }),
      this.prisma.userRole.upsert({ where: { userId_role: { userId, role: 'GYM_STAFF' } }, create: { userId, role: 'GYM_STAFF' }, update: {} }),
      this.prisma.notification.create({ data: { userId: row.gym.ownerId, type: 'gym_invite_accepted', data: { clientId: userId } } }),
    ]);
    return { id, status: 'ACTIVE' as const };
  }

  async decline(userId: string, id: string) {
    const row = await this.prisma.gymStaffMember.findFirst({ where: { id, userId, status: 'INVITED' }, select: { id: true } });
    if (!row) throw notFound('INVITE_NOT_FOUND', 'Davet bulunamadı.');
    await this.prisma.gymStaffMember.update({ where: { id }, data: { status: 'DECLINED', endedAt: new Date() } });
    return { id, status: 'DECLINED' as const };
  }

  // Personelin kendi isteğiyle ayrılması
  async leave(userId: string) {
    const row = await this.prisma.gymStaffMember.findFirst({ where: { userId, status: 'ACTIVE' }, select: { id: true, gymId: true } });
    if (!row) throw notFound('NOT_STAFF', 'Bir salonun ekibinde değilsin.');
    await this.prisma.gymStaffMember.update({ where: { id: row.id }, data: { status: 'ENDED', endedAt: new Date() } });
    await this.prisma.gymShift.deleteMany({ where: { gymId: row.gymId, userId } });
    await this.dropStaffRoleIfIdle(userId);
    return { id: row.id, status: 'ENDED' as const };
  }

  // ───────────── Paketler ─────────────

  async listPlans(userId: string, includeInactive: boolean) {
    const ctx = await this.context(userId, 'plans.view');
    return this.prisma.membershipPlan.findMany({
      where: { gymId: ctx.gymId, ...(includeInactive ? {} : { active: true }) },
      orderBy: [{ active: 'desc' }, { createdAt: 'asc' }],
    });
  }

  async addPlan(userId: string, input: { name: string; durationDays: number; sessionCount?: number; priceKurus: number }) {
    const ctx = await this.context(userId, 'plans.manage');
    if (await this.prisma.membershipPlan.findFirst({ where: { gymId: ctx.gymId, name: input.name.trim(), active: true }, select: { id: true } })) {
      throw conflict('PLAN_EXISTS', 'Bu adla aktif bir paket var.');
    }
    return this.prisma.membershipPlan.create({ data: { gymId: ctx.gymId, ...input, name: input.name.trim(), sessionCount: input.sessionCount ?? null } });
  }

  // Paketler silinmez (satılmış üyelikler ona bağlıdır); satıştan kaldırılır ya da fiyatı değişir
  async updatePlan(userId: string, id: string, patch: { name?: string; priceKurus?: number; active?: boolean }) {
    const ctx = await this.context(userId, 'plans.manage');
    const plan = await this.prisma.membershipPlan.findFirst({ where: { id, gymId: ctx.gymId } });
    if (!plan) throw notFound('PLAN_NOT_FOUND', 'Paket bulunamadı.');
    if (patch.name !== undefined && !patch.name.trim()) throw badRequest('INVALID_NAME', 'Paket adını yaz.');
    return this.prisma.membershipPlan.update({ where: { id }, data: { ...patch, ...(patch.name ? { name: patch.name.trim() } : {}) } });
  }
}
