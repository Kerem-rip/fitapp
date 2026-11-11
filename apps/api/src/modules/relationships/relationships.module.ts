import { Module } from '@nestjs/common';
import { ConsentsModule } from '../consents/consents.module.js';
import { AccessService } from './access.service.js';
import { AuditService } from './audit.service.js';
import { RelationshipsController } from './relationships.controller.js';
import { RelationshipsService } from './relationships.service.js';

// AccessService ve AuditService, danışan verisi okuyan/yazan diğer modüller için dışa açılır
@Module({
  imports: [ConsentsModule],
  controllers: [RelationshipsController],
  providers: [RelationshipsService, AccessService, AuditService],
  exports: [AccessService, AuditService],
})
export class RelationshipsModule {}
