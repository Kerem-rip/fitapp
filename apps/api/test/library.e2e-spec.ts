import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types.js';
import { addLocalDays, localDay } from '../src/common/local-day.js';
import { bearer, cleanupTestData, createTestApp, registerUser } from './helpers.js';

describe('İçerik kütüphanesi ve Programım (e2e)', () => {
  let app: INestApplication<App>;
  const http = () => request(app.getHttpServer());
  type Token = { accessToken: string };

  beforeAll(async () => {
    app = await createTestApp();
  });

  afterAll(async () => {
    await cleanupTestData(app);
    await app.close();
  });

  it('katalog: hareketler, yüz masajları, beslenme rehberleri ve ücretsiz programlar', async () => {
    const user = (await registerUser(app)) as Token;
    const res = (await http().get('/api/library').set(bearer(user.accessToken)).expect(200)).body as {
      items: { id: string; kind: string; workText?: string }[];
      programs: { id: string; access: string; totalDays: number; minutesPerDay: number }[];
    };
    expect(res.items.some((i) => i.kind === 'MOVE' && i.workText)).toBe(true);
    expect(res.items.some((i) => i.kind === 'FACE')).toBe(true);
    expect(res.items.some((i) => i.kind === 'GUIDE')).toBe(true);
    expect(res.programs.every((p) => p.access === 'FREE' && p.totalDays > 0 && p.minutesPerDay > 0)).toBe(true);

    const item = (await http().get('/api/library/items/squat').set(bearer(user.accessToken)).expect(200)).body as { steps: string[]; warnings: string[] };
    expect(item.steps.length).toBeGreaterThan(0);
    await http().get('/api/library/items/yok').set(bearer(user.accessToken)).expect(404);
    await http().get('/api/library').expect(401);
  });

  it('programa katılınca o günün hareketleri sırayla, süre ve dinlenmeyle gelir; işaretlenir ve bırakılır', async () => {
    const user = (await registerUser(app)) as Token;
    const auth = bearer(user.accessToken);
    const today = localDay();

    const joined = (await http().post('/api/library/programs/yuz-masaji-rutini/join').set(auth).send({}).expect(201)).body as { id: string; startDate: string };
    expect(joined.startDate).toBe(today);
    await http().post('/api/library/programs/yuz-masaji-rutini/join').set(auth).send({}).expect(409);
    await http().post('/api/library/programs/yok/join').set(auth).send({}).expect(404);
    await http().post('/api/library/programs/ev-baslangic/join').set(auth).send({ startDate: addLocalDays(today, -1) }).expect(400);

    const detail = (await http().get('/api/library/programs/yuz-masaji-rutini').set(auth).expect(200)).body as { enrollment: { id: string } | null; preview: unknown[] };
    expect(detail.enrollment?.id).toBe(joined.id);
    expect(detail.preview.length).toBeGreaterThan(0);

    type Day = { programs: { enrollmentId: string; dayIndex: number; steps: { index: number; workText: string; durationSec: number; restAfterSec: number; done: boolean }[]; doneCount: number }[] };
    const day = (await http().get(`/api/me/program?date=${today}`).set(auth).expect(200)).body as Day;
    expect(day.programs).toHaveLength(1);
    const prog = day.programs[0]!;
    expect(prog.dayIndex).toBe(0);
    expect(prog.steps.map((s) => s.index)).toEqual(prog.steps.map((_, i) => i));
    expect(prog.steps.every((s) => s.durationSec > 0 && s.workText.length > 0)).toBe(true);

    await http().post(`/api/me/library/enrollments/${joined.id}/steps`).set(auth).send({ dayIndex: 0, stepIndex: 0, done: true }).expect(200);
    // Yarının program günü henüz işaretlenemez; olmayan adım reddedilir
    await http().post(`/api/me/library/enrollments/${joined.id}/steps`).set(auth).send({ dayIndex: 1, stepIndex: 0, done: true }).expect(400);
    await http().post(`/api/me/library/enrollments/${joined.id}/steps`).set(auth).send({ dayIndex: 0, stepIndex: 40, done: true }).expect(400);
    const after = (await http().get(`/api/me/program?date=${today}`).set(auth).expect(200)).body as Day;
    expect(after.programs[0]!.doneCount).toBe(1);
    expect(after.programs[0]!.steps[0]!.done).toBe(true);

    const list = (await http().get('/api/me/library/enrollments').set(auth).expect(200)).body as { id: string; progress: { done: number; total: number }; next: { date: string } | null }[];
    expect(list[0]).toMatchObject({ id: joined.id, progress: { done: 1 } });
    expect(list[0]!.next?.date).toBe(today);

    await http().post(`/api/me/library/enrollments/${joined.id}/leave`).set(auth).expect(200);
    await http().post(`/api/me/library/enrollments/${joined.id}/leave`).set(auth).expect(409);
    const left = (await http().get(`/api/me/program?date=${today}`).set(auth).expect(200)).body as Day;
    expect(left.programs).toHaveLength(0);
    // Bırakınca yeniden katılabilir
    await http().post('/api/library/programs/yuz-masaji-rutini/join').set(auth).send({}).expect(201);
  });

  it('tek hareket görevlere eklenir, işaretlenir, silinir; başkası dokunamaz', async () => {
    const user = (await registerUser(app)) as Token;
    const other = (await registerUser(app)) as Token;
    const auth = bearer(user.accessToken);
    const today = localDay();

    const task = (await http().post('/api/me/library/tasks').set(auth).send({ itemId: 'plank' }).expect(201)).body as { id: string; date: string };
    expect(task.date).toBe(today);
    await http().post('/api/me/library/tasks').set(auth).send({ itemId: 'plank' }).expect(409);
    await http().post('/api/me/library/tasks').set(auth).send({ itemId: 'akdeniz' }).expect(400);
    const future = (await http().post('/api/me/library/tasks').set(auth).send({ itemId: 'plank', date: addLocalDays(today, 2) }).expect(201)).body as { id: string };
    await http().post(`/api/me/library/tasks/${future.id}/done`).set(auth).send({ done: true }).expect(400);

    await http().post(`/api/me/library/tasks/${task.id}/done`).set(auth).send({ done: true }).expect(200);
    const day = (await http().get(`/api/me/program?date=${today}`).set(auth).expect(200)).body as { tasks: { id: string; done: boolean; durationSec: number }[] };
    expect(day.tasks).toEqual([expect.objectContaining({ id: task.id, done: true })]);

    await http().post(`/api/me/library/tasks/${task.id}/done`).set(bearer(other.accessToken)).send({ done: false }).expect(404);
    await http().delete(`/api/me/library/tasks/${task.id}`).set(bearer(other.accessToken)).expect(404);
    await http().delete(`/api/me/library/tasks/${task.id}`).set(auth).expect(200);
    await http().get('/api/me/program?date=bugun').set(auth).expect(400);
  });
});
