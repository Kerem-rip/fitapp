// Uzmanın danışana zamanlı hatırlatması (ör. "Su içmeyi unutma", "Yarın ölçümünü gir").
// Zamanı gelince danışana bildirim gider. Danışanlık o an aktif değilse gönderilmez, iptal edilir.
import { Inject, Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { badRequest, conflict, forbidden, notFound } from '../../../common/app-error.js';
import { PrismaService } from '../../../common/prisma/prisma.service.js';

const MAX_AHEAD_MS = 365 * 86_400_000;

@Injectable()
export class RemindersService {
  private readonly log = new Logger(RemindersService.name);

  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async create(professionalId: string, clientId: string, input: { text: string; remindAt: Date }) {
    const rel = await this.prisma.clientRelationship.findFirst({ where: { professionalId, clientId, status: 'ACTIVE' }, select: { id: true } });
    if (!rel) throw forbidden('NO_ACCESS', 'Bu danışana hatırlatma gönderemezsin.');
    const at = input.remindAt.getTime();
    if (at < Date.now() - 60_000) throw badRequest('IN_PAST', 'Hatırlatma zamanı geçmişte olamaz.');
    if (at > Date.now() + MAX_AHEAD_MS) throw badRequest('TOO_FAR', 'Hatırlatma en fazla 1 yıl sonrasına kurulabilir.');
    return this.prisma.clientReminder.create({
      data: { professionalId, clientId, text: input.text.trim(), remindAt: input.remindAt },
      select: { id: true, text: true, remindAt: true, sentAt: true, cancelledAt: true },
    });
  }

  list(professionalId: string, clientId: string) {
    return this.prisma.clientReminder.findMany({
      where: { professionalId, clientId },
      orderBy: { remindAt: 'desc' },
      take: 50,
      select: { id: true, text: true, remindAt: true, sentAt: true, cancelledAt: true },
    });
  }

  async cancel(professionalId: string, id: string) {
    const r = await this.prisma.clientReminder.findFirst({ where: { id, professionalId } });
    if (!r) throw notFound('REMINDER_NOT_FOUND', 'Hatırlatma bulunamadı.');
    if (r.sentAt || r.cancelledAt) throw conflict('NOT_PENDING', 'Bu hatırlatma artık beklemede değil.');
    return this.prisma.clientReminder.update({
      where: { id },
      data: { cancelledAt: new Date() },
      select: { id: true, text: true, remindAt: true, sentAt: true, cancelledAt: true },
    });
  }

  @Cron(CronExpression.EVERY_MINUTE)
  async sendDue(now = new Date()): Promise<number> {
    const due = await this.prisma.clientReminder.findMany({
      where: { remindAt: { lte: now }, sentAt: null, cancelledAt: null },
      take: 200,
      select: { id: true, professionalId: true, clientId: true, text: true },
    });
    let sent = 0;
    for (const r of due) {
      try {
        const active = await this.prisma.clientRelationship.findFirst({
          where: { professionalId: r.professionalId, clientId: r.clientId, status: 'ACTIVE' },
          select: { id: true },
        });
        if (!active) {
          await this.prisma.clientReminder.update({ where: { id: r.id }, data: { cancelledAt: now } });
          continue;
        }
        await this.prisma.$transaction([
          this.prisma.clientReminder.update({ where: { id: r.id }, data: { sentAt: now } }),
          this.prisma.notification.create({
            data: { userId: r.clientId, type: 'reminder', data: { reminderId: r.id, professionalId: r.professionalId, text: r.text } },
          }),
        ]);
        sent += 1;
      } catch (e) {
        this.log.warn(`Hatırlatma gönderilemedi: ${(e as Error).message}`);
      }
    }
    return sent;
  }
}
