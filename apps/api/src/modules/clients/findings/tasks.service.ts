// Uzmanın takip görevleri (bir maddeden ya da kendiliğinden). Görevler uzmana aittir; danışan görmez.
import { Inject, Injectable } from '@nestjs/common';
import { conflict, forbidden, notFound } from '../../../common/app-error.js';
import { PrismaService } from '../../../common/prisma/prisma.service.js';
import type { TaskStatus } from '../../../generated/prisma/enums.js';

const nameOf = (p: { firstName: string | null; lastName: string | null; username: string }) =>
  [p.firstName, p.lastName].filter(Boolean).join(' ') || p.username;

@Injectable()
export class TasksService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  // Görev açmak için aktif danışanlık gerekir
  async create(professionalId: string, clientId: string, input: { title: string; dueAt?: Date }) {
    const active = await this.prisma.clientRelationship.findFirst({
      where: { professionalId, clientId, status: 'ACTIVE' },
      select: { id: true },
    });
    if (!active) throw forbidden('NO_ACCESS', 'Bu danışan için görev açamazsın.');
    return this.prisma.followUpTask.create({
      data: { professionalId, clientId, title: input.title.trim(), dueAt: input.dueAt },
      select: { id: true, title: true, dueAt: true, status: true, doneAt: true },
    });
  }

  // Vadesi olanlar önce, vadesizler sonda
  async list(professionalId: string, options: { status: TaskStatus; clientId?: string }) {
    const rows = await this.prisma.followUpTask.findMany({
      where: { professionalId, status: options.status, ...(options.clientId ? { clientId: options.clientId } : {}) },
      select: {
        id: true,
        title: true,
        dueAt: true,
        status: true,
        doneAt: true,
        createdAt: true,
        findingId: true,
        client: { select: { id: true, firstName: true, lastName: true, username: true } },
      },
    });
    return rows
      .sort((a, b) => (a.dueAt?.getTime() ?? Infinity) - (b.dueAt?.getTime() ?? Infinity) || a.createdAt.getTime() - b.createdAt.getTime())
      .map(({ client, ...task }) => ({ ...task, client: { id: client.id, name: nameOf(client), username: client.username } }));
  }

  // Görev bitince, ona bağlı madde başka açık görev yoksa tekrar değerlendirilmek üzere açılır
  async done(professionalId: string, taskId: string) {
    const task = await this.prisma.followUpTask.findFirst({
      where: { id: taskId, professionalId },
      select: { id: true, status: true, findingId: true },
    });
    if (!task) throw notFound('TASK_NOT_FOUND', 'Görev bulunamadı.');
    if (task.status === 'DONE') throw conflict('ALREADY_DONE', 'Bu görev zaten tamamlanmış.');

    await this.prisma.followUpTask.update({ where: { id: taskId }, data: { status: 'DONE', doneAt: new Date() } });
    if (task.findingId) {
      const others = await this.prisma.followUpTask.count({ where: { findingId: task.findingId, status: 'OPEN' } });
      const finding = await this.prisma.reviewFinding.findUnique({ where: { id: task.findingId }, select: { status: true } });
      if (others === 0 && finding?.status === 'FOLLOW_UP') {
        await this.prisma.$transaction([
          this.prisma.reviewFinding.update({ where: { id: task.findingId }, data: { status: 'OPEN' } }),
          this.prisma.reviewFindingEvent.create({
            data: { findingId: task.findingId, kind: 'TASK_DONE', text: 'Takip görevi tamamlandı; maddeyi yeniden değerlendir.', byId: professionalId },
          }),
        ]);
      }
    }
    return { id: taskId, status: 'DONE' as const };
  }
}
