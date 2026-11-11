// Profesyonelin danışanın verisine erişim kapısı. Sağlık verisi okuyan/yazan her modül buradan geçer.
// Erişim ancak şu dördü birlikte doğruysa verilir:
//   1) aktif danışanlık var, 2) paylaşım süresi dolmamış, 3) o veri türü paylaşılmış, 4) danışanın sağlık verisi rızası geçerli.
// Her başarılı erişim ve (danışanlık varken) reddedilen her deneme denetim kaydına yazılır.
import { Inject, Injectable } from '@nestjs/common';
import { forbidden } from '../../common/app-error.js';
import { PrismaService } from '../../common/prisma/prisma.service.js';
import type { SharedDataType } from '../../generated/prisma/enums.js';
import { ConsentsService } from '../consents/consents.service.js';
import { AuditService } from './audit.service.js';

export type DenyReason = 'NO_RELATIONSHIP' | 'SHARING_EXPIRED' | 'NOT_SHARED' | 'CONSENT_REVOKED';

@Injectable()
export class AccessService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(ConsentsService) private readonly consents: ConsentsService,
    @Inject(AuditService) private readonly audit: AuditService,
  ) {}

  // Erişim yoksa neden döner; varsa null. Kayıt yazmaz.
  async check(professionalId: string, clientId: string, category: SharedDataType, now = new Date()) {
    const relationship = await this.prisma.clientRelationship.findFirst({
      where: { professionalId, clientId, status: 'ACTIVE' },
      select: { id: true, sharedData: true, sharedUntil: true },
    });
    let reason: DenyReason | null = null;
    if (!relationship) reason = 'NO_RELATIONSHIP';
    else if (relationship.sharedUntil && relationship.sharedUntil <= now) reason = 'SHARING_EXPIRED';
    else if (!relationship.sharedData.includes(category)) reason = 'NOT_SHARED';
    else if (!(await this.consents.hasActive(clientId, 'health_data'))) reason = 'CONSENT_REVOKED';
    return { relationship, reason };
  }

  // Erişimi doğrular ve kaydeder. Erişim yoksa 403 fırlatır (neden dışarıya söylenmez).
  async requireAccess(
    professionalId: string,
    clientId: string,
    category: SharedDataType,
    action: 'DATA_VIEWED' | 'DATA_CHANGED' = 'DATA_VIEWED',
    meta?: Record<string, string>,
  ) {
    const { relationship, reason } = await this.check(professionalId, clientId, category);
    if (reason || !relationship) {
      // Hiç danışanlık yoksa kaydedilecek bir konu da yoktur (yabancı denemesi)
      if (relationship) {
        await this.audit.record({
          actorId: professionalId,
          targetUserId: clientId,
          action: 'ACCESS_DENIED',
          category,
          relationshipId: relationship.id,
          meta: { reason: reason ?? 'NOT_SHARED' },
        });
      }
      throw forbidden('NO_ACCESS', 'Bu bilgiye erişimin yok.');
    }
    await this.audit.record({
      actorId: professionalId,
      targetUserId: clientId,
      action,
      category,
      relationshipId: relationship.id,
      meta,
    });
    return relationship;
  }
}
