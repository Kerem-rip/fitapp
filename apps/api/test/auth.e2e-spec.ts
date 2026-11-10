import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types.js';
import {
  bearer,
  birthDateForAge,
  cleanupTestUsers,
  createTestApp,
  registerBody,
  registerUser,
  TEST_PASSWORD,
} from './helpers.js';

describe('Kayıt ve giriş (e2e)', () => {
  let app: INestApplication<App>;
  const http = () => request(app.getHttpServer());

  beforeAll(async () => {
    app = await createTestApp();
  });

  afterAll(async () => {
    await cleanupTestUsers(app);
    await app.close();
  });

  describe('kayıt', () => {
    it('yetişkin kullanıcı kayıt olur; şifre özeti cevapta yer almaz', async () => {
      const body = registerBody({ email: '  Buyuk.Harf@E2E.test ', username: 'Buyuk_Harf' });
      const res = await http().post('/api/auth/register').send(body).expect(201);

      expect(res.body.accessToken).toEqual(expect.any(String));
      expect(res.body.refreshToken).toEqual(expect.any(String));
      expect(res.body.user).toMatchObject({
        email: 'buyuk.harf@e2e.test',
        username: 'buyuk_harf',
        ageGroup: 'ADULT',
        roles: ['USER'],
        isPrivate: true,
      });
      expect(JSON.stringify(res.body)).not.toContain('passwordHash');
    });

    it('13 yaşından küçük kayıt olamaz', async () => {
      const res = await http()
        .post('/api/auth/register')
        .send(registerBody({ birthDate: birthDateForAge(12) }))
        .expect(403);
      expect(res.body.code).toBe('AGE_RESTRICTED');
    });

    it('13-17 yaş genç modunda kayıt olur', async () => {
      const { user } = await registerUser(app, { birthDate: birthDateForAge(15) });
      expect(user.ageGroup).toBe('TEEN');
    });

    it('aynı e-posta veya kullanıcı adı ikinci kez kullanılamaz', async () => {
      const { body } = await registerUser(app);

      const emailRes = await http()
        .post('/api/auth/register')
        .send(registerBody({ email: body.email }))
        .expect(409);
      expect(emailRes.body.code).toBe('EMAIL_TAKEN');

      const usernameRes = await http()
        .post('/api/auth/register')
        .send(registerBody({ username: body.username }))
        .expect(409);
      expect(usernameRes.body.code).toBe('USERNAME_TAKEN');
    });

    it.each([
      ['kısa şifre', { password: '1234567' }],
      ['geçersiz e-posta', { email: 'eposta-degil' }],
      ['geçersiz kullanıcı adı', { username: 'a b' }],
      ['yasaklı kullanıcı adı', { username: 'admin' }],
      ['koşullar kabul edilmemiş', { acceptTerms: false }],
      ['gelecekte doğum tarihi', { birthDate: '2999-01-01' }],
    ])('geçersiz veri reddedilir: %s', async (_name, overrides) => {
      await http().post('/api/auth/register').send(registerBody(overrides)).expect(400);
    });
  });

  describe('giriş', () => {
    it('doğru şifreyle giriş yapılır, yanlış şifre reddedilir', async () => {
      const { body } = await registerUser(app);

      const ok = await http()
        .post('/api/auth/login')
        .send({ email: body.email, password: TEST_PASSWORD })
        .expect(200);
      expect(ok.body.user.email).toBe(body.email);

      const wrong = await http()
        .post('/api/auth/login')
        .send({ email: body.email, password: 'yanlis-sifre' })
        .expect(401);
      expect(wrong.body.code).toBe('INVALID_CREDENTIALS');
    });

    it('kayıtlı olmayan e-posta, yanlış şifreyle aynı cevabı alır', async () => {
      const res = await http()
        .post('/api/auth/login')
        .send({ email: 'yok@e2e.test', password: TEST_PASSWORD })
        .expect(401);
      expect(res.body.code).toBe('INVALID_CREDENTIALS');
    });
  });

  describe('oturum', () => {
    it('giriş yapmadan korumalı adrese erişilemez', async () => {
      await http().get('/api/users/me').expect(401);
      await http().get('/api/users/me').set(bearer('gecersiz')).expect(401);
    });

    it('yenileme anahtarı her kullanımda değişir', async () => {
      const { refreshToken } = await registerUser(app);

      const res = await http().post('/api/auth/refresh').send({ refreshToken }).expect(200);
      expect(res.body.refreshToken).not.toBe(refreshToken);
      await http().get('/api/users/me').set(bearer(res.body.accessToken)).expect(200);
    });

    it('eski yenileme anahtarı tekrar kullanılırsa tüm oturumlar kapanır', async () => {
      const { refreshToken } = await registerUser(app);
      const rotated = await http().post('/api/auth/refresh').send({ refreshToken }).expect(200);

      // Eski anahtarın tekrar kullanılması çalınma belirtisidir
      await http().post('/api/auth/refresh').send({ refreshToken }).expect(401);

      await http().get('/api/users/me').set(bearer(rotated.body.accessToken)).expect(401);
      await http()
        .post('/api/auth/refresh')
        .send({ refreshToken: rotated.body.refreshToken })
        .expect(401);
    });

    it('çıkış yapınca erişim anahtarı geçersiz olur', async () => {
      const { accessToken, refreshToken } = await registerUser(app);

      await http().post('/api/auth/logout').set(bearer(accessToken)).expect(204);

      await http().get('/api/users/me').set(bearer(accessToken)).expect(401);
      await http().post('/api/auth/refresh').send({ refreshToken }).expect(401);
    });
  });
});
