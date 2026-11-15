import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types.js';
import { addLocalDays, localDay } from '../src/common/local-day.js';
import { bearer, birthDateForAge, cleanupTestData, createTestApp, registerUser } from './helpers.js';

describe('Kalori aracı, premium, günün düzeni ve geçmiş (e2e)', () => {
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

  const SCREEN = { pregnant: false, medicalRestriction: false, eatingDisorderHistory: false };
  // Ortak pakettekiyle tutarlı örnek sonuç (erkek, 85 kg, 180 cm, orta aktif, kilo koruma)
  const profile = (over: Record<string, unknown> = {}) => ({
    goal: 'maintain', activity: 'moderate', sex: 'male', ageYears: 30, heightCm: 180, weightKg: 85,
    bmr: 1805, tdee: 2798, targetKcal: 2798, proteinG: 119, carbsG: 330, fatG: 84, waterMl: 3000, screening: SCREEN, ...over,
  });

  it('kalori profili kaydedilir ve geri okunur; geçmişe düşer', async () => {
    const user = (await registerUser(app)) as Token;
    const auth = bearer(user.accessToken);
    expect((await http().get('/api/me/calorie-profile').set(auth).expect(200)).body).toEqual({ profile: null });

    const saved = (await http().put('/api/me/calorie-profile').set(auth).send(profile()).expect(200)).body as { targetKcal: number; goal: string };
    expect(saved).toMatchObject({ targetKcal: 2798, goal: 'maintain' });
    const read = (await http().get('/api/me/calorie-profile').set(auth).expect(200)).body as { profile: { targetKcal: number } };
    expect(read.profile.targetKcal).toBe(2798);

    const hist = (await http().get('/api/me/history').set(auth).expect(200)).body as { items: { kind: string; title: string }[] };
    expect(hist.items.some((i) => i.kind === 'CALORIE_PROFILE')).toBe(true);
    await http().get('/api/me/calorie-profile').expect(401);
  });

  it('güvenlik sınırları: alt kalori, haftalık 1 kg, makro uyumu, hamilelik/kısıt, sporcu ve emzirme zorunlulukları', async () => {
    const user = (await registerUser(app)) as Token;
    const auth = bearer(user.accessToken);
    const put = (body: object) => http().put('/api/me/calorie-profile').set(auth).send(body);

    // Hedef alt sınırın altında (erkek 1500)
    await put(profile({ goal: 'lose', targetKcal: 1400, tdee: 2000, proteinG: 105, carbsG: 150, fatG: 42 })).expect(400);
    // Günlük açık 1100'ü aşıyor (haftada 1 kg'dan fazla)
    await put(profile({ goal: 'lose', tdee: 3200, targetKcal: 2000, proteinG: 120, carbsG: 220, fatG: 67 })).expect(400);
    // Makrolar hedefle uyuşmuyor
    await put(profile({ proteinG: 20, carbsG: 20, fatG: 10 })).expect(400);
    // Hamilelik, doktor kısıtı, yeme bozukluğu geçmişi: hedef verilmez
    await put(profile({ screening: { ...SCREEN, pregnant: true } })).expect(403);
    await put(profile({ screening: { ...SCREEN, medicalRestriction: true } })).expect(403);
    await put(profile({ screening: { ...SCREEN, eatingDisorderHistory: true } })).expect(403);
    // Sporcu için branş, emzirme için ay gerekir
    await put(profile({ goal: 'athlete' })).expect(400);
    await put(profile({ sex: 'female', goal: 'breastfeeding' })).expect(400);
    // Emzirmede 1800 alt sınırı
    await put(profile({ sex: 'female', goal: 'breastfeeding', breastfeedingMonths: 3, tdee: 1500, targetKcal: 1700, proteinG: 80, carbsG: 200, fatG: 60 })).expect(400);
    // Geçerli kilo verme: tam 1100 açık
    await put(profile({ goal: 'lose', tdee: 2900, targetKcal: 1800, proteinG: 120, carbsG: 190, fatG: 54 })).expect(200);
    // Geçerli sporcu ve emzirme
    await put(profile({ goal: 'athlete', sport: 'gym' })).expect(200);
    await put(profile({ sex: 'female', goal: 'breastfeeding', breastfeedingMonths: 3, tdee: 2200, targetKcal: 2530, proteinG: 120, carbsG: 330, fatG: 84 })).expect(200);
  });

  it('18 yaş altı kalori hedefi kaydedemez', async () => {
    const teen = (await registerUser(app, { birthDate: birthDateForAge(16) })) as Token;
    await http().put('/api/me/calorie-profile').set(bearer(teen.accessToken)).send(profile({ ageYears: 18 })).expect(403);
  });

  it('premium: deneme olarak açılır/kapanır; önerilen rutin yalnızca premiumda, kendi görevi herkesde', async () => {
    const user = (await registerUser(app)) as Token;
    const auth = bearer(user.accessToken);
    const today = localDay();
    expect((await http().get('/api/me/premium').set(auth).expect(200)).body).toMatchObject({ active: false, paymentAvailable: false });

    const sug = { slot: 'MORNING', lane: 'CARE', kind: 'CARE', title: 'Yüzünü temizle ve nemlendir', source: 'SUGGESTED' };
    await http().post('/api/me/routine').set(auth).send(sug).expect(403);
    // Serbest (kendi) görev herkese açık
    const manual = (await http().post('/api/me/routine').set(auth).send({ slot: 'ANYTIME', lane: 'EXERCISE', kind: 'CUSTOM', title: 'Akşam yürüyüşü', source: 'MANUAL' }).expect(201)).body as { id: string };
    expect(manual.id).toBeTruthy();

    await http().put('/api/me/premium').set(auth).send({ active: true }).expect(200);
    expect((await http().get('/api/me/premium').set(auth).expect(200)).body.active).toBe(true);
    await http().post('/api/me/routine').set(auth).send(sug).expect(201);
    await http().post('/api/me/routine').set(auth).send(sug).expect(400); // aynı öğe iki kez eklenmez
    await http().post('/api/me/routine').set(auth).send({ ...sug, slot: 'ANYTIME', title: 'Başka' }).expect(400);
    await http().post('/api/me/routine').set(auth).send({ slot: 'EVENING', lane: 'EXERCISE', kind: 'CARD', refId: 'yok', title: 'x', source: 'SUGGESTED' }).expect(400);

    type Day = { premium: boolean; items: { id: string; slot: string; lane: string; done: boolean }[] };
    const day = (await http().get(`/api/me/routine?date=${today}`).set(auth).expect(200)).body as Day;
    expect(day.premium).toBe(true);
    expect(day.items.map((i) => i.slot)).toEqual(['MORNING', 'ANYTIME']);

    await http().post(`/api/me/routine/${manual.id}/done`).set(auth).send({ done: true }).expect(200);
    const after = (await http().get(`/api/me/routine?date=${today}`).set(auth).expect(200)).body as Day;
    expect(after.items.find((i) => i.id === manual.id)!.done).toBe(true);
    await http().post(`/api/me/routine/${manual.id}/done`).set(auth).send({ done: false }).expect(200);
    await http().delete(`/api/me/routine/${manual.id}`).set(auth).expect(200);
    await http().delete(`/api/me/routine/${manual.id}`).set(auth).expect(404);

    // Gelecek günün görevi işaretlenemez
    const tomorrow = addLocalDays(today, 1);
    const future = (await http().post('/api/me/routine').set(auth).send({ ...sug, date: tomorrow, title: 'Yarın' }).expect(201)).body as { id: string };
    await http().post(`/api/me/routine/${future.id}/done`).set(auth).send({ done: true }).expect(400);

    await http().put('/api/me/premium').set(auth).send({ active: false }).expect(200);
    await http().post('/api/me/routine').set(auth).send({ ...sug, title: 'Premium kapalı' }).expect(403);
  });

  it('yemek öğesi tamamlanınca öğün günlüğüne yazılır, geri alınınca silinir (sağlık rızası gerekir)', async () => {
    const user = (await registerUser(app)) as Token;
    const auth = bearer(user.accessToken);
    const today = localDay();
    await http().put('/api/me/premium').set(auth).send({ active: true }).expect(200);
    const meal = {
      slot: 'MORNING', lane: 'MEAL', kind: 'FOOD', title: 'Örnek kahvaltı', source: 'SUGGESTED',
      data: { items: [{ name: 'Haşlanmış yumurta', portion: '2 adet', servings: 1, kcal: 155, proteinG: 13, carbsG: 1, fatG: 11 }, { name: 'Tam buğday ekmeği', portion: '2 dilim', servings: 1, kcal: 160, proteinG: 6, carbsG: 30, fatG: 2 }] },
    };
    const created = (await http().post('/api/me/routine').set(auth).send(meal).expect(201)).body as { id: string };
    // Rıza yokken öğün günlüğüne yazılamaz
    await http().post(`/api/me/routine/${created.id}/done`).set(auth).send({ done: true }).expect(403);
    await http().put('/api/consents/health_data').set(auth).expect(200);
    await http().post(`/api/me/routine/${created.id}/done`).set(auth).send({ done: true }).expect(200);

    const food = (await http().get(`/api/me/health/food?from=${today}&to=${today}`).set(auth).expect(200)).body as { date: string; totals: { kcal: number } }[];
    expect(food.find((d) => d.date === today)!.totals.kcal).toBe(315);

    await http().post(`/api/me/routine/${created.id}/done`).set(auth).send({ done: false }).expect(200);
    const food2 = (await http().get(`/api/me/health/food?from=${today}&to=${today}`).set(auth).expect(200)).body as { date: string; totals: { kcal: number } }[];
    expect(food2.find((d) => d.date === today)?.totals.kcal ?? 0).toBe(0);
  });

  it('görev işaretleri açılır/kapanır, geçersiz anahtar ve gelecek gün reddedilir; geçmiş birleşik gelir', async () => {
    const user = (await registerUser(app)) as Token;
    const auth = bearer(user.accessToken);
    const today = localDay();
    const key = 'plan:abc:meal1';
    await http().post('/api/me/task-checks').set(auth).send({ key, date: today, done: true }).expect(200);
    expect(((await http().get(`/api/me/task-checks?date=${today}`).set(auth).expect(200)).body as { keys: string[] }).keys).toEqual([key]);
    await http().post('/api/me/task-checks').set(auth).send({ key, date: today, done: false }).expect(200);
    expect(((await http().get(`/api/me/task-checks?date=${today}`).set(auth).expect(200)).body as { keys: string[] }).keys).toEqual([]);
    await http().post('/api/me/task-checks').set(auth).send({ key: 'bozuk anahtar', date: today, done: true }).expect(400);
    await http().post('/api/me/task-checks').set(auth).send({ key, date: addLocalDays(today, 1), done: true }).expect(400);

    // Program katılımı ve antrenman tamamlama geçmişte görünür
    await http().post('/api/library/programs/pack-karin/join').set(auth).send({}).expect(201);
    await http().post('/api/me/workout-cards/chair-start/complete').set(auth).send({ completedMoves: 5, totalMoves: 7 }).expect(200);
    const hist = (await http().get('/api/me/history?limit=20').set(auth).expect(200)).body as { items: { kind: string; title: string }[] };
    const kinds = hist.items.map((i) => i.kind);
    expect(kinds).toContain('PROGRAM_JOINED');
    expect(kinds).toContain('WORKOUT_DONE');
    expect(hist.items.find((i) => i.kind === 'PROGRAM_JOINED')!.title).toContain('28 Günde Karın');
  });

  it('boyun çevresi ölçümü kaydedilir (vücut kompozisyonu tahmini için)', async () => {
    const user = (await registerUser(app)) as Token;
    const auth = bearer(user.accessToken);
    await http().put('/api/consents/health_data').set(auth).expect(200);
    await http().post('/api/me/health/measurements').set(auth).send({ kind: 'NECK', value: 38, method: 'TAPE' }).expect(201);
    await http().post('/api/me/health/measurements').set(auth).send({ kind: 'NECK', value: 5, method: 'TAPE' }).expect(400);
  });
});
