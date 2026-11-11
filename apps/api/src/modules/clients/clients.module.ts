import { Module } from '@nestjs/common';
import { ConsentsModule } from '../consents/consents.module.js';
import { RelationshipsModule } from '../relationships/relationships.module.js';
import { AnamnesisService } from './anamnesis.service.js';
import { ClientFileService } from './client-file.service.js';
import { ClientsController, IntakeQuestionsController } from './clients.controller.js';
import { FindingsController, ReviewOverviewController } from './findings/findings.controller.js';
import { FindingsService } from './findings/findings.service.js';
import { TasksService } from './findings/tasks.service.js';
import { AgendaController, ClientAgendaController } from './agenda/agenda.controller.js';
import { AppointmentsService } from './agenda/appointments.service.js';
import { GoalsService } from './agenda/goals.service.js';
import { RemindersService } from './agenda/reminders.service.js';
import { MeasurementsService } from './measurements.service.js';
import { MyPlansController, PlansController } from './plans/plans.controller.js';
import { PlansService } from './plans/plans.service.js';
import { MyHealthController } from './my-health.controller.js';
import { NotesService } from './notes.service.js';

@Module({
  imports: [RelationshipsModule, ConsentsModule],
  controllers: [ClientsController, IntakeQuestionsController, MyHealthController, FindingsController, ReviewOverviewController, PlansController, MyPlansController, ClientAgendaController, AgendaController],
  providers: [
    MeasurementsService,
    AnamnesisService,
    NotesService,
    ClientFileService,
    FindingsService,
    TasksService,
    PlansService,
    AppointmentsService,
    GoalsService,
    RemindersService,
  ],
  exports: [MeasurementsService, AnamnesisService, FindingsService],
})
export class ClientsModule {}
