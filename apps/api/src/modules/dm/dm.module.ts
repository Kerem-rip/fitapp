import { Module } from '@nestjs/common';
import { DmEventsService } from './dm-events.service.js';
import { DmController } from './dm.controller.js';
import { DmService } from './dm.service.js';

@Module({
  controllers: [DmController],
  providers: [DmService, DmEventsService],
  exports: [DmService],
})
export class DmModule {}
