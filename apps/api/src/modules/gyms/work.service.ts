// Ekip işleri: görevler ve haftalık vardiya şablonu.
// Görevi sahip atar; görevli kişi tamamlar ya da geri açar. Vardiyayı sahip yazar; ekip görür.
import { Inject, Injectable } from '@nestjs/common';
import { badRequest, forbidden, notFound } from '../../common/app-error.js';
import { PrismaService } from '../../common/prisma/prisma.service.js';
import { can, timeToMin, toDay } from './gym-rules.js';
import { GymsService } from './gyms.service.js';

const DAY = /^\d{4}-\d{2}-\d{2}$/;
const isValidDay = (s: string) => DAY.test(s) && toDay(new Date(`${s}T00:00:00Z`)) === s;
const MAX_OPEN_TASKS = 300;

@Injectable()
export class WorkService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(GymsService) private readonly gyms: GymsService,
  ) {}

  // ───────────── Görevler ─────────────

  // Sahip tüm görevleri, diğerleri sadece kendine atananları görür
  async listTasks(userId: string, options: { status: 'open' | 'done' | 'all'; mine: boolean }) {
    const ctx = await this.gyms.context(userId);
    const all = can(ctx.role, 'tasks.manage') && !options.mine;
    const rows = await this.prisma.gymTask.findMany({
      where: {
        gymId: ctx.gymId,
        ...(all ? {} : { assigneeId: userId }),
        ...(options.status === 'open' ? { doneAt: null } : options.status === 'done' ? { doneAt: { not: null } } : {}),
      },
      orderBy: [{ doneAt: { sort: 'desc', nulls: 'first' } }, { dueDate: { sort: 'asc', nulls: 'last' } }, { createdAt: 'desc' }],
      take: 200,
    });
    const names = new Map((await this.gyms.teamOf(ctx.gymId)).map((p) => [p.userId, p.name]));
    return rows.map((t) => ({
      id: t.id,
      title: t.title,
      assignee: { id: t.assigneeId, name: names.get(t.assigneeId) ?? 'Eski ekip üyesi' },
      dueDate: t.dueDate ? toDay(t.dueDate) : null,
      done: t.doneAt !== null,
      doneAt: t.doneAt,
      createdAt: t.createdAt,
    }));
  }

  private async assignable(gymId: string, assigneeId: string) {
    const person = (await this.gyms.teamOf(gymId)).find((p) => p.userId === assigneeId);
    if (!person) throw badRequest('ASSIGNEE_NOT_FOUND', 'Görev sadece salon ekibinden birine atanabilir.');
    return person;
  }

  async createTask(userId: string, input: { title: string; assigneeId: string; dueDate?: string }) {
    const ctx = await this.gyms.context(userId, 'tasks.manage');
    await this.assignable(ctx.gymId, input.assigneeId);
    if (input.dueDate && !isValidDay(input.dueDate)) throw badRequest('INVALID_DATE', 'Son tarih geçerli değil.');
    if ((await this.prisma.gymTask.count({ where: { gymId: ctx.gymId, doneAt: null } })) >= MAX_OPEN_TASKS) {
      throw badRequest('TOO_MANY_TASKS', 'Çok fazla açık görev var; önce bazılarını kapat.');
    }
    const task = await this.prisma.gymTask.create({
      data: { gymId: ctx.gymId, title: input.title.trim(), assigneeId: input.assigneeId, dueDate: input.dueDate ? new Date(`${input.dueDate}T00:00:00Z`) : null, createdById: userId },
    });
    if (input.assigneeId !== userId) {
      await this.prisma.notification.create({ data: { userId: input.assigneeId, type: 'gym_task_assigned', data: { gymName: ctx.gymName } } });
    }
    return task;
  }

  async updateTask(userId: string, id: string, patch: { title?: string; assigneeId?: string; dueDate?: string | null }) {
    const ctx = await this.gyms.context(userId, 'tasks.manage');
    const task = await this.prisma.gymTask.findFirst({ where: { id, gymId: ctx.gymId } });
    if (!task) throw notFound('TASK_NOT_FOUND', 'Görev bulunamadı.');
    if (patch.assigneeId) await this.assignable(ctx.gymId, patch.assigneeId);
    if (patch.dueDate && !isValidDay(patch.dueDate)) throw badRequest('INVALID_DATE', 'Son tarih geçerli değil.');
    return this.prisma.gymTask.update({
      where: { id },
      data: {
        ...(patch.title !== undefined ? { title: patch.title.trim() } : {}),
        ...(patch.assigneeId ? { assigneeId: patch.assigneeId } : {}),
        ...(patch.dueDate !== undefined ? { dueDate: patch.dueDate ? new Date(`${patch.dueDate}T00:00:00Z`) : null } : {}),
      },
    });
  }

  async removeTask(userId: string, id: string) {
    const ctx = await this.gyms.context(userId, 'tasks.manage');
    const removed = await this.prisma.gymTask.deleteMany({ where: { id, gymId: ctx.gymId } });
    if (removed.count === 0) throw notFound('TASK_NOT_FOUND', 'Görev bulunamadı.');
    return { id, removed: true };
  }

  // Görevli kişi ya da sahip tamamlar / geri açar
  async setDone(userId: string, id: string, done: boolean) {
    const ctx = await this.gyms.context(userId);
    const task = await this.prisma.gymTask.findFirst({ where: { id, gymId: ctx.gymId } });
    if (!task) throw notFound('TASK_NOT_FOUND', 'Görev bulunamadı.');
    if (task.assigneeId !== userId && !can(ctx.role, 'tasks.manage')) throw forbidden('GYM_FORBIDDEN', 'Bu görev sana atanmamış.');
    return this.prisma.gymTask.update({ where: { id }, data: done ? { doneAt: new Date(), doneById: userId } : { doneAt: null, doneById: null } });
  }

  // ───────────── Vardiyalar ─────────────

  // Ekipteki herkesin haftalık şablonu: 7 gün, her gün { start, end } ya da null (izinli)
  async listShifts(userId: string) {
    const ctx = await this.gyms.context(userId);
    const team = await this.gyms.teamOf(ctx.gymId);
    const rows = await this.prisma.gymShift.findMany({ where: { gymId: ctx.gymId } });
    return team.map((p) => ({
      user: { id: p.userId, name: p.name, username: p.username },
      role: p.role,
      days: Array.from({ length: 7 }, (_, weekday) => {
        const s = rows.find((r) => r.userId === p.userId && r.weekday === weekday);
        return s ? { start: s.startTime, end: s.endTime } : null;
      }),
    }));
  }

  // Bir günün vardiyasını yazar; null ise o gün izinli
  async setShift(userId: string, targetUserId: string, weekday: number, shift: { start: string; end: string } | null) {
    const ctx = await this.gyms.context(userId, 'shifts.manage');
    if (!(await this.gyms.teamOf(ctx.gymId)).some((p) => p.userId === targetUserId)) throw notFound('STAFF_NOT_FOUND', 'Ekip üyesi bulunamadı.');
    if (!shift) {
      await this.prisma.gymShift.deleteMany({ where: { gymId: ctx.gymId, userId: targetUserId, weekday } });
      return { weekday, shift: null };
    }
    const start = timeToMin(shift.start);
    const end = timeToMin(shift.end);
    if (start === null || end === null || end <= start) throw badRequest('INVALID_TIME', 'Vardiya saatleri geçerli değil (bitiş başlangıçtan sonra olmalı).');
    await this.prisma.gymShift.upsert({
      where: { gymId_userId_weekday: { gymId: ctx.gymId, userId: targetUserId, weekday } },
      create: { gymId: ctx.gymId, userId: targetUserId, weekday, startTime: shift.start, endTime: shift.end },
      update: { startTime: shift.start, endTime: shift.end },
    });
    return { weekday, shift };
  }
}
