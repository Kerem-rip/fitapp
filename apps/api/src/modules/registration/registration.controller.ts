import {
  Body,
  Controller,
  Get,
  HttpCode,
  Inject,
  Param,
  Post,
  Query,
  Req,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Throttle } from '@nestjs/throttler';
import type { Request } from 'express';
import { env } from '../../config/env.js';
import { authLimit } from '../auth/auth.controller.js';
import {
  documentKindSchema,
  registerResendSchema,
  registerStartSchema,
  registerVerifySchema,
  usernameQuerySchema,
  type DocumentKindDto,
  type RegisterResendDto,
  type RegisterStartDto,
  type RegisterVerifyDto,
} from '../auth/dto/auth.schemas.js';
import type { UploadedFileLike } from '../files/documents.service.js';
import { RegistrationService } from './registration.service.js';

const uploadLimit = { default: { limit: env.authRateLimitPerMinute * 3, ttl: 60_000 } };

@Controller('auth/register')
export class RegistrationController {
  constructor(@Inject(RegistrationService) private readonly registration: RegistrationService) {}

  // POST /api/auth/register/start → bilgileri doğrular, e-postaya kod gönderir (hesap henüz oluşmaz)
  @Post('start')
  @Throttle(authLimit)
  start(@Body({ schema: registerStartSchema }) dto: RegisterStartDto, @Req() req: Request) {
    return this.registration.start(dto, req.ip);
  }

  // POST /api/auth/register/:id/documents → profesyonel başvuru belgesi (PDF/JPG/PNG)
  @Post(':id/documents')
  @Throttle(uploadLimit)
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: env.maxDocumentBytes + 1024, files: 1 } }))
  uploadDocument(
    @Param('id') id: string,
    @Body({ schema: documentKindSchema }) body: DocumentKindDto,
    @UploadedFile() file: UploadedFileLike | undefined,
  ) {
    return this.registration.uploadDocument(id, body.kind, file);
  }

  // POST /api/auth/register/verify → kod doğruysa hesap oluşur, oturum açılır
  @Post('verify')
  @HttpCode(200)
  @Throttle(authLimit)
  verify(@Body({ schema: registerVerifySchema }) dto: RegisterVerifyDto) {
    return this.registration.verify(dto);
  }

  // POST /api/auth/register/resend → yeni kod
  @Post('resend')
  @HttpCode(200)
  @Throttle(authLimit)
  resend(@Body({ schema: registerResendSchema }) dto: RegisterResendDto) {
    return this.registration.resend(dto);
  }

  // GET /api/auth/register/username-available?username=ayse → kullanıcı adı boş mu
  @Get('username-available')
  @Throttle(uploadLimit)
  async usernameAvailable(@Query({ schema: usernameQuerySchema }) query: { username: string }) {
    return { available: await this.registration.usernameAvailable(query.username) };
  }
}
