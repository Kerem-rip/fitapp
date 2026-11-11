import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types.js';
import { bearer, cleanupTestData, createAdminAndLogin, createTestApp, registerUser, TEST_PASSWORD } from './helpers.js';

describe('Giriş ve oturum (e2e)', () => {
  let app: INestApplication<App>;
  const http = () => request(app.getHttpServer());

  beforeAll(async () => {
    app = await createTestApp();
  });

  afterAll(async () => {
    await cleanupTestData(app);
    await app.close();
  });

  describe('giriş', () => {
    it('e-posta veya kullanıcı adıyla giriş yapılır; yanlış şifre reddedilir', async () => {
      const { body } = await registerUser(app);

      const byEmail = await http().post('/api/auth/login').send({ identifier: body.email, password: TEST_PASSWORD }).expect(200);
      expect(byEmail.body.user.email).toBe(body.email);
      expect(JSON.stringify(byEmail.body)).not.toContain('passwordHash');

      await http().post('/api/auth/login').send({ identifier: body.username, password: TEST_PASSWORD }).expect(200);
      await http().post('/api/auth/login').send({ identifier: body.email.toUpperCase(), password: TEST_PASSWORD }).expect(200);

      const wrong = await http().post('/api/auth/login').send({ identifier: body.email, password: 'yanlis-sifre' }).expect(401);
      expect(wrong.body.code).toBe('INVALID_CREDENTIALS');
    });

    it('kayıtlı olmayan hesap, yanlış şifreyle aynı cevabı alır', async () => {
      const res = await http().post('/api/auth/login').send({ identifier: 'yok@e2e.test', password: TEST_PASSWORD }).expect(401);
      expect(res.body.code).toBe('INVALID_CREDENTIALS');
    });

    it('yönetici hesabı normal girişten giremez, yönetici girişinden girer', async () => {
      const { email } = await createAdminAndLogin(app);
      const res = await http().post('/api/auth/login').send({ identifier: email, password: TEST_PASSWORD }).expect(401);
      expect(res.body.code).toBe('INVALID_CREDENTIALS');
    });

    it('normal kullanıcı yönetici girişinden giremez', async () => {
      const { body } = await registerUser(app);
      await http().post('/api/auth/admin/login').send({ identifier: body.email, password: TEST_PASSWORD }).expect(401);
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
      await http().post('/api/auth/refresh').send({ refreshToken: rotated.body.refreshToken }).expect(401);
    });

    it('çıkış yapınca erişim anahtarı geçersiz olur', async () => {
      const { accessToken, refreshToken } = await registerUser(app);

      await http().post('/api/auth/logout').set(bearer(accessToken)).expect(204);

      await http().get('/api/users/me').set(bearer(accessToken)).expect(401);
      await http().post('/api/auth/refresh').send({ refreshToken }).expect(401);
    });
  });
});
