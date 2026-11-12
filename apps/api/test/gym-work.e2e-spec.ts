import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types.js';
import { PrismaService } from '../src/common/prisma/prisma.service.js';
import { bearer, cleanupTestData, createTestApp, registerApprovedProfessional, registerUser } from './helpers.js';

describe('Spor salonu: dersler, katılım, görevler ve vardiyalar (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  const http = () => request(app.getHttpServer());
  // Salon günleri Türkiye saatine göredir (UTC+3)
  const dayOffset = (n: number) => new Date(Date.now() + 3 * 3_600_000 + n * 86_400_000).toISOString().slice(0, 10);
  const today = () => dayOffset(0);

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
  });

  afterAll(async () => {
    await cleanupTestData(app);
    await app.close();
  });

  type Token = { accessToken: string; body: { username: string }; user: { id: string } };
  const get = (t: Token, path: string) => http().get(`/api/gym/${path}`).set(bearer(t.accessToken));
  const post = (t: Token, path: string, body: Record<string, unknown> = {}) => http().post(`/api/gym/${path}`).set(bearer(t.accessToken)).send(body);
  const put = (t: Token, path: string, body: Record<string, unknown>) => http().put(`/api/gym/${path}`).set(bearer(t.accessToken)).send(body);

  // Salon sahibi + resepsiyon + eğitmen; sınırsız aylık paket ve 10 derslik paket; üç üye
  async function setup() {
    const owner = (await registerApprovedProfessional(app, 'GYM_OWNER')) as Token;
    const reception = (await registerUser(app)) as Token;
    const trainer = (await registerUser(app)) as Token;
    for (const [u, role] of [[reception, 'RECEPTION'], [trainer, 'TRAINER']] as const) {
      await post(owner, 'staff/invite', { username: u.body.username, role }).expect(201);
      const invites = await http().get('/api/me/gym-invites').set(bearer(u.accessToken)).expect(200);
      await http().post(`/api/me/gym-invites/${invites.body[0].id}/accept`).set(bearer(u.accessToken)).expect(200);
    }
    const monthly = (await post(owner, 'plans', { name: 'Aylık', durationDays: 30, priceKurus: 150_000 }).expect(201)).body as { id: string };
    const pack = (await post(owner, 'plans', { name: '10 ders', durationDays: 60, sessionCount: 10, priceKurus: 600_000 }).expect(201)).body as { id: string };
    const member = async (fullName: string, planId?: string) => {
      const m = (await post(reception, 'members', { fullName }).expect(201)).body as { id: string };
      if (planId) await post(reception, `members/${m.id}/memberships`, { planId }).expect(201);
      return m.id;
    };
    const ali = await member('Ali Aylık', monthly.id);
    const pelin = await member('Pelin Paket', pack.id);
    const yusuf = await member('Yusuf Üyeliksiz');
    return { owner, reception, trainer, ali, pelin, yusuf };
  }

  const sessionsLeft = async (memberId: string) => (await prisma.membership.findFirstOrThrow({ where: { memberId, sessionsTotal: { not: null } } })).sessionsLeft;

  describe('grup dersi ve katılım', () => {
    it('katılan üyeden ders hakkı düşer, gelmeyenden düşmez; işaret geri alınınca hak geri gelir', async () => {
      const { reception, trainer, ali, pelin, yusuf } = await setup();
      const created = await post(reception, 'lessons', {
        kind: 'GROUP', title: 'Pilates', trainerId: trainer.user.id, date: today(), startTime: '06:00', durationMin: 50, capacity: 3,
      }).expect(201);
      const lessonId = created.body.lessons[0].id as string;

      expect((await post(reception, `lessons/${lessonId}/bookings`, { memberId: ali }).expect(201)).body.warning).toBeNull();
      const b2 = await post(reception, `lessons/${lessonId}/bookings`, { memberId: pelin }).expect(201);
      // Üyeliği olmayan üye yazılabilir ama uyarı döner
      const b3 = await post(reception, `lessons/${lessonId}/bookings`, { memberId: yusuf }).expect(201);
      expect(b3.body.warning.code).toBe('NO_ACTIVE_MEMBERSHIP');
      expect((await post(reception, `lessons/${lessonId}/bookings`, { memberId: ali }).expect(409)).body.code).toBe('ALREADY_BOOKED');

      const extra = (await post(reception, 'members', { fullName: 'Dördüncü' }).expect(201)).body.id;
      expect((await post(reception, `lessons/${lessonId}/bookings`, { memberId: extra }).expect(409)).body.code).toBe('LESSON_FULL');

      const detail = (await get(trainer, `lessons/${lessonId}`).expect(200)).body;
      expect(detail.canManage).toBe(true);
      expect(detail.bookings).toHaveLength(3);
      const aliBooking = detail.bookings.find((b: { member: { id: string } }) => b.member.id === ali).id;

      // Sınırsız üyelikte hak düşmez
      await post(trainer, `bookings/${aliBooking}/mark`, { status: 'ATTENDED' }).expect(200);
      // Paketli üyeden 1 hak düşer; geri alınca geri gelir; "gelmedi" düşmez
      await post(trainer, `bookings/${b2.body.booking.id}/mark`, { status: 'ATTENDED' }).expect(200);
      expect(await sessionsLeft(pelin)).toBe(9);
      await post(trainer, `bookings/${b2.body.booking.id}/mark`, { status: 'BOOKED' }).expect(200);
      expect(await sessionsLeft(pelin)).toBe(10);
      await post(trainer, `bookings/${b2.body.booking.id}/mark`, { status: 'NO_SHOW' }).expect(200);
      expect(await sessionsLeft(pelin)).toBe(10);
      await post(trainer, `bookings/${b2.body.booking.id}/mark`, { status: 'ATTENDED' }).expect(200);
      expect(await sessionsLeft(pelin)).toBe(9);
      // Aynı işaret tekrar gelirse ikinci kez düşmez
      await post(trainer, `bookings/${b2.body.booking.id}/mark`, { status: 'ATTENDED' }).expect(200);
      expect(await sessionsLeft(pelin)).toBe(9);

      // Üyeliği olmayan katılım kaydedilir, uyarı döner
      const yusufMark = await post(trainer, `bookings/${b3.body.booking.id}/mark`, { status: 'ATTENDED' }).expect(200);
      expect(yusufMark.body.warning.code).toBe('NO_ACTIVE_MEMBERSHIP');
      expect(yusufMark.body.booking.status).toBe('ATTENDED');

      // Hak hareketleri kayıtlı: -1, +1, -1
      const logs = await prisma.gymSessionLog.findMany({ where: { bookingId: b2.body.booking.id }, orderBy: { createdAt: 'asc' } });
      expect(logs.map((l) => l.delta)).toEqual([-1, 1, -1]);

      // Katılımı işaretlenmiş ders iptal edilemez; işaretli kayıt kaldırılamaz
      expect((await post(reception, `lessons/${lessonId}/cancel`, { reason: 'Eğitmen hasta' }).expect(409)).body.code).toBe('ATTENDANCE_MARKED');
      expect((await post(reception, `bookings/${aliBooking}/cancel`).expect(409)).body.code).toBe('ATTENDANCE_MARKED');

      const list = (await get(reception, `lessons?from=${today()}&to=${today()}`).expect(200)).body;
      expect(list[0]).toMatchObject({ title: 'Pilates', booked: 3, attended: 3 });

      const history = (await get(reception, `members/${pelin}/lessons`).expect(200)).body;
      expect(history.history[0]).toMatchObject({ status: 'ATTENDED', deducted: true });
    });

    it('ileri tarihli derste katılım işaretlenmez; haftalık seri oluşur ve kalan haftalarla iptal edilir', async () => {
      const { reception, trainer, ali } = await setup();
      const created = await post(reception, 'lessons', {
        kind: 'GROUP', title: 'Yoga', trainerId: trainer.user.id, date: dayOffset(1), startTime: '19:00', durationMin: 60, capacity: 10, repeatWeeks: 4,
      }).expect(201);
      expect(created.body.lessons).toHaveLength(4);
      const [first, second] = created.body.lessons as { id: string; seriesId: string; date: string }[];
      expect(first!.seriesId).toBe(second!.seriesId);
      expect(second!.date).toBe(dayOffset(8));

      const b = await post(reception, `lessons/${first!.id}/bookings`, { memberId: ali }).expect(201);
      expect((await post(reception, `bookings/${b.body.booking.id}/mark`, { status: 'ATTENDED' }).expect(400)).body.code).toBe('LESSON_IN_FUTURE');
      // Kayıt kaldırılıp yeniden yazılabilir
      await post(reception, `bookings/${b.body.booking.id}/cancel`).expect(200);
      await post(reception, `lessons/${first!.id}/bookings`, { memberId: ali }).expect(201);

      // Aynı eğitmene aynı saatte ikinci ders açılamaz
      expect(
        (await post(reception, 'lessons', { kind: 'GROUP', title: 'Çakışan', trainerId: trainer.user.id, date: dayOffset(8), startTime: '19:30', durationMin: 30, capacity: 5 }).expect(409)).body.code,
      ).toBe('TRAINER_BUSY');

      // İkinci haftadan itibaren seriyi iptal et: ilk hafta kalır
      expect((await post(reception, `lessons/${second!.id}/cancel`, { reason: 'Salon tadilatta', wholeSeries: true }).expect(200)).body.cancelled).toBe(3);
      const list = (await get(reception, `lessons?from=${dayOffset(0)}&to=${dayOffset(30)}`).expect(200)).body as { status: string }[];
      expect(list.map((l) => l.status)).toEqual(['SCHEDULED', 'CANCELLED', 'CANCELLED', 'CANCELLED']);
      expect((await post(reception, `lessons/${first!.id}/bookings`, { memberId: ali }).expect(409)).body.code).toBe('ALREADY_BOOKED');
    });
  });

  describe('özel ders ve eğitmen yetkisi', () => {
    it('eğitmen kendine özel ders açar ve katılımını işaretler; grup dersi ya da başkasının dersi için yetkisi yok', async () => {
      const { owner, reception, trainer, pelin, ali } = await setup();
      const mine = await post(trainer, 'lessons', { kind: 'PRIVATE', trainerId: trainer.user.id, memberId: pelin, date: today(), startTime: '07:00', durationMin: 60 }).expect(201);
      expect(mine.body.warning).toBeNull();
      // Sadece sınırsız üyeliği olan üyeye özel ders: uyarı
      const noPack = await post(trainer, 'lessons', { kind: 'PRIVATE', trainerId: trainer.user.id, memberId: ali, date: today(), startTime: '09:00', durationMin: 60 }).expect(201);
      expect(noPack.body.warning.code).toBe('NO_SESSIONS_LEFT');

      const detail = (await get(trainer, `lessons/${mine.body.lessons[0].id}`).expect(200)).body;
      await post(trainer, `bookings/${detail.bookings[0].id}/mark`, { status: 'ATTENDED' }).expect(200);
      expect(await sessionsLeft(pelin)).toBe(9);

      expect((await post(trainer, 'lessons', { kind: 'GROUP', title: 'Grup', trainerId: trainer.user.id, date: today(), startTime: '20:00', durationMin: 60, capacity: 5 }).expect(403)).body.code).toBe('GYM_FORBIDDEN');
      await post(trainer, 'lessons', { kind: 'PRIVATE', trainerId: owner.user.id, memberId: pelin, date: today(), startTime: '20:00', durationMin: 60 }).expect(403);

      // Sahibin dersi: eğitmen katılım işaretleyemez
      const ownerLesson = await post(owner, 'lessons', { kind: 'PRIVATE', trainerId: owner.user.id, memberId: pelin, date: today(), startTime: '08:00', durationMin: 45 }).expect(201);
      const od = (await get(trainer, `lessons/${ownerLesson.body.lessons[0].id}`).expect(200)).body;
      expect(od.canManage).toBe(false);
      await post(trainer, `bookings/${od.bookings[0].id}/mark`, { status: 'ATTENDED' }).expect(403);

      // Resepsiyon ders veremez
      expect((await post(reception, 'lessons', { kind: 'PRIVATE', trainerId: reception.user.id, memberId: pelin, date: today(), startTime: '10:00', durationMin: 60 }).expect(400)).body.code).toBe('TRAINER_NOT_FOUND');
    });

    it('başka salon dersleri göremez ve değiştiremez', async () => {
      const { reception, trainer, ali } = await setup();
      const lesson = await post(reception, 'lessons', { kind: 'GROUP', title: 'Spin', trainerId: trainer.user.id, date: today(), startTime: '12:00', durationMin: 45, capacity: 8 }).expect(201);
      const other = (await registerApprovedProfessional(app, 'GYM_OWNER')) as Token;
      await get(other, `lessons/${lesson.body.lessons[0].id}`).expect(404);
      await post(other, `lessons/${lesson.body.lessons[0].id}/bookings`, { memberId: ali }).expect(404);
      expect((await get(other, `lessons?from=${today()}&to=${today()}`).expect(200)).body).toHaveLength(0);
      await post(other, `lessons/${lesson.body.lessons[0].id}/cancel`, { reason: 'deneme' }).expect(404);
    });

    it('geçersiz girdiler reddedilir', async () => {
      const { reception, trainer } = await setup();
      const base = { kind: 'GROUP', title: 'X ders', trainerId: trainer.user.id, date: today(), startTime: '10:00', durationMin: 60, capacity: 5 };
      await post(reception, 'lessons', { ...base, startTime: '25:00' }).expect(400);
      await post(reception, 'lessons', { ...base, startTime: '23:30' }).expect(400);
      await post(reception, 'lessons', { ...base, capacity: undefined }).expect(400);
      await post(reception, 'lessons', { ...base, date: dayOffset(-5) }).expect(400);
      await post(reception, 'lessons', { ...base, repeatWeeks: 20 }).expect(400);
      await post(reception, 'lessons', { kind: 'PRIVATE', trainerId: trainer.user.id, date: today(), startTime: '10:00', durationMin: 60 }).expect(400);
      await get(reception, `lessons?from=${today()}&to=${dayOffset(60)}`).expect(400);
    });
  });

  describe('görevler ve vardiyalar', () => {
    it('sahip görev atar, görevli tamamlar; başkası atayamaz ve başkasının görevini kapatamaz', async () => {
      const { owner, reception, trainer } = await setup();
      await http().post('/api/notifications/read').set(bearer(trainer.accessToken)).send({}).expect(200);
      const task = (await post(owner, 'tasks', { title: 'Ekipman bakımı', assigneeId: trainer.user.id, dueDate: today() }).expect(201)).body;
      const n = (await http().get('/api/notifications').set(bearer(trainer.accessToken)).expect(200)).body.items;
      expect(n[0]).toMatchObject({ type: 'gym_task_assigned', title: 'Yeni görev' });

      expect((await get(trainer, 'tasks').expect(200)).body).toHaveLength(1);
      expect((await get(reception, 'tasks').expect(200)).body).toHaveLength(0);
      expect((await post(reception, 'tasks', { title: 'Deneme', assigneeId: trainer.user.id }).expect(403)).body.code).toBe('GYM_FORBIDDEN');
      await post(reception, `tasks/${task.id}/done`, { done: true }).expect(403);

      await post(trainer, `tasks/${task.id}/done`, { done: true }).expect(200);
      expect((await get(owner, 'tasks?status=done').expect(200)).body[0]).toMatchObject({ title: 'Ekipman bakımı', done: true, assignee: { id: trainer.user.id } });
      await post(trainer, `tasks/${task.id}/done`, { done: false }).expect(200);
      expect((await get(owner, 'tasks').expect(200)).body[0].done).toBe(false);

      const outsider = (await registerUser(app)) as Token;
      expect((await post(owner, 'tasks', { title: 'Dışarıya', assigneeId: outsider.user.id }).expect(400)).body.code).toBe('ASSIGNEE_NOT_FOUND');
      await http().delete(`/api/gym/tasks/${task.id}`).set(bearer(owner.accessToken)).expect(200);
      expect((await get(owner, 'tasks?status=all').expect(200)).body).toHaveLength(0);
    });

    it('vardiyayı sahip yazar, ekip görür; ekipten çıkanın vardiyası silinir', async () => {
      const { owner, trainer } = await setup();
      await put(owner, `shifts/${trainer.user.id}/0`, { shift: { start: '08:00', end: '16:00' } }).expect(200);
      await put(owner, `shifts/${trainer.user.id}/2`, { shift: { start: '12:00', end: '20:00' } }).expect(200);
      await put(owner, `shifts/${trainer.user.id}/2`, { shift: null }).expect(200);
      expect((await put(owner, `shifts/${trainer.user.id}/1`, { shift: { start: '16:00', end: '08:00' } }).expect(400)).body.code).toBe('INVALID_TIME');
      expect((await put(owner, `shifts/${trainer.user.id}/7`, { shift: null }).expect(400)).body.code).toBe('INVALID_WEEKDAY');
      expect((await put(trainer, `shifts/${trainer.user.id}/1`, { shift: { start: '08:00', end: '12:00' } }).expect(403)).body.code).toBe('GYM_FORBIDDEN');

      const shifts = (await get(trainer, 'shifts').expect(200)).body as { user: { id: string }; role: string; days: unknown[] }[];
      const row = shifts.find((s) => s.user.id === trainer.user.id)!;
      expect(row.role).toBe('TRAINER');
      expect(row.days[0]).toEqual({ start: '08:00', end: '16:00' });
      expect(row.days[2]).toBeNull();
      expect(shifts[0]!.role).toBe('OWNER');

      const staffId = (await get(owner, 'staff').expect(200)).body.find((s: { user: { id: string } }) => s.user.id === trainer.user.id).id;
      await post(owner, `staff/${staffId}/end`).expect(200);
      expect(await prisma.gymShift.count({ where: { userId: trainer.user.id } })).toBe(0);
    });
  });
});
