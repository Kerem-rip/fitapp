import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types.js';
import { addLocalDays, localDay } from '../src/common/local-day.js';
import { bearer, cleanupTestData, createTestApp, registerUser } from './helpers.js';

describe('Antrenman kartları ve kanıt katmanı (e2e)', () => {
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

  it('hareket detayında kaynaklar, doğrulama durumu, alternatifler ve medya durumu gelir; yüz hareketinde kanıt uyarısı var', async () => {
    const user = (await registerUser(app)) as Token;
    const auth = bearer(user.accessToken);
    const wall = (await http().get('/api/library/items/wall-push-up').set(auth).expect(200)).body as {
      evidence: { verification: string; sources: { url: string }[]; alternatives: { id: string }[] };
      media: { status: string };
      steps: string[];
    };
    expect(wall.evidence.verification).toBe('ok');
    expect(wall.evidence.sources.length).toBeGreaterThanOrEqual(2);
    expect(wall.evidence.sources.every((s) => s.url.startsWith('https://'))).toBe(true);
    expect(wall.evidence.alternatives.some((a) => a.id === 'knee-push-up')).toBe(true);
    expect(wall.media.status).toBe('MISSING');

    const face = (await http().get('/api/library/items/face-cheek').set(auth).expect(200)).body as { evidence: { verification: string }; warnings: string[] };
    expect(face.evidence.verification).toBe('held');
    expect(face.warnings.some((w) => w.includes('garanti edilmez'))).toBe(true);

    const raw = (await http().get('/api/library/items/arm-circles').set(auth).expect(200)).body as { evidence: { verification: string } };
    expect(raw.evidence.verification).toBe('none');
  });

  it('kartlar listelenir; kısıt seçilince hareket değişir; geçersiz kart 404', async () => {
    const user = (await registerUser(app)) as Token;
    const auth = bearer(user.accessToken);
    const list = (await http().get('/api/workout-cards').set(auth).expect(200)).body as { cards: { id: string; estimatedMinutes: number; moveCount: number }[]; restrictions: { key: string }[] };
    expect(list.cards.length).toBeGreaterThanOrEqual(5);
    expect(list.cards.every((c) => c.estimatedMinutes > 0 && c.moveCount > 0)).toBe(true);
    expect(list.restrictions.map((r) => r.key)).toContain('KNEE');

    type Card = { sections: { kind: string; items: { itemId: string; replacedFrom?: { id: string } }[] }[]; swapped: unknown[]; basis: string[] };
    const plain = (await http().get('/api/workout-cards/home-lower-mid').set(auth).expect(200)).body as Card;
    expect(plain.swapped).toHaveLength(0);
    expect(plain.sections.flatMap((s) => s.items).some((i) => i.itemId === 'squat')).toBe(true);
    expect(plain.basis.length).toBeGreaterThan(0);

    const knee = (await http().get('/api/workout-cards/home-lower-mid?avoid=KNEE').set(auth).expect(200)).body as Card;
    expect(knee.swapped.length).toBeGreaterThan(0);
    expect(knee.sections.flatMap((s) => s.items).some((i) => i.itemId === 'squat')).toBe(false);

    await http().get('/api/workout-cards/yok').set(auth).expect(404);
    await http().get('/api/workout-cards').expect(401);
  });

  it('bölgeler, yüz bölgeleri ve 28 günlük paket: katılınca günün antrenman kartı Görevlerim\'de gelir', async () => {
    const user = (await registerUser(app)) as Token;
    const auth = bearer(user.accessToken);
    const today = localDay();

    const res = (await http().get('/api/workout-cards').set(auth).expect(200)).body as { regions: { key: string; moveCount: number; cardCount: number; hero: string }[]; cards: { regionKey: string; hero: string; areas: string[] }[] };
    for (const key of ['hip', 'chest', 'arms', 'core', 'fullbody', 'face-alin', 'face-cene']) expect(res.regions.some((r) => r.key === key && r.moveCount > 0), key).toBe(true);
    expect(res.cards.every((c) => c.regionKey && c.hero && c.areas.length > 0)).toBe(true);

    const lib = (await http().get('/api/library').set(auth).expect(200)).body as { programs: { id: string; kind: string; hero: string; totalDays: number }[] };
    const packs = lib.programs.filter((p) => p.kind === 'PACK');
    expect(packs.length).toBeGreaterThanOrEqual(8);
    expect(lib.programs.some((p) => p.kind === 'PROGRAM' && p.id === 'ev-baslangic')).toBe(true);

    const detail = (await http().get('/api/library/programs/pack-karin').set(auth).expect(200)).body as { weekPlan: { week: number; days: { cardId: string | null; minutes: number }[] }[] };
    expect(detail.weekPlan).toHaveLength(4);
    expect(detail.weekPlan[0]!.days.every((d) => d.cardId && d.minutes > 0)).toBe(true);

    await http().post('/api/library/programs/pack-karin/join').set(auth).send({}).expect(201);
    const day = (await http().get(`/api/me/program?date=${today}`).set(auth).expect(200)).body as { programs: { cardId: string | null; hero: string; steps: unknown[] }[] };
    expect(day.programs[0]).toMatchObject({ cardId: 'core-beginner', hero: 'core' });
    expect(day.programs[0]!.steps.length).toBeGreaterThan(3);

    const face = (await http().get('/api/library/items/face-cene-yukari').set(auth).expect(200)).body as { kind: string; warnings: string[]; steps: string[] };
    expect(face.kind).toBe('FACE');
    expect(face.warnings.some((w) => w.includes('garanti edilmez'))).toBe(true);
    await http().get('/api/demo-media/yok.gif').expect(404);
    await http().get('/api/demo-media/..%2Fpackage.json').expect(404);
  });

  it('Takvime ekle görevlere girer, çift ekleme reddedilir; Hemen Başla bitişi tamamlama kaydı yazar', async () => {
    const user = (await registerUser(app)) as Token;
    const auth = bearer(user.accessToken);
    const today = localDay();

    const added = (await http().post('/api/me/workout-cards/tasks').set(auth).send({ cardId: 'chair-start', avoid: ['KNEE'] }).expect(201)).body as { id: string };
    await http().post('/api/me/workout-cards/tasks').set(auth).send({ cardId: 'chair-start' }).expect(409);
    await http().post('/api/me/workout-cards/tasks').set(auth).send({ cardId: 'yok' }).expect(404);
    await http().post('/api/me/workout-cards/tasks').set(auth).send({ cardId: 'yoga-calm', date: addLocalDays(today, -1) }).expect(400);
    await http().post('/api/me/workout-cards/tasks').set(auth).send({ cardId: 'yoga-calm', avoid: ['ELBOW'] }).expect(400);

    type Day = { cards: { id: string; done: boolean; avoid: string[]; completedMoves: number | null; moveCount: number }[] };
    const before = (await http().get(`/api/me/program?date=${today}`).set(auth).expect(200)).body as Day;
    expect(before.cards).toHaveLength(1);
    expect(before.cards[0]).toMatchObject({ id: added.id, done: false, avoid: ['KNEE'] });

    await http().post('/api/me/workout-cards/chair-start/complete').set(auth).send({ avoid: ['KNEE'], completedMoves: 9, totalMoves: 5 }).expect(400);
    await http().post('/api/me/workout-cards/chair-start/complete').set(auth).send({ avoid: ['KNEE'], completedMoves: 5, totalMoves: 7 }).expect(200);
    const after = (await http().get(`/api/me/program?date=${today}`).set(auth).expect(200)).body as Day;
    expect(after.cards[0]).toMatchObject({ done: true, completedMoves: 5 });

    await http().post(`/api/me/workout-cards/tasks/${added.id}/reset`).set(auth).expect(200);
    await http().delete(`/api/me/workout-cards/tasks/${added.id}`).set(auth).expect(200);
    await http().delete(`/api/me/workout-cards/tasks/${added.id}`).set(auth).expect(404);

    // Hiç hareket yapılmadan biten oturum görevi tamamlandı yapmaz
    await http().post('/api/me/workout-cards/chair-start/complete').set(auth).send({ completedMoves: 0, totalMoves: 7 }).expect(200);
    const none = (await http().get(`/api/me/program?date=${today}`).set(auth).expect(200)).body as Day;
    expect(none.cards.every((c) => !c.done)).toBe(true);

    // Takvime eklemeden de bitirilebilir: bugünün kaydı oluşur
    await http().post('/api/me/workout-cards/yoga-calm/complete').set(auth).send({ completedMoves: 4, totalMoves: 4 }).expect(200);
    const solo = (await http().get(`/api/me/program?date=${today}`).set(auth).expect(200)).body as Day;
    expect(solo.cards.some((c) => c.done)).toBe(true);
  });
});
