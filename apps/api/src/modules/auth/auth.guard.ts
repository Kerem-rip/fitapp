// Giriş yapmış kullanıcı gerektiren adresleri korur.
// Kullanım: @UseGuards(AuthGuard) + parametrede @CurrentUser()
import {
  CanActivate,
  createParamDecorator,
  ExecutionContext,
  Inject,
  Injectable,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { Request } from 'express';
import { unauthorized } from '../../common/app-error.js';
import { PrismaService } from '../../common/prisma/prisma.service.js';

export interface AuthUser {
  userId: string;
  sessionId: string;
}

type AuthedRequest = Request & { user?: AuthUser };

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    @Inject(JwtService) private readonly jwt: JwtService,
    @Inject(PrismaService) private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthedRequest>();
    const [scheme, token] = request.headers.authorization?.split(' ') ?? [];
    if (scheme !== 'Bearer' || !token) throw this.invalid();

    let payload: { sub: string; sid: string };
    try {
      payload = await this.jwt.verifyAsync(token);
    } catch {
      throw this.invalid();
    }

    // Oturum kapatıldıysa veya hesap silinme sürecindeyse anahtar süresi dolmasa da geçersizdir
    const session = await this.prisma.session.findFirst({
      where: {
        id: payload.sid,
        userId: payload.sub,
        revokedAt: null,
        user: { deletionRequestedAt: null },
      },
      select: { id: true },
    });
    if (!session) throw this.invalid();

    request.user = { userId: payload.sub, sessionId: payload.sid };
    return true;
  }

  private invalid() {
    return unauthorized('UNAUTHENTICATED', 'Oturum geçersiz. Lütfen tekrar giriş yapın.');
  }
}

export const CurrentUser = createParamDecorator(
  (_data: unknown, context: ExecutionContext): AuthUser =>
    context.switchToHttp().getRequest<AuthedRequest>().user!,
);
