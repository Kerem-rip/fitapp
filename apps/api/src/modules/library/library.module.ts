import { Module } from '@nestjs/common';
import { PersonalPlanModule } from '../personal-plan/plan.module.js';
import { DemoMediaController } from './demo-media.controller.js';
import { LibraryController } from './library.controller.js';
import { LibraryService } from './library.service.js';

@Module({
  imports: [PersonalPlanModule],
  controllers: [LibraryController, DemoMediaController],
  providers: [LibraryService],
})
export class LibraryModule {}
