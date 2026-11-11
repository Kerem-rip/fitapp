// Kayıt: e-postaya doğrulama kodu gider; kod girilince hesap oluşur (kod girilmeden hesap OLUŞMAZ).
// Profesyonel kayıtta belgeler de yüklenir ve hesap "onay sürecinde" açılır.
import { Inject, Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { createHmac, randomInt, timingSafeEqual } from 'node:crypto';
import { ageGroupOf } from '../../common/age.js';
import { badRequest, conflict, forbidden, gone, notFound, tooMany } from '../../common/app-error.js';
import { isDisposableEmail } from '../../common/disposable-emails.js';
import { PrismaService } from '../../common/prisma/prisma.service.js';
import { env } from '../../config/env.js';
import { Prisma } from '../../generated/prisma/client.js';
import { AuthService } from '../auth/auth.service.js';
import { PasswordService } from '../auth/password.service.js';
import type {
  ProfessionalDetails,
  RegisterResendDto,
  RegisterStartDto,
  RegisterVerifyDto,
} from '../auth/dto/auth.schemas.js';
import { ConsentsService } from '../consents/consents.service.js';
import { EmailService } from '../email/email.service.js';
import { allowedKindsFor, documentsSatisfy, type DocumentKind } from '../files/document-checks.js';
import { DocumentsService, type UploadedFileLike } from '../files/documents.service.js';
import { UsersService } from '../users/users.service.js';

const MINUTE_MS = 60 * 1000;

// PendingRegistration.payload içinde saklanan bilgiler (şifre burada DEĞİL, karılmış halde ayrı alanda)
interface RegistrationPayload {
  firstName: string;
  lastName?: string;
  birthDate: string;
  gender: 'FEMALE' | 'MALE' | 'OTHER' | 'UNSPECIFIED';
  healthDataConsent: boolean;
  deviceName?: string;
  professional?: ProfessionalDetails;
}

@Injectable()
export class RegistrationService {
  private readonly logger = new Logger(RegistrationService.name);

  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(PasswordService) private readonly passwords: PasswordService,
    @Inject(EmailService) private readonly email: EmailService,
    @Inject(DocumentsService) private readonly documents: DocumentsService,
    @Inject(AuthService) private readonly auth: AuthService,
    @Inject(UsersService) private readonly users: UsersService,
    @Inject(ConsentsService) private readonly consents: ConsentsService,
  ) {}

  // Kodun kendisi saklanmaz; kayda özel anahtarlı özet saklanır
  private codeHash(code: string, registrationId: string): string {
    return createHmac('sha256', env.jwtSecret).update(`${registrationId}:${code}`).digest('hex');
  }

  private newCode(): string {
    return String(randomInt(0, 1_000_000)).padStart(6, '0');
  }

  async start(dto: RegisterStartDto, ipAddress?: string) {
    const birthDate = new Date(dto.birthDate);
    const group = ageGroupOf(birthDate);
    if (group === 'CHILD') {
      throw forbidden('AGE_RESTRICTED', '13 yaşından küçükler kayıt olamaz.');
    }
    if (dto.accountType === 'PROFESSIONAL' && group !== 'ADULT') {
      throw forbidden('PROFESSIONAL_ADULT_ONLY', 'Profesyonel hesap için 18 yaşından büyük olmalısın.');
    }
    if (isDisposableEmail(dto.email)) {
      throw badRequest('EMAIL_NOT_ALLOWED', 'Geçici e-posta adresleriyle kayıt olunamaz. Kalıcı bir adres kullan.');
    }

    await this.purgeExpired();

    const existingUser = await this.prisma.user.findFirst({
      where: { OR: [{ email: dto.email }, { username: dto.username }] },
      select: { email: true },
    });
    if (existingUser) {
      throw existingUser.email === dto.email
        ? conflict('EMAIL_TAKEN', 'Bu e-posta adresi zaten kayıtlı.')
        : conflict('USERNAME_TAKEN', 'Bu kullanıcı adı alınmış.');
    }

    // Başkasının bekleyen kaydı bu kullanıcı adını/e-postayı kısa süre rezerve eder.
    // Aynı e-postayla yeniden denenirse eski bekleyen kayıt silinip baştan başlanır.
    const pending = await this.prisma.pendingRegistration.findMany({
      where: { OR: [{ email: dto.email }, { username: dto.username }] },
      select: { id: true, email: true, username: true },
    });
    const sameEmail = pending.filter((p) => p.email === dto.email).map((p) => p.id);
    if (pending.some((p) => p.email !== dto.email && p.username === dto.username)) {
      throw conflict('USERNAME_TAKEN', 'Bu kullanıcı adı alınmış.');
    }
    await this.removePending(sameEmail);

    const payload: RegistrationPayload = {
      firstName: dto.firstName,
      lastName: dto.lastName,
      birthDate: dto.birthDate,
      gender: dto.gender,
      healthDataConsent: dto.healthDataConsent,
      deviceName: dto.deviceName,
      professional: dto.professional,
    };
    const code = this.newCode();
    const now = Date.now();
    const registration = await this.prisma.pendingRegistration.create({
      data: {
        email: dto.email,
        username: dto.username,
        passwordHash: await this.passwords.hash(dto.password),
        accountType: dto.accountType,
        payload: payload as unknown as Prisma.InputJsonValue,
        codeHash: '',
        codeExpiresAt: new Date(now + env.codeTtlMinutes * MINUTE_MS),
        expiresAt: new Date(now + env.registrationTtlMinutes * MINUTE_MS),
        ipAddress,
      },
      select: { id: true, codeExpiresAt: true },
    });
    await this.prisma.pendingRegistration.update({
      where: { id: registration.id },
      data: { codeHash: this.codeHash(code, registration.id) },
    });
    await this.email.sendVerificationCode(dto.email, code, env.codeTtlMinutes);

    return {
      registrationId: registration.id,
      codeExpiresAt: registration.codeExpiresAt,
      // Sadece test modunda: uygulama "test kodu" olarak gösterir
      ...(env.exposeDevCodes ? { devCode: code } : {}),
      requiredDocuments: dto.professional ? allowedKindsFor(dto.professional.field) : [],
    };
  }

  async uploadDocument(registrationId: string, kind: DocumentKind, file: UploadedFileLike | undefined) {
    const registration = await this.requireActive(registrationId);
    if (registration.accountType !== 'PROFESSIONAL') {
      throw forbidden('DOCUMENTS_NOT_ALLOWED', 'Standart hesapta belge yüklenmez.');
    }
    const field = (registration.payload as unknown as RegistrationPayload).professional?.field;
    if (!field || !(allowedKindsFor(field) as readonly string[]).includes(kind)) {
      throw badRequest('INVALID_DOCUMENT_KIND', 'Bu belge türü seçtiğin alan için geçerli değil.');
    }
    const count = await this.prisma.pendingDocument.count({ where: { registrationId } });
    if (count >= env.maxDocumentsPerApplication) {
      throw badRequest('TOO_MANY_DOCUMENTS', `En fazla ${env.maxDocumentsPerApplication} belge yükleyebilirsin.`);
    }

    const doc = await this.documents.ingest(file, registrationId);
    const saved = await this.prisma.pendingDocument.create({
      data: { registrationId, kind, ...doc },
      select: { id: true, kind: true, originalName: true, sizeBytes: true },
    });
    // Otomatik işaretler başvurana gösterilmez (atlatılmasın diye)
    return saved;
  }

  async verify(dto: RegisterVerifyDto) {
    const registration = await this.requireActive(dto.registrationId, true);

    if (registration.attempts >= env.codeMaxAttempts) {
      await this.removePending([registration.id]);
      throw tooMany('TOO_MANY_ATTEMPTS', 'Çok fazla yanlış deneme yaptın. Kaydı baştan başlatmalısın.');
    }
    if (registration.codeExpiresAt.getTime() < Date.now()) {
      throw badRequest('CODE_EXPIRED', 'Kodun süresi doldu. Yeni kod iste.');
    }

    const expected = Buffer.from(registration.codeHash, 'hex');
    const actual = Buffer.from(this.codeHash(dto.code, registration.id), 'hex');
    if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) {
      const attempts = registration.attempts + 1;
      if (attempts >= env.codeMaxAttempts) {
        await this.removePending([registration.id]);
        throw tooMany('TOO_MANY_ATTEMPTS', 'Çok fazla yanlış deneme yaptın. Kaydı baştan başlatmalısın.');
      }
      await this.prisma.pendingRegistration.update({ where: { id: registration.id }, data: { attempts } });
      throw badRequest('CODE_INVALID', `Kod hatalı. ${env.codeMaxAttempts - attempts} deneme hakkın kaldı.`);
    }

    const payload = registration.payload as unknown as RegistrationPayload;
    const professional = payload.professional;
    if (registration.accountType === 'PROFESSIONAL') {
      if (!professional || !documentsSatisfy(professional.field, registration.documents.map((d) => d.kind))) {
        throw badRequest('DOCUMENTS_REQUIRED', 'Gerekli belgeleri yüklemelisin.');
      }
    }

    const birthDate = new Date(payload.birthDate);
    const adult = ageGroupOf(birthDate) === 'ADULT';
    let userId: string;
    try {
      const user = await this.prisma.$transaction(async (tx) => {
        const created = await tx.user.create({
          data: {
            email: registration.email,
            username: registration.username,
            passwordHash: registration.passwordHash,
            firstName: payload.firstName,
            lastName: payload.lastName,
            birthDate,
            gender: payload.gender,
            roles: { create: { role: 'USER' } },
            profile: { create: {} },
            // 18 yaş altı sağlık verisi rızasını kendisi veremez; veli onayı gerekir
            consents: { create: this.consents.registrationConsents(adult && payload.healthDataConsent) },
            ...(registration.accountType === 'PROFESSIONAL' && professional
              ? {
                  professionalApplications: {
                    create: {
                      field: professional.field,
                      details: professional as unknown as Prisma.InputJsonValue,
                      documents: {
                        create: registration.documents.map((d) => ({
                          kind: d.kind,
                          originalName: d.originalName,
                          mimeType: d.mimeType,
                          sizeBytes: d.sizeBytes,
                          sha256: d.sha256,
                          storageKey: d.storageKey,
                          flags: d.flags,
                        })),
                      },
                    },
                  },
                }
              : {}),
          },
          select: { id: true },
        });
        // Dosyalar başvuruya geçti; bekleyen kayıt silinir (dosyalara dokunulmaz)
        await tx.pendingRegistration.delete({ where: { id: registration.id } });
        return created;
      });
      userId = user.id;
    } catch (error) {
      // Aynı anda başka biri aynı kullanıcı adını/e-postayı aldıysa veritabanındaki benzersizlik kuralı yakalar
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw String(error.meta?.target).includes('email')
          ? conflict('EMAIL_TAKEN', 'Bu e-posta adresi zaten kayıtlı.')
          : conflict('USERNAME_TAKEN', 'Bu kullanıcı adı alınmış.');
      }
      throw error;
    }

    const tokens = await this.auth.issueSession(userId, payload.deviceName);
    return { ...tokens, user: await this.users.getMe(userId) };
  }

  async resend(dto: RegisterResendDto) {
    const registration = await this.requireActive(dto.registrationId);
    if (registration.sendCount >= env.resendMaxCount) {
      throw tooMany('RESEND_LIMIT', 'Çok fazla kod istedin. Kaydı baştan başlatmalısın.');
    }
    const waited = (Date.now() - registration.lastSentAt.getTime()) / 1000;
    if (waited < env.resendCooldownSec) {
      const remaining = Math.ceil(env.resendCooldownSec - waited);
      throw tooMany('RESEND_TOO_SOON', `Yeni kod için ${remaining} saniye bekle.`, remaining);
    }

    const code = this.newCode();
    const updated = await this.prisma.pendingRegistration.update({
      where: { id: registration.id },
      data: {
        codeHash: this.codeHash(code, registration.id),
        codeExpiresAt: new Date(Date.now() + env.codeTtlMinutes * MINUTE_MS),
        sendCount: { increment: 1 },
        lastSentAt: new Date(),
        attempts: 0,
      },
      select: { codeExpiresAt: true },
    });
    await this.email.sendVerificationCode(registration.email, code, env.codeTtlMinutes);
    return { codeExpiresAt: updated.codeExpiresAt, ...(env.exposeDevCodes ? { devCode: code } : {}) };
  }

  async usernameAvailable(username: string): Promise<boolean> {
    if (!/^[a-z0-9_.]{3,20}$/.test(username)) return false;
    const [user, pending] = await Promise.all([
      this.prisma.user.count({ where: { username } }),
      this.prisma.pendingRegistration.count({ where: { username, expiresAt: { gt: new Date() } } }),
    ]);
    return user + pending === 0;
  }

  private async requireActive(registrationId: string, withDocuments = false) {
    const registration = await this.prisma.pendingRegistration.findUnique({
      where: { id: registrationId },
      include: { documents: withDocuments },
    });
    if (!registration) throw notFound('REGISTRATION_NOT_FOUND', 'Kayıt bulunamadı. Baştan başlamalısın.');
    if (registration.expiresAt.getTime() < Date.now()) {
      await this.removePending([registration.id]);
      throw gone('REGISTRATION_EXPIRED', 'Kayıt süresi doldu. Baştan başlamalısın.');
    }
    return { ...registration, documents: registration.documents ?? [] };
  }

  private async removePending(ids: string[]): Promise<void> {
    if (ids.length === 0) return;
    const docs = await this.prisma.pendingDocument.findMany({
      where: { registrationId: { in: ids } },
      select: { storageKey: true },
    });
    await this.prisma.pendingRegistration.deleteMany({ where: { id: { in: ids } } });
    await this.documents.removeFiles(docs.map((d) => d.storageKey));
  }

  // Süresi dolan bekleyen kayıtlar ve yüklenmiş geçici belgeleri silinir
  @Cron(CronExpression.EVERY_10_MINUTES)
  async purgeExpired(): Promise<void> {
    const expired = await this.prisma.pendingRegistration.findMany({
      where: { expiresAt: { lt: new Date() } },
      select: { id: true },
    });
    if (expired.length > 0) {
      await this.removePending(expired.map((r) => r.id));
      this.logger.log(`${expired.length} süresi dolmuş bekleyen kayıt silindi`);
    }
  }
}
