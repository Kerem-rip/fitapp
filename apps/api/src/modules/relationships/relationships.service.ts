// Danışanlık: profesyonel teklif eder → danışan kabul eder ve neyi, ne zamana kadar paylaşacağını seçer.
// Danışan paylaşımı istediği an değiştirir ya da bitirir; profesyonel erişimi o anda kapanır.
import { Inject, Injectable } from '@nestjs/common';
import { badRequest, conflict, forbidden, notFound } from '../../common/app-error.js';
import { ageGroupOf } from '../../common/age.js';
import { PrismaService } from '../../common/prisma/prisma.service.js';
import type { ClientStatus, SharedDataType } from '../../generated/prisma/enums.js';
import { ConsentsService } from '../consents/consents.service.js';
import { AuditService } from './audit.service.js';

export const SHARED_DATA_TYPES = ['MEALS', 'WATER', 'WEIGHT', 'MEASUREMENTS', 'PHOTOS', 'ANAMNESIS'] as const;

const MAX_PENDING_OFFERS = 20;
const MAX_SHARE_DAYS = 730;

const PROFESSIONAL_SELECT = {
  professional: {
    select: {
      type: true,
      title: true,
      city: true,
      user: { select: { firstName: true, lastName: true, username: true } },
    },
  },
} as const;

type Pro = { type: string; title: string | null; city: string | null; user: { firstName: string | null; lastName: string | null; username: string } };

interface RelationshipRow {
  id: string;
  status: ClientStatus;
  sharedData: SharedDataType[];
  sharedUntil: Date | null;
  offeredAt: Date;
  acceptedAt: Date | null;
}

const present = (row: RelationshipRow) => ({
  id: row.id,
  status: row.status,
  sharedData: row.sharedData,
  sharedUntil: row.sharedUntil,
  // Süre dolduysa danışanlık sürer ama profesyonel hiçbir veriyi göremez
  sharingExpired: row.status === 'ACTIVE' && row.sharedUntil !== null && row.sharedUntil <= new Date(),
  offeredAt: row.offeredAt,
  acceptedAt: row.acceptedAt,
});

@Injectable()
export class RelationshipsService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(ConsentsService) private readonly consents: ConsentsService,
    @Inject(AuditService) private readonly audit: AuditService,
  ) {}

  // ───────────── Profesyonel tarafı ─────────────

  async offer(professionalId: string, username: string) {
    const profile = await this.prisma.professionalProfile.findUnique({
      where: { userId: professionalId },
      select: { type: true, verification: true },
    });
    if (!profile || profile.verification !== 'APPROVED' || profile.type === 'GYM') {
      throw forbidden('NOT_A_PROFESSIONAL', 'Danışan teklif etmek için onaylı bir diyetisyen veya eğitmen olmalısın.');
    }

    const client = await this.prisma.user.findUnique({
      where: { username: username.trim().toLowerCase() },
      select: {
        id: true,
        birthDate: true,
        deletionRequestedAt: true,
        firstName: true,
        lastName: true,
        username: true,
        roles: { select: { role: true } },
        blocking: { where: { blockedId: professionalId }, select: { blockerId: true } },
      },
    });
    const reachable =
      client !== null &&
      client.id !== professionalId &&
      client.deletionRequestedAt === null &&
      client.blocking.length === 0 &&
      !client.roles.some((r) => r.role === 'ADMIN' || r.role === 'MODERATOR');
    if (!reachable) throw notFound('USER_NOT_FOUND', 'Bu kullanıcı adıyla ulaşabileceğin biri bulunamadı.');

    await this.requireParentalContact(client.id, client.birthDate);

    const existing = await this.prisma.clientRelationship.findFirst({
      where: { professionalId, clientId: client.id, status: { in: ['OFFERED', 'ACTIVE'] } },
      select: { status: true },
    });
    if (existing) {
      throw conflict(
        'ALREADY_RELATED',
        existing.status === 'ACTIVE' ? 'Bu kişi zaten danışanın.' : 'Bu kişiye zaten bir teklif gönderdin.',
      );
    }
    const pending = await this.prisma.clientRelationship.count({ where: { professionalId, status: 'OFFERED' } });
    if (pending >= MAX_PENDING_OFFERS) {
      throw conflict('TOO_MANY_OFFERS', 'Yanıt bekleyen çok fazla teklifin var. Birkaçı yanıtlanınca yenisini gönderebilirsin.');
    }

    const row = await this.prisma.$transaction(async (tx) => {
      const created = await tx.clientRelationship.create({
        data: { professionalId, clientId: client.id },
        select: { id: true, status: true, sharedData: true, sharedUntil: true, offeredAt: true, acceptedAt: true },
      });
      await tx.notification.create({
        data: { userId: client.id, type: 'client_offer', data: { relationshipId: created.id, professionalId } },
      });
      await this.audit.record(
        { actorId: professionalId, targetUserId: client.id, action: 'OFFER_SENT', relationshipId: created.id },
        tx,
      );
      return created;
    });
    return { ...present(row), client: { firstName: client.firstName, lastName: client.lastName, username: client.username } };
  }

  async listAsProfessional(professionalId: string, status: ClientStatus) {
    const rows = await this.prisma.clientRelationship.findMany({
      where: { professionalId, status },
      orderBy: { offeredAt: 'desc' },
      select: {
        id: true,
        status: true,
        sharedData: true,
        sharedUntil: true,
        offeredAt: true,
        acceptedAt: true,
        // Profesyonel danışanın sadece adını ve kullanıcı adını görür; sağlık verisine erişim ayrı kapıdan geçer
        client: { select: { id: true, firstName: true, lastName: true, username: true } },
      },
    });
    return rows.map(({ client, ...row }) => ({ ...present(row), client }));
  }

  // ───────────── Danışan tarafı ─────────────

  async listAsClient(clientId: string) {
    const rows = await this.prisma.clientRelationship.findMany({
      where: { clientId, status: { in: ['OFFERED', 'ACTIVE'] } },
      orderBy: { offeredAt: 'desc' },
      select: {
        id: true,
        status: true,
        sharedData: true,
        sharedUntil: true,
        offeredAt: true,
        acceptedAt: true,
        ...PROFESSIONAL_SELECT,
      },
    });
    return rows.map(({ professional, ...row }) => ({ ...present(row), professional: presentPro(professional) }));
  }

  async accept(clientId: string, id: string, input: { sharedData: SharedDataType[]; sharedUntil: Date | null }) {
    const relationship = await this.requireOwn(clientId, id);
    if (relationship.status !== 'OFFERED') throw conflict('NOT_PENDING', 'Bu teklif artık yanıt beklemiyor.');
    const sharedData = await this.validatedSharing(clientId, input.sharedData, input.sharedUntil);

    const now = new Date();
    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.clientRelationship.update({
        where: { id },
        data: { status: 'ACTIVE', acceptedAt: now, sharedData, sharedUntil: input.sharedUntil },
        select: { id: true, status: true, sharedData: true, sharedUntil: true, offeredAt: true, acceptedAt: true },
      });
      await tx.notification.create({
        data: { userId: relationship.professionalId, type: 'client_accepted', data: { relationshipId: id, clientId } },
      });
      await this.audit.record(
        {
          actorId: clientId,
          targetUserId: clientId,
          action: 'OFFER_ACCEPTED',
          relationshipId: id,
          meta: { sharedData, sharedUntil: input.sharedUntil?.toISOString() ?? null },
        },
        tx,
      );
      return present(updated);
    });
  }

  async decline(clientId: string, id: string) {
    const relationship = await this.requireOwn(clientId, id);
    if (relationship.status !== 'OFFERED') throw conflict('NOT_PENDING', 'Bu teklif artık yanıt beklemiyor.');
    await this.prisma.$transaction(async (tx) => {
      await tx.clientRelationship.update({
        where: { id },
        data: { status: 'ENDED', endedAt: new Date(), endedById: clientId },
      });
      await tx.notification.create({
        data: { userId: relationship.professionalId, type: 'client_declined', data: { relationshipId: id } },
      });
      await this.audit.record(
        { actorId: clientId, targetUserId: clientId, action: 'OFFER_DECLINED', relationshipId: id },
        tx,
      );
    });
    return { id, status: 'ENDED' as const };
  }

  async updateSharing(clientId: string, id: string, input: { sharedData?: SharedDataType[]; sharedUntil?: Date | null }) {
    const relationship = await this.requireOwn(clientId, id);
    if (relationship.status !== 'ACTIVE') throw conflict('NOT_ACTIVE', 'Paylaşım ayarı sadece aktif danışanlıkta değişir.');

    const nextUntil = input.sharedUntil === undefined ? relationship.sharedUntil : input.sharedUntil;
    const nextData = await this.validatedSharing(clientId, input.sharedData ?? relationship.sharedData, nextUntil);

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.clientRelationship.update({
        where: { id },
        data: { sharedData: nextData, sharedUntil: nextUntil },
        select: { id: true, status: true, sharedData: true, sharedUntil: true, offeredAt: true, acceptedAt: true },
      });
      await this.audit.record(
        {
          actorId: clientId,
          targetUserId: clientId,
          action: 'SHARING_CHANGED',
          relationshipId: id,
          meta: {
            before: relationship.sharedData,
            after: nextData,
            untilBefore: relationship.sharedUntil?.toISOString() ?? null,
            untilAfter: nextUntil?.toISOString() ?? null,
          },
        },
        tx,
      );
      return present(updated);
    });
  }

  // ───────────── İki taraf da ─────────────

  // Danışan da profesyonel de danışanlığı bitirebilir; bittiği an profesyonelin erişimi kapanır
  async end(userId: string, id: string) {
    const relationship = await this.prisma.clientRelationship.findFirst({
      where: { id, OR: [{ clientId: userId }, { professionalId: userId }] },
      select: { id: true, status: true, clientId: true, professionalId: true },
    });
    if (!relationship) throw notFound('RELATIONSHIP_NOT_FOUND', 'Danışanlık bulunamadı.');
    if (relationship.status === 'ENDED') throw conflict('ALREADY_ENDED', 'Bu danışanlık zaten sona ermiş.');

    const other = relationship.clientId === userId ? relationship.professionalId : relationship.clientId;
    await this.prisma.$transaction(async (tx) => {
      await tx.clientRelationship.update({
        where: { id },
        data: { status: 'ENDED', endedAt: new Date(), endedById: userId },
      });
      await tx.notification.create({
        data: { userId: other, type: 'relationship_ended', data: { relationshipId: id } },
      });
      await this.audit.record(
        { actorId: userId, targetUserId: relationship.clientId, action: 'RELATIONSHIP_ENDED', relationshipId: id },
        tx,
      );
    });
    return { id, status: 'ENDED' as const };
  }

  // ───────────── Yardımcılar ─────────────

  private async requireOwn(clientId: string, id: string) {
    const relationship = await this.prisma.clientRelationship.findFirst({
      where: { id, clientId },
      select: { id: true, status: true, professionalId: true, sharedData: true, sharedUntil: true },
    });
    if (!relationship) throw notFound('RELATIONSHIP_NOT_FOUND', 'Danışanlık bulunamadı.');
    return relationship;
  }

  // 18 yaş altı, uzmanla iletişim için veli onayı olmadan danışan olamaz
  private async requireParentalContact(userId: string, birthDate: Date) {
    if (ageGroupOf(birthDate) === 'ADULT') return;
    const approved = await this.prisma.parentalConsent.findFirst({
      where: { userId, scope: 'contact_professionals', approvedAt: { not: null }, revokedAt: null },
      select: { id: true },
    });
    if (!approved) {
      throw forbidden('PARENTAL_CONSENT_REQUIRED', '18 yaşından küçükler için uzmanlarla iletişime veli onayı gerekir.');
    }
  }

  // Paylaşım seçimini doğrular: sağlık verisi rızası, yaş ve süre kuralları
  private async validatedSharing(clientId: string, requested: SharedDataType[], until: Date | null) {
    const sharedData = [...new Set(requested)];
    if (until) {
      const now = Date.now();
      if (until.getTime() <= now) throw badRequest('INVALID_SHARE_UNTIL', 'Paylaşım bitiş tarihi gelecekte olmalı.');
      if (until.getTime() > now + MAX_SHARE_DAYS * 86_400_000) {
        throw badRequest('INVALID_SHARE_UNTIL', 'Paylaşım en fazla 2 yıl için verilebilir.');
      }
    }
    if (sharedData.length > 0) {
      const user = await this.prisma.user.findUniqueOrThrow({ where: { id: clientId }, select: { birthDate: true } });
      if (ageGroupOf(user.birthDate) !== 'ADULT') {
        throw forbidden('PARENTAL_CONSENT_REQUIRED', '18 yaşından küçükler için sağlık verisi paylaşımı veli tarafından verilmelidir.');
      }
      if (!(await this.consents.hasActive(clientId, 'health_data'))) {
        throw forbidden('HEALTH_CONSENT_REQUIRED', 'Sağlık verisi paylaşmak için önce Profil bölümünden sağlık verisi iznini vermelisin.');
      }
    }
    return sharedData;
  }
}

function presentPro(pro: Pro) {
  return {
    type: pro.type,
    title: pro.title,
    city: pro.city,
    firstName: pro.user.firstName,
    lastName: pro.user.lastName,
    username: pro.user.username,
  };
}
