import { Module } from '@nestjs/common';
import { ConsentsModule } from '../consents/consents.module.js';
import { RelationshipsModule } from '../relationships/relationships.module.js';
import { AnamnesisService } from './anamnesis.service.js';
import { ClientFileService } from './client-file.service.js';
import { ClientsController, IntakeQuestionsController } from './clients.controller.js';
import { MeasurementsService } from './measurements.service.js';
import { MyHealthController } from './my-health.controller.js';
import { NotesService } from './notes.service.js';

@Module({
  imports: [RelationshipsModule, ConsentsModule],
  controllers: [ClientsController, IntakeQuestionsController, MyHealthController],
  providers: [MeasurementsService, AnamnesisService, NotesService, ClientFileService],
  exports: [MeasurementsService, AnamnesisService],
})
export class ClientsModule {}
