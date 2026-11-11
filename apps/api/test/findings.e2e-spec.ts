import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types.js';
import { PrismaService } from '../src/common/prisma/prisma.service.js';
import { bearer, cleanupTestData, createActiveRelationship, createTestApp, registerApprovedProfessional } from './helpers.js';

interface Finding {
  id: string;
  ruleCode: string;
  level: 'RED' | 'YELLOW' | 'GREEN';
  title: string;
  detail: string;
  status: string;
  decision: string | null;
  closedReason: string | null;
  basis: { type: string; label: string; display: string }[];
  events: { kind: string; text: string | null }[];
  tasks: { id: string; title: string; status: string }[];
}

describe('Uzman inceleme özeti (e2e)', () => {
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

  type Rel = Awaited<ReturnType<typeof createActiveRelationship>>;

  const list = async (rel: Rel, view = 'open') =>
    (await http().get(`/api/clients/${rel.client.user.id}/findings?view=${view}`).set(bearer(rel.pro.accessToken)).expect(200)).body as {
      rulesStatus: string;
      counts: { red: number; yellow: number; green: number; followUp: number };
      items: Finding[];
    };
  const answer = (rel: Rel, key: string, value: unknown) =>
    http().put(`/api/me/health/anamnesis/${key}`).set(bearer(rel.client.accessToken)).send({ value }).expect(200);
  const weight = (rel: Rel, value: number, takenAt?: string) =>
    http().post('/api/me/health/measurements').set(bearer(rel.client.accessToken)).send({ kind: 'WEIGHT', value, method: 'SCALE', takenAt }).expect(201);
  const byCode = (items: Finding[], code: string) => items.filter((f) => f.ruleCode === code);
  const post = (rel: Rel, path: string, body: Record<string, unknown> = {}) =>
    http().post(`/api/clients/${rel.client.user.id}/${path}`).set(bearer(rel.pro.accessToken)).send(body);

  describe('maddelerin üretimi', () => {
    it('veri yokken eksik bilgi maddeleri çıkar; kesin sonuç (kırmızı/yeşil) üretilmez; her maddenin dayanağı vardır', async () => {
      const rel = await createActiveRelationship(app);
      const res = await list(rel);
      expect(res.rulesStatus).toBe('UNREVIEWED');
      expect(byCode(res.items, 'Y-ANAMNESIS-MISSING')).toHaveLength(5);
      expect(byCode(res.items, 'Y-NO-WEIGHT')).toHaveLength(1);
      expect(byCode(res.items, 'Y-NO-HEIGHT')).toHaveLength(1);
      expect(res.counts).toMatchObject({ red: 0, green: 0, yellow: 7 });
      expect(res.items.every((f) => f.status === 'OPEN' && f.basis.length > 0)).toBe(true);
      expect(res.items.every((f) => f.level === 'YELLOW')).toBe(true);
    });

    it('listeleme denetim kaydına yazılır (paylaşılan her kategori için bir kez)', async () => {
      const rel = await createActiveRelationship(app);
      await list(rel);
      await list(rel);
      const views = await prisma.auditLog.findMany({ where: { targetUserId: rel.client.user.id, action: 'DATA_VIEWED' } });
      expect(views.map((v) => String(v.category)).sort((a, b) => a.localeCompare(b))).toEqual(['ANAMNESIS', 'MEASUREMENTS', 'WEIGHT']);
    });

    it('danışan yeme bozukluğu öyküsü beyan edince kırmızı madde ve panel sayısı, uzman dosyayı açmadan güncellenir', async () => {
      const rel = await createActiveRelationship(app);
      await answer(rel, 'std.eating_disorder_history', 'yes');

      const overview = await http().get('/api/review/overview').set(bearer(rel.pro.accessToken)).expect(200);
      expect(overview.body).toHaveLength(1);
      expect(overview.body[0]).toMatchObject({ red: 1, followUp: 0, openTasks: 0 });
      // Panel sadece sayı döner, içerik değil
      expect(JSON.stringify(overview.body)).not.toContain('Yeme bozukluğu');

      const res = await list(rel);
      const red = byCode(res.items, 'R-EATING-DISORDER')[0]!;
      expect(red).toMatchObject({ level: 'RED', status: 'OPEN' });
      expect(red.basis[0]).toMatchObject({ type: 'ANSWER', display: 'Evet' });
      expect(res.items[0]!.level).toBe('RED');
    });

    it('danışan eksik bilgiyi tamamlayınca eksik maddesi otomatik geçersizleşir; yanıt değişince yeşil madde yenilenir', async () => {
      const rel = await createActiveRelationship(app);
      expect(byCode((await list(rel)).items, 'Y-ANAMNESIS-MISSING').some((f) => f.title === 'Alerji bilgisi yok')).toBe(true);

      await answer(rel, 'std.allergies', ['egg']);
      let res = await list(rel);
      expect(res.items.some((f) => f.title === 'Alerji bilgisi yok')).toBe(false);
      expect(byCode(res.items, 'G-ALLERGY-FILTER')[0]!.detail).toContain('Yumurta');
      const superseded = await prisma.reviewFinding.findFirst({
        where: { clientId: rel.client.user.id, title: 'Alerji bilgisi yok' },
        include: { events: true },
      });
      expect(superseded).toMatchObject({ status: 'SUPERSEDED' });
      expect(superseded!.events.map((e) => e.kind)).toContain('SUPERSEDED');

      await answer(rel, 'std.allergies', ['egg', 'milk']);
      res = await list(rel);
      expect(byCode(res.items, 'G-ALLERGY-FILTER')).toHaveLength(1);
      expect(byCode(res.items, 'G-ALLERGY-FILTER')[0]!.detail).toContain('Yumurta, Süt');
    });

    it('beyan geri alınınca madde geçersizleşir, aynı beyan tekrar gelince aynı madde yeniden açılır (kopya oluşmaz)', async () => {
      const rel = await createActiveRelationship(app);
      await answer(rel, 'std.eating_disorder_history', 'yes');
      await list(rel);
      await answer(rel, 'std.eating_disorder_history', 'no');
      expect(byCode((await list(rel)).items, 'R-EATING-DISORDER')).toHaveLength(0);
      await answer(rel, 'std.eating_disorder_history', 'yes');
      const res = await list(rel);
      expect(byCode(res.items, 'R-EATING-DISORDER')).toHaveLength(1);
      expect(res.items.find((f) => f.ruleCode === 'R-EATING-DISORDER')!.events.map((e) => e.kind)).toEqual(['SUPERSEDED', 'REOPENED']);
      expect(await prisma.reviewFinding.count({ where: { clientId: rel.client.user.id, ruleCode: 'R-EATING-DISORDER' } })).toBe(1);
    });

    it('ölçüm maddeleri: ani kilo farkı ve eski ölçüm', async () => {
      const rel = await createActiveRelationship(app);
      const day = 86_400_000;
      await weight(rel, 70, new Date(Date.now() - 5 * day).toISOString());
      await weight(rel, 80, new Date(Date.now() - 1 * day).toISOString());
      const res = await list(rel);
      expect(byCode(res.items, 'Y-WEIGHT-JUMP')).toHaveLength(1);
      expect(byCode(res.items, 'Y-WEIGHT-JUMP')[0]!.basis).toHaveLength(2);

      const old = await createActiveRelationship(app);
      await weight(old, 70, new Date(Date.now() - 45 * day).toISOString());
      expect(byCode((await list(old)).items, 'Y-WEIGHT-STALE')[0]!.detail).toContain('45 gün');
    });

    it('her şey eksiksizse "temel bilgiler tamam" önerisi çıkar', async () => {
      const rel = await createActiveRelationship(app);
      await answer(rel, 'std.allergies', ['none']);
      await answer(rel, 'std.conditions', ['none']);
      await answer(rel, 'std.medications', 'Yok');
      await answer(rel, 'std.pregnancy', 'no');
      await answer(rel, 'std.eating_disorder_history', 'no');
      await weight(rel, 70);
      await http().post('/api/me/health/measurements').set(bearer(rel.client.accessToken)).send({ kind: 'HEIGHT', value: 170, method: 'TAPE' }).expect(201);
      const res = await list(rel);
      const ready = byCode(res.items, 'G-BASICS-READY')[0]!;
      expect(ready.level).toBe('GREEN');
      expect(ready.detail).toContain('onaylamadan danışana gitmez');
      expect(res.counts.red).toBe(0);
      expect(res.items.some((f) => f.level === 'YELLOW')).toBe(false);
    });

    it('paylaşılmayan kategorinin maddeleri görünmez; sadece "paylaşılmıyor" uyarısı çıkar', async () => {
      const rel = await createActiveRelationship(app, { sharedData: ['WEIGHT'] });
      await answer(rel, 'std.eating_disorder_history', 'yes');
      const res = await list(rel);
      expect(res.items.some((f) => f.ruleCode === 'R-EATING-DISORDER')).toBe(false);
      expect(byCode(res.items, 'Y-NOT-SHARED').map((f) => f.title).sort()).toEqual(['Sağlık öyküsü paylaşılmıyor', 'Vücut ölçüleri paylaşılmıyor']);
      expect(byCode(res.items, 'Y-NO-WEIGHT')).toHaveLength(1);
    });
  });

  describe('uzmanın kararları', () => {
    it('gerekçe olmadan kapatılmaz; gerekçeyle kapatılır, geçmişte kalır, kopya oluşmaz; yeniden açılabilir', async () => {
      const rel = await createActiveRelationship(app);
      await answer(rel, 'std.eating_disorder_history', 'yes');
      const red = byCode((await list(rel)).items, 'R-EATING-DISORDER')[0]!;

      await post(rel, `findings/${red.id}/close`, { decision: 'EVALUATED', reason: 'a' }).expect(400);
      await post(rel, `findings/${red.id}/close`, { decision: 'KESIN', reason: 'Değerlendirdim' }).expect(400);
      await post(rel, `findings/${red.id}/close`, { decision: 'EVALUATED', reason: 'Danışanla konuştum, kalori hedefi koymayacağım.' }).expect(200);
      expect((await post(rel, `findings/${red.id}/close`, { decision: 'EVALUATED', reason: 'tekrar' }).expect(409)).body.code).toBe('ALREADY_CLOSED');

      expect(byCode((await list(rel)).items, 'R-EATING-DISORDER')).toHaveLength(0);
      const closed = byCode((await list(rel, 'closed')).items, 'R-EATING-DISORDER')[0]!;
      expect(closed).toMatchObject({ status: 'CLOSED', decision: 'EVALUATED', closedReason: 'Danışanla konuştum, kalori hedefi koymayacağım.' });
      expect(closed.events.map((e) => e.kind)).toContain('CLOSED');
      // Aynı dayanakla yeniden açılmaz, ikinci madde oluşmaz
      expect(await prisma.reviewFinding.count({ where: { clientId: rel.client.user.id, ruleCode: 'R-EATING-DISORDER' } })).toBe(1);

      await post(rel, `findings/${red.id}/reopen`).expect(200);
      expect((await post(rel, `findings/${red.id}/reopen`).expect(409)).body.code).toBe('NOT_CLOSED');
      expect(byCode((await list(rel)).items, 'R-EATING-DISORDER')[0]!.status).toBe('OPEN');
    });

    it('her maddeye not eklenebilir; başka danışanın maddesine eklenemez', async () => {
      const rel = await createActiveRelationship(app);
      const other = await createActiveRelationship(app, { pro: rel.pro });
      const f = (await list(rel)).items[0]!;
      await post(rel, `findings/${f.id}/notes`, { text: 'Bir sonraki görüşmede soracağım.' }).expect(201);
      expect((await list(rel)).items.find((x) => x.id === f.id)!.events).toEqual([{ id: expect.any(String), kind: 'NOTE', text: 'Bir sonraki görüşmede soracağım.', createdAt: expect.any(String) }]);

      await http().post(`/api/clients/${other.client.user.id}/findings/${f.id}/notes`).set(bearer(rel.pro.accessToken)).send({ text: 'x' }).expect(404);
    });

    it('takip görevi: madde "takipte" olur, görev bitince yeniden açılır; kapalı maddeye görev açılmaz', async () => {
      const rel = await createActiveRelationship(app);
      await answer(rel, 'std.eating_disorder_history', 'yes');
      const red = byCode((await list(rel)).items, 'R-EATING-DISORDER')[0]!;

      const task = (await post(rel, `findings/${red.id}/task`, { title: 'Danışanı ara', dueAt: new Date(Date.now() + 86_400_000).toISOString() }).expect(201)).body as { id: string };
      let res = await list(rel);
      expect(res.counts).toMatchObject({ red: 0, followUp: 1 });
      expect(res.items.find((f) => f.id === red.id)).toMatchObject({ status: 'FOLLOW_UP' });
      expect(res.items.find((f) => f.id === red.id)!.tasks).toHaveLength(1);

      const own = await post(rel, 'tasks', { title: 'Plan hazırla', dueAt: new Date(Date.now() + 3 * 86_400_000).toISOString() }).expect(201);
      const open = await http().get('/api/review/tasks').set(bearer(rel.pro.accessToken)).expect(200);
      expect(open.body.map((t: { title: string }) => t.title)).toEqual(['Danışanı ara', 'Plan hazırla']);
      expect(open.body[0].client.username).toBe(rel.client.body.username);
      expect(own.body.status).toBe('OPEN');

      await http().post(`/api/review/tasks/${task.id}/done`).set(bearer(rel.pro.accessToken)).expect(200);
      expect((await http().post(`/api/review/tasks/${task.id}/done`).set(bearer(rel.pro.accessToken)).expect(409)).body.code).toBe('ALREADY_DONE');
      res = await list(rel);
      expect(res.counts).toMatchObject({ red: 1, followUp: 0 });
      expect(res.items.find((f) => f.id === red.id)!.events.map((e) => e.kind)).toEqual(['TASK_CREATED', 'TASK_DONE']);

      await post(rel, `findings/${red.id}/close`, { decision: 'OTHER', reason: 'Takip tamamlandı' }).expect(200);
      expect((await post(rel, `findings/${red.id}/task`, { title: 'Yeni görev' }).expect(409)).body.code).toBe('NOT_OPEN');
    });

    it('başka uzmanın görevi görünmez ve tamamlanamaz', async () => {
      const rel = await createActiveRelationship(app);
      const task = (await post(rel, 'tasks', { title: 'Benim görevim' }).expect(201)).body as { id: string };
      const stranger = await registerApprovedProfessional(app);
      expect((await http().get('/api/review/tasks').set(bearer(stranger.accessToken)).expect(200)).body).toEqual([]);
      await http().post(`/api/review/tasks/${task.id}/done`).set(bearer(stranger.accessToken)).expect(404);
    });
  });

  describe('erişim sınırları', () => {
    it('danışanlığı olmayan uzman ve danışanın kendisi maddeleri göremez, işlem yapamaz', async () => {
      const rel = await createActiveRelationship(app);
      const f = (await list(rel)).items[0]!;
      const stranger = await registerApprovedProfessional(app);
      const id = rel.client.user.id;
      await http().get(`/api/clients/${id}/findings`).set(bearer(stranger.accessToken)).expect(403);
      await http().post(`/api/clients/${id}/findings/${f.id}/close`).set(bearer(stranger.accessToken)).send({ decision: 'OTHER', reason: 'deneme' }).expect(403);
      await http().post(`/api/clients/${id}/tasks`).set(bearer(stranger.accessToken)).send({ title: 'deneme' }).expect(403);
      await http().get(`/api/clients/${id}/findings`).set(bearer(rel.client.accessToken)).expect(403);
    });

    it('danışanlık bitince maddelere erişim ve işlem kapanır', async () => {
      const rel = await createActiveRelationship(app);
      const f = (await list(rel)).items[0]!;
      await http().post(`/api/relationships/${rel.id}/end`).set(bearer(rel.client.accessToken)).expect(200);
      await http().get(`/api/clients/${rel.client.user.id}/findings`).set(bearer(rel.pro.accessToken)).expect(403);
      await post(rel, `findings/${f.id}/notes`, { text: 'x' }).expect(403);
      expect((await http().get('/api/review/overview').set(bearer(rel.pro.accessToken)).expect(200)).body).toEqual([]);
    });

    it('danışan bir kategoriyi kapatınca o kategorideki mevcut maddeler de gizlenir', async () => {
      const rel = await createActiveRelationship(app);
      await answer(rel, 'std.eating_disorder_history', 'yes');
      expect(byCode((await list(rel)).items, 'R-EATING-DISORDER')).toHaveLength(1);
      await http().patch(`/api/relationships/${rel.id}/sharing`).set(bearer(rel.client.accessToken)).send({ sharedData: ['WEIGHT', 'MEASUREMENTS'] }).expect(200);
      const res = await list(rel);
      expect(byCode(res.items, 'R-EATING-DISORDER')).toHaveLength(0);
      expect(res.counts.red).toBe(0);
      // Gizlendi ama silinmedi: paylaşım tekrar açılınca geri gelir
      await http().patch(`/api/relationships/${rel.id}/sharing`).set(bearer(rel.client.accessToken)).send({ sharedData: ['WEIGHT', 'MEASUREMENTS', 'ANAMNESIS'] }).expect(200);
      expect(byCode((await list(rel)).items, 'R-EATING-DISORDER')).toHaveLength(1);
    });

    it('iki uzmanın maddeleri birbirinden bağımsızdır', async () => {
      const first = await createActiveRelationship(app);
      const second = await registerApprovedProfessional(app);
      await http().post('/api/relationships/offer').set(bearer(second.accessToken)).send({ username: first.client.body.username }).expect(201);
      const offers = await http().get('/api/relationships/as-client').set(bearer(first.client.accessToken)).expect(200);
      const secondRel = offers.body.find((r: { status: string }) => r.status === 'OFFERED') as { id: string };
      await http().post(`/api/relationships/${secondRel.id}/accept`).set(bearer(first.client.accessToken)).send({ sharedData: ['ANAMNESIS'] }).expect(200);

      const mine = (await list(first)).items;
      await post(first, `findings/${mine[0]!.id}/close`, { decision: 'OTHER', reason: 'Benim kararım' }).expect(200);
      const theirs = (await http().get(`/api/clients/${first.client.user.id}/findings`).set(bearer(second.accessToken)).expect(200)).body.items as Finding[];
      expect(theirs.some((f) => f.status === 'CLOSED')).toBe(false);
      expect(theirs.map((f) => f.id)).not.toContain(mine[0]!.id);
    });
  });

  describe('panel ve özet', () => {
    it('panel danışanları kırmızı/sarı sayısına göre sıralar; özet açık madde sayılarını içerir', async () => {
      const first = await createActiveRelationship(app);
      const second = await createActiveRelationship(app, { pro: first.pro });
      await answer(second, 'std.eating_disorder_history', 'yes');

      const overview = await http().get('/api/review/overview').set(bearer(first.pro.accessToken)).expect(200);
      expect(overview.body.map((o: { client: { id: string }; red: number }) => [o.client.id, o.red])).toEqual([
        [second.client.user.id, 1],
        [first.client.user.id, 0],
      ]);

      const summary = await http().get(`/api/clients/${second.client.user.id}/file`).set(bearer(first.pro.accessToken)).expect(200);
      expect(summary.body.findings).toMatchObject({ red: 1 });
    });
  });

  it('giriş yapmadan hiçbir adres açılmaz', async () => {
    await http().get('/api/clients/x/findings').expect(401);
    await http().get('/api/review/overview').expect(401);
    await http().get('/api/review/tasks').expect(401);
  });
});
