import {
  Controller,
  Delete,
  Get,
  Inject,
  Param,
  Put,
  UseGuards,
} from '@nestjs/common';
import { z } from 'zod';
import { AuthGuard, CurrentUser, type AuthUser } from '../auth/auth.guard.js';
import {
  ConsentsService,
  OPTIONAL_CONSENTS,
  type OptionalConsentType,
} from './consents.service.js';

const typeSchema = z.enum(OPTIONAL_CONSENTS);

@Controller('consents')
@UseGuards(AuthGuard)
export class ConsentsController {
  constructor(@Inject(ConsentsService) private readonly consents: ConsentsService) {}

  // GET /api/consents → geçerli rızalar
  @Get()
  list(@CurrentUser() user: AuthUser) {
    return this.consents.listActive(user.userId);
  }

  // PUT /api/consents/health_data → rıza ver
  @Put(':type')
  grant(
    @CurrentUser() user: AuthUser,
    @Param('type', { schema: typeSchema }) type: OptionalConsentType,
  ) {
    return this.consents.grant(user.userId, type);
  }

  // DELETE /api/consents/health_data → rızayı geri çek
  @Delete(':type')
  revoke(
    @CurrentUser() user: AuthUser,
    @Param('type', { schema: typeSchema }) type: OptionalConsentType,
  ) {
    return this.consents.revoke(user.userId, type);
  }
}
