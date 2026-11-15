import { Module } from '@nestjs/common';
import { ClientsModule } from '../clients/clients.module.js';
import { DailyController } from './daily.controller.js';
import { DailyService } from './daily.service.js';

@Module({
  imports: [ClientsModule],
  controllers: [DailyController],
  providers: [DailyService],
})
export class DailyModule {}
