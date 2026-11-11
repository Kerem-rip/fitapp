// Denetim kaydı: sağlık verisiyle ilgili işlemler sadece eklenir, hiç değiştirilmez.
// Kaydın konusu olan kullanıcı, neyin kimle paylaşıldığını ve kimin baktığını görebilir.
import { Inject, Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service.js';
import type { Prisma } from '../../generated/prisma/client.js';

export type AuditAction =
  | 'OFFER_SENT'
  | 'OFFER_ACCEPTED'
  | 'OFFER_DECLINED'
  | 'SHARING_CHANGED'
  | 'RELATIONSHIP_ENDED'
  | 'DATA_VIEWED'
  | 'DATA_CHANGED'
  | 'ACCESS_DENIED';

export interface AuditEntry {
  actorId: string | null;
  targetUserId: string;
  action: AuditAction;
  category?: string;
  relationshipId?: string;
  meta?: Prisma.InputJsonValue;
}

@Injectable()
export class AuditService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  // İşlemle aynı transaction içinde yazmak için `Prisma.TransactionClient` verilebilir
  record(entry: AuditEntry, db: Pick<PrismaService, 'auditLog'> = this.prisma) {
    return db.auditLog.create({
      data: {
        actorId: entry.actorId,
        targetUserId: entry.targetUserId,
        action: entry.action,
        category: entry.category,
        relationshipId: entry.relationshipId,
        meta: entry.meta,
      },
    });
  }

  // Kullanıcının kendi verisiyle ilgili kayıtlar (en yeniden eskiye)
  async listForUser(userId: string, limit: number, before?: Date) {
    const rows = await this.prisma.auditLog.findMany({
      where: { targetUserId: userId, ...(before ? { createdAt: { lt: before } } : {}) },
      orderBy: { createdAt: 'desc' },
      take: limit,
      select: {
        id: true,
        action: true,
        category: true,
        relationshipId: true,
        meta: true,
        createdAt: true,
        actor: { select: { firstName: true, lastName: true, username: true } },
      },
    });
    return rows;
  }
}
