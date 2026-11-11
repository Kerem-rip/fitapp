// Yönetici / moderatör işlemleri: profesyonel başvuruları inceleme, belgeleri görme, onay veya gerekçeli red.
// Otomatik işaretler sadece "şüpheli" uyarısıdır; karar her zaman insan tarafından verilir.
import { Inject, Injectable } from '@nestjs/common';
import { badRequest, conflict, notFound } from '../../common/app-error.js';
import { PrismaService } from '../../common/prisma/prisma.service.js';
import type { ApplicationStatus, ProfessionalField, RoleType } from '../../generated/prisma/enums.js';
import { FLAG_LABELS_TR } from '../files/document-checks.js';
import { StorageService } from '../files/storage.service.js';

const ROLE_OF_FIELD: Record<ProfessionalField, RoleType> = {
  DIETITIAN: 'DIETITIAN',
  TRAINER: 'TRAINER',
  GYM_OWNER: 'GYM_MANAGER',
};

const PROFILE_TYPE_OF_FIELD = { DIETITIAN: 'DIETITIAN', TRAINER: 'TRAINER', GYM_OWNER: 'GYM' } as const;

const TITLE_OF_FIELD: Record<ProfessionalField, string> = {
  DIETITIAN: 'Diyetisyen',
  TRAINER: 'Bağımsız eğitmen',
  GYM_OWNER: 'Spor salonu',
};

// İncelemede dikkat edilecekler (alana göre)
const CHECKLIST: Record<ProfessionalField, string[]> = {
  DIETITIAN: [
    'Belgedeki ad ve soyad, başvurudaki ad ve soyadla aynı mı?',
    'Belge, beslenme ve diyetetik eğitimini gösteriyor mu?',
    'Belgede barkod veya QR varsa resmi doğrulama sayfasından kontrol ettin mi?',
    'Aşağıdaki otomatik işaretleri (varsa) inceledin mi?',
  ],
  TRAINER: [
    'Belgedeki ad ve soyad, başvurudaki ad ve soyadla aynı mı?',
    'Belge antrenörlük/spor eğitimini gösteriyor mu?',
    'Belgede barkod veya QR varsa resmi doğrulama sayfasından kontrol ettin mi?',
    'Aşağıdaki otomatik işaretleri (varsa) inceledin mi?',
  ],
  GYM_OWNER: [
    'Belgedeki işletme adı ve sahibi, başvurudakiyle uyuşuyor mu?',
    'Adres, başvurudaki salon adresiyle uyuşuyor mu?',
    'Vergi levhası veya ruhsat belgesini resmi kaynaktan doğruladın mı?',
    'Aşağıdaki otomatik işaretleri (varsa) inceledin mi?',
  ],
};

const flagsWithLabels = (flags: string[]) => flags.map((code) => ({ code, label: FLAG_LABELS_TR[code] ?? code }));

@Injectable()
export class AdminService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(StorageService) private readonly storage: StorageService,
  ) {}

  async listApplications(status: ApplicationStatus) {
    const rows = await this.prisma.professionalApplication.findMany({
      where: { status },
      orderBy: { submittedAt: 'asc' },
      select: {
        id: true,
        field: true,
        status: true,
        submittedAt: true,
        attemptNumber: true,
        user: { select: { firstName: true, lastName: true, email: true, username: true } },
        documents: { select: { flags: true } },
      },
    });
    return rows.map(({ documents, ...row }) => ({
      ...row,
      documentCount: documents.length,
      flagged: documents.some((d) => d.flags.length > 0),
    }));
  }

  async applicationDetail(id: string) {
    const application = await this.prisma.professionalApplication.findUnique({
      where: { id },
      select: {
        id: true,
        field: true,
        status: true,
        details: true,
        rejectionReason: true,
        reviewedAt: true,
        submittedAt: true,
        attemptNumber: true,
        user: { select: { id: true, firstName: true, lastName: true, email: true, username: true, birthDate: true } },
        documents: {
          orderBy: { createdAt: 'asc' },
          select: { id: true, kind: true, originalName: true, mimeType: true, sizeBytes: true, flags: true },
        },
      },
    });
    if (!application) throw notFound('APPLICATION_NOT_FOUND', 'Başvuru bulunamadı.');

    const previous = await this.prisma.professionalApplication.findMany({
      where: { userId: application.user.id, id: { not: id } },
      orderBy: { submittedAt: 'desc' },
      select: { id: true, status: true, rejectionReason: true, submittedAt: true, attemptNumber: true },
    });

    return {
      ...application,
      documents: application.documents.map((d) => ({ ...d, flags: flagsWithLabels(d.flags) })),
      previousAttempts: previous,
      checklist: CHECKLIST[application.field],
    };
  }

  // Belgeyi açar ve kaydı tutar (kişisel veri: kim, ne zaman baktı)
  async openDocument(documentId: string, adminId: string) {
    const doc = await this.prisma.applicationDocument.findUnique({
      where: { id: documentId },
      select: { id: true, mimeType: true, storageKey: true },
    });
    if (!doc) throw notFound('DOCUMENT_NOT_FOUND', 'Belge bulunamadı.');
    await this.prisma.documentAccessLog.create({ data: { documentId: doc.id, adminId } });
    return { mimeType: doc.mimeType, data: await this.storage.read(doc.storageKey) };
  }

  async approve(applicationId: string, adminId: string) {
    const application = await this.requirePending(applicationId);
    const details = application.details as { city?: string; specialties?: string[]; gymName?: string; gymAddress?: string };
    const field = application.field;
    const now = new Date();

    await this.prisma.$transaction([
      this.prisma.professionalApplication.update({
        where: { id: applicationId },
        data: { status: 'APPROVED', reviewedById: adminId, reviewedAt: now, rejectionReason: null },
      }),
      this.prisma.userRole.upsert({
        where: { userId_role: { userId: application.userId, role: ROLE_OF_FIELD[field] } },
        create: { userId: application.userId, role: ROLE_OF_FIELD[field] },
        update: {},
      }),
      this.prisma.professionalProfile.upsert({
        where: { userId: application.userId },
        create: {
          userId: application.userId,
          type: PROFILE_TYPE_OF_FIELD[field],
          title: TITLE_OF_FIELD[field],
          specialties: details.specialties ?? [],
          city: details.city,
          verification: 'APPROVED',
          verifiedAt: now,
        },
        update: {
          type: PROFILE_TYPE_OF_FIELD[field],
          verification: 'APPROVED',
          verifiedAt: now,
          rejectionReason: null,
        },
      }),
      this.prisma.notification.create({
        data: { userId: application.userId, type: 'application_approved', data: { field } },
      }),
      // Salon sahibinin salonu başvurusundaki bilgilerle hemen açılır
      ...(field === 'GYM_OWNER'
        ? [
            this.prisma.gym.upsert({
              where: { ownerId: application.userId },
              create: { ownerId: application.userId, name: details.gymName ?? 'Salonum', address: details.gymAddress ?? null, city: details.city ?? null },
              update: {},
            }),
          ]
        : []),
    ]);
    return { id: applicationId, status: 'APPROVED' as const };
  }

  async reject(applicationId: string, adminId: string, reason: string) {
    const application = await this.requirePending(applicationId);
    if (reason.trim().length < 5) throw badRequest('REASON_REQUIRED', 'Red gerekçesini yaz.');

    await this.prisma.$transaction([
      this.prisma.professionalApplication.update({
        where: { id: applicationId },
        data: { status: 'REJECTED', reviewedById: adminId, reviewedAt: new Date(), rejectionReason: reason.trim() },
      }),
      this.prisma.notification.create({
        data: {
          userId: application.userId,
          type: 'application_rejected',
          data: { field: application.field, reason: reason.trim() },
        },
      }),
    ]);
    return { id: applicationId, status: 'REJECTED' as const };
  }

  private async requirePending(applicationId: string) {
    const application = await this.prisma.professionalApplication.findUnique({
      where: { id: applicationId },
      select: { id: true, userId: true, field: true, status: true, details: true },
    });
    if (!application) throw notFound('APPLICATION_NOT_FOUND', 'Başvuru bulunamadı.');
    if (application.status !== 'PENDING') {
      throw conflict('ALREADY_REVIEWED', 'Bu başvuru zaten karara bağlanmış.');
    }
    return application;
  }
}
