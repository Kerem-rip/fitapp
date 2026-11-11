import { Body, Controller, Get, HttpCode, Inject, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { z } from 'zod';
import type { SharedDataType } from '../../generated/prisma/enums.js';
import { AuthGuard, CurrentUser, type AuthUser } from '../auth/auth.guard.js';
import { AuditService } from './audit.service.js';
import { RelationshipsService, SHARED_DATA_TYPES } from './relationships.service.js';

const sharedDataSchema = z.array(z.enum(SHARED_DATA_TYPES)).max(SHARED_DATA_TYPES.length);
const untilSchema = z.iso.datetime().transform((value) => new Date(value));

const offerSchema = z.object({ username: z.string().trim().min(3).max(30) });
const acceptSchema = z.object({
  sharedData: sharedDataSchema.default([]),
  sharedUntil: untilSchema.nullable().default(null),
});
const sharingSchema = z.object({ sharedData: sharedDataSchema.optional(), sharedUntil: untilSchema.nullable().optional() });
const listSchema = z.object({ status: z.enum(['OFFERED', 'ACTIVE', 'ENDED']).default('ACTIVE') });
const auditSchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(50),
  before: untilSchema.optional(),
});

@Controller('relationships')
@UseGuards(AuthGuard)
export class RelationshipsController {
  constructor(
    @Inject(RelationshipsService) private readonly relationships: RelationshipsService,
    @Inject(AuditService) private readonly audit: AuditService,
  ) {}

  // POST /api/relationships/offer { username } → (profesyonel) danışan teklifi
  @Post('offer')
  @HttpCode(201)
  offer(@CurrentUser() user: AuthUser, @Body({ schema: offerSchema }) body: { username: string }) {
    return this.relationships.offer(user.userId, body.username);
  }

  // GET /api/relationships/as-professional?status=ACTIVE → (profesyonel) danışanlarım
  @Get('as-professional')
  asProfessional(@CurrentUser() user: AuthUser, @Query({ schema: listSchema }) query: { status: 'OFFERED' | 'ACTIVE' | 'ENDED' }) {
    return this.relationships.listAsProfessional(user.userId, query.status);
  }

  // GET /api/relationships/as-client → (danışan) bana gelen teklifler ve aktif danışanlıklarım
  @Get('as-client')
  asClient(@CurrentUser() user: AuthUser) {
    return this.relationships.listAsClient(user.userId);
  }

  // GET /api/relationships/audit?limit=50&before=... → verime kim ne yaptı
  @Get('audit')
  async auditLog(@CurrentUser() user: AuthUser, @Query({ schema: auditSchema }) query: { limit: number; before?: Date }) {
    return this.audit.listForUser(user.userId, query.limit, query.before);
  }

  // POST /api/relationships/:id/accept { sharedData, sharedUntil }
  @Post(':id/accept')
  @HttpCode(200)
  accept(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body({ schema: acceptSchema }) body: { sharedData: SharedDataType[]; sharedUntil: Date | null },
  ) {
    return this.relationships.accept(user.userId, id, body);
  }

  // POST /api/relationships/:id/decline
  @Post(':id/decline')
  @HttpCode(200)
  decline(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.relationships.decline(user.userId, id);
  }

  // PATCH /api/relationships/:id/sharing { sharedData?, sharedUntil? }
  @Patch(':id/sharing')
  sharing(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body({ schema: sharingSchema }) body: { sharedData?: SharedDataType[]; sharedUntil?: Date | null },
  ) {
    return this.relationships.updateSharing(user.userId, id, body);
  }

  // POST /api/relationships/:id/end → danışan veya profesyonel danışanlığı bitirir
  @Post(':id/end')
  @HttpCode(200)
  end(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.relationships.end(user.userId, id);
  }
}
