// Sadece yönetici (ADMIN) ve moderatör (MODERATOR) rolündeki hesaplar geçebilir.
import { CanActivate, ExecutionContext, Inject, Injectable } from '@nestjs/common';
import type { Request } from 'express';
import { forbidden } from '../../common/app-error.js';
import { PrismaService } from '../../common/prisma/prisma.service.js';
import { AuthGuard, type AuthUser } from '../auth/auth.guard.js';

@Injectable()
export class AdminGuard implements CanActivate {
  constructor(
    @Inject(AuthGuard) private readonly auth: AuthGuard,
    @Inject(PrismaService) private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    await this.auth.canActivate(context);
    const request = context.switchToHttp().getRequest<Request & { user?: AuthUser }>();
    const staff = await this.prisma.userRole.count({
      where: { userId: request.user!.userId, role: { in: ['ADMIN', 'MODERATOR'] } },
    });
    if (staff === 0) throw forbidden('FORBIDDEN', 'Bu işlem için yetkin yok.');
    return true;
  }
}
