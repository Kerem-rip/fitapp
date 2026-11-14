import { Global, Module } from '@nestjs/common';
import { NotificationsController } from './notifications.controller.js';
import { NotificationsService } from './notifications.service.js';
import { NotifyService } from './notify.service.js';

@Global()
@Module({
  controllers: [NotificationsController],
  providers: [NotificationsService, NotifyService],
  exports: [NotifyService],
})
export class NotificationsModule {}