// Sosyal arayüz adresleri (profil, spor branşları). Takip, gönderi, hikâye ve keşfet sonraki aşamalarda buraya eklenir.
import { Controller, Get, Inject, Param, UseGuards } from '@nestjs/common';
import { AuthGuard, CurrentUser, type AuthUser } from '../auth/auth.guard.js';
import { ProfilesService } from './profiles.service.js';

@Controller('social')
@UseGuards(AuthGuard)
export class SocialController {
  constructor(@Inject(ProfilesService) private readonly profiles: ProfilesService) {}

  // GET /api/social/sports → spor branşları
  @Get('sports')
  sports() {
    return this.profiles.sports();
  }

  // GET /api/social/profiles/:username → profil başlığı
  @Get('profiles/:username')
  profile(@CurrentUser() user: AuthUser, @Param('username') username: string) {
    return this.profiles.view(user.userId, username);
  }
}
