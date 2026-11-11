import {
  Body,
  Controller,
  Get,
  HttpCode,
  Inject,
  Post,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { Throttle } from '@nestjs/throttler';
import { z } from 'zod';
import { badRequest } from '../../common/app-error.js';
import { env } from '../../config/env.js';
import { AuthGuard, CurrentUser, type AuthUser } from '../auth/auth.guard.js';
import type { UploadedFileLike } from '../files/documents.service.js';
import { ApplicationsService } from './applications.service.js';

const uploadLimit = { default: { limit: env.authRateLimitPerMinute, ttl: 60_000 } };

// kinds: dosyalarla aynı sırada belge türleri (JSON dizisi metni)
const resubmitBodySchema = z.object({ kinds: z.string().min(2).max(500) });

@Controller('applications')
@UseGuards(AuthGuard)
export class ApplicationsController {
  constructor(@Inject(ApplicationsService) private readonly applications: ApplicationsService) {}

  // GET /api/applications/me → son başvurunun durumu
  @Get('me')
  me(@CurrentUser() user: AuthUser) {
    return this.applications.myLatest(user.userId);
  }

  // POST /api/applications/me/resubmit → reddedilen başvuruyu yeni belgelerle tekrar gönderir
  @Post('me/resubmit')
  @HttpCode(201)
  @Throttle(uploadLimit)
  @UseInterceptors(
    FilesInterceptor('files', env.maxDocumentsPerApplication, { limits: { fileSize: env.maxDocumentBytes + 1024 } }),
  )
  resubmit(
    @CurrentUser() user: AuthUser,
    @Body({ schema: resubmitBodySchema }) body: { kinds: string },
    @UploadedFiles() files: UploadedFileLike[] | undefined,
  ) {
    let kinds: unknown;
    try {
      kinds = JSON.parse(body.kinds);
    } catch {
      throw badRequest('INVALID_DOCUMENTS', 'Belge türleri okunamadı.');
    }
    if (!Array.isArray(kinds) || !kinds.every((k) => typeof k === 'string')) {
      throw badRequest('INVALID_DOCUMENTS', 'Belge türleri okunamadı.');
    }
    return this.applications.resubmit(user.userId, files ?? [], kinds as string[]);
  }
}
