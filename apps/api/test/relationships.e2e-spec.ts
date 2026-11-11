import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types.js';
import { PrismaService } from '../src/common/prisma/prisma.service.js';
import { AccessService } from '../src/modules/relationships/access.service.js';
import {
  bearer,
  birthDateForAge,
  cleanupTestData,
  createTestApp,
  registerApprovedProfessional,
  registerProfessional,
  registerUser,
} from './helpers.js';

describe('Danışanlık, paylaşım ve erişim kaydı (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let access: AccessService;
  const http = () => request(app.getHttpServer());

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
    access = app.get(AccessService);
  });

  afterAll(async () => {
    await cleanupTestData(app);
    await app.close();
  });

  const offer = (token: string, username: string) =>
    http().post('/api/relationships/offer').set(bearer(token)).send({ username });

  // Danışan (sağlık verisi rızası verilmiş) ve onaylı diyetisyen; teklif kabul edilmiş, MEALS + WEIGHT paylaşılıyor
  async function activeRelationship(sharedData: string[] = ['MEALS', 'WEIGHT'], sharedUntil: string | null = null) {
    const pro = await registerApprovedProfessional(app);
    const client = await registerUser(app, { healthDataConsent: true });
    const sent = await offer(pro.accessToken, client.body.username as string).expect(201);
    const id = sent.body.id as string;
    await http().post(`/api/relationships/${id}/accept`).set(bearer(client.accessToken)).send({ sharedData, sharedUntil }).expect(200);
    return { pro, client, id };
  }

  const auditOf = (clientId: string, action: string) => prisma.auditLog.findMany({ where: { targetUserId: clientId, action } });

  describe('teklif', () => {
    it('onaysız profesyonel ve normal kullanıcı teklif gönderemez', async () => {
      const pending = await registerProfessional(app);
      const client = await registerUser(app);
      const stranger = await registerUser(app);
      const a = await offer(pending.accessToken, client.body.username as string).expect(403);
      expect(a.body.code).toBe('NOT_A_PROFESSIONAL');
      const b = await offer(stranger.accessToken, client.body.username as string).expect(403);
      expect(b.body.code).toBe('NOT_A_PROFESSIONAL');
    });

    it('teklif danışana bildirim olarak gider ve iki tarafta da görünür', async () => {
      const pro = await registerApprovedProfessional(app);
      const client = await registerUser(app);
      const res = await offer(pro.accessToken, (client.body.username as string).toUpperCase()).expect(201);
      expect(res.body.status).toBe('OFFERED');

      const asClient = await http().get('/api/relationships/as-client').set(bearer(client.accessToken)).expect(200);
      expect(asClient.body).toHaveLength(1);
      expect(asClient.body[0].professional.title).toBe('Diyetisyen');
      expect(asClient.body[0].sharedData).toEqual([]);

      const asPro = await http()
        .get('/api/relationships/as-professional?status=OFFERED')
        .set(bearer(pro.accessToken))
        .expect(200);
      expect(asPro.body).toHaveLength(1);
      expect(asPro.body[0].client.username).toBe(client.body.username);

      const notifications = await prisma.notification.findMany({ where: { userId: client.user.id, type: 'client_offer' } });
      expect(notifications).toHaveLength(1);
      expect(await auditOf(client.user.id, 'OFFER_SENT')).toHaveLength(1);
    });

    it('olmayan kullanıcı, kendisi ve engelleyen kullanıcı bulunamadı döner; aynı kişiye ikinci teklif reddedilir', async () => {
      const pro = await registerApprovedProfessional(app);
      const client = await registerUser(app);
      const blocker = await registerUser(app);

      expect((await offer(pro.accessToken, 'yok_boyle_biri').expect(404)).body.code).toBe('USER_NOT_FOUND');
      expect((await offer(pro.accessToken, pro.body.username as string).expect(404)).body.code).toBe('USER_NOT_FOUND');

      await prisma.block.create({ data: { blockerId: blocker.user.id, blockedId: pro.user.id } });
      expect((await offer(pro.accessToken, blocker.body.username as string).expect(404)).body.code).toBe('USER_NOT_FOUND');

      await offer(pro.accessToken, client.body.username as string).expect(201);
      expect((await offer(pro.accessToken, client.body.username as string).expect(409)).body.code).toBe('ALREADY_RELATED');
    });

    it('18 yaş altına veli onayı olmadan teklif gidemez; onayla gider ama sağlık verisi paylaşılamaz', async () => {
      const pro = await registerApprovedProfessional(app);
      const teen = await registerUser(app, { birthDate: birthDateForAge(15) });
      const denied = await offer(pro.accessToken, teen.body.username as string).expect(403);
      expect(denied.body.code).toBe('PARENTAL_CONSENT_REQUIRED');

      await prisma.parentalConsent.create({
        data: { userId: teen.user.id, parentEmail: 'veli@e2e.test', scope: 'contact_professionals', token: `t-${teen.user.id}`, approvedAt: new Date() },
      });
      const sent = await offer(pro.accessToken, teen.body.username as string).expect(201);
      const id = sent.body.id as string;

      const withData = await http()
        .post(`/api/relationships/${id}/accept`)
        .set(bearer(teen.accessToken))
        .send({ sharedData: ['WEIGHT'] })
        .expect(403);
      expect(withData.body.code).toBe('PARENTAL_CONSENT_REQUIRED');
      await http().post(`/api/relationships/${id}/accept`).set(bearer(teen.accessToken)).send({ sharedData: [] }).expect(200);
    });
  });

  describe('kabul ve paylaşım', () => {
    it('sağlık verisi rızası yoksa veri paylaşılamaz; verisiz kabul edilebilir', async () => {
      const pro = await registerApprovedProfessional(app);
      const client = await registerUser(app);
      const id = (await offer(pro.accessToken, client.body.username as string).expect(201)).body.id as string;

      const res = await http()
        .post(`/api/relationships/${id}/accept`)
        .set(bearer(client.accessToken))
        .send({ sharedData: ['WEIGHT'] })
        .expect(403);
      expect(res.body.code).toBe('HEALTH_CONSENT_REQUIRED');

      const ok = await http().post(`/api/relationships/${id}/accept`).set(bearer(client.accessToken)).send({}).expect(200);
      expect(ok.body.status).toBe('ACTIVE');
      expect(ok.body.sharedData).toEqual([]);
    });

    it('başkasının teklifini kabul edemez; kabul edilmiş teklifi tekrar kabul edemez', async () => {
      const pro = await registerApprovedProfessional(app);
      const client = await registerUser(app, { healthDataConsent: true });
      const other = await registerUser(app);
      const id = (await offer(pro.accessToken, client.body.username as string).expect(201)).body.id as string;

      await http().post(`/api/relationships/${id}/accept`).set(bearer(other.accessToken)).send({}).expect(404);
      await http().post(`/api/relationships/${id}/accept`).set(bearer(client.accessToken)).send({ sharedData: ['MEALS'] }).expect(200);
      const again = await http().post(`/api/relationships/${id}/accept`).set(bearer(client.accessToken)).send({}).expect(409);
      expect(again.body.code).toBe('NOT_PENDING');
    });

    it('paylaşım süresi geçmişte veya 2 yıldan uzun olamaz', async () => {
      const pro = await registerApprovedProfessional(app);
      const client = await registerUser(app, { healthDataConsent: true });
      const id = (await offer(pro.accessToken, client.body.username as string).expect(201)).body.id as string;
      const accept = (sharedUntil: string) =>
        http().post(`/api/relationships/${id}/accept`).set(bearer(client.accessToken)).send({ sharedData: ['MEALS'], sharedUntil });

      const day = 86_400_000;
      expect((await accept(new Date(Date.now() - day).toISOString()).expect(400)).body.code).toBe('INVALID_SHARE_UNTIL');
      expect((await accept(new Date(Date.now() + 800 * day).toISOString()).expect(400)).body.code).toBe('INVALID_SHARE_UNTIL');
      await accept(new Date(Date.now() + 30 * day).toISOString()).expect(200);
    });

    it('teklif reddedilir; profesyonel bildirim alır ve teklif listeden düşer', async () => {
      const pro = await registerApprovedProfessional(app);
      const client = await registerUser(app);
      const id = (await offer(pro.accessToken, client.body.username as string).expect(201)).body.id as string;
      await http().post(`/api/relationships/${id}/decline`).set(bearer(client.accessToken)).expect(200);

      const asClient = await http().get('/api/relationships/as-client').set(bearer(client.accessToken)).expect(200);
      expect(asClient.body).toHaveLength(0);
      expect(await prisma.notification.count({ where: { userId: pro.user.id, type: 'client_declined' } })).toBe(1);
      // Reddedildikten sonra aynı kişiye yeniden teklif edilebilir
      await offer(pro.accessToken, client.body.username as string).expect(201);
    });

    it('danışan paylaşımı değiştirir ve her değişiklik kayda geçer', async () => {
      const { client, id } = await activeRelationship();
      const res = await http()
        .patch(`/api/relationships/${id}/sharing`)
        .set(bearer(client.accessToken))
        .send({ sharedData: ['MEALS', 'MEASUREMENTS', 'ANAMNESIS'] })
        .expect(200);
      expect(res.body.sharedData).toEqual(['MEALS', 'MEASUREMENTS', 'ANAMNESIS']);

      const entries = await auditOf(client.user.id, 'SHARING_CHANGED');
      expect(entries).toHaveLength(1);
      expect(entries[0]!.meta).toMatchObject({ before: ['MEALS', 'WEIGHT'], after: ['MEALS', 'MEASUREMENTS', 'ANAMNESIS'] });
    });
  });

  describe('erişim kapısı', () => {
    it('paylaşılan veriye erişilir ve kaydedilir; paylaşılmayan veri reddedilir ve o da kaydedilir', async () => {
      const { pro, client } = await activeRelationship();
      await access.requireAccess(pro.user.id, client.user.id, 'WEIGHT');
      expect(await auditOf(client.user.id, 'DATA_VIEWED')).toHaveLength(1);

      await expect(access.requireAccess(pro.user.id, client.user.id, 'MEASUREMENTS')).rejects.toMatchObject({
        response: { code: 'NO_ACCESS' },
      });
      const denied = await auditOf(client.user.id, 'ACCESS_DENIED');
      expect(denied).toHaveLength(1);
      expect(denied[0]).toMatchObject({ category: 'MEASUREMENTS', meta: { reason: 'NOT_SHARED' } });
    });

    it('danışanlığı olmayan biri erişemez ve danışanın kaydına iz düşmez', async () => {
      const stranger = await registerApprovedProfessional(app);
      const client = await registerUser(app, { healthDataConsent: true });
      await expect(access.requireAccess(stranger.user.id, client.user.id, 'WEIGHT')).rejects.toMatchObject({
        response: { code: 'NO_ACCESS' },
      });
      expect(await prisma.auditLog.count({ where: { targetUserId: client.user.id } })).toBe(0);
    });

    it('süre dolunca ve rıza geri çekilince erişim kapanır', async () => {
      const { pro, client, id } = await activeRelationship();
      await access.requireAccess(pro.user.id, client.user.id, 'MEALS');

      await prisma.clientRelationship.update({ where: { id }, data: { sharedUntil: new Date(Date.now() - 1000) } });
      expect(await access.check(pro.user.id, client.user.id, 'MEALS')).toMatchObject({ reason: 'SHARING_EXPIRED' });
      const list = await http().get('/api/relationships/as-professional').set(bearer(pro.accessToken)).expect(200);
      expect(list.body[0].sharingExpired).toBe(true);

      await prisma.clientRelationship.update({ where: { id }, data: { sharedUntil: null } });
      expect(await access.check(pro.user.id, client.user.id, 'MEALS')).toMatchObject({ reason: null });
      await http().delete('/api/consents/health_data').set(bearer(client.accessToken)).expect(200);
      expect(await access.check(pro.user.id, client.user.id, 'MEALS')).toMatchObject({ reason: 'CONSENT_REVOKED' });
    });

    it('danışan danışanlığı bitirince erişim anında kapanır; profesyonel de bitirebilir; üçüncü kişi bitiremez', async () => {
      const { pro, client, id } = await activeRelationship();
      const outsider = await registerUser(app);
      await http().post(`/api/relationships/${id}/end`).set(bearer(outsider.accessToken)).expect(404);

      await http().post(`/api/relationships/${id}/end`).set(bearer(client.accessToken)).expect(200);
      expect(await access.check(pro.user.id, client.user.id, 'MEALS')).toMatchObject({ reason: 'NO_RELATIONSHIP' });
      expect((await http().post(`/api/relationships/${id}/end`).set(bearer(client.accessToken)).expect(409)).body.code).toBe('ALREADY_ENDED');
      expect(await prisma.notification.count({ where: { userId: pro.user.id, type: 'relationship_ended' } })).toBe(1);

      const second = await activeRelationship();
      await http().post(`/api/relationships/${second.id}/end`).set(bearer(second.pro.accessToken)).expect(200);
      expect(await prisma.notification.count({ where: { userId: second.client.user.id, type: 'relationship_ended' } })).toBe(1);
    });
  });

  describe('erişim kaydı', () => {
    it('danışan kendi verisine kimin ne yaptığını görür; profesyonel başkasının kaydını göremez', async () => {
      const { pro, client } = await activeRelationship();
      await access.requireAccess(pro.user.id, client.user.id, 'WEIGHT');

      const res = await http().get('/api/relationships/audit').set(bearer(client.accessToken)).expect(200);
      const actions = (res.body as { action: string }[]).map((e) => e.action);
      expect(actions).toEqual(expect.arrayContaining(['OFFER_SENT', 'OFFER_ACCEPTED', 'DATA_VIEWED']));
      const viewed = (res.body as { action: string; category: string; actor: { username: string } }[]).find((e) => e.action === 'DATA_VIEWED')!;
      expect(viewed.category).toBe('WEIGHT');
      expect(viewed.actor.username).toBe(pro.body.username);

      const proView = await http().get('/api/relationships/audit').set(bearer(pro.accessToken)).expect(200);
      expect(proView.body).toEqual([]);
    });

    it('limit ve sayfalama çalışır', async () => {
      const { pro, client } = await activeRelationship();
      for (let i = 0; i < 3; i++) await access.requireAccess(pro.user.id, client.user.id, 'MEALS');
      const first = await http().get('/api/relationships/audit?limit=2').set(bearer(client.accessToken)).expect(200);
      expect(first.body).toHaveLength(2);
      const before = first.body[1].createdAt as string;
      const next = await http().get(`/api/relationships/audit?limit=50&before=${encodeURIComponent(before)}`).set(bearer(client.accessToken)).expect(200);
      expect((next.body as { createdAt: string }[]).every((e) => e.createdAt < before)).toBe(true);
    });
  });

  it('giriş yapmadan hiçbir adres açılmaz', async () => {
    await http().get('/api/relationships/as-client').expect(401);
    await http().post('/api/relationships/offer').send({ username: 'biri' }).expect(401);
    await http().get('/api/relationships/audit').expect(401);
  });
});
