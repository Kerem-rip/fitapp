import { Module } from '@nestjs/common';
import { AdminGuard } from '../admin/admin.guard.js';
import { ModerationController, ReportsController } from './moderation.controller.js';
import { ModerationService } from './moderation.service.js';

@Module({
  controllers: [ReportsController, ModerationController],
  providers: [ModerationService, AdminGuard],
})
export class ModerationModule {}