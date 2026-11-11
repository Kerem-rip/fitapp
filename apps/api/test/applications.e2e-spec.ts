import { INestApplication } from '@nestjs/common';
import { randomBytes } from 'node:crypto';
import request from 'supertest';
import { App } from 'supertest/types.js';
import { PrismaService } from '../src/common/prisma/prisma.service.js';
import {
  bearer,
  cleanupTestData,
  createAdminAndLogin,
  createTestApp,
  fakePdf,
  PRO_DETAILS,
  registerProfessional,
  registerUser,
  startRegistration,
  TEST_PASSWORD,
} from './helpers.js';

describe('Profesyonel başvuru ve yönetici onayı (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  const http = () => request(app.getHttpServer());

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
  });

  afterAll(async () => {
    await cleanupTestData(app);
    await app.close();
  });

  const upload = (registrationId: string, kind: string, file: Buffer, filename = 'belge.pdf') =>
    http()
      .post(`/api/auth/register/${registrationId}/documents`)
      .field('kind', kind)
      .attach('file', file, { filename });

  describe('profesyonel kayıt', () => {
    it('belge olmadan hesap açılmaz', async () => {
      const { registrationId, devCode } = await startRegistration(app, {
        accountType: 'PROFESSIONAL',
        lastName: 'Uzman',
        professional: PRO_DETAILS.DIETITIAN,
      });
      const res = await http().post('/api/auth/register/verify').send({ registrationId, code: devCode }).expect(400);
      expect(res.body.code).toBe('DOCUMENTS_REQUIRED');
    });

    it('belgeli kayıt "onay sürecinde" açılır; kişi sadece standart kullanıcıdır', async () => {
      const { user, accessToken, body } = await registerProfessional(app, 'DIETITIAN');
      expect(user.roles).toEqual(['USER']);
      expect(user.application).toMatchObject({ status: 'PENDING', field: 'DIETITIAN' });

      const status = await http().get('/api/applications/me').set(bearer(accessToken)).expect(200);
      expect(status.body).toMatchObject({ status: 'PENDING', canResubmit: false });

      // Aynı e-posta ve kullanıcı adıyla normal giriş yapabilir
      await http().post('/api/auth/login').send({ identifier: body.username, password: TEST_PASSWORD }).expect(200);
    });

    it('her alan kendi belge türünü ister', async () => {
      const { registrationId } = await startRegistration(app, {
        accountType: 'PROFESSIONAL',
        lastName: 'Uzman',
        professional: PRO_DETAILS.GYM_OWNER,
      });
      const wrong = await upload(registrationId, 'diploma', fakePdf()).expect(400);
      expect(wrong.body.code).toBe('INVALID_DOCUMENT_KIND');
      await upload(registrationId, 'business_license', fakePdf()).expect(201);
    });

    it('standart hesapta belge yüklenemez', async () => {
      const { registrationId } = await startRegistration(app);
      const res = await upload(registrationId, 'diploma', fakePdf()).expect(403);
      expect(res.body.code).toBe('DOCUMENTS_NOT_ALLOWED');
    });

    it('sadece PDF, JPG ve PNG kabul edilir (dosya türü baytlardan anlaşılır)', async () => {
      const { registrationId } = await startRegistration(app, {
        accountType: 'PROFESSIONAL',
        lastName: 'Uzman',
        professional: PRO_DETAILS.DIETITIAN,
      });
      // Uzantı .pdf ama içi metin
      const fake = await upload(registrationId, 'diploma', Buffer.from('bu bir pdf degil '.repeat(2000))).expect(400);
      expect(fake.body.code).toBe('INVALID_FILE_TYPE');
      const exe = await upload(registrationId, 'diploma', Buffer.from([0x4d, 0x5a, 0x90, 0x00, ...randomBytes(20000)]), 'belge.pdf').expect(400);
      expect(exe.body.code).toBe('INVALID_FILE_TYPE');

      const png = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), randomBytes(20000)]);
      await upload(registrationId, 'diploma', png, 'belge.png').expect(201);
    });

    it('çok büyük dosya ve fazla dosya reddedilir', async () => {
      const { registrationId } = await startRegistration(app, {
        accountType: 'PROFESSIONAL',
        lastName: 'Uzman',
        professional: PRO_DETAILS.TRAINER,
      });
      const huge = Buffer.concat([Buffer.from('%PDF-1.4\n'), Buffer.alloc(11 * 1024 * 1024, 1)]);
      await upload(registrationId, 'diploma', huge).expect((res) => {
        if (![413, 400].includes(res.status)) throw new Error(`beklenmeyen durum: ${res.status}`);
      });

      for (let i = 0; i < 5; i += 1) await upload(registrationId, 'certificate', fakePdf()).expect(201);
      const sixth = await upload(registrationId, 'certificate', fakePdf()).expect(400);
      expect(sixth.body.code).toBe('TOO_MANY_DOCUMENTS');
    });

    it('süresi dolan bekleyen kayıt silinir ve belgeleri diskten kalkar', async () => {
      const { registrationId } = await startRegistration(app, {
        accountType: 'PROFESSIONAL',
        lastName: 'Uzman',
        professional: PRO_DETAILS.DIETITIAN,
      });
      await upload(registrationId, 'diploma', fakePdf()).expect(201);
      expect(await prisma.pendingDocument.count({ where: { registrationId } })).toBe(1);

      await prisma.pendingRegistration.update({ where: { id: registrationId }, data: { expiresAt: new Date(Date.now() - 1000) } });
      // Yeni bir kayıt başlatmak temizliği tetikler
      await startRegistration(app);
      expect(await prisma.pendingRegistration.count({ where: { id: registrationId } })).toBe(0);
      expect(await prisma.pendingDocument.count({ where: { registrationId } })).toBe(0);
    });
  });

  describe('otomatik işaretler', () => {
    it('aynı dosya ikinci başvuruda "kopya" olarak işaretlenir; başvurana gösterilmez', async () => {
      const shared = fakePdf('ayni-diploma-' + randomBytes(4).toString('hex'));
      const first = await registerProfessional(app, 'DIETITIAN', { documents: [shared] });
      const second = await registerProfessional(app, 'DIETITIAN', { documents: [shared] });

      const admin = await createAdminAndLogin(app);
      const detail = await http().get(`/api/admin/applications/${second.user.application!.id}`).set(bearer(admin.accessToken)).expect(200);
      expect(detail.body.documents[0].flags.map((f: { code: string }) => f.code)).toContain('DUPLICATE_DOCUMENT');
      expect(detail.body.documents[0].flags[0].label).toEqual(expect.any(String));

      const firstDetail = await http().get(`/api/admin/applications/${first.user.application!.id}`).set(bearer(admin.accessToken)).expect(200);
      expect(firstDetail.body.documents[0].flags.map((f: { code: string }) => f.code)).not.toContain('DUPLICATE_DOCUMENT');

      // Başvuran kendi cevabında işaretleri görmez
      const mine = await http().get('/api/applications/me').set(bearer(second.accessToken)).expect(200);
      expect(JSON.stringify(mine.body)).not.toContain('DUPLICATE');
    });

    it('düzenleme programı izi taşıyan dosya işaretlenir', async () => {
      const edited = Buffer.from(`%PDF-1.4\n/Producer (Adobe Photoshop 25.0)\n${'x'.repeat(20000)}\n%%EOF`);
      const { user } = await registerProfessional(app, 'TRAINER', { documents: [edited] });
      const admin = await createAdminAndLogin(app);
      const detail = await http().get(`/api/admin/applications/${user.application!.id}`).set(bearer(admin.accessToken)).expect(200);
      expect(detail.body.documents[0].flags.map((f: { code: string }) => f.code)).toContain('EDITING_SOFTWARE_TRACE');
    });
  });

  describe('yönetici incelemesi', () => {
    it('başvuru listesi sadece yönetici ve moderatöre açıktır', async () => {
      const normal = await registerUser(app);
      await http().get('/api/admin/applications').set(bearer(normal.accessToken)).expect(403);
      await http().get('/api/admin/applications').expect(401);
      const pro = await registerProfessional(app);
      await http().get('/api/admin/applications').set(bearer(pro.accessToken)).expect(403);

      const admin = await createAdminAndLogin(app);
      const list = await http().get('/api/admin/applications?status=PENDING').set(bearer(admin.accessToken)).expect(200);
      expect(list.body.some((a: { id: string }) => a.id === pro.user.application!.id)).toBe(true);
    });

    it('belge açılışı kayıt altına alınır ve belge gerçek içerikle döner', async () => {
      const content = 'gizli-diploma-' + randomBytes(4).toString('hex');
      const doc = fakePdf(content);
      const pro = await registerProfessional(app, 'DIETITIAN', { documents: [doc] });
      const admin = await createAdminAndLogin(app);
      const detail = await http().get(`/api/admin/applications/${pro.user.application!.id}`).set(bearer(admin.accessToken)).expect(200);
      expect(detail.body.checklist.length).toBeGreaterThan(0);
      expect(detail.body.user.email).toBe(pro.body.email);

      const docId = detail.body.documents[0].id as string;
      const file = await http().get(`/api/admin/documents/${docId}/file`).set(bearer(admin.accessToken)).expect(200);
      expect(file.headers['content-type']).toContain('application/pdf');
      expect(file.headers['cache-control']).toBe('no-store');
      expect(Buffer.from(file.body).toString('latin1')).toContain(content);

      expect(await prisma.documentAccessLog.count({ where: { documentId: docId, adminId: admin.adminId } })).toBe(1);

      // Normal kullanıcı belgeye erişemez
      const normal = await registerUser(app);
      await http().get(`/api/admin/documents/${docId}/file`).set(bearer(normal.accessToken)).expect(403);
    });

    it('onay: kullanıcıya rol verilir ve profesyonel profili açılır', async () => {
      const pro = await registerProfessional(app, 'DIETITIAN');
      const admin = await createAdminAndLogin(app);

      await http().post(`/api/admin/applications/${pro.user.application!.id}/approve`).set(bearer(admin.accessToken)).expect(200);

      const login = await http().post('/api/auth/login').send({ identifier: pro.body.email, password: TEST_PASSWORD }).expect(200);
      expect(login.body.user.roles.sort()).toEqual(['DIETITIAN', 'USER']);
      expect(login.body.user.application.status).toBe('APPROVED');

      const profile = await prisma.professionalProfile.findUniqueOrThrow({ where: { userId: pro.user.id } });
      expect(profile).toMatchObject({ type: 'DIETITIAN', verification: 'APPROVED', city: 'İstanbul' });
      expect(await prisma.notification.count({ where: { userId: pro.user.id, type: 'application_approved' } })).toBe(1);

      // İkinci kez karar verilemez
      const again = await http().post(`/api/admin/applications/${pro.user.application!.id}/approve`).set(bearer(admin.accessToken)).expect(409);
      expect(again.body.code).toBe('ALREADY_REVIEWED');
    });

    it('salon sahibi onayı salon yöneticisi rolünü verir', async () => {
      const owner = await registerProfessional(app, 'GYM_OWNER');
      const admin = await createAdminAndLogin(app);
      await http().post(`/api/admin/applications/${owner.user.application!.id}/approve`).set(bearer(admin.accessToken)).expect(200);
      const login = await http().post('/api/auth/login').send({ identifier: owner.body.email, password: TEST_PASSWORD }).expect(200);
      expect(login.body.user.roles).toContain('GYM_MANAGER');
      const profile = await prisma.professionalProfile.findUniqueOrThrow({ where: { userId: owner.user.id } });
      expect(profile.type).toBe('GYM');
    });

    it('red gerekçe ister; kişi gerekçeyi görür, rol almaz, yeniden başvurabilir', async () => {
      const pro = await registerProfessional(app, 'TRAINER');
      const admin = await createAdminAndLogin(app);
      const id = pro.user.application!.id;

      const noReason = await http().post(`/api/admin/applications/${id}/reject`).set(bearer(admin.accessToken)).send({ reason: '' }).expect(400);
      expect(noReason.body.message).toBeDefined();
      await http().post(`/api/admin/applications/${id}/reject`).set(bearer(admin.accessToken)).send({ reason: 'Belge okunaklı değil, tekrar yükleyin.' }).expect(200);

      const login = await http().post('/api/auth/login').send({ identifier: pro.body.email, password: TEST_PASSWORD }).expect(200);
      expect(login.body.user.roles).toEqual(['USER']);
      expect(login.body.user.application).toMatchObject({ status: 'REJECTED', rejectionReason: 'Belge okunaklı değil, tekrar yükleyin.', canResubmit: true });

      // Yeniden başvuru
      const resubmit = await http()
        .post('/api/applications/me/resubmit')
        .set(bearer(pro.accessToken))
        .field('kinds', JSON.stringify(['diploma']))
        .attach('files', fakePdf(), { filename: 'yeni.pdf', contentType: 'application/pdf' })
        .expect(201);
      expect(resubmit.body).toMatchObject({ status: 'PENDING', attemptNumber: 2 });

      const detail = await http().get(`/api/admin/applications/${resubmit.body.id}`).set(bearer(admin.accessToken)).expect(200);
      expect(detail.body.previousAttempts[0]).toMatchObject({ status: 'REJECTED', attemptNumber: 1 });
    });

    it('bekleyen başvuru yeniden gönderilemez; başvuru hakkı 3 ile sınırlıdır', async () => {
      const pro = await registerProfessional(app, 'DIETITIAN');
      const admin = await createAdminAndLogin(app);
      const resubmit = () =>
        http()
          .post('/api/applications/me/resubmit')
          .set(bearer(pro.accessToken))
          .field('kinds', JSON.stringify(['diploma']))
          .attach('files', fakePdf(), { filename: 'yeni.pdf', contentType: 'application/pdf' });

      const notRejected = await resubmit().expect(409);
      expect(notRejected.body.code).toBe('APPLICATION_NOT_REJECTED');

      let applicationId = pro.user.application!.id;
      for (let attempt = 1; attempt <= 2; attempt += 1) {
        await http().post(`/api/admin/applications/${applicationId}/reject`).set(bearer(admin.accessToken)).send({ reason: 'Uygun değil, yeniden deneyin.' }).expect(200);
        applicationId = (await resubmit().expect(201)).body.id;
      }
      await http().post(`/api/admin/applications/${applicationId}/reject`).set(bearer(admin.accessToken)).send({ reason: 'Yine uygun değil.' }).expect(200);
      const exceeded = await resubmit().expect(403);
      expect(exceeded.body.code).toBe('APPLICATION_ATTEMPTS_EXCEEDED');
    });
  });
});
