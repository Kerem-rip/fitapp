import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types.js';
import { PrismaService } from '../src/common/prisma/prisma.service.js';
import { AppointmentsService } from '../src/modules/clients/agenda/appointments.service.js';
import { RemindersService } from '../src/modules/clients/agenda/reminders.service.js';
import { bearer, cleanupTestData, createActiveRelationship, createTestApp, registerApprovedProfessional } from './helpers.js';

type Rel = Awaited<ReturnType<typeof createActiveRelationship>>;

describe('Randevu, hedef, hatırlatma ve gelişim takibi (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  const http = () => request(app.getHttpServer());
  const HOUR = 3_600_000;
  const DAY = 24 * HOUR;
  const at = (ms: number) => new Date(Date.now() + ms).toISOString();

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
  });

  afterAll(async () => {
    await cleanupTestData(app);
    await app.close();
  });

  const book = (rel: Rel, body: Record<string, unknown>) =>
    http().post(`/api/clients/${rel.client.user.id}/appointments`).set(bearer(rel.pro.accessToken)).send({ mode: 'ONLINE', ...body });
  const notifications = async (token: string) =>
    (await http().get('/api/notifications').set(bearer(token)).expect(200)).body as { unread: number; items: { id: string; type: string; title: string; text: string; read: boolean }[] };
  const weight = (rel: Rel, value: number, takenAt?: string) =>
    http().post('/api/me/health/measurements').set(bearer(rel.client.accessToken)).send({ kind: 'WEIGHT', value, method: 'SCALE', takenAt }).expect(201);
  const findings = async (rel: Rel) =>
    ((await http().get(`/api/clients/${rel.client.user.id}/findings`).set(bearer(rel.pro.accessToken)).expect(200)).body.items as { ruleCode: string; title: string; detail: string }[]);

  describe('randevular', () => {
    it('uzman randevu verir; danışan bildirim alır ve randevuyu uzmanın notu olmadan görür', async () => {
      const rel = await createActiveRelationship(app);
      // Danışanlık teklifinin bildirimi okunmuş say
      await http().post('/api/notifications/read').set(bearer(rel.client.accessToken)).send({}).expect(200);
      const res = await book(rel, { startsAt: at(2 * DAY), durationMin: 30, title: 'İlk görüşme', notes: 'Alerjileri sor' }).expect(201);
      expect(res.body.status).toBe('SCHEDULED');

      const n = await notifications(rel.client.accessToken);
      expect(n.unread).toBe(1);
      expect(n.items[0]).toMatchObject({ type: 'appointment_created', title: 'Yeni randevu', read: false });
      expect(n.items[0]!.text).toContain('Uzman');

      const mine = await http().get('/api/me/appointments').set(bearer(rel.client.accessToken)).expect(200);
      expect(mine.body).toHaveLength(1);
      expect(mine.body[0]).toMatchObject({ title: 'İlk görüşme', mode: 'ONLINE', status: 'SCHEDULED' });
      expect(mine.body[0].notes).toBeUndefined();
      expect(mine.body[0].outcome).toBeUndefined();
    });

    it('geçmişe, çakışan saate ve danışanlığı olmayan kişiye randevu verilemez', async () => {
      const rel = await createActiveRelationship(app);
      expect((await book(rel, { startsAt: at(-DAY) }).expect(400)).body.code).toBe('IN_PAST');
      await book(rel, { startsAt: at(DAY), durationMin: 60 }).expect(201);
      expect((await book(rel, { startsAt: at(DAY + 30 * 60_000) }).expect(409)).body.code).toBe('APPOINTMENT_OVERLAP');
      await book(rel, { startsAt: at(DAY + 61 * 60_000) }).expect(201);

      const stranger = await registerApprovedProfessional(app);
      await http().post(`/api/clients/${rel.client.user.id}/appointments`).set(bearer(stranger.accessToken)).send({ mode: 'ONLINE', startsAt: at(3 * DAY) }).expect(403);
    });

    it('erteleme bildirim gönderir; saati gelmeden "tamamlandı" işaretlenemez; görüşme özeti danışana gösterilmez', async () => {
      const rel = await createActiveRelationship(app);
      const a = (await book(rel, { startsAt: at(DAY) }).expect(201)).body as { id: string };
      await http().patch(`/api/appointments/${a.id}`).set(bearer(rel.pro.accessToken)).send({ startsAt: at(2 * DAY) }).expect(200);
      expect((await notifications(rel.client.accessToken)).items[0]!.type).toBe('appointment_updated');

      expect((await http().post(`/api/appointments/${a.id}/status`).set(bearer(rel.pro.accessToken)).send({ status: 'COMPLETED' }).expect(400)).body.code).toBe('NOT_YET');
      await prisma.appointment.update({ where: { id: a.id }, data: { startsAt: new Date(Date.now() - HOUR) } });
      await http().post(`/api/appointments/${a.id}/status`).set(bearer(rel.pro.accessToken)).send({ status: 'COMPLETED', outcome: 'Hedefler konuşuldu.' }).expect(200);
      expect((await http().patch(`/api/appointments/${a.id}`).set(bearer(rel.pro.accessToken)).send({ title: 'x' }).expect(409)).body.code).toBe('NOT_SCHEDULED');

      const mine = await http().get('/api/me/appointments').set(bearer(rel.client.accessToken)).expect(200);
      expect(mine.body[0]).toMatchObject({ status: 'COMPLETED' });
      expect(JSON.stringify(mine.body)).not.toContain('Hedefler konuşuldu');

      const timeline = await http().get(`/api/clients/${rel.client.user.id}/timeline`).set(bearer(rel.pro.accessToken)).expect(200);
      expect(timeline.body.find((i: { type: string }) => i.type === 'APPOINTMENT')).toMatchObject({ status: 'COMPLETED', outcome: 'Hedefler konuşuldu.' });
    });

    it('danışan ileri tarihli randevuyu iptal eder, uzman bildirim alır; başkası iptal edemez', async () => {
      const rel = await createActiveRelationship(app);
      const other = await createActiveRelationship(app);
      const a = (await book(rel, { startsAt: at(DAY) }).expect(201)).body as { id: string };
      await http().post(`/api/me/appointments/${a.id}/cancel`).set(bearer(other.client.accessToken)).send({}).expect(404);
      await http().post(`/api/me/appointments/${a.id}/cancel`).set(bearer(rel.client.accessToken)).send({ reason: 'İşim çıktı' }).expect(200);
      expect((await http().post(`/api/me/appointments/${a.id}/cancel`).set(bearer(rel.client.accessToken)).send({}).expect(409)).body.code).toBe('NOT_CANCELLABLE');
      const n = await notifications(rel.pro.accessToken);
      expect(n.items.some((x) => x.type === 'appointment_cancelled_by_client')).toBe(true);
    });

    it('24 saat kala danışana bir kez hatırlatma gider', async () => {
      const rel = await createActiveRelationship(app);
      const a = (await book(rel, { startsAt: at(2 * HOUR) }).expect(201)).body as { id: string };
      const far = (await book(rel, { startsAt: at(3 * DAY) }).expect(201)).body as { id: string };
      const service = app.get(AppointmentsService);
      await service.sendDueReminders();
      await service.sendDueReminders();
      const reminders = await prisma.notification.findMany({ where: { userId: rel.client.user.id, type: 'appointment_reminder' } });
      expect(reminders).toHaveLength(1);
      expect((reminders[0]!.data as { appointmentId: string }).appointmentId).toBe(a.id);
      expect((await prisma.appointment.findUniqueOrThrow({ where: { id: far.id } })).reminderSentAt).toBeNull();
    });

    it('ajanda: aralıktaki randevular ve açık görevler', async () => {
      const rel = await createActiveRelationship(app);
      await book(rel, { startsAt: at(DAY), title: 'Kontrol' }).expect(201);
      await book(rel, { startsAt: at(20 * DAY), title: 'Uzak' }).expect(201);
      await http().post(`/api/clients/${rel.client.user.id}/tasks`).set(bearer(rel.pro.accessToken)).send({ title: 'Planı gözden geçir', dueAt: at(2 * DAY) }).expect(201);
      const res = await http().get(`/api/agenda?from=${encodeURIComponent(at(-HOUR))}&to=${encodeURIComponent(at(7 * DAY))}`).set(bearer(rel.pro.accessToken)).expect(200);
      expect(res.body.appointments.map((a: { title: string }) => a.title)).toEqual(['Kontrol']);
      expect(res.body.appointments[0].client.username).toBe(rel.client.body.username);
      expect(res.body.tasks.map((t: { title: string }) => t.title)).toEqual(['Planı gözden geçir']);
    });
  });

  describe('hatırlatmalar', () => {
    it('zamanı gelince danışana bildirim gider; gönderilmiş hatırlatma iptal edilemez', async () => {
      const rel = await createActiveRelationship(app);
      expect((await http().post(`/api/clients/${rel.client.user.id}/reminders`).set(bearer(rel.pro.accessToken)).send({ text: 'Su iç', remindAt: at(-DAY) }).expect(400)).body.code).toBe('IN_PAST');
      const r = (await http().post(`/api/clients/${rel.client.user.id}/reminders`).set(bearer(rel.pro.accessToken)).send({ text: 'Bugün ölçümünü gir', remindAt: at(HOUR) }).expect(201)).body as { id: string };

      const service = app.get(RemindersService);
      expect(await service.sendDue()).toBe(0);
      expect(await service.sendDue(new Date(Date.now() + 2 * HOUR))).toBe(1);
      const n = await notifications(rel.client.accessToken);
      expect(n.items[0]).toMatchObject({ type: 'reminder', text: 'Bugün ölçümünü gir' });
      expect(n.items[0]!.title).toContain('hatırlatıyor');
      expect((await http().post(`/api/reminders/${r.id}/cancel`).set(bearer(rel.pro.accessToken)).expect(409)).body.code).toBe('NOT_PENDING');
    });

    it('danışanlık bittiyse hatırlatma gönderilmez, iptal edilir', async () => {
      const rel = await createActiveRelationship(app);
      await http().post(`/api/clients/${rel.client.user.id}/reminders`).set(bearer(rel.pro.accessToken)).send({ text: 'Yürüyüş', remindAt: at(HOUR) }).expect(201);
      await http().post(`/api/relationships/${rel.id}/end`).set(bearer(rel.client.accessToken)).expect(200);
      await app.get(RemindersService).sendDue(new Date(Date.now() + 2 * HOUR));
      expect(await prisma.notification.count({ where: { userId: rel.client.user.id, type: 'reminder' } })).toBe(0);
      const stored = await prisma.clientReminder.findFirstOrThrow({ where: { clientId: rel.client.user.id } });
      expect(stored.cancelledAt).not.toBeNull();
    });
  });

  describe('hedefler ve "beklenen değişim yok"', () => {
    const addGoal = (rel: Rel, body: Record<string, unknown>) => http().post(`/api/clients/${rel.client.user.id}/goals`).set(bearer(rel.pro.accessToken)).send(body);

    it('ölçüm hedefinin başlangıcı son ölçümdür; ilerleme gösterilir; danışan hedefini görür', async () => {
      const rel = await createActiveRelationship(app);
      await weight(rel, 80);
      const goal = await addGoal(rel, { title: 'Kilo', measurementKind: 'WEIGHT', targetValue: 74 }).expect(201);
      expect(goal.body).toMatchObject({ startValue: 80, targetValue: 74, status: 'ACTIVE' });

      await weight(rel, 78.5);
      const list = await http().get(`/api/clients/${rel.client.user.id}/goals`).set(bearer(rel.pro.accessToken)).expect(200);
      expect(list.body[0].progress).toMatchObject({ latestValue: 78.5, remaining: 4.5, measurementsSinceStart: 1, unit: 'kg' });

      const mine = await http().get('/api/me/goals').set(bearer(rel.client.accessToken)).expect(200);
      expect(mine.body[0]).toMatchObject({ title: 'Kilo', targetValue: 74, unit: 'kg' });
    });

    it('geçersiz hedefler reddedilir; kategori paylaşılmıyorsa ölçüm hedefi açılamaz ama alışkanlık hedefi açılır', async () => {
      const rel = await createActiveRelationship(app, { sharedData: ['ANAMNESIS'] });
      expect((await addGoal(rel, { title: 'Kilo', measurementKind: 'WEIGHT', targetValue: 70 }).expect(403)).body.code).toBe('NO_ACCESS');
      expect((await addGoal(rel, { title: 'Değer', targetValue: 70 }).expect(400)).body.code).toBe('INVALID_VALUE');
      const full = await createActiveRelationship(app);
      expect((await addGoal(full, { title: 'Kilo', measurementKind: 'WEIGHT' }).expect(400)).body.code).toBe('TARGET_REQUIRED');
      expect((await addGoal(full, { title: 'Kilo', measurementKind: 'WEIGHT', targetValue: 900 }).expect(400)).body.code).toBe('INVALID_VALUE');
      await addGoal(rel, { title: 'Her gün 2 litre su' }).expect(201);
    });

    it('hedefe yaklaşılmıyorsa plan dayatmadan inceleme önerisi çıkar; yaklaşınca kalkar; ulaşınca yeşil öneri; kapatınca hepsi kalkar', async () => {
      const rel = await createActiveRelationship(app);
      await weight(rel, 80, new Date(Date.now() - 40 * DAY).toISOString());
      const goal = (await addGoal(rel, { title: 'Kilo', measurementKind: 'WEIGHT', targetValue: 72 }).expect(201)).body as { id: string };
      await prisma.clientGoal.update({ where: { id: goal.id }, data: { startDate: new Date(Date.now() - 30 * DAY) } });

      await weight(rel, 80.4);
      let items = await findings(rel);
      const stuck = items.find((f) => f.ruleCode === 'Y-GOAL-NO-PROGRESS')!;
      expect(stuck.title).toContain('Kilo');
      expect(stuck.detail).toContain('Yeni bir plan yazmadan önce');
      expect(stuck.detail).toContain('Plan seçimleri görünmüyor');

      await weight(rel, 77);
      items = await findings(rel);
      expect(items.some((f) => f.ruleCode === 'Y-GOAL-NO-PROGRESS')).toBe(false);

      await weight(rel, 71.5);
      items = await findings(rel);
      expect(items.some((f) => f.ruleCode === 'G-GOAL-REACHED')).toBe(true);

      await http().post(`/api/goals/${goal.id}/status`).set(bearer(rel.pro.accessToken)).send({ status: 'ACHIEVED', note: 'Tebrikler' }).expect(200);
      items = await findings(rel);
      expect(items.some((f) => f.ruleCode.startsWith('G-GOAL') || f.ruleCode.startsWith('Y-GOAL'))).toBe(false);
      expect((await http().get('/api/me/goals').set(bearer(rel.client.accessToken)).expect(200)).body).toEqual([]);
    });

    it('hedeften sonra ölçüm yoksa uyarı çıkar', async () => {
      const rel = await createActiveRelationship(app);
      await weight(rel, 80, new Date(Date.now() - 30 * DAY).toISOString());
      const goal = (await addGoal(rel, { title: 'Kilo', measurementKind: 'WEIGHT', targetValue: 76 }).expect(201)).body as { id: string };
      await prisma.clientGoal.update({ where: { id: goal.id }, data: { startDate: new Date(Date.now() - 20 * DAY) } });
      await http().post(`/api/clients/${rel.client.user.id}/notes`).set(bearer(rel.pro.accessToken)).send({ text: 'tetik' }).expect(201);
      expect((await findings(rel)).some((f) => f.ruleCode === 'Y-GOAL-NO-MEASUREMENT')).toBe(true);
    });
  });

  describe('bildirimler', () => {
    it('okunur metinle listelenir, okundu işaretlenir; kişi sadece kendi bildirimlerini işaretler', async () => {
      const rel = await createActiveRelationship(app);
      await http().post('/api/notifications/read').set(bearer(rel.client.accessToken)).send({}).expect(200);
      await book(rel, { startsAt: at(DAY) }).expect(201);
      await book(rel, { startsAt: at(2 * DAY) }).expect(201);
      const before = await notifications(rel.client.accessToken);
      expect(before.unread).toBe(2);
      const firstId = before.items[0]!.id;

      // Başkası işaretleyemez
      await http().post('/api/notifications/read').set(bearer(rel.pro.accessToken)).send({ ids: [firstId] }).expect(200);
      expect((await notifications(rel.client.accessToken)).unread).toBe(2);

      await http().post('/api/notifications/read').set(bearer(rel.client.accessToken)).send({ ids: [firstId] }).expect(200);
      expect((await notifications(rel.client.accessToken)).unread).toBe(1);
      await http().post('/api/notifications/read').set(bearer(rel.client.accessToken)).send({}).expect(200);
      expect((await notifications(rel.client.accessToken)).unread).toBe(0);
    });
  });

  it('giriş yapmadan hiçbir adres açılmaz', async () => {
    await http().get('/api/agenda').expect(401);
    await http().get('/api/me/appointments').expect(401);
    await http().get('/api/notifications').expect(401);
  });
});
