import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types.js';
import { PrismaService } from '../src/common/prisma/prisma.service.js';
import { bearer, cleanupTestData, createTestApp, registerUser } from './helpers.js';

describe('Sosyal bildirimler (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  const http = () => request(app.getHttpServer());
  type Token = { accessToken: string; body: { username: string }; user: { id: string } };
  type Item = { type: string; center: string; text: string; read: boolean; actorUsername: string | null; postId: string | null };

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
  });

  afterAll(async () => {
    await cleanupTestData(app);
    await app.close();
  });

  const user = async (publicAccount = true) => {
    const t = (await registerUser(app)) as Token;
    await http().patch('/api/users/me').set(bearer(t.accessToken)).send({ isPrivate: !publicAccount }).expect(200);
    return t;
  };
  const list = async (t: Token, center?: string) =>
    (await http().get('/api/notifications').query(center ? { center } : {}).set(bearer(t.accessToken)).expect(200)).body as { unread: number; items: Item[] };
  const post = async (t: Token, text: string) => ((await http().post('/api/social/posts').set(bearer(t.accessToken)).send({ text }).expect(201)).body as { id: string }).id;

  it('takip, beğeni, yorum, yanıt ve bahsetme sosyal merkeze düşer; uzman merkezinden ayrıdır', async () => {
    const [owner, fan] = [await user(), await user()];
    await http().post(`/api/social/users/${owner.user.id}/follow`).set(bearer(fan.accessToken)).expect(200);
    const pid = await post(owner, 'ilk gönderi');
    await http().post(`/api/social/posts/${pid}/like`).set(bearer(fan.accessToken)).expect(200);
    // Aynı beğeni iki kez bildirim üretmez
    await http().delete(`/api/social/posts/${pid}/like`).set(bearer(fan.accessToken)).expect(200);
    await http().post(`/api/social/posts/${pid}/like`).set(bearer(fan.accessToken)).expect(200);
    const c = (await http().post(`/api/social/posts/${pid}/comments`).set(bearer(fan.accessToken)).send({ text: 'güzel' }).expect(201)).body as { id: string };
    await http().post(`/api/social/posts/${pid}/comments`).set(bearer(owner.accessToken)).send({ text: 'sağ ol', parentId: c.id }).expect(201);
    await post(fan, `selam @${owner.body.username}`);
    // Kendi gönderini beğenmek bildirim üretmez
    await http().post(`/api/social/posts/${pid}/like`).set(bearer(owner.accessToken)).expect(200);

    const social = await list(owner, 'SOCIAL');
    expect(social.items.map((i) => i.type).sort()).toEqual(['social_comment', 'social_follow', 'social_like', 'social_mention']);
    expect(social.unread).toBe(4);
    expect(social.items.every((i) => i.center === 'SOCIAL' && i.actorUsername === fan.body.username)).toBe(true);
    expect(social.items.find((i) => i.type === 'social_like')?.postId).toBe(pid);
    expect((await list(fan, 'SOCIAL')).items.map((i) => i.type)).toEqual(['social_reply']);
    expect((await list(owner, 'PRO')).items).toHaveLength(0);

    const counts = (await http().get('/api/notifications/counts').set(bearer(owner.accessToken)).expect(200)).body as { social: number; pro: number; total: number };
    expect(counts).toEqual({ social: 4, pro: 0, total: 4 });
    await http().post('/api/notifications/read').set(bearer(owner.accessToken)).send({ center: 'SOCIAL' }).expect(200);
    expect((await list(owner, 'SOCIAL')).unread).toBe(0);
  });

  it('gizli hesapta takip isteği ve kabul bildirimi; istek geri çekilince bildirim kalkar', async () => {
    const [secret, fan] = [await user(false), await user()];
    await http().post(`/api/social/users/${secret.user.id}/follow`).set(bearer(fan.accessToken)).expect(200);
    expect((await list(secret, 'SOCIAL')).items.map((i) => i.type)).toEqual(['social_follow_request']);
    await http().delete(`/api/social/users/${secret.user.id}/follow`).set(bearer(fan.accessToken)).expect(200);
    expect((await list(secret, 'SOCIAL')).items).toHaveLength(0);
    await http().post(`/api/social/users/${secret.user.id}/follow`).set(bearer(fan.accessToken)).expect(200);
    await http().post(`/api/social/follow-requests/${fan.user.id}/accept`).set(bearer(secret.accessToken)).expect(200);
    expect((await list(fan, 'SOCIAL')).items.map((i) => i.type)).toEqual(['social_follow_accepted']);
  });

  it('tercihle kapatılan tür, sessize alınan ve engellenen kişi bildirim üretmez', async () => {
    const [owner, a, muted] = [await user(), await user(), await user()];
    const pid = await post(owner, 'x');
    const prefs = (await http().put('/api/notifications/preferences').set(bearer(owner.accessToken)).send({ likes: false, quietFrom: 23, quietTo: 7 }).expect(200)).body as { likes: boolean; comments: boolean; quietFrom: number };
    expect(prefs).toMatchObject({ likes: false, comments: true, quietFrom: 23 });
    await http().put('/api/notifications/preferences').set(bearer(owner.accessToken)).send({ quietFrom: 23 }).expect(400);
    await http().post(`/api/social/posts/${pid}/like`).set(bearer(a.accessToken)).expect(200);
    await http().post(`/api/social/users/${muted.user.id}/mute`).set(bearer(owner.accessToken)).expect(200);
    await http().post(`/api/social/posts/${pid}/comments`).set(bearer(muted.accessToken)).send({ text: 'sessiz' }).expect(201);
    await http().post(`/api/social/posts/${pid}/comments`).set(bearer(a.accessToken)).send({ text: 'duyulur' }).expect(201);
    expect((await list(owner, 'SOCIAL')).items.map((i) => i.type)).toEqual(['social_comment']);
  });

  it('hikâye tepkisi ve yanıtı bildirilir; cihaz kaydı eklenir ve silinir', async () => {
    const [owner, viewer] = [await user(), await user()];
    const s = (await http().post('/api/social/stories').set(bearer(owner.accessToken)).send({ text: 'hikâye', question: 'Nasılsın?', mentions: [viewer.body.username] }).expect(201)).body as { id: string };
    expect((await list(viewer, 'SOCIAL')).items.map((i) => i.type)).toEqual(['social_story_mention']);
    await http().post(`/api/social/stories/${s.id}/react`).set(bearer(viewer.accessToken)).send({ emoji: '🔥' }).expect(200);
    await http().post(`/api/social/stories/${s.id}/react`).set(bearer(viewer.accessToken)).send({ emoji: '👏' }).expect(200);
    await http().post(`/api/social/stories/${s.id}/answer`).set(bearer(viewer.accessToken)).send({ text: 'iyi' }).expect(201);
    expect((await list(owner, 'SOCIAL')).items.map((i) => i.type).sort()).toEqual(['social_story_answer', 'social_story_reaction']);

    const token = `ExponentPushToken[test-${owner.user.id}]`;
    await http().post('/api/notifications/devices').set(bearer(owner.accessToken)).send({ token, platform: 'android' }).expect(200);
    expect(await prisma.pushDevice.count({ where: { userId: owner.user.id } })).toBe(1);
    await http().delete(`/api/notifications/devices/${encodeURIComponent(token)}`).set(bearer(owner.accessToken)).expect(200);
    expect(await prisma.pushDevice.count({ where: { userId: owner.user.id } })).toBe(0);
  });
});
