// Uçtan uca testlerin ortak araçları. Testler gerçek veritabanına karşı çalışır
// (önce `pnpm db:up`). Test kullanıcıları @e2e.test uzantılı e-posta kullanır ve sonunda silinir.
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { randomBytes } from 'node:crypto';
import { rm } from 'node:fs/promises';
import request from 'supertest';
import { App } from 'supertest/types.js';
import { AppModule } from '../src/app.module.js';
import { configureApp } from '../src/app.setup.js';
import { hashPassword } from '../src/common/password.js';
import { PrismaService } from '../src/common/prisma/prisma.service.js';

export const TEST_PASSWORD = 'dogru-sifre-123';

export async function createTestApp(): Promise<INestApplication<App>> {
  const moduleFixture = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();
  const app = moduleFixture.createNestApplication<INestApplication<App>>();
  configureApp(app);
  await app.init();
  return app;
}

export async function cleanupTestData(app: INestApplication): Promise<void> {
  const prisma = app.get(PrismaService);
  await prisma.pendingRegistration.deleteMany({ where: { email: { endsWith: '@e2e.test' } } });
  await prisma.user.deleteMany({ where: { email: { endsWith: '@e2e.test' } } });
  await rm('./storage-test', { recursive: true, force: true });
}

// Bugünden `years` yıl önce doğmuş birinin doğum tarihi (YYYY-AA-GG)
export function birthDateForAge(years: number): string {
  const date = new Date();
  date.setUTCFullYear(date.getUTCFullYear() - years);
  date.setUTCDate(date.getUTCDate() - 1);
  return date.toISOString().slice(0, 10);
}

export function registerBody(overrides: Record<string, unknown> = {}) {
  const id = randomBytes(5).toString('hex');
  return {
    accountType: 'USER',
    email: `user-${id}@e2e.test`,
    username: `u_${id}`,
    password: TEST_PASSWORD,
    firstName: 'Test',
    birthDate: birthDateForAge(25),
    acceptTerms: true,
    ...overrides,
  };
}

export const bearer = (token: string) => ({ Authorization: `Bearer ${token}` });

// Kayıt başlatır (e-posta kodu gönderilir). Test modunda kod cevapta `devCode` olarak döner.
export async function startRegistration(app: INestApplication<App>, overrides: Record<string, unknown> = {}) {
  const body = registerBody(overrides);
  const res = await request(app.getHttpServer()).post('/api/auth/register/start').send(body).expect(201);
  return {
    body,
    registrationId: res.body.registrationId as string,
    devCode: res.body.devCode as string,
  };
}

// Standart kullanıcı kaydı: başlat + kodu doğrula
export async function registerUser(app: INestApplication<App>, overrides: Record<string, unknown> = {}) {
  const { body, registrationId, devCode } = await startRegistration(app, overrides);
  const res = await request(app.getHttpServer())
    .post('/api/auth/register/verify')
    .send({ registrationId, code: devCode })
    .expect(200);
  return {
    body,
    accessToken: res.body.accessToken as string,
    refreshToken: res.body.refreshToken as string,
    user: res.body.user as { id: string; ageGroup: string; email: string; roles: string[]; application: { status: string } | null },
  };
}

// Test belgesi: her çağrıda farklı içerik (ayrı dosya sayılır); `content` verilirse aynı içerik (kopya testi)
export function fakePdf(content = randomBytes(8).toString('hex')): Buffer {
  return Buffer.from(`%PDF-1.4\n% ${content}\n${'x'.repeat(20000)}\n%%EOF`);
}

export const PRO_DETAILS = {
  DIETITIAN: { field: 'DIETITIAN', city: 'İstanbul', specialties: ['Kilo yönetimi'] },
  TRAINER: { field: 'TRAINER', city: 'Ankara', specialties: ['Kuvvet'] },
  GYM_OWNER: { field: 'GYM_OWNER', city: 'İzmir', gymName: 'Test Salon', gymAddress: 'Alsancak Mah. 1. Sk. No:3' },
} as const;

// Profesyonel kaydı: başlat + belge yükle + kodu doğrula (hesap "onay sürecinde" açılır)
export async function registerProfessional(
  app: INestApplication<App>,
  field: keyof typeof PRO_DETAILS = 'DIETITIAN',
  options: { documents?: Buffer[]; overrides?: Record<string, unknown> } = {},
) {
  const { body, registrationId, devCode } = await startRegistration(app, {
    accountType: 'PROFESSIONAL',
    lastName: 'Uzman',
    professional: PRO_DETAILS[field],
    ...options.overrides,
  });
  const kind = field === 'GYM_OWNER' ? 'business_license' : 'diploma';
  for (const doc of options.documents ?? [fakePdf()]) {
    await request(app.getHttpServer())
      .post(`/api/auth/register/${registrationId}/documents`)
      .field('kind', kind)
      .attach('file', doc, { filename: 'belge.pdf', contentType: 'application/pdf' })
      .expect(201);
  }
  const res = await request(app.getHttpServer())
    .post('/api/auth/register/verify')
    .send({ registrationId, code: devCode })
    .expect(200);
  return {
    body,
    accessToken: res.body.accessToken as string,
    user: res.body.user as { id: string; roles: string[]; application: { id: string; status: string } | null },
  };
}

// Yönetici hesabı (veritabanında doğrudan oluşturulur; kayıtla açılamaz) ve girişi
export async function createAdminAndLogin(app: INestApplication<App>) {
  const prisma = app.get(PrismaService);
  const id = randomBytes(5).toString('hex');
  const email = `admin-${id}@e2e.test`;
  const user = await prisma.user.create({
    data: {
      email,
      username: `a_${id}`,
      passwordHash: await hashPassword(TEST_PASSWORD),
      firstName: 'Yönetici',
      birthDate: new Date('1990-01-01'),
      roles: { create: { role: 'ADMIN' } },
    },
    select: { id: true },
  });
  const res = await request(app.getHttpServer())
    .post('/api/auth/admin/login')
    .send({ identifier: email, password: TEST_PASSWORD })
    .expect(200);
  return { adminId: user.id, email, accessToken: res.body.accessToken as string };
}
