import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types.js';
import { PrismaService } from '../src/common/prisma/prisma.service.js';
import { bearer, cleanupTestData, createActiveRelationship, createTestApp, registerApprovedProfessional } from './helpers.js';

type Rel = Awaited<ReturnType<typeof createActiveRelationship>>;

const PROGRAM = {
  title: 'Başlangıç programı',
  weeks: 4,
  days: [
    {
      name: 'A günü',
      focus: 'Alt vücut',
      exercises: [
        { name: 'Squat', sets: 3, reps: '8-10', load: '20 kg', restSec: 90 },
        { name: 'Köprü', sets: 3, reps: '12' },
      ],
    },
    { name: 'B günü', exercises: [{ name: 'Şınav', sets: 3, reps: '10' }] },
  ],
};

const ALL_SHARED = ['WEIGHT', 'MEASUREMENTS', 'ANAMNESIS', 'WORKOUTS'];

describe('Egzersiz programı ve antrenman kayıtları (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  const http = () => request(app.getHttpServer());
  const today = () => new Date().toISOString().slice(0, 10);

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
  });

  afterAll(async () => {
    await cleanupTestData(app);
    await app.close();
  });

  async function trainerRel(sharedData = ALL_SHARED) {
    const trainer = await registerApprovedProfessional(app, 'TRAINER');
    return createActiveRelationship(app, { pro: trainer, sharedData });
  }
  const answer = (rel: Rel, key: string, value: unknown) => http().put(`/api/me/health/anamnesis/${key}`).set(bearer(rel.client.accessToken)).send({ value }).expect(200);
  const healthy = async (rel: Rel) => {
    await answer(rel, 'std.conditions', ['none']);
    await answer(rel, 'std.pregnancy', 'not_applicable');
  };
  const pro = (rel: Rel, method: 'get' | 'post' | 'put' | 'delete', path: string) => http()[method](`/api/clients/${rel.client.user.id}/${path}`).set(bearer(rel.pro.accessToken));
  const myPrograms = async (rel: Rel) => (await http().get('/api/me/programs').set(bearer(rel.client.accessToken)).expect(200)).body as { programId: string; number: number }[];

  async function published(rel: Rel) {
    await healthy(rel);
    await pro(rel, 'post', 'program/draft').send({ content: PROGRAM }).expect(201);
    const res = await pro(rel, 'post', 'program/draft/approve').send({ confirmWarnings: true }).expect(200);
    const [p] = await myPrograms(rel);
    const view = (await http().get(`/api/me/programs/${p!.programId}`).set(bearer(rel.client.accessToken)).expect(200)).body;
    return { programId: p!.programId, number: res.body.number as number, view };
  }

  describe('program', () => {
    it('sadece onaylı antrenör program hazırlar; taslak danışana görünmez', async () => {
      const dietitianRel = await createActiveRelationship(app);
      expect((await pro(dietitianRel, 'post', 'program/draft').send({}).expect(403)).body.code).toBe('NOT_A_TRAINER');

      const rel = await trainerRel();
      await pro(rel, 'post', 'program/draft').send({ content: PROGRAM }).expect(201);
      expect((await pro(rel, 'post', 'program/draft').send({}).expect(409)).body.code).toBe('DRAFT_EXISTS');
      expect(await myPrograms(rel)).toEqual([]);
    });

    it('sağlık durumu ve hamilelik bilgisi bilinmeden ya da sağlık öyküsü paylaşılmıyorsa onaylanamaz', async () => {
      const rel = await trainerRel();
      await pro(rel, 'post', 'program/draft').send({ content: PROGRAM }).expect(201);
      expect((await pro(rel, 'get', 'program/draft/check').expect(200)).body.blockers.map((b: { code: string }) => b.code)).toEqual(['HEALTH_INFO_MISSING']);
      expect((await pro(rel, 'post', 'program/draft/approve').send({ confirmWarnings: true }).expect(409)).body.code).toBe('PROGRAM_BLOCKED');
      await answer(rel, 'std.conditions', ['none']);
      expect((await pro(rel, 'get', 'program/draft/check').expect(200)).body.canApprove).toBe(false);
      await answer(rel, 'std.pregnancy', 'no');
      expect((await pro(rel, 'get', 'program/draft/check').expect(200)).body.canApprove).toBe(true);

      const hidden = await trainerRel(['WORKOUTS']);
      await pro(hidden, 'post', 'program/draft').send({ content: PROGRAM }).expect(201);
      expect((await pro(hidden, 'get', 'program/draft/check').expect(200)).body.blockers.map((b: { code: string }) => b.code)).toEqual(['HEALTH_INFO_MISSING']);
    });

    it('beyan edilen sağlık durumu uyarıdır: antrenör açıkça onaylamadan yayınlanmaz', async () => {
      const rel = await trainerRel();
      await answer(rel, 'std.conditions', ['hypertension']);
      await answer(rel, 'std.pregnancy', 'no');
      await pro(rel, 'post', 'program/draft').send({ content: PROGRAM }).expect(201);
      const check = await pro(rel, 'get', 'program/draft/check').expect(200);
      expect(check.body.canApprove).toBe(true);
      expect(check.body.warnings.map((w: { ruleCode: string }) => w.ruleCode)).toContain('Y-CONDITIONS');
      expect((await pro(rel, 'post', 'program/draft/approve').send({}).expect(409)).body.code).toBe('PROGRAM_WARNINGS');
      await pro(rel, 'post', 'program/draft/approve').send({ confirmWarnings: true }).expect(200);
      const v = await prisma.trainingProgramVersion.findFirstOrThrow({ where: { program: { clientId: rel.client.user.id }, status: 'APPROVED' } });
      expect(JSON.stringify(v.acknowledged)).toContain('Sağlık durumu');
    });

    it('onay yayınlar, bildirim gönderir; yeni sürüm farkla kaydedilir, eskisi "eski" olur', async () => {
      const rel = await trainerRel();
      const { number, view } = await published(rel);
      expect(number).toBe(1);
      expect(view).toMatchObject({ title: 'Başlangıç programı', version: { number: 1 } });
      expect(view.days).toHaveLength(2);
      const n = (await http().get('/api/notifications').set(bearer(rel.client.accessToken)).expect(200)).body.items;
      expect(n[0]).toMatchObject({ type: 'program_published', title: 'Antrenman programın güncellendi' });

      const draft = (await pro(rel, 'post', 'program/draft').send({ fromPublished: true }).expect(201)).body.content;
      draft.days[0].exercises[0].sets = 4;
      draft.days[1].exercises.push({ name: 'Plank', sets: 3, reps: '30 sn' });
      await pro(rel, 'put', 'program/draft').send({ content: draft, changeNote: 'Hacim artırıldı' }).expect(200);
      const res = await pro(rel, 'post', 'program/draft/approve').send({ confirmWarnings: true }).expect(200);
      expect(res.body.number).toBe(2);
      expect(res.body.summary).toEqual(expect.arrayContaining(['"A günü" › "Squat": 3×8-10 → 4×8-10', '"B günü": egzersiz eklendi "Plank"']));
      const ov = (await pro(rel, 'get', 'program').expect(200)).body;
      expect(ov.versions.map((v: { number: number; status: string }) => [v.number, v.status])).toEqual([[2, 'APPROVED'], [1, 'SUPERSEDED']]);
      expect(ov.versions[0].changeNote).toBe('Hacim artırıldı');
    });

    it('danışanlık bitince danışan programı göremez', async () => {
      const rel = await trainerRel();
      const { programId } = await published(rel);
      await http().post(`/api/relationships/${rel.id}/end`).set(bearer(rel.client.accessToken)).expect(200);
      expect(await myPrograms(rel)).toEqual([]);
      await http().get(`/api/me/programs/${programId}`).set(bearer(rel.client.accessToken)).expect(404);
    });
  });

  describe('antrenman kayıtları', () => {
    it('danışan program gününü kaydeder; geçersiz gün, gelecek tarih ve rızasız kayıt reddedilir', async () => {
      const rel = await trainerRel();
      const { programId, view } = await published(rel);
      const day = view.days[0];
      const body = {
        date: today(),
        dayId: day.id,
        rpe: 7,
        entries: [{ exerciseId: day.exercises[0].id, name: 'Squat', sets: [{ reps: 10, loadKg: 20 }, { reps: 8, loadKg: 22.5 }] }],
      };
      const ok = await http().post(`/api/me/programs/${programId}/logs`).set(bearer(rel.client.accessToken)).send(body).expect(201);
      expect(ok.body).toMatchObject({ source: 'SELF', dayId: day.id, pain: false });

      await http().post(`/api/me/programs/${programId}/logs`).set(bearer(rel.client.accessToken)).send({ ...body, dayId: 'yok' }).expect(400);
      const future = new Date(Date.now() + 3 * 86_400_000).toISOString().slice(0, 10);
      expect((await http().post(`/api/me/programs/${programId}/logs`).set(bearer(rel.client.accessToken)).send({ ...body, date: future }).expect(400)).body.code).toBe('INVALID_DATE');
      // Programsız serbest kayıt
      await http().post('/api/me/workouts').set(bearer(rel.client.accessToken)).send({ date: today(), entries: [{ name: 'Yürüyüş', sets: [{ reps: 1 }] }] }).expect(201);
      expect((await http().get('/api/me/workouts').set(bearer(rel.client.accessToken)).expect(200)).body).toHaveLength(2);

      await http().delete('/api/consents/health_data').set(bearer(rel.client.accessToken)).expect(200);
      expect((await http().post('/api/me/workouts').set(bearer(rel.client.accessToken)).send(body).expect(403)).body.code).toBe('HEALTH_CONSENT_REQUIRED');
    });

    it('antrenör kayıtları ve performansı sadece paylaşılıyorsa görür; yüz yüze seansı danışan adına girer', async () => {
      const rel = await trainerRel();
      const { programId } = await published(rel);
      const log = (date: string, load: number) =>
        http().post(`/api/me/programs/${programId}/logs`).set(bearer(rel.client.accessToken)).send({ date, entries: [{ name: 'Squat', sets: [{ reps: 10, loadKg: load }] }] }).expect(201);
      const d = (n: number) => new Date(Date.now() - n * 86_400_000).toISOString().slice(0, 10);
      await log(d(5), 20);
      await log(d(2), 25);

      const logs = await pro(rel, 'get', 'workouts').expect(200);
      expect(logs.body).toHaveLength(2);
      const perf = (await pro(rel, 'get', 'performance').expect(200)).body as { name: string; sessions: { bestLoadKg: number }[] }[];
      expect(perf[0]!.name).toBe('Squat');
      expect(perf[0]!.sessions.map((s) => s.bestLoadKg)).toEqual([20, 25]);

      const inPerson = await pro(rel, 'post', 'workouts').send({ date: today(), entries: [{ name: 'Squat', sets: [{ reps: 8, loadKg: 27.5 }] }], note: 'Yüz yüze seans' }).expect(201);
      expect(inPerson.body.source).toBe('PROFESSIONAL');

      const closed = await trainerRel(['ANAMNESIS']);
      await pro(closed, 'get', 'workouts').expect(403);
      await pro(closed, 'get', 'performance').expect(403);
      await pro(closed, 'post', 'workouts').send({ date: today(), entries: [{ name: 'Squat', sets: [{ reps: 8 }] }] }).expect(403);
    });

    it('ağrı bildirimi antrenörün panelinde kırmızı madde olarak hemen görünür ve onay öncesi uyarıdır', async () => {
      const rel = await trainerRel();
      const { programId } = await published(rel);
      await http()
        .post(`/api/me/programs/${programId}/logs`)
        .set(bearer(rel.client.accessToken))
        .send({ date: today(), pain: true, painNote: 'Squat sırasında dizimde ağrı', entries: [{ name: 'Squat', sets: [{ reps: 5, loadKg: 20 }] }] })
        .expect(201);

      const ov = await http().get('/api/review/overview').set(bearer(rel.pro.accessToken)).expect(200);
      expect(ov.body[0].red).toBe(1);
      const items = (await pro(rel, 'get', 'findings').expect(200)).body.items as { ruleCode: string; detail: string }[];
      const pain = items.find((f) => f.ruleCode === 'R-PAIN-REPORTED')!;
      expect(pain.detail).toContain('dizimde ağrı');

      await pro(rel, 'post', 'program/draft').send({ fromPublished: true }).expect(201);
      const check = (await pro(rel, 'get', 'program/draft/check').expect(200)).body;
      expect(check.warnings.map((w: { ruleCode: string }) => w.ruleCode)).toContain('R-PAIN-REPORTED');
    });

    it('program yayında ama 14 günde kayıt yoksa programı değiştirmeden sorulacaklar önerilir', async () => {
      const rel = await trainerRel();
      await published(rel);
      await prisma.trainingProgramVersion.updateMany({ where: { program: { clientId: rel.client.user.id }, status: 'APPROVED' }, data: { approvedAt: new Date(Date.now() - 30 * 86_400_000) } });
      const items = (await pro(rel, 'get', 'findings').expect(200)).body.items as { ruleCode: string; detail: string }[];
      const none = items.find((f) => f.ruleCode === 'Y-NO-WORKOUT-LOGS')!;
      expect(none.detail).toContain('Programı değiştirmeden önce');
    });
  });

  it('giriş yapmadan hiçbir adres açılmaz', async () => {
    await http().get('/api/me/programs').expect(401);
    await http().get('/api/me/workouts').expect(401);
    await http().get('/api/clients/x/program').expect(401);
  });
});
