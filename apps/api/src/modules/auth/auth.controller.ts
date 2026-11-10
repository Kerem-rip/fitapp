import {
  Body,
  Controller,
  HttpCode,
  Inject,
  Post,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { env } from '../../config/env.js';
import { AuthGuard, CurrentUser, type AuthUser } from './auth.guard.js';
import { AuthService } from './auth.service.js';
import {
  loginSchema,
  refreshSchema,
  registerSchema,
  type LoginDto,
  type RefreshDto,
  type RegisterDto,
} from './dto/auth.schemas.js';

// Şifre deneme saldırılarına karşı: bu adreslere dakikada sınırlı istek atılabilir
const authLimit = { default: { limit: env.authRateLimitPerMinute, ttl: 60_000 } };

@Controller('auth')
export class AuthController {
  constructor(@Inject(AuthService) private readonly auth: AuthService) {}

  // POST /api/auth/register
  @Post('register')
  @Throttle(authLimit)
  register(@Body({ schema: registerSchema }) dto: RegisterDto) {
    return this.auth.register(dto);
  }

  // POST /api/auth/login
  @Post('login')
  @HttpCode(200)
  @Throttle(authLimit)
  login(@Body({ schema: loginSchema }) dto: LoginDto) {
    return this.auth.login(dto);
  }

  // POST /api/auth/refresh → yeni erişim + yenileme anahtarı
  @Post('refresh')
  @HttpCode(200)
  @Throttle(authLimit)
  refresh(@Body({ schema: refreshSchema }) dto: RefreshDto) {
    return this.auth.refresh(dto.refreshToken);
  }

  // POST /api/auth/logout → bu cihazdaki oturumu kapatır
  @Post('logout')
  @HttpCode(204)
  @UseGuards(AuthGuard)
  async logout(@CurrentUser() user: AuthUser) {
    await this.auth.logout(user.sessionId);
  }
}
