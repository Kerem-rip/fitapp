import { Global, Module } from '@nestjs/common';
import { DocumentsService } from './documents.service.js';
import { StorageService } from './storage.service.js';

@Global()
@Module({
  providers: [StorageService, DocumentsService],
  exports: [StorageService, DocumentsService],
})
export class FilesModule {}
