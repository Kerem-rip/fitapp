import {
  Body,
  Controller,
  Get,
  HttpCode,
  Inject,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard, CurrentUser, type AuthUser } from '../auth/auth.guard.js';
import {
  deleteAccountSchema,
  updateMeSchema,
  type DeleteAccountDto,
  type UpdateMeDto,
} from './dto/users.schemas.js';
import { UsersService } from './users.service.js';

@Controller('users')
@UseGuards(AuthGuard)
export class UsersController {
  constructor(@Inject(UsersService) private readonly users: UsersService) {}

  // GET /api/users/me
  @Get('me')
  me(@CurrentUser() user: AuthUser) {
    return this.users.getMe(user.userId);
  }

  // PATCH /api/users/me
  @Patch('me')
  update(
    @CurrentUser() user: AuthUser,
    @Body({ schema: updateMeSchema }) dto: UpdateMeDto,
  ) {
    return this.users.updateMe(user.userId, dto);
  }

  // POST /api/users/me/delete → hesap silme talebi (30 gün geri dönüş süresi)
  @Post('me/delete')
  @HttpCode(200)
  requestDeletion(
    @CurrentUser() user: AuthUser,
    @Body({ schema: deleteAccountSchema }) dto: DeleteAccountDto,
  ) {
    return this.users.requestDeletion(user.userId, dto.password);
  }
}
