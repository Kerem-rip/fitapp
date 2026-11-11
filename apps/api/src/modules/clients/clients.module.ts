import { Module } from '@nestjs/common';
import { ConsentsModule } from '../consents/consents.module.js';
import { RelationshipsModule } from '../relationships/relationships.module.js';
import { AnamnesisService } from './anamnesis.service.js';
import { ClientFileService } from './client-file.service.js';
import { ClientsController, IntakeQuestionsController } from './clients.controller.js';
import { FindingsController, ReviewOverviewController } from './findings/findings.controller.js';
import { FindingsService } from './findings/findings.service.js';
import { TasksService } from './findings/tasks.service.js';
import { MeasurementsService } from './measurements.service.js';
import { MyHealthController } from './my-health.controller.js';
import { NotesService } from './notes.service.js';

@Module({
  imports: [RelationshipsModule, ConsentsModule],
  controllers: [ClientsController, IntakeQuestionsController, MyHealthController, FindingsController, ReviewOverviewController],
  providers: [MeasurementsService, AnamnesisService, NotesService, ClientFileService, FindingsService, TasksService],
  exports: [MeasurementsService, AnamnesisService, FindingsService],
})
export class ClientsModule {}
