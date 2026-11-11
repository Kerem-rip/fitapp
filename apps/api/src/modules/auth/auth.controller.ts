import { Body, Controller, HttpCode, Inject, Post, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { env } from '../../config/env.js';
import { AuthGuard, CurrentUser, type AuthUser } from './auth.guard.js';
import { AuthService } from './auth.service.js';
import { loginSchema, refreshSchema, type LoginDto, type RefreshDto } from './dto/auth.schemas.js';

// Şifre deneme saldırılarına karşı: bu adreslere dakikada sınırlı istek atılabilir
export const authLimit = { default: { limit: env.authRateLimitPerMinute, ttl: 60_000 } };

// Kayıt (e-posta kodu ile) için bkz. modules/registration
@Controller('auth')
export class AuthController {
  constructor(@Inject(AuthService) private readonly auth: AuthService) {}

  // POST /api/auth/login
  @Post('login')
  @HttpCode(200)
  @Throttle(authLimit)
  login(@Body({ schema: loginSchema }) dto: LoginDto) {
    return this.auth.login(dto, 'user');
  }

  // POST /api/auth/admin/login → sadece yönetici ve moderatör hesapları (normal girişten ayrı)
  @Post('admin/login')
  @HttpCode(200)
  @Throttle(authLimit)
  adminLogin(@Body({ schema: loginSchema }) dto: LoginDto) {
    return this.auth.login(dto, 'admin');
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
