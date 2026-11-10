// Silme talebinin üzerinden 30 gün geçmiş hesapları kalıcı olarak siler.
import { Inject, Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../../common/prisma/prisma.service.js';
import { env } from '../../config/env.js';

const DAY_MS = 24 * 60 * 60 * 1000;

@Injectable()
export class AccountPurgeService {
  private readonly logger = new Logger(AccountPurgeService.name);

  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  @Cron(CronExpression.EVERY_DAY_AT_3AM)
  async purgeExpired(now: Date = new Date()): Promise<number> {
    const cutoff = new Date(now.getTime() - env.accountDeletionGraceDays * DAY_MS);
    const users = await this.prisma.user.findMany({
      where: { deletionRequestedAt: { lte: cutoff } },
      select: { id: true },
    });

    for (const { id } of users) {
      const files = await this.prisma.file.findMany({
        where: { ownerId: id },
        select: { id: true },
      });
      // Kullanıcı silinince bağlı tüm kayıtlar (rızalar, kayıtlar, mesajlar...) birlikte silinir.
      // Dosya kayıtları ayrıca silinir.
      // TODO(files modülü): dosyaların kendisi de depolama servisinden silinecek.
      await this.prisma.$transaction([
        this.prisma.user.delete({ where: { id } }),
        this.prisma.file.deleteMany({ where: { id: { in: files.map((f) => f.id) } } }),
      ]);
    }

    if (users.length > 0) {
      this.logger.log(`${users.length} hesap kalıcı olarak silindi`);
    }
    return users.length;
  }
}
