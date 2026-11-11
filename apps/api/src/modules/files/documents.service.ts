// Belge yükleme: tür/boyut kontrolü, parmak izi (hash), otomatik işaretler ve gizli depolama.
import { Inject, Injectable } from '@nestjs/common';
import { badRequest, tooLarge } from '../../common/app-error.js';
import { PrismaService } from '../../common/prisma/prisma.service.js';
import { env } from '../../config/env.js';
import {
  analyzeDocument,
  detectFileType,
  FLAG_DUPLICATE,
  sha256,
} from './document-checks.js';
import { StorageService } from './storage.service.js';

// Multer'ın verdiği dosyanın bu servisin kullandığı kısmı
export interface UploadedFileLike {
  originalname: string;
  buffer: Buffer;
  size: number;
}

export interface IngestedDocument {
  originalName: string;
  mimeType: string;
  sizeBytes: number;
  sha256: string;
  storageKey: string;
  flags: string[];
}

@Injectable()
export class DocumentsService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(StorageService) private readonly storage: StorageService,
  ) {}

  // Dosyayı doğrular ve depolar. `ownRegistrationId`: kendi kaydındaki aynı dosya "kopya" sayılmaz.
  async ingest(file: UploadedFileLike | undefined, ownRegistrationId?: string): Promise<IngestedDocument> {
    if (!file || file.buffer.length === 0) {
      throw badRequest('FILE_REQUIRED', 'Bir dosya seç.');
    }
    if (file.buffer.length > env.maxDocumentBytes) {
      throw tooLarge('FILE_TOO_LARGE', `Dosya en fazla ${Math.round(env.maxDocumentBytes / 1024 / 1024)} MB olabilir.`);
    }
    const type = detectFileType(file.buffer);
    if (!type) {
      throw badRequest('INVALID_FILE_TYPE', 'Sadece PDF, JPG veya PNG dosyası yükleyebilirsin.');
    }

    const hash = sha256(file.buffer);
    const flags = analyzeDocument(file.buffer);

    // Aynı dosya başka bir başvuruda kullanılmışsa "şüpheli" olarak işaretlenir (reddedilmez)
    const [inApplications, inPending] = await Promise.all([
      this.prisma.applicationDocument.count({ where: { sha256: hash } }),
      this.prisma.pendingDocument.count({
        where: { sha256: hash, ...(ownRegistrationId ? { registrationId: { not: ownRegistrationId } } : {}) },
      }),
    ]);
    if (inApplications + inPending > 0) flags.push(FLAG_DUPLICATE);

    const storageKey = await this.storage.save(file.buffer);
    return {
      originalName: file.originalname.slice(0, 200),
      mimeType: type.mime,
      sizeBytes: file.buffer.length,
      sha256: hash,
      storageKey,
      flags,
    };
  }

  async removeFiles(keys: string[]): Promise<void> {
    await Promise.all(keys.map((key) => this.storage.remove(key)));
  }
}
