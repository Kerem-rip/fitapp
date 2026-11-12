import { Module } from '@nestjs/common';
import { GymWorkController } from './gym-work.controller.js';
import { GymInvitesController, GymsController } from './gyms.controller.js';
import { GymsService } from './gyms.service.js';
import { LessonsService } from './lessons.service.js';
import { MembersService } from './members.service.js';
import { WorkService } from './work.service.js';

@Module({
  controllers: [GymsController, GymWorkController, GymInvitesController],
  providers: [GymsService, MembersService, LessonsService, WorkService],
  exports: [GymsService],
})
export class GymsModule {}
