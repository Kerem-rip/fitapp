import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types.js';
import { bearer, cleanupTestData, createActiveRelationship, createTestApp, registerApprovedProfessional, registerUser } from './helpers.js';

describe('Öğün ve su günlüğü (e2e)', () => {
  let app: INestApplication<App>;
  const http = () => request(app.getHttpServer());
  // Günler Türkiye saatine göredir (UTC+3)
  const dayOffset = (n: number) => new Date(Date.now() + 3 * 3_600_000 + n * 86_400_000).toISOString().slice(0, 10);
  const today = () => dayOffset(0);

  beforeAll(async () => {
    app = await createTestApp();
  });

  afterAll(async () => {
    await cleanupTestData(app);
    await app.close();
  });

  const meal = (over: Record<string, unknown> = {}) => ({
    mealType: 'BREAKFAST',
    foodKey: 'menemen',
    name: 'Menemen',
    portion: '1 porsiyon',
    servings: 1.5,
    perServing: { kcal: 220, proteinG: 11, carbsG: 9, fatG: 16 },
    ...over,
  });

  it('danışan kendi öğün ve su kaydını tutar; değerler porsiyonla çarpılır, gün toplamı hesaplanır', async () => {
    const { client } = await createActiveRelationship(app, { sharedData: ['MEALS', 'WATER'] });
    const created = await http().post('/api/me/health/meals').set(bearer(client.accessToken)).send(meal()).expect(201);
    expect(created.body).toMatchObject({ date: today(), kcal: 330, proteinG: 16.5, servings: 1.5 });
    await http().post('/api/me/health/meals').set(bearer(client.accessToken)).send(meal({ mealType: 'DINNER', foodKey: 'mercimek', name: 'Mercimek çorbası', servings: 1, perServing: { kcal: 150, proteinG: 8, carbsG: 22, fatG: 3 } })).expect(201);
    await http().post('/api/me/health/meals').set(bearer(client.accessToken)).send(meal({ date: dayOffset(-1), servings: 1 })).expect(201);

    await http().post('/api/me/health/water').set(bearer(client.accessToken)).send({ amountMl: 250 }).expect(201);
    const w = await http().post('/api/me/health/water').set(bearer(client.accessToken)).send({ amountMl: 250 }).expect(201);
    expect(w.body.waterMl).toBe(500);
    await http().post('/api/me/health/water').set(bearer(client.accessToken)).send({ amountMl: -250 }).expect(201);
    expect((await http().post('/api/me/health/water').set(bearer(client.accessToken)).send({ amountMl: -1000 }).expect(400)).body.code).toBe('INVALID_VALUE');

    const days = (await http().get(`/api/me/health/food?from=${dayOffset(-1)}&to=${today()}`).set(bearer(client.accessToken)).expect(200)).body;
    expect(days[0]).toMatchObject({ date: today(), totals: { kcal: 480 }, waterMl: 250 });
    // Öğün sırası: kahvaltı akşamdan önce
    expect(days[0].meals.map((m: { mealType: string }) => m.mealType)).toEqual(['BREAKFAST', 'DINNER']);
    expect(days[1]).toMatchObject({ date: dayOffset(-1), totals: { kcal: 220 }, waterMl: 0 });

    // Kendi kaydını siler; başkasınınkini silemez
    const other = await registerUser(app, { healthDataConsent: true });
    await http().delete(`/api/me/health/meals/${created.body.id}`).set(bearer(other.accessToken)).expect(404);
    await http().delete(`/api/me/health/meals/${created.body.id}`).set(bearer(client.accessToken)).expect(200);
  });

  it('sağlık verisi izni olmadan kayıt tutulamaz; geçersiz girdiler reddedilir', async () => {
    const noConsent = await registerUser(app);
    expect((await http().post('/api/me/health/meals').set(bearer(noConsent.accessToken)).send(meal()).expect(403)).body.code).toBe('HEALTH_CONSENT_REQUIRED');
    expect((await http().post('/api/me/health/water').set(bearer(noConsent.accessToken)).send({ amountMl: 250 }).expect(403)).body.code).toBe('HEALTH_CONSENT_REQUIRED');

    const user = await registerUser(app, { healthDataConsent: true });
    const post = (body: Record<string, unknown>) => http().post('/api/me/health/meals').set(bearer(user.accessToken)).send(body);
    expect((await post(meal({ date: dayOffset(1) })).expect(400)).body.code).toBe('INVALID_DATE');
    expect((await post(meal({ date: dayOffset(-40) })).expect(400)).body.code).toBe('INVALID_DATE');
    await post(meal({ servings: 0.3 })).expect(400);
    await post(meal({ servings: 12 })).expect(400);
    expect((await post(meal({ perServing: { kcal: 9000, proteinG: 1, carbsG: 1, fatG: 1 } })).expect(400)).body.code).toBe('INVALID_VALUE');
    await http().get(`/api/me/health/food?from=${dayOffset(-40)}&to=${today()}`).set(bearer(user.accessToken)).expect(400);
  });

  it('uzman sadece paylaşılan kategoriyi görür ve bakışı denetim kaydına düşer; danışanlığı olmayan göremez', async () => {
    const { pro, client } = await createActiveRelationship(app, { sharedData: ['MEALS'] });
    await http().post('/api/me/health/meals').set(bearer(client.accessToken)).send(meal()).expect(201);
    await http().post('/api/me/health/water').set(bearer(client.accessToken)).send({ amountMl: 500 }).expect(201);

    const res = (await http().get(`/api/clients/${client.user.id}/food?from=${today()}&to=${today()}`).set(bearer(pro.accessToken)).expect(200)).body;
    expect(res.shared).toEqual({ meals: true, water: false });
    expect(res.days[0].meals).toHaveLength(1);
    // Su paylaşılmadığı için gelmez
    expect(res.days[0].waterMl).toBeNull();

    const audit = (await http().get('/api/relationships/audit').set(bearer(client.accessToken)).expect(200)).body;
    const entries = (audit.items ?? audit) as { action: string; category: string | null }[];
    expect(entries.some((e) => e.action === 'DATA_VIEWED' && e.category === 'MEALS')).toBe(true);

    const stranger = await registerApprovedProfessional(app);
    await http().get(`/api/clients/${client.user.id}/food?from=${today()}&to=${today()}`).set(bearer(stranger.accessToken)).expect(403);
  });

  it('hiçbir şey paylaşılmıyorsa boş döner', async () => {
    const { pro, client } = await createActiveRelationship(app, { sharedData: ['WEIGHT'] });
    const res = (await http().get(`/api/clients/${client.user.id}/food?from=${today()}&to=${today()}`).set(bearer(pro.accessToken)).expect(200)).body;
    expect(res).toEqual({ shared: { meals: false, water: false }, days: [] });
  });
});
