import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types.js';
import { PrismaService } from '../src/common/prisma/prisma.service.js';
import { bearer, createActiveRelationship, cleanupTestData, createTestApp, registerApprovedProfessional } from './helpers.js';

type Rel = Awaited<ReturnType<typeof createActiveRelationship>>;

interface Option {
  id?: string;
  name: string;
  portion: string;
  kcal?: number;
  allergens: string[] | null;
  note?: string;
}
interface Meal {
  id?: string;
  name: string;
  time?: string;
  pick: number;
  rule?: string;
  options: Option[];
}
interface PlanBody {
  title?: string;
  targetKcal?: number;
  notes?: string;
  meals: Meal[];
}

const SAFE_PLAN: PlanBody = {
  title: 'Deneme planı',
  targetKcal: 1800,
  meals: [
    {
      name: 'Kahvaltı',
      time: '08:00',
      pick: 1,
      rule: 'Tahıl yerine tahıl seç',
      options: [
        { name: 'Yulaf', portion: '1 kase', kcal: 250, allergens: ['gluten'] },
        { name: 'Meyve', portion: '1 porsiyon', kcal: 80, allergens: [] },
        { name: 'Yumurta', portion: '2 adet', kcal: 160, allergens: ['egg'] },
      ],
    },
    { name: 'Öğle', pick: 2, options: [{ name: 'Mercimek', portion: '1 kase', allergens: [] }, { name: 'Salata', portion: '1 tabak', allergens: [] }, { name: 'Pilav', portion: '1 kepçe', allergens: [] }] },
  ],
};

describe('Beslenme planı (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  const http = () => request(app.getHttpServer());

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
  });

  afterAll(async () => {
    await cleanupTestData(app);
    await app.close();
  });

  const today = () => new Date().toISOString().slice(0, 10);
  const answer = (rel: Rel, key: string, value: unknown) => http().put(`/api/me/health/anamnesis/${key}`).set(bearer(rel.client.accessToken)).send({ value }).expect(200);
  const draft = (rel: Rel, body: Record<string, unknown> = {}) => http().post(`/api/clients/${rel.client.user.id}/plan/draft`).set(bearer(rel.pro.accessToken)).send(body);
  const save = (rel: Rel, content: PlanBody, changeNote?: string) =>
    http().put(`/api/clients/${rel.client.user.id}/plan/draft`).set(bearer(rel.pro.accessToken)).send({ content, changeNote });
  const check = (rel: Rel) => http().get(`/api/clients/${rel.client.user.id}/plan/draft/check`).set(bearer(rel.pro.accessToken));
  const approve = (rel: Rel, body: Record<string, unknown> = {}) => http().post(`/api/clients/${rel.client.user.id}/plan/draft/approve`).set(bearer(rel.pro.accessToken)).send(body);
  const overview = async (rel: Rel) => (await http().get(`/api/clients/${rel.client.user.id}/plan`).set(bearer(rel.pro.accessToken)).expect(200)).body;
  const myPlans = async (rel: Rel) => (await http().get('/api/me/plans').set(bearer(rel.client.accessToken)).expect(200)).body as { planId: string; number: number }[];
  const myView = (rel: Rel, planId: string, date = today()) => http().get(`/api/me/plans/${planId}?date=${date}`).set(bearer(rel.client.accessToken));
  const choose = (rel: Rel, planId: string, mealId: string, optionIds: string[], date = today()) =>
    http().put(`/api/me/plans/${planId}/choices`).set(bearer(rel.client.accessToken)).send({ date, mealId, optionIds });

  // Danışan "alerjim yok" demiş, plan taslağı hazır
  async function withDraft(content: PlanBody = SAFE_PLAN, allergies: string[] = ['none']) {
    const rel = await createActiveRelationship(app);
    await answer(rel, 'std.allergies', allergies);
    await draft(rel).expect(201);
    await save(rel, content).expect(200);
    return rel;
  }

  // Onaylanmış planlı danışanlık
  async function withPublished(content: PlanBody = SAFE_PLAN, allergies: string[] = ['none']) {
    const rel = await withDraft(content, allergies);
    const res = await approve(rel, { confirmWarnings: true }).expect(200);
    const [plan] = await myPlans(rel);
    return { rel, planId: plan!.planId, number: res.body.number as number };
  }

  describe('taslak', () => {
    it('sadece onaylı diyetisyen taslak açar; taslak danışana görünmez', async () => {
      const rel = await createActiveRelationship(app);
      await answer(rel, 'std.allergies', ['none']);
      const trainer = await registerApprovedProfessional(app, 'TRAINER');
      const trainerRel = await createActiveRelationship(app, { pro: trainer });
      expect((await draft(trainerRel).expect(403)).body.code).toBe('NOT_A_DIETITIAN');

      await draft(rel).expect(201);
      await save(rel, SAFE_PLAN).expect(200);
      expect(await myPlans(rel)).toEqual([]);
      expect((await myView(rel, 'yok').expect(404)).body.code).toBe('PLAN_NOT_FOUND');
    });

    it('ikinci taslak açılmaz; taslak silinebilir; içerik doğrulanır ve kimlikler korunur', async () => {
      const rel = await createActiveRelationship(app);
      await draft(rel).expect(201);
      expect((await draft(rel).expect(409)).body.code).toBe('DRAFT_EXISTS');

      await save(rel, { meals: [{ name: 'X', pick: 1, options: [{ name: 'A', portion: '1', allergens: ['uzay'] }] }] }).expect(400);
      const saved = await save(rel, SAFE_PLAN).expect(200);
      const ids = saved.body.content.meals.map((m: { id: string }) => m.id);
      expect(ids.every((id: string) => /^[0-9a-f-]{36}$/.test(id))).toBe(true);
      // Kimlikle tekrar kaydedince kimlikler korunur
      const again = await save(rel, saved.body.content).expect(200);
      expect(again.body.content.meals.map((m: { id: string }) => m.id)).toEqual(ids);

      await http().delete(`/api/clients/${rel.client.user.id}/plan/draft`).set(bearer(rel.pro.accessToken)).expect(200);
      expect((await overview(rel)).draft).toBeNull();
      expect(await prisma.planEvent.findMany({ where: { plan: { clientId: rel.client.user.id } }, orderBy: { createdAt: 'asc' } }).then((e) => e.map((x) => x.kind))).toEqual(['DRAFT_CREATED', 'DRAFT_DISCARDED']);
    });

    it('danışanlığı olmayan uzman taslak açamaz, planı göremez', async () => {
      const rel = await createActiveRelationship(app);
      const stranger = await registerApprovedProfessional(app);
      await http().post(`/api/clients/${rel.client.user.id}/plan/draft`).set(bearer(stranger.accessToken)).send({}).expect(403);
      await http().get(`/api/clients/${rel.client.user.id}/plan`).set(bearer(stranger.accessToken)).expect(403);
    });
  });

  describe('güvenlik kontrolleri ve onay', () => {
    it('alerji bilgisi olmadan onaylanamaz', async () => {
      const rel = await createActiveRelationship(app);
      await draft(rel).expect(201);
      await save(rel, SAFE_PLAN).expect(200);
      const res = await check(rel).expect(200);
      expect(res.body.canApprove).toBe(false);
      expect(res.body.blockers.map((b: { code: string }) => b.code)).toContain('ALLERGY_INFO_MISSING');
      const blocked = await approve(rel, { confirmWarnings: true }).expect(409);
      expect(blocked.body.code).toBe('PLAN_BLOCKED');
      expect(await myPlans(rel)).toEqual([]);
    });

    it('sağlık öyküsü paylaşılmıyorsa da onaylanamaz', async () => {
      const rel = await createActiveRelationship(app, { sharedData: ['WEIGHT'] });
      await draft(rel).expect(201);
      await save(rel, SAFE_PLAN).expect(200);
      expect((await check(rel).expect(200)).body.blockers.map((b: { code: string }) => b.code)).toContain('ALLERGY_INFO_MISSING');
    });

    it('danışanın alerjenini içeren ve alerjeni belirtilmemiş seçenek onayı engeller; düzeltince onaylanır', async () => {
      const bad: PlanBody = { meals: [{ name: 'Kahvaltı', pick: 1, options: [{ name: 'Omlet', portion: '2 adet', allergens: ['egg'] }, { name: 'Bilinmeyen', portion: '1', allergens: null }, { name: 'Meyve', portion: '1', allergens: [] }] }] };
      const rel = await withDraft(bad, ['egg']);
      const res = await check(rel).expect(200);
      const codes = res.body.blockers.map((b: { code: string }) => b.code).sort((a: string, b: string) => a.localeCompare(b));
      expect(codes).toEqual(['ALLERGEN_CONFLICT', 'ALLERGEN_UNKNOWN']);
      expect(res.body.blockers[0].message).toBeTruthy();
      expect((await approve(rel, { confirmWarnings: true }).expect(409)).body.blockers).toHaveLength(2);

      await save(rel, { meals: [{ name: 'Kahvaltı', pick: 1, options: [{ name: 'Meyve', portion: '1', allergens: [] }, { name: 'Yulaf', portion: '1 kase', allergens: ['gluten'] }] }] }).expect(200);
      expect((await check(rel).expect(200)).body.canApprove).toBe(true);
    });

    it('boş plan, seçeneksiz öğün ve fazla seçim sayısı onayı engeller', async () => {
      const rel = await withDraft({ meals: [] });
      expect((await check(rel)).body.blockers.map((b: { code: string }) => b.code)).toEqual(['EMPTY_PLAN']);
      await save(rel, { meals: [{ name: 'A', pick: 1, options: [] }, { name: 'B', pick: 3, options: [{ name: 'X', portion: '1', allergens: [] }] }] }).expect(200);
      expect((await check(rel)).body.blockers.map((b: { code: string }) => b.code)).toEqual(['MEAL_WITHOUT_OPTIONS', 'PICK_TOO_HIGH']);
    });

    it('açık uyarı varken uzman açıkça onaylamadan yayınlanmaz; onay kayda geçer', async () => {
      const rel = await withDraft(SAFE_PLAN);
      await answer(rel, 'std.eating_disorder_history', 'yes');
      const res = await check(rel).expect(200);
      expect(res.body.canApprove).toBe(true);
      expect(res.body.warnings.map((w: { ruleCode: string }) => w.ruleCode)).toContain('R-EATING-DISORDER');

      const stopped = await approve(rel).expect(409);
      expect(stopped.body.code).toBe('PLAN_WARNINGS');
      expect(stopped.body.warnings.length).toBeGreaterThan(0);
      expect(await myPlans(rel)).toEqual([]);

      await approve(rel, { confirmWarnings: true, changeNote: 'İlk plan' }).expect(200);
      const version = await prisma.planVersion.findFirstOrThrow({ where: { plan: { clientId: rel.client.user.id }, status: 'APPROVED' } });
      expect(JSON.stringify(version.acknowledged)).toContain('Yeme bozukluğu');
      expect(version.approvedById).toBe(rel.pro.user.id);
    });
  });

  describe('sürümler', () => {
    it('onay sürüm numarası verir, danışana yayınlar ve bildirim gönderir; onaylanmış sürüm değişmez', async () => {
      const { rel, planId, number } = await withPublished();
      expect(number).toBe(1);
      const list = await myPlans(rel);
      expect(list).toHaveLength(1);
      expect(list[0]).toMatchObject({ planId, number: 1, mealCount: 2 });
      expect(await prisma.notification.count({ where: { userId: rel.client.user.id, type: 'plan_published' } })).toBe(1);

      const ov = await overview(rel);
      expect(ov.published).toMatchObject({ number: 1 });
      expect(ov.draft).toBeNull();
      expect(ov.versions[0].summary[0]).toBe('İlk sürüm: 2 öğün, 6 seçenek');
      // Taslak yokken düzenleme/onay yapılamaz
      await save(rel, SAFE_PLAN).expect(404);
    });

    it('yeni taslak yayındaki sürümden türetilir; onaylanınca eski sürüm "eski" olur, fark ve kim/ne zaman kaydedilir', async () => {
      const { rel } = await withPublished();
      const created = await draft(rel, { fromPublished: true }).expect(201);
      expect(created.body.basedOnNumber).toBe(1);
      const content = created.body.content as PlanBody & { meals: (Meal & { id: string })[] };
      content.targetKcal = 1900;
      content.meals[0]!.options = content.meals[0]!.options.filter((o) => o.name !== 'Yumurta');
      content.meals[0]!.options.push({ name: 'Ceviz', portion: '1 avuç', allergens: ['tree_nut'] });
      await save(rel, content, 'Kalori artırıldı, yumurta çıkarıldı').expect(200);

      // Taslak danışana görünmez: hâlâ sürüm 1 yayında
      expect((await myPlans(rel))[0]!.number).toBe(1);
      const res = await approve(rel, { confirmWarnings: true }).expect(200);
      expect(res.body.number).toBe(2);
      expect(res.body.summary).toEqual(expect.arrayContaining(['Hedef kalori 1800 → 1900', '"Kahvaltı": seçenek kaldırıldı "Yumurta"', '"Kahvaltı": seçenek eklendi "Ceviz"']));

      const ov = await overview(rel);
      expect(ov.published.number).toBe(2);
      expect(ov.versions.map((v: { number: number; status: string }) => [v.number, v.status])).toEqual([[2, 'APPROVED'], [1, 'SUPERSEDED']]);
      expect(ov.versions[0]).toMatchObject({ changeNote: 'Kalori artırıldı, yumurta çıkarıldı', basedOnNumber: 1 });
      expect(ov.versions[0].approvedBy).toContain('Uzman');
      expect((await myPlans(rel))[0]!.number).toBe(2);

      const v1 = await http().get(`/api/clients/${rel.client.user.id}/plan/versions/1`).set(bearer(rel.pro.accessToken)).expect(200);
      expect(v1.body.status).toBe('SUPERSEDED');
      expect(JSON.stringify(v1.body.content)).toContain('Yumurta');
      await http().get(`/api/clients/${rel.client.user.id}/plan/versions/9`).set(bearer(rel.pro.accessToken)).expect(404);
      const events = await prisma.planEvent.findMany({ where: { plan: { clientId: rel.client.user.id } } });
      expect(events.map((e) => e.kind)).toEqual(expect.arrayContaining(['DRAFT_CREATED', 'APPROVED', 'SUPERSEDED']));
    });

    it('danışanlık bitince danışan planı göremez; uzman kendi plan geçmişini okumaya devam eder', async () => {
      const { rel, planId } = await withPublished();
      await http().post(`/api/relationships/${rel.id}/end`).set(bearer(rel.client.accessToken)).expect(200);
      expect(await myPlans(rel)).toEqual([]);
      await myView(rel, planId).expect(404);
      await http().get(`/api/clients/${rel.client.user.id}/plan`).set(bearer(rel.pro.accessToken)).expect(200);
      await draft(rel).expect(403);
    });
  });

  describe('danışanın görünümü ve seçimleri', () => {
    it('danışan planı alternatifleriyle görür ve yalnızca izinli alternatiflerden, en fazla "pick" kadar seçer', async () => {
      const { rel, planId } = await withPublished();
      const view = (await myView(rel, planId).expect(200)).body;
      expect(view).toMatchObject({ version: { number: 1 }, title: 'Deneme planı', anyBlocked: false });
      expect(view.professional.name).toContain('Uzman');
      const [breakfast, lunch] = view.meals as { id: string; pick: number; options: { id: string; blockedReason: string | null }[]; chosen: string[] }[];
      expect(breakfast!.options).toHaveLength(3);

      await choose(rel, planId, breakfast!.id, [breakfast!.options[1]!.id]).expect(200);
      // Öğle: pick 2
      await choose(rel, planId, lunch!.id, [lunch!.options[0]!.id, lunch!.options[1]!.id]).expect(200);
      expect((await choose(rel, planId, lunch!.id, lunch!.options.map((o) => o.id)).expect(400)).body.code).toBe('TOO_MANY_OPTIONS');
      expect((await choose(rel, planId, breakfast!.id, ['planda-olmayan']).expect(400)).body.code).toBe('OPTION_NOT_ALLOWED');
      await choose(rel, planId, 'yok', ['x']).expect(404);

      const after = (await myView(rel, planId).expect(200)).body;
      expect(after.meals[0].chosen).toEqual([breakfast!.options[1]!.id]);
      expect(after.meals[1].chosen).toHaveLength(2);
      // Seçimi temizle
      await choose(rel, planId, breakfast!.id, []).expect(200);
      expect((await myView(rel, planId).expect(200)).body.meals[0].chosen).toEqual([]);
      // Farklı gün ayrı tutulur
      const tomorrow = new Date(Date.now() + 86_400_000).toISOString().slice(0, 10);
      await choose(rel, planId, breakfast!.id, [breakfast!.options[0]!.id], tomorrow).expect(200);
      expect((await myView(rel, planId, tomorrow).expect(200)).body.meals[0].chosen).toHaveLength(1);
    });

    it('tarih ve rıza kuralları', async () => {
      const { rel, planId } = await withPublished();
      const meal = ((await myView(rel, planId).expect(200)).body.meals as { id: string; options: { id: string }[] }[])[0]!;
      await choose(rel, planId, meal.id, [meal.options[0]!.id], '2020-01-01').expect(400);
      await choose(rel, planId, meal.id, [meal.options[0]!.id], '2026-13-45').expect(400);
      await myView(rel, planId, 'yarin').expect(400);

      await http().delete('/api/consents/health_data').set(bearer(rel.client.accessToken)).expect(200);
      expect((await choose(rel, planId, meal.id, [meal.options[0]!.id]).expect(403)).body.code).toBe('HEALTH_CONSENT_REQUIRED');
    });

    it('başka danışan planı göremez ve seçim yapamaz', async () => {
      const { planId } = await withPublished();
      const other = await createActiveRelationship(app);
      await myView(other, planId).expect(404);
      await choose(other, planId, 'x', ['y']).expect(404);
    });

    it('uzman, danışanın seçimlerini sadece öğün kayıtları paylaşılıyorsa görür', async () => {
      const { rel, planId } = await withPublished();
      const meal = ((await myView(rel, planId).expect(200)).body.meals as { id: string; options: { id: string; name?: string }[] }[])[0]!;
      await choose(rel, planId, meal.id, [meal.options[1]!.id]).expect(200);
      await http().get(`/api/clients/${rel.client.user.id}/plan/choices`).set(bearer(rel.pro.accessToken)).expect(403);

      await http().patch(`/api/relationships/${rel.id}/sharing`).set(bearer(rel.client.accessToken)).send({ sharedData: ['WEIGHT', 'MEASUREMENTS', 'ANAMNESIS', 'MEALS'] }).expect(200);
      const res = await http().get(`/api/clients/${rel.client.user.id}/plan/choices`).set(bearer(rel.pro.accessToken)).expect(200);
      expect(res.body).toHaveLength(1);
      expect(res.body[0]).toMatchObject({ date: today(), mealName: 'Kahvaltı', versionNumber: 1, options: [{ name: 'Meyve' }] });
    });
  });

  describe('alerji değişince yeniden inceleme', () => {
    it('danışan sonradan alerji beyan edince çakışan seçenek danışana kapanır, uzmana kırmızı madde düşer; yeni sürümle çözülür', async () => {
      const { rel, planId } = await withPublished();
      // Yayında Yumurta seçeneği var; danışan yumurta alerjisi beyan eder
      await answer(rel, 'std.allergies', ['egg']);

      const view = (await myView(rel, planId).expect(200)).body;
      expect(view.anyBlocked).toBe(true);
      const egg = view.meals[0].options.find((o: { name: string }) => o.name === 'Yumurta');
      expect(egg.blockedReason).toContain('incelemesini bekliyor');
      expect(view.meals[0].options.filter((o: { blockedReason: string | null }) => o.blockedReason).map((o: { name: string }) => o.name)).toEqual(['Yumurta']);
      expect((await choose(rel, planId, view.meals[0].id, [egg.id]).expect(403)).body.code).toBe('OPTION_BLOCKED');
      await choose(rel, planId, view.meals[0].id, [view.meals[0].options[1].id]).expect(200);

      // Uzmanın panelinde dosyayı açmadan görünür
      const ov = await http().get('/api/review/overview').set(bearer(rel.pro.accessToken)).expect(200);
      expect(ov.body.find((o: { client: { id: string } }) => o.client.id === rel.client.user.id).red).toBe(1);
      const findings = (await http().get(`/api/clients/${rel.client.user.id}/findings`).set(bearer(rel.pro.accessToken)).expect(200)).body.items as { ruleCode: string; level: string; detail: string; basis: { type: string }[] }[];
      const flagged = findings.filter((f) => f.ruleCode === 'R-PLAN-ALLERGEN');
      expect(flagged).toHaveLength(1);
      expect(flagged[0]).toMatchObject({ level: 'RED' });
      expect(flagged[0]!.detail).toContain('Yumurta');
      expect(flagged[0]!.basis.map((b) => b.type)).toEqual(['ANSWER', 'PLAN']);
      expect((await overview(rel)).openPlanFindings).toBe(1);

      // Uzman yeni taslak açar, yumurtayı çıkarır, onaylar → madde kendiliğinden kapanır, seçenek tekrar yok
      const created = await draft(rel, { fromPublished: true }).expect(201);
      const content = created.body.content as { meals: { options: { name: string }[] }[] };
      content.meals[0]!.options = content.meals[0]!.options.filter((o) => o.name !== 'Yumurta');
      await save(rel, content as unknown as PlanBody).expect(200);
      expect((await check(rel).expect(200)).body.canApprove).toBe(true);
      await approve(rel, { confirmWarnings: true }).expect(200);

      const after = (await http().get(`/api/clients/${rel.client.user.id}/findings`).set(bearer(rel.pro.accessToken)).expect(200)).body.items as { ruleCode: string }[];
      expect(after.filter((f) => f.ruleCode === 'R-PLAN-ALLERGEN')).toHaveLength(0);
      const view2 = (await myView(rel, planId).expect(200)).body;
      expect(view2).toMatchObject({ version: { number: 2 }, anyBlocked: false });
    });

    it('alerjisi olmayan bir danışanda aynı plan sorunsuzdur', async () => {
      const { rel, planId } = await withPublished();
      await answer(rel, 'std.allergies', ['gluten']);
      const view = (await myView(rel, planId).expect(200)).body;
      expect(view.meals[0].options.filter((o: { blockedReason: string | null }) => o.blockedReason).map((o: { name: string }) => o.name)).toEqual(['Yulaf']);
      await answer(rel, 'std.allergies', ['none']);
      expect((await myView(rel, planId).expect(200)).body.anyBlocked).toBe(false);
    });
  });

  it('giriş yapmadan hiçbir adres açılmaz', async () => {
    await http().get('/api/me/plans').expect(401);
    await http().get('/api/clients/x/plan').expect(401);
    await http().post('/api/clients/x/plan/draft').send({}).expect(401);
  });
});
