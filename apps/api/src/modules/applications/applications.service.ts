// Profesyonel başvuru durumu ve reddedilen başvurunun yeniden gönderilmesi.
import { Inject, Injectable } from '@nestjs/common';
import { badRequest, conflict, forbidden, notFound } from '../../common/app-error.js';
import { PrismaService } from '../../common/prisma/prisma.service.js';
import { env } from '../../config/env.js';
import { Prisma } from '../../generated/prisma/client.js';
import { allowedKindsFor, documentsSatisfy, DOCUMENT_KINDS, type ProfessionalFieldKey } from '../files/document-checks.js';
import { DocumentsService, type UploadedFileLike } from '../files/documents.service.js';

@Injectable()
export class ApplicationsService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(DocumentsService) private readonly documents: DocumentsService,
  ) {}

  async myLatest(userId: string) {
    const application = await this.prisma.professionalApplication.findFirst({
      where: { userId },
      orderBy: { submittedAt: 'desc' },
      select: { id: true, field: true, status: true, rejectionReason: true, submittedAt: true, attemptNumber: true },
    });
    if (!application) throw notFound('NO_APPLICATION', 'Profesyonel başvurun yok.');
    return {
      ...application,
      canResubmit: application.status === 'REJECTED' && application.attemptNumber < env.maxApplicationAttempts,
    };
  }

  // Reddedilen başvuru yeni belgelerle yeniden gönderilir (en fazla 3 başvuru hakkı)
  async resubmit(userId: string, files: UploadedFileLike[], kinds: string[]) {
    const latest = await this.prisma.professionalApplication.findFirst({
      where: { userId },
      orderBy: { submittedAt: 'desc' },
    });
    if (!latest) throw notFound('NO_APPLICATION', 'Profesyonel başvurun yok.');
    if (latest.status !== 'REJECTED') {
      throw conflict('APPLICATION_NOT_REJECTED', 'Yeniden başvuru sadece reddedilen başvurular için yapılır.');
    }
    if (latest.attemptNumber >= env.maxApplicationAttempts) {
      throw forbidden('APPLICATION_ATTEMPTS_EXCEEDED', 'Başvuru hakkın doldu. Destek ile iletişime geç.');
    }

    const field = latest.field as ProfessionalFieldKey;
    if (files.length === 0 || files.length !== kinds.length || files.length > env.maxDocumentsPerApplication) {
      throw badRequest('INVALID_DOCUMENTS', 'Belgeleri ve türlerini kontrol et.');
    }
    const allowed = allowedKindsFor(field) as readonly string[];
    for (const kind of kinds) {
      if (!(DOCUMENT_KINDS as readonly string[]).includes(kind) || !allowed.includes(kind)) {
        throw badRequest('INVALID_DOCUMENT_KIND', 'Bu belge türü seçtiğin alan için geçerli değil.');
      }
    }
    if (!documentsSatisfy(field, kinds)) {
      throw badRequest('DOCUMENTS_REQUIRED', 'Gerekli belgeleri yüklemelisin.');
    }

    const ingested = [];
    for (const file of files) ingested.push(await this.documents.ingest(file));

    const created = await this.prisma.professionalApplication.create({
      data: {
        userId,
        field: latest.field,
        details: latest.details as Prisma.InputJsonValue,
        attemptNumber: latest.attemptNumber + 1,
        documents: { create: ingested.map((doc, i) => ({ kind: kinds[i]!, ...doc })) },
      },
      select: { id: true, field: true, status: true, submittedAt: true, attemptNumber: true },
    });
    return created;
  }
}
