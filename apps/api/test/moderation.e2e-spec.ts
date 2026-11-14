import { randomBytes } from 'node:crypto';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types.js';
import { hashPassword } from '../src/common/password.js';
import { PrismaService } from '../src/common/prisma/prisma.service.js';
import { bearer, cleanupTestData, createAdminAndLogin, createTestApp, registerUser, TEST_PASSWORD } from './helpers.js';

describe('Moderasyon ve oturumlar (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  const http = () => request(app.getHttpServer());
  type Token = { accessToken: string; body: { username: string; email?: string }; user: { id: string } };

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
  });

  afterAll(async () => {
    await prisma.moderationAction.deleteMany({ where: { note: { startsWith: 'e2e' } } });
    await cleanupTestData(app);
    await app.close();
  });

  const user = async (sports: string[] = []) => {
    const t = (await registerUser(app)) as Token;
    await http().patch('/api/users/me').set(bearer(t.accessToken)).send({ isPrivate: false, sports }).expect(200);
    return t;
  };
  // Moderatör hesabı (yönetici girişiyle oturum açar)
  const moderator = async () => {
    const idPart = randomBytes(5).toString('hex');
    const email = `mod-${idPart}@e2e.test`;
    const u = await prisma.user.create({
      data: { email, username: `mod_${idPart}`, passwordHash: await hashPassword(TEST_PASSWORD), birthDate: new Date('1990-01-01'), roles: { create: [{ role: 'MODERATOR' }] } },
    });
    const res = await http().post('/api/auth/admin/login').send({ identifier: email, password: TEST_PASSWORD }).expect(200);
    return { id: u.id, accessToken: res.body.accessToken as string };
  };
  const post = async (t: Token, text: string) => ((await http().post('/api/social/posts').set(bearer(t.accessToken)).send({ text }).expect(201)).body as { id: string }).id;
  const report = (t: Token, body: Record<string, unknown>) => http().post('/api/social/reports').set(bearer(t.accessToken)).send(body);

  it('şikâyet → kuyruk → kaldırma → bildirim → itiraz → geri getirme; hepsi kayıt defterinde', async () => {
    const [author, r1, r2] = [await user(['kosu']), await user(), await user()];
    const admin = await createAdminAndLogin(app);
    const mod = await moderator();
    const pid = await post(author, 'kurallara aykırı içerik');

    await report(r1, { targetType: 'POST', targetId: pid, reason: 'SPAM' }).expect(201);
    await report(r1, { targetType: 'POST', targetId: pid, reason: 'SPAM' }).expect(409);
    await report(author, { targetType: 'POST', targetId: pid, reason: 'SPAM' }).expect(400);
    await report(r2, { targetType: 'POST', targetId: pid, reason: 'HARASSMENT', details: 'rahatsız edici' }).expect(201);
    // Normal kullanıcı kuyruğu göremez
    await http().get('/api/admin/moderation/reports').set(bearer(r1.accessToken)).expect(403);

    const queue = (await http().get('/api/admin/moderation/reports').set(bearer(mod.accessToken)).expect(200)).body as { id: string; targetId: string; sameTargetReports: number }[];
    const mine = queue.filter((q) => q.targetId === pid);
    expect(mine).toHaveLength(2);
    expect(mine[0]!.sameTargetReports).toBe(2);

    await http().post(`/api/admin/moderation/reports/${mine[0]!.id}/resolve`).set(bearer(mod.accessToken)).send({ action: 'REMOVE' }).expect(400);
    await http().post(`/api/admin/moderation/reports/${mine[0]!.id}/resolve`).set(bearer(mod.accessToken)).send({ action: 'REMOVE', note: 'e2e spam' }).expect(200);
    // İçerik herkesten kalkar; aynı içerikteki diğer şikâyet de kapanır
    await http().get(`/api/social/posts/${pid}`).set(bearer(r1.accessToken)).expect(404);
    expect(await prisma.report.count({ where: { targetId: pid, status: 'OPEN' } })).toBe(0);

    const notes = (await http().get('/api/notifications').query({ center: 'SOCIAL' }).set(bearer(author.accessToken)).expect(200)).body as { items: { type: string }[] };
    expect(notes.items.map((n) => n.type)).toContain('moderation_removed');
    const notices = (await http().get('/api/social/moderation/notices').set(bearer(author.accessToken)).expect(200)).body as { targetId: string; appeal: unknown }[];
    expect(notices).toEqual([expect.objectContaining({ targetId: pid, appeal: null })]);

    await http().post('/api/social/appeals').set(bearer(r1.accessToken)).send({ targetType: 'POST', targetId: pid, text: 'benim değil' }).expect(404);
    const appeal = (await http().post('/api/social/appeals').set(bearer(author.accessToken)).send({ targetType: 'POST', targetId: pid, text: 'Yanlış anlaşıldı' }).expect(201)).body as { id: string };
    await http().post('/api/social/appeals').set(bearer(author.accessToken)).send({ targetType: 'POST', targetId: pid, text: 'tekrar' }).expect(409);
    // Kaldıran moderatör kendi kararının itirazına bakamaz; başka biri (yönetici) karar verir
    await http().post(`/api/admin/moderation/appeals/${appeal.id}/decide`).set(bearer(mod.accessToken)).send({ accept: true }).expect(403);
    await http().post(`/api/admin/moderation/appeals/${appeal.id}/decide`).set(bearer(admin.accessToken)).send({ accept: true, note: 'e2e kabul' }).expect(200);
    await http().get(`/api/social/posts/${pid}`).set(bearer(r1.accessToken)).expect(200);

    const log = (await http().get('/api/admin/moderation/log').set(bearer(admin.accessToken)).expect(200)).body as { action: string; targetId: string }[];
    expect(log.filter((l) => l.targetId === pid).map((l) => l.action).sort()).toEqual(['APPEAL_ACCEPTED', 'REMOVE']);
  });

  it('branş moderatörü sadece kendi branşını görür; özel mesajda sadece şikâyet edilen mesaj görünür ve kayda geçer', async () => {
    const admin = await createAdminAndLogin(app);
    const mod = await moderator();
    const [runner, swimmer, reporter] = [await user(['kosu']), await user(['yuzme']), await user()];
    await http().put(`/api/admin/moderation/moderators/${mod.id}/branches`).set(bearer(mod.accessToken)).send({ sportIds: ['kosu'] }).expect(403);
    await http().put(`/api/admin/moderation/moderators/${mod.id}/branches`).set(bearer(admin.accessToken)).send({ sportIds: ['kosu'] }).expect(200);

    const p1 = await post(runner, 'koşu gönderisi');
    const p2 = await post(swimmer, 'yüzme gönderisi');
    const rep1 = (await report(reporter, { targetType: 'POST', targetId: p1, reason: 'OTHER' }).expect(201)).body as { id: string };
    const rep2 = (await report(reporter, { targetType: 'POST', targetId: p2, reason: 'OTHER' }).expect(201)).body as { id: string };
    const queue = (await http().get('/api/admin/moderation/reports').set(bearer(mod.accessToken)).expect(200)).body as { id: string }[];
    expect(queue.map((q) => q.id)).toContain(rep1.id);
    expect(queue.map((q) => q.id)).not.toContain(rep2.id);
    await http().get(`/api/admin/moderation/reports/${rep2.id}`).set(bearer(mod.accessToken)).expect(403);
    await http().post(`/api/admin/moderation/reports/${rep1.id}/resolve`).set(bearer(mod.accessToken)).send({ action: 'DISMISS', note: 'e2e ihlal yok' }).expect(200);

    // Özel mesaj: sadece sohbetteki kişi şikâyet edebilir; moderatör sadece o mesajı görür
    await http().post(`/api/social/users/${runner.user.id}/follow`).set(bearer(reporter.accessToken)).expect(200);
    const sent = (await http().post(`/api/social/dm/users/${reporter.user.id}/messages`).set(bearer(runner.accessToken)).send({ text: 'rahatsız edici mesaj' }).expect(201)).body as { conversationId: string; message: { id: string } };
    await http().post(`/api/social/dm/conversations/${sent.conversationId}/messages`).set(bearer(runner.accessToken)).send({ text: 'şikâyet edilmeyen ikinci mesaj' }).expect(201);
    await report(swimmer, { targetType: 'DM_MESSAGE', targetId: sent.message.id, reason: 'HARASSMENT' }).expect(404);
    const dmRep = (await report(reporter, { targetType: 'DM_MESSAGE', targetId: sent.message.id, reason: 'HARASSMENT' }).expect(201)).body as { id: string };
    const detail = (await http().get(`/api/admin/moderation/reports/${dmRep.id}`).set(bearer(mod.accessToken)).expect(200)).body as { content: { text: string } };
    expect(detail.content.text).toBe('rahatsız edici mesaj');
    expect(JSON.stringify(detail)).not.toContain('ikinci mesaj');
    expect(await prisma.moderationAction.count({ where: { moderatorId: mod.id, action: 'VIEW_REPORTED_MESSAGE', targetId: sent.message.id } })).toBe(1);
    await prisma.moderationAction.deleteMany({ where: { moderatorId: mod.id } });
  });

  it('etkin oturumlar listelenir; diğer cihazlar kapatılır', async () => {
    const t = (await registerUser(app)) as Token & { body: { email: string } };
    const second = (await http().post('/api/auth/login').send({ identifier: t.body.email, password: TEST_PASSWORD, deviceName: 'İkinci telefon' }).expect(200)).body as { accessToken: string };
    const sessions = (await http().get('/api/auth/sessions').set(bearer(t.accessToken)).expect(200)).body as { id: string; deviceName: string | null; current: boolean }[];
    expect(sessions).toHaveLength(2);
    expect(sessions.filter((s) => s.current)).toHaveLength(1);
    expect(sessions.some((s) => s.deviceName === 'İkinci telefon')).toBe(true);
    await http().post('/api/auth/sessions/revoke-others').set(bearer(t.accessToken)).expect(200);
    await http().get('/api/users/me').set(bearer(second.accessToken)).expect(401);
    await http().get('/api/users/me').set(bearer(t.accessToken)).expect(200);
  });
});
