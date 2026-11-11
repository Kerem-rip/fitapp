import { Module } from '@nestjs/common';
import { GymInvitesController, GymsController } from './gyms.controller.js';
import { GymsService } from './gyms.service.js';
import { MembersService } from './members.service.js';

@Module({
  controllers: [GymsController, GymInvitesController],
  providers: [GymsService, MembersService],
  exports: [GymsService],
})
export class GymsModule {}
