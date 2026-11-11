import { Body, Controller, Get, HttpCode, Inject, Param, Post, Query, Res, UseGuards } from '@nestjs/common';
import type { Response } from 'express';
import { z } from 'zod';
import { CurrentUser, type AuthUser } from '../auth/auth.guard.js';
import { AdminGuard } from './admin.guard.js';
import { AdminService } from './admin.service.js';

const listQuerySchema = z.object({ status: z.enum(['PENDING', 'APPROVED', 'REJECTED']).default('PENDING') });
const rejectSchema = z.object({ reason: z.string().trim().min(5, 'Red gerekçesini yaz').max(500) });

@Controller('admin')
@UseGuards(AdminGuard)
export class AdminController {
  constructor(@Inject(AdminService) private readonly admin: AdminService) {}

  // GET /api/admin/applications?status=PENDING
  @Get('applications')
  list(@Query({ schema: listQuerySchema }) query: { status: 'PENDING' | 'APPROVED' | 'REJECTED' }) {
    return this.admin.listApplications(query.status);
  }

  // GET /api/admin/applications/:id
  @Get('applications/:id')
  detail(@Param('id') id: string) {
    return this.admin.applicationDetail(id);
  }

  // GET /api/admin/documents/:id/file → belgenin kendisi (her açılış kayıt altına alınır)
  @Get('documents/:id/file')
  async file(@Param('id') id: string, @CurrentUser() user: AuthUser, @Res() res: Response) {
    const doc = await this.admin.openDocument(id, user.userId);
    res.setHeader('Content-Type', doc.mimeType);
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Content-Disposition', 'inline; filename="belge"');
    res.send(doc.data);
  }

  // POST /api/admin/applications/:id/approve
  @Post('applications/:id/approve')
  @HttpCode(200)
  approve(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.admin.approve(id, user.userId);
  }

  // POST /api/admin/applications/:id/reject  { reason }
  @Post('applications/:id/reject')
  @HttpCode(200)
  reject(@Param('id') id: string, @CurrentUser() user: AuthUser, @Body({ schema: rejectSchema }) body: { reason: string }) {
    return this.admin.reject(id, user.userId, body.reason);
  }
}
