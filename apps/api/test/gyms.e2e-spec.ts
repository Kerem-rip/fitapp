import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types.js';
import { bearer, cleanupTestData, createTestApp, registerApprovedProfessional, registerUser } from './helpers.js';

describe('Spor salonu: ekip, üyelik ve ödeme kayıtları (e2e)', () => {
  let app: INestApplication<App>;
  const http = () => request(app.getHttpServer());
  const today = () => dayOffset(0);
  // Salon günleri Türkiye saatine göredir (UTC+3)
  const dayOffset = (n: number) => new Date(Date.now() + 3 * 3_600_000 + n * 86_400_000).toISOString().slice(0, 10);

  beforeAll(async () => {
    app = await createTestApp();
  });

  afterAll(async () => {
    await cleanupTestData(app);
    await app.close();
  });

  type Token = { accessToken: string };
  const get = (t: Token, path: string) => http().get(`/api/gym/${path}`).set(bearer(t.accessToken));
  const post = (t: Token, path: string, body: Record<string, unknown> = {}) => http().post(`/api/gym/${path}`).set(bearer(t.accessToken)).send(body);
  const patch = (t: Token, path: string, body: Record<string, unknown>) => http().patch(`/api/gym/${path}`).set(bearer(t.accessToken)).send(body);

  // Onaylı salon sahibi + aktif resepsiyon + aktif salon eğitmeni + bir paket
  async function setup() {
    const owner = await registerApprovedProfessional(app, 'GYM_OWNER');
    const reception = await registerUser(app);
    const trainer = await registerUser(app);
    for (const [u, role] of [[reception, 'RECEPTION'], [trainer, 'TRAINER']] as const) {
      await post(owner, 'staff/invite', { username: u.body.username, role }).expect(201);
      const invites = await http().get('/api/me/gym-invites').set(bearer(u.accessToken)).expect(200);
      await http().post(`/api/me/gym-invites/${invites.body[0].id}/accept`).set(bearer(u.accessToken)).expect(200);
    }
    const plan = (await post(owner, 'plans', { name: '1 aylık', durationDays: 30, priceKurus: 150_000 }).expect(201)).body as { id: string };
    return { owner, reception, trainer, plan };
  }

  describe('salon ve ekip', () => {
    it('onaylı salon sahibinin salonu başvurusundaki bilgilerle açılır; görevi ve yetkileri gelir', async () => {
      const owner = await registerApprovedProfessional(app, 'GYM_OWNER');
      const me = await get(owner, 'me').expect(200);
      expect(me.body.gym).toMatchObject({ name: 'Test Salon', city: 'İzmir' });
      expect(me.body.role).toBe('OWNER');
      expect(me.body.permissions).toHaveLength(15);
      const profile = await http().get('/api/users/me').set(bearer(owner.accessToken)).expect(200);
      expect(profile.body.gym).toMatchObject({ name: 'Test Salon', role: 'OWNER' });

      const user = await registerUser(app);
      expect((await get(user, 'me').expect(404)).body.code).toBe('NO_GYM');
    });

    it('davet bildirim olarak gider; kabul edince kişi ekibe ve personel rolüne geçer; rozet bilgisi gelir', async () => {
      const owner = await registerApprovedProfessional(app, 'GYM_OWNER');
      const user = await registerUser(app);
      await post(owner, 'staff/invite', { username: user.body.username, role: 'TRAINER' }).expect(201);
      expect((await post(owner, 'staff/invite', { username: user.body.username, role: 'TRAINER' }).expect(409)).body.code).toBe('ALREADY_INVITED');
      expect((await post(owner, 'staff/invite', { username: 'yok_boyle', role: 'TRAINER' }).expect(404)).body.code).toBe('USER_NOT_FOUND');

      const n = (await http().get('/api/notifications').set(bearer(user.accessToken)).expect(200)).body.items;
      expect(n[0]).toMatchObject({ type: 'gym_invite', title: 'Salon ekibine davet' });
      expect(n[0].text).toContain('Test Salon');

      const invite = (await http().get('/api/me/gym-invites').set(bearer(user.accessToken)).expect(200)).body[0];
      await http().post(`/api/me/gym-invites/${invite.id}/accept`).set(bearer(user.accessToken)).expect(200);
      const profile = (await http().get('/api/users/me').set(bearer(user.accessToken)).expect(200)).body;
      expect(profile.roles).toContain('GYM_STAFF');
      expect(profile.gym).toMatchObject({ name: 'Test Salon', role: 'TRAINER' });

      const staff = (await get(owner, 'staff').expect(200)).body;
      expect(staff[0]).toMatchObject({ role: 'TRAINER', status: 'ACTIVE' });

      // İkinci salonun davetini kabul edemez
      const other = await registerApprovedProfessional(app, 'GYM_OWNER');
      await post(other, 'staff/invite', { username: user.body.username, role: 'RECEPTION' }).expect(201);
      const second = (await http().get('/api/me/gym-invites').set(bearer(user.accessToken)).expect(200)).body[0];
      expect((await http().post(`/api/me/gym-invites/${second.id}/accept`).set(bearer(user.accessToken)).expect(409)).body.code).toBe('ALREADY_STAFF');
    });

    it('ekipten çıkarılan kişinin rolü ve erişimi kalkar; personel kendisi ayrılabilir', async () => {
      const { owner, reception, trainer } = await setup();
      const staff = (await get(owner, 'staff').expect(200)).body as { id: string; user: { id: string } }[];
      const rec = staff.find((s) => s.user.id === reception.user.id)!;
      await post(owner, `staff/${rec.id}/end`).expect(200);
      expect((await http().get('/api/users/me').set(bearer(reception.accessToken)).expect(200)).body.roles).not.toContain('GYM_STAFF');
      await get(reception, 'members').expect(404);

      await http().post('/api/me/gym-invites/leave').set(bearer(trainer.accessToken)).expect(200);
      await get(trainer, 'members').expect(404);
    });
  });

  describe('görev bazlı yetki', () => {
    it('resepsiyon üye, üyelik ve ödeme kaydı yapar; ödeme iptali, paket, rapor ve ekip yönetimi yapamaz', async () => {
      const { reception, plan } = await setup();
      const member = (await post(reception, 'members', { fullName: 'Ali Veli', phone: '05551112233' }).expect(201)).body as { id: string };
      await post(reception, `members/${member.id}/memberships`, { planId: plan.id }).expect(201);
      const payment = (await post(reception, `members/${member.id}/payments`, { amountKurus: 50_000, method: 'CASH' }).expect(201)).body as { id: string };

      for (const req of [
        post(reception, `payments/${payment.id}/void`, { reason: 'Hatalı' }),
        post(reception, 'plans', { name: 'Yeni paket', durationDays: 30, priceKurus: 1 }),
        get(reception, `reports/payments?from=${today()}&to=${today()}`),
        post(reception, 'staff/invite', { username: 'biri', role: 'TRAINER' }),
      ]) {
        expect((await req.expect(403)).body.code).toBe('GYM_FORBIDDEN');
      }
    });

    it('salon eğitmeni üyeleri adıyla ve üyelik durumuyla görür; telefon ve para bilgisini görmez, üye ekleyemez', async () => {
      const { owner, trainer, plan } = await setup();
      const member = (await post(owner, 'members', { fullName: 'Ayla Demir', phone: '05550000000', note: 'Bel fıtığı geçmişi' }).expect(201)).body as { id: string };
      await post(owner, `members/${member.id}/memberships`, { planId: plan.id }).expect(201);
      await post(owner, `members/${member.id}/payments`, { amountKurus: 100_000, method: 'CARD' }).expect(201);

      const list = (await get(trainer, 'members').expect(200)).body;
      expect(list[0].fullName).toBe('Ayla Demir');
      expect(list[0].current.state).toBe('ACTIVE');
      expect(list[0].phone).toBeUndefined();
      expect(list[0].balanceKurus).toBeUndefined();
      const detail = (await get(trainer, `members/${member.id}`).expect(200)).body;
      expect(detail.member.phone).toBeUndefined();
      expect(detail.member.note).toBeUndefined();
      expect(detail.payments).toBeUndefined();
      expect((await post(trainer, 'members', { fullName: 'X Y' }).expect(403)).body.code).toBe('GYM_FORBIDDEN');
    });

    it('başka salonun üyesine erişilemez', async () => {
      const a = await setup();
      const b = await registerApprovedProfessional(app, 'GYM_OWNER');
      const member = (await post(a.owner, 'members', { fullName: 'Gizli Üye' }).expect(201)).body as { id: string };
      await get(b, `members/${member.id}`).expect(404);
      await post(b, `members/${member.id}/payments`, { amountKurus: 1, method: 'CASH' }).expect(404);
    });
  });

  describe('üyelik ve ödeme kayıtları', () => {
    it('üyelik paketten oluşur: bitiş tarihi hesaplanır, fiyat satışta değiştirilebilir, paket bilgisi kopyalanır', async () => {
      const { owner, plan } = await setup();
      const member = (await post(owner, 'members', { fullName: 'Can Er' }).expect(201)).body as { id: string };
      const m = (await post(owner, `members/${member.id}/memberships`, { planId: plan.id, startDate: '2026-11-01', priceKurus: 120_000 }).expect(201)).body;
      expect(m).toMatchObject({ planName: '1 aylık', startDate: '2026-11-01', endDate: '2026-11-30', priceKurus: 120_000 });

      // Paketin fiyatı/adı değişse de satılmış üyelik değişmez; satıştan kalkan paket satılamaz
      await patch(owner, `plans/${plan.id}`, { name: 'Aylık', priceKurus: 200_000, active: false }).expect(200);
      const detail = (await get(owner, `members/${member.id}`).expect(200)).body;
      expect(detail.memberships[0]).toMatchObject({ planName: '1 aylık', priceKurus: 120_000 });
      expect((await post(owner, `members/${member.id}/memberships`, { planId: plan.id }).expect(404)).body.code).toBe('PLAN_NOT_FOUND');
      expect((await get(owner, 'plans').expect(200)).body).toHaveLength(0);
      expect((await get(owner, 'plans?all=true').expect(200)).body).toHaveLength(1);
    });

    it('bakiye: ödeme düşer; iptal edilen ödeme ve üyelik bakiyeye girmez; ödeme silinmez, gerekçeyle iptal edilir', async () => {
      const { owner, reception, plan } = await setup();
      const member = (await post(reception, 'members', { fullName: 'Deniz Su' }).expect(201)).body as { id: string };
      const m = (await post(reception, `members/${member.id}/memberships`, { planId: plan.id }).expect(201)).body as { id: string };
      const p = (await post(reception, `members/${member.id}/payments`, { amountKurus: 100_000, method: 'CASH', membershipId: m.id }).expect(201)).body as { id: string };

      let detail = (await get(owner, `members/${member.id}`).expect(200)).body;
      expect(detail.balance).toEqual({ chargedKurus: 150_000, paidKurus: 100_000, balanceKurus: 50_000 });
      expect(detail.memberships[0].dueKurus).toBe(50_000);

      await post(owner, `payments/${p.id}/void`, { reason: 'Yanlış tutar girildi' }).expect(200);
      expect((await post(owner, `payments/${p.id}/void`, { reason: 'tekrar' }).expect(409)).body.code).toBe('ALREADY_VOIDED');
      detail = (await get(owner, `members/${member.id}`).expect(200)).body;
      expect(detail.balance.balanceKurus).toBe(150_000);
      expect(detail.payments[0]).toMatchObject({ voidReason: 'Yanlış tutar girildi' });

      await post(owner, `memberships/${m.id}/cancel`, { reason: 'Üye vazgeçti' }).expect(200);
      expect((await get(owner, `members/${member.id}`).expect(200)).body.balance.balanceKurus).toBe(0);
    });

    it('geçersiz ödeme ve üyelik istekleri reddedilir', async () => {
      const { owner, plan } = await setup();
      const a = (await post(owner, 'members', { fullName: 'Üye A' }).expect(201)).body as { id: string };
      const b = (await post(owner, 'members', { fullName: 'Üye B' }).expect(201)).body as { id: string };
      const mb = (await post(owner, `members/${b.id}/memberships`, { planId: plan.id }).expect(201)).body as { id: string };
      expect((await post(owner, `members/${a.id}/payments`, { amountKurus: 100, method: 'CASH', membershipId: mb.id }).expect(400)).body.code).toBe('MEMBERSHIP_NOT_FOUND');
      await post(owner, `members/${a.id}/payments`, { amountKurus: 0, method: 'CASH' }).expect(400);
      await post(owner, `members/${a.id}/payments`, { amountKurus: 100, method: 'BITCOIN' }).expect(400);
      expect((await post(owner, `members/${a.id}/payments`, { amountKurus: 100, method: 'CASH', paidAt: new Date(Date.now() + 86_400_000).toISOString() }).expect(400)).body.code).toBe('INVALID_DATE');
      expect((await post(owner, `memberships/${mb.id}/cancel`, { reason: 'x' }).expect(400)).status).toBe(400);
      await patch(owner, `members/${a.id}`, { status: 'ARCHIVED' }).expect(200);
      expect((await post(owner, `members/${a.id}/memberships`, { planId: plan.id }).expect(409)).body.code).toBe('MEMBER_ARCHIVED');
    });
  });

  describe('bugün paneli ve rapor', () => {
    it('bitmek üzere olan ve yeni biten üyelikler; yenilenen üye listeden düşer; borçlular ve günün tahsilatı', async () => {
      const { owner, reception, trainer } = await setup();
      const short = (await post(owner, 'plans', { name: '3 günlük', durationDays: 3, priceKurus: 30_000 }).expect(201)).body as { id: string };
      const monthly = (await get(owner, 'plans').expect(200)).body.find((p: { name: string }) => p.name === '1 aylık') as { id: string };

      const soon = (await post(owner, 'members', { fullName: 'Bitiyor Üye' }).expect(201)).body as { id: string };
      await post(owner, `members/${soon.id}/memberships`, { planId: short.id }).expect(201);
      const ended = (await post(owner, 'members', { fullName: 'Bitti Üye' }).expect(201)).body as { id: string };
      await post(owner, `members/${ended.id}/memberships`, { planId: short.id, startDate: dayOffset(-5) }).expect(201);
      const renewed = (await post(owner, 'members', { fullName: 'Yeniledi Üye' }).expect(201)).body as { id: string };
      await post(owner, `members/${renewed.id}/memberships`, { planId: short.id }).expect(201);
      await post(owner, `members/${renewed.id}/memberships`, { planId: monthly.id, startDate: dayOffset(3) }).expect(201);
      await post(reception, `members/${renewed.id}/payments`, { amountKurus: 30_000, method: 'CARD' }).expect(201);

      const panel = (await get(owner, 'today').expect(200)).body;
      expect(panel.expiring.map((e: { fullName: string }) => e.fullName)).toEqual(['Bitiyor Üye']);
      expect(panel.expiring[0].daysLeft).toBe(2);
      expect(panel.expired.map((e: { fullName: string }) => e.fullName)).toEqual(['Bitti Üye']);
      expect(panel.todayCollections).toMatchObject({ totalKurus: 30_000, count: 1, byMethod: { CARD: 30_000 } });
      expect(panel.debts.find((d: { fullName: string }) => d.fullName === 'Yeniledi Üye').balanceKurus).toBe(150_000);
      expect(panel.activeMembers).toBe(3);
      expect(panel.staffCount).toBe(2);

      const trainerPanel = (await get(trainer, 'today').expect(200)).body;
      expect(trainerPanel.expiring).toHaveLength(1);
      expect(trainerPanel.todayCollections).toBeUndefined();
      expect(trainerPanel.debts).toBeUndefined();
    });

    it('tahsilat raporu gün ve yönteme göre; iptal edilen ödemeler sayılmaz', async () => {
      const { owner, plan } = await setup();
      const m = (await post(owner, 'members', { fullName: 'Rapor Üye' }).expect(201)).body as { id: string };
      await post(owner, `members/${m.id}/memberships`, { planId: plan.id }).expect(201);
      await post(owner, `members/${m.id}/payments`, { amountKurus: 40_000, method: 'CASH', paidAt: new Date(Date.now() - 86_400_000).toISOString() }).expect(201);
      await post(owner, `members/${m.id}/payments`, { amountKurus: 60_000, method: 'TRANSFER' }).expect(201);
      const voided = (await post(owner, `members/${m.id}/payments`, { amountKurus: 99_000, method: 'CARD' }).expect(201)).body as { id: string };
      await post(owner, `payments/${voided.id}/void`, { reason: 'Yanlış kayıt' }).expect(200);

      const report = (await get(owner, `reports/payments?from=${dayOffset(-1)}&to=${today()}`).expect(200)).body;
      expect(report.total).toMatchObject({ totalKurus: 100_000, count: 2 });
      expect(report.days.map((d: { day: string; totalKurus: number }) => d.totalKurus)).toEqual([40_000, 60_000]);
      expect((await get(owner, `reports/payments?from=${today()}&to=${dayOffset(-3)}`).expect(400)).body.code).toBe('INVALID_RANGE');
    });
  });

  it('giriş yapmadan hiçbir adres açılmaz', async () => {
    await http().get('/api/gym/me').expect(401);
    await http().get('/api/gym/members').expect(401);
    await http().get('/api/me/gym-invites').expect(401);
  });
});
