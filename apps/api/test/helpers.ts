// Uçtan uca testlerin ortak araçları. Testler gerçek veritabanına karşı çalışır
// (önce `pnpm db:up`). Test kullanıcıları @e2e.test uzantılı e-posta kullanır ve sonunda silinir.
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { randomBytes } from 'node:crypto';
import request from 'supertest';
import { App } from 'supertest/types.js';
import { AppModule } from '../src/app.module.js';
import { configureApp } from '../src/app.setup.js';
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

export async function cleanupTestUsers(app: INestApplication): Promise<void> {
  await app.get(PrismaService).user.deleteMany({
    where: { email: { endsWith: '@e2e.test' } },
  });
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
    email: `user-${id}@e2e.test`,
    username: `u_${id}`,
    password: TEST_PASSWORD,
    birthDate: birthDateForAge(25),
    acceptTerms: true,
    ...overrides,
  };
}

export async function registerUser(
  app: INestApplication<App>,
  overrides: Record<string, unknown> = {},
) {
  const body = registerBody(overrides);
  const res = await request(app.getHttpServer())
    .post('/api/auth/register')
    .send(body)
    .expect(201);
  return {
    body,
    accessToken: res.body.accessToken as string,
    refreshToken: res.body.refreshToken as string,
    user: res.body.user as { id: string; ageGroup: string; email: string },
  };
}

export const bearer = (token: string) => ({ Authorization: `Bearer ${token}` });
