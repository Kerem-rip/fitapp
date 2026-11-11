import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types.js';
import { PrismaService } from '../src/common/prisma/prisma.service.js';
import {
  bearer,
  birthDateForAge,
  cleanupTestData,
  createTestApp,
  registerBody,
  registerUser,
  startRegistration,
  TEST_PASSWORD,
} from './helpers.js';

describe('Kayıt ve e-posta doğrulama (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  const http = () => request(app.getHttpServer());
  const verify = (registrationId: string, code: string) =>
    http().post('/api/auth/register/verify').send({ registrationId, code });

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
  });

  afterAll(async () => {
    await cleanupTestData(app);
    await app.close();
  });

  it('kod doğrulanmadan hesap oluşmaz; doğrulanınca oluşur ve oturum açılır', async () => {
    const { body, registrationId, devCode } = await startRegistration(app);

    // Henüz hesap yok
    await http().post('/api/auth/login').send({ identifier: body.email, password: TEST_PASSWORD }).expect(401);
    expect(await prisma.user.count({ where: { email: body.email } })).toBe(0);

    const res = await verify(registrationId, devCode).expect(200);
    expect(res.body.accessToken).toEqual(expect.any(String));
    expect(res.body.user).toMatchObject({ email: body.email, username: body.username, ageGroup: 'ADULT', roles: ['USER'], application: null });
    expect(JSON.stringify(res.body)).not.toContain('passwordHash');
    await http().get('/api/users/me').set(bearer(res.body.accessToken)).expect(200);

    // Bekleyen kayıt silinmiş olmalı
    expect(await prisma.pendingRegistration.count({ where: { id: registrationId } })).toBe(0);
  });

  it('e-posta ve kullanıcı adı küçük harfe çevrilir, kod kayıtta saklanmaz', async () => {
    const { body, registrationId } = await startRegistration(app, {
      email: `  Buyuk.Harf${Date.now()}@E2E.test `,
      username: `Buyuk_${Date.now() % 100000}`,
    });
    const row = await prisma.pendingRegistration.findUniqueOrThrow({ where: { id: registrationId } });
    expect(row.email).toBe(String(body.email).trim().toLowerCase());
    expect(row.username).toBe(String(body.username).toLowerCase());
    expect(row.codeHash).toMatch(/^[a-f0-9]{64}$/);
    expect(JSON.stringify(row)).not.toContain(TEST_PASSWORD);
  });

  describe('kurallar', () => {
    it('13 yaşından küçük kayıt olamaz; 13-17 genç modunda açılır', async () => {
      const res = await http()
        .post('/api/auth/register/start')
        .send(registerBody({ birthDate: birthDateForAge(12) }))
        .expect(403);
      expect(res.body.code).toBe('AGE_RESTRICTED');

      const { user } = await registerUser(app, { birthDate: birthDateForAge(15) });
      expect(user.ageGroup).toBe('TEEN');
    });

    it('alınmış e-posta veya kullanıcı adı kullanılamaz', async () => {
      const { body } = await registerUser(app);

      const emailRes = await http().post('/api/auth/register/start').send(registerBody({ email: body.email })).expect(409);
      expect(emailRes.body.code).toBe('EMAIL_TAKEN');

      const usernameRes = await http().post('/api/auth/register/start').send(registerBody({ username: body.username })).expect(409);
      expect(usernameRes.body.code).toBe('USERNAME_TAKEN');
    });

    it('bekleyen kayıt kullanıcı adını kısa süre rezerve eder; aynı e-postayla yeniden denenebilir', async () => {
      const first = await startRegistration(app);

      // Başka e-posta aynı kullanıcı adını alamaz
      const taken = await http().post('/api/auth/register/start').send(registerBody({ username: first.body.username })).expect(409);
      expect(taken.body.code).toBe('USERNAME_TAKEN');

      // Aynı e-postayla yeniden başlayınca eski bekleyen kayıt silinir, yenisi geçerli olur
      const retry = await startRegistration(app, { email: first.body.email, username: first.body.username });
      expect(retry.registrationId).not.toBe(first.registrationId);
      await verify(first.registrationId, first.devCode).expect(404);
      await verify(retry.registrationId, retry.devCode).expect(200);
    });

    it('geçici e-posta servisleri engellenir', async () => {
      const res = await http().post('/api/auth/register/start').send(registerBody({ email: 'biri@mailinator.com' })).expect(400);
      expect(res.body.code).toBe('EMAIL_NOT_ALLOWED');
    });

    it.each([
      ['kısa şifre', { password: '1234567' }],
      ['geçersiz e-posta', { email: 'eposta-degil' }],
      ['geçersiz kullanıcı adı', { username: 'a b' }],
      ['yasaklı kullanıcı adı', { username: 'admin' }],
      ['koşullar kabul edilmemiş', { acceptTerms: false }],
      ['gelecekte doğum tarihi', { birthDate: '2999-01-01' }],
      ['profesyonel alan bilgisi eksik', { accountType: 'PROFESSIONAL', lastName: 'X' }],
      ['standart hesapta alan bilgisi', { professional: { field: 'DIETITIAN', city: 'İzmir' } }],
    ])('geçersiz veri reddedilir: %s', async (_name, overrides) => {
      await http().post('/api/auth/register/start').send(registerBody(overrides)).expect(400);
    });

    it('profesyonel hesap için 18 yaş gerekir', async () => {
      const res = await http()
        .post('/api/auth/register/start')
        .send(
          registerBody({
            accountType: 'PROFESSIONAL',
            lastName: 'Uzman',
            birthDate: birthDateForAge(16),
            professional: { field: 'DIETITIAN', city: 'İzmir' },
          }),
        )
        .expect(403);
      expect(res.body.code).toBe('PROFESSIONAL_ADULT_ONLY');
    });

    it('kullanıcı adının boş olup olmadığı sorulabilir', async () => {
      const { body } = await registerUser(app);
      const taken = await http().get('/api/auth/register/username-available').query({ username: body.username }).expect(200);
      expect(taken.body.available).toBe(false);
      const free = await http().get('/api/auth/register/username-available').query({ username: 'tamamen_bos_ad_1' }).expect(200);
      expect(free.body.available).toBe(true);
      const invalid = await http().get('/api/auth/register/username-available').query({ username: 'a b' }).expect(200);
      expect(invalid.body.available).toBe(false);
    });
  });

  describe('doğrulama kodu', () => {
    it('yanlış kod hak azaltır; hak bitince kayıt silinir', async () => {
      const { registrationId, devCode } = await startRegistration(app);
      const wrong = devCode === '000000' ? '111111' : '000000';

      const first = await verify(registrationId, wrong).expect(400);
      expect(first.body.code).toBe('CODE_INVALID');
      expect(first.body.message).toContain('4 deneme');

      for (let i = 0; i < 3; i += 1) await verify(registrationId, wrong).expect(400);
      const last = await verify(registrationId, wrong).expect(429);
      expect(last.body.code).toBe('TOO_MANY_ATTEMPTS');

      // Doğru kod bile artık işe yaramaz: kayıt silindi
      await verify(registrationId, devCode).expect(404);
    });

    it('süresi dolan kod reddedilir; yeni kod istenince çalışır', async () => {
      const { registrationId, devCode, body } = await startRegistration(app);
      await prisma.pendingRegistration.update({
        where: { id: registrationId },
        data: { codeExpiresAt: new Date(Date.now() - 1000), lastSentAt: new Date(Date.now() - 60_000) },
      });
      const expired = await verify(registrationId, devCode).expect(400);
      expect(expired.body.code).toBe('CODE_EXPIRED');

      const resent = await http().post('/api/auth/register/resend').send({ registrationId }).expect(200);
      expect(resent.body.devCode).toMatch(/^\d{6}$/);
      // Eski kod artık geçersiz
      if (resent.body.devCode !== devCode) await verify(registrationId, devCode).expect(400);
      const ok = await verify(registrationId, resent.body.devCode).expect(200);
      expect(ok.body.user.email).toBe(body.email);
    });

    it('yeni kod isteği için bekleme süresi vardır', async () => {
      const { registrationId } = await startRegistration(app);
      const res = await http().post('/api/auth/register/resend').send({ registrationId }).expect(429);
      expect(res.body.code).toBe('RESEND_TOO_SOON');
    });

    it('süresi dolmuş kayıt kullanılamaz', async () => {
      const { registrationId, devCode } = await startRegistration(app);
      await prisma.pendingRegistration.update({ where: { id: registrationId }, data: { expiresAt: new Date(Date.now() - 1000) } });
      const res = await verify(registrationId, devCode).expect(410);
      expect(res.body.code).toBe('REGISTRATION_EXPIRED');
    });
  });

  it('rızalar kayıtta saklanır; 18 yaş altı sağlık verisi rızasını kendisi veremez', async () => {
    const adult = await registerUser(app, { healthDataConsent: true });
    const adultConsents = await http().get('/api/consents').set(bearer(adult.accessToken)).expect(200);
    expect(adultConsents.body.map((c: { type: string }) => c.type).sort()).toEqual(['health_data', 'privacy_notice', 'terms']);

    const teen = await registerUser(app, { birthDate: birthDateForAge(15), healthDataConsent: true });
    const teenConsents = await http().get('/api/consents').set(bearer(teen.accessToken)).expect(200);
    expect(teenConsents.body.map((c: { type: string }) => c.type)).not.toContain('health_data');
  });
});
