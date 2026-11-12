import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types.js';
import { PrismaService } from '../src/common/prisma/prisma.service.js';
import { cleanupTestData, createAdminAndLogin, createTestApp, registerUser } from './helpers.js';

describe('Şifremi unuttum (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  const http = () => request(app.getHttpServer());
  const forgot = (email: string) => http().post('/api/auth/password/forgot').send({ email });
  const reset = (email: string, code: string, password: string) => http().post('/api/auth/password/reset').send({ email, code, password });
  const login = (identifier: string, password: string) => http().post('/api/auth/login').send({ identifier, password });

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
  });

  afterAll(async () => {
    await cleanupTestData(app);
    await app.close();
  });

  it('kodla yeni şifre belirlenir; eski şifre ve eski oturumlar geçersiz olur', async () => {
    const user = await registerUser(app);
    const email = user.body.email as string;
    const res = (await forgot(email.toUpperCase()).expect(200)).body;
    expect(res).toMatchObject({ sent: true });
    expect(res.devCode).toMatch(/^\d{6}$/);

    const wrong = res.devCode === '000000' ? '111111' : '000000';
    const bad = await reset(email, wrong, 'YeniSifre123').expect(400);
    expect(bad.body.code).toBe('CODE_INVALID');
    expect(bad.body.message).toContain('4 deneme');

    await reset(email, res.devCode, 'kisa').expect(400);
    await reset(email, res.devCode, 'YeniSifre123').expect(200);

    await login(email, user.body.password as string).expect(401);
    await login(email, 'YeniSifre123').expect(200);
    // Eski oturumun yenileme anahtarı artık çalışmaz
    await http().post('/api/auth/refresh').send({ refreshToken: user.refreshToken }).expect(401);
    // Kod bir kez kullanılır
    expect((await reset(email, res.devCode, 'BaskaSifre123').expect(400)).body.code).toBe('CODE_INVALID');
  });

  it('hesap yoksa da aynı cevap döner; bilgi sızdırmaz', async () => {
    const res = (await forgot('yok-boyle-biri@e2e.test').expect(200)).body;
    expect(res).toEqual({ sent: true, codeTtlMinutes: expect.any(Number) });
    expect((await reset('yok-boyle-biri@e2e.test', '123456', 'YeniSifre123').expect(400)).body.code).toBe('CODE_INVALID');
  });

  it('çok fazla hatalı denemede kod kilitlenir; bekleme süresinde yeni kod üretilmez', async () => {
    const user = await registerUser(app);
    const email = user.body.email as string;
    const { devCode } = (await forgot(email).expect(200)).body as { devCode: string };
    // Hemen ikinci istek: aynı cevap, yeni kod yok
    expect((await forgot(email).expect(200)).body.devCode).toBeUndefined();

    const wrong = devCode === '000000' ? '111111' : '000000';
    for (let i = 0; i < 4; i++) await reset(email, wrong, 'YeniSifre123').expect(400);
    expect((await reset(email, wrong, 'YeniSifre123').expect(400)).body.code).toBe('CODE_LOCKED');
    expect((await reset(email, devCode, 'YeniSifre123').expect(400)).body.code).toBe('CODE_LOCKED');
    await login(email, user.body.password as string).expect(200);
  });

  it('süresi dolan kod kabul edilmez', async () => {
    const user = await registerUser(app);
    const email = user.body.email as string;
    const { devCode } = (await forgot(email).expect(200)).body as { devCode: string };
    await prisma.passwordReset.update({ where: { userId: user.user.id }, data: { codeExpiresAt: new Date(Date.now() - 1000) } });
    expect((await reset(email, devCode, 'YeniSifre123').expect(400)).body.code).toBe('CODE_INVALID');
  });

  it('yönetici hesabı bu yoldan sıfırlanmaz', async () => {
    await createAdminAndLogin(app);
    const admin = await prisma.user.findFirstOrThrow({ where: { email: { startsWith: 'admin-', endsWith: '@e2e.test' } }, select: { email: true } });
    const res = (await forgot(admin.email).expect(200)).body;
    expect(res.devCode).toBeUndefined();
  });
});
