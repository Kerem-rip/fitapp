import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Inject,
  Patch,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { AuthGuard, CurrentUser, type AuthUser } from '../auth/auth.guard.js';
import type { UploadedFileLike } from '../files/documents.service.js';
import { MAX_IMAGE_BYTES } from '../media/media.service.js';
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

  // POST /api/users/me/avatar (çok parçalı, alan adı "file") → profil fotoğrafı
  @Post('me/avatar')
  @HttpCode(200)
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: MAX_IMAGE_BYTES + 1024, files: 1 } }))
  setAvatar(@CurrentUser() user: AuthUser, @UploadedFile() file: UploadedFileLike | undefined) {
    return this.users.setAvatar(user.userId, file);
  }

  @Delete('me/avatar')
  removeAvatar(@CurrentUser() user: AuthUser) {
    return this.users.removeAvatar(user.userId);
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
