import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types.js';
import { PrismaService } from '../src/common/prisma/prisma.service.js';
import { AccountPurgeService } from '../src/modules/users/account-purge.service.js';
import {
  bearer,
  birthDateForAge,
  cleanupTestUsers,
  createTestApp,
  registerUser,
  TEST_PASSWORD,
} from './helpers.js';

const DAY_MS = 24 * 60 * 60 * 1000;

describe('Profil, rızalar ve hesap silme (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  const http = () => request(app.getHttpServer());

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
  });

  afterAll(async () => {
    await cleanupTestUsers(app);
    await app.close();
  });

  describe('profil', () => {
    it('kullanıcı bilgilerini günceller', async () => {
      const { accessToken } = await registerUser(app);
      const res = await http()
        .patch('/api/users/me')
        .set(bearer(accessToken))
        .send({ firstName: 'Ayşe', bio: 'Merhaba', isPrivate: false })
        .expect(200);
      expect(res.body).toMatchObject({ firstName: 'Ayşe', bio: 'Merhaba', isPrivate: false });
    });

    it('başkasının kullanıcı adı alınamaz', async () => {
      const other = await registerUser(app);
      const { accessToken } = await registerUser(app);
      const res = await http()
        .patch('/api/users/me')
        .set(bearer(accessToken))
        .send({ username: other.body.username })
        .expect(409);
      expect(res.body.code).toBe('USERNAME_TAKEN');
    });

    it('genç modunda profil açık hesaba çevrilemez', async () => {
      const { accessToken } = await registerUser(app, { birthDate: birthDateForAge(15) });
      const res = await http()
        .patch('/api/users/me')
        .set(bearer(accessToken))
        .send({ isPrivate: false })
        .expect(403);
      expect(res.body.code).toBe('TEEN_PROFILE_PRIVATE');
    });
  });

  describe('KVKK rızaları', () => {
    const types = (res: request.Response) =>
      (res.body as { type: string }[]).map((c) => c.type).sort();

    it('kayıtta koşullar kaydedilir; sağlık verisi rızası sadece istenirse', async () => {
      const without = await registerUser(app);
      const res1 = await http().get('/api/consents').set(bearer(without.accessToken)).expect(200);
      expect(types(res1)).toEqual(['privacy_notice', 'terms']);

      const withHealth = await registerUser(app, { healthDataConsent: true });
      const res2 = await http()
        .get('/api/consents')
        .set(bearer(withHealth.accessToken))
        .expect(200);
      expect(types(res2)).toEqual(['health_data', 'privacy_notice', 'terms']);
    });

    it('rıza sonradan verilir ve geri çekilir; geçmiş kaydı silinmez', async () => {
      const { accessToken, user } = await registerUser(app);

      const granted = await http()
        .put('/api/consents/health_data')
        .set(bearer(accessToken))
        .expect(200);
      expect(types(granted)).toContain('health_data');

      const revoked = await http()
        .delete('/api/consents/health_data')
        .set(bearer(accessToken))
        .expect(200);
      expect(types(revoked)).not.toContain('health_data');

      const history = await prisma.consent.findMany({
        where: { userId: user.id, type: 'health_data' },
      });
      expect(history).toHaveLength(1);
      expect(history[0]?.revokedAt).not.toBeNull();
    });

    it('zorunlu rızalar bu adresten geri çekilemez', async () => {
      const { accessToken } = await registerUser(app);
      await http().delete('/api/consents/terms').set(bearer(accessToken)).expect(400);
    });

    it('18 yaş altı sağlık verisi rızasını kendisi veremez', async () => {
      const teen = await registerUser(app, {
        birthDate: birthDateForAge(15),
        healthDataConsent: true,
      });
      const list = await http().get('/api/consents').set(bearer(teen.accessToken)).expect(200);
      expect(types(list)).not.toContain('health_data');

      const res = await http()
        .put('/api/consents/health_data')
        .set(bearer(teen.accessToken))
        .expect(403);
      expect(res.body.code).toBe('PARENTAL_CONSENT_REQUIRED');
    });
  });

  describe('hesap silme', () => {
    const requestDeletion = (accessToken: string, password = TEST_PASSWORD) =>
      http().post('/api/users/me/delete').set(bearer(accessToken)).send({ password });

    it('yanlış şifreyle silinemez', async () => {
      const { accessToken } = await registerUser(app);
      const res = await requestDeletion(accessToken, 'yanlis-sifre').expect(401);
      expect(res.body.code).toBe('INVALID_PASSWORD');
      await http().get('/api/users/me').set(bearer(accessToken)).expect(200);
    });

    it('silme talebi oturumları kapatır; 30 gün içinde giriş silmeyi iptal eder', async () => {
      const { accessToken, refreshToken, body } = await registerUser(app);

      const res = await requestDeletion(accessToken).expect(200);
      expect(res.body.graceDays).toBe(30);

      await http().get('/api/users/me').set(bearer(accessToken)).expect(401);
      await http().post('/api/auth/refresh').send({ refreshToken }).expect(401);

      const login = await http()
        .post('/api/auth/login')
        .send({ email: body.email, password: TEST_PASSWORD })
        .expect(200);
      expect(login.body.deletionCancelled).toBe(true);
      await http().get('/api/users/me').set(bearer(login.body.accessToken)).expect(200);
    });

    it('30 gün dolunca hesap ve verileri kalıcı silinir; süresi dolmayan kalır', async () => {
      const expired = await registerUser(app, { healthDataConsent: true });
      const recent = await registerUser(app);
      await requestDeletion(expired.accessToken).expect(200);
      await requestDeletion(recent.accessToken).expect(200);

      const in31Days = new Date(Date.now() + 31 * DAY_MS);
      await prisma.user.update({
        where: { id: recent.user.id },
        data: { deletionRequestedAt: new Date(in31Days.getTime() - 5 * DAY_MS) },
      });

      await app.get(AccountPurgeService).purgeExpired(in31Days);

      expect(await prisma.user.findUnique({ where: { id: expired.user.id } })).toBeNull();
      expect(await prisma.consent.count({ where: { userId: expired.user.id } })).toBe(0);
      expect(await prisma.session.count({ where: { userId: expired.user.id } })).toBe(0);
      expect(await prisma.user.findUnique({ where: { id: recent.user.id } })).not.toBeNull();
    });

    it('süresi dolmuş hesapla giriş yapılamaz', async () => {
      const { accessToken, body, user } = await registerUser(app);
      await requestDeletion(accessToken).expect(200);
      await prisma.user.update({
        where: { id: user.id },
        data: { deletionRequestedAt: new Date(Date.now() - 31 * DAY_MS) },
      });

      await http()
        .post('/api/auth/login')
        .send({ email: body.email, password: TEST_PASSWORD })
        .expect(401);
    });
  });
});
