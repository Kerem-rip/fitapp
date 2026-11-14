import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types.js';
import { PrismaService } from '../src/common/prisma/prisma.service.js';
import { bearer, cleanupTestData, createTestApp, registerUser } from './helpers.js';

const PNG = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  Buffer.from('0000000d49484452000000010000000108060000001f15c489', 'hex'),
  Buffer.from('0000000049454e44ae426082', 'hex'),
]);

describe('Hikâyeler (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  const http = () => request(app.getHttpServer());
  type Token = { accessToken: string; body: { username: string }; user: { id: string } };
  type Story = { id: string; isMine: boolean; viewed: boolean; myReaction: string | null; poll: { myVote: number | null; results: number[] | null } | null; mentions: string[]; counts?: { views: number } };

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
  const story = async (t: Token, body: Record<string, unknown>) => (await http().post('/api/social/stories').set(bearer(t.accessToken)).send(body).expect(201)).body as Story;
  const follow = async (a: Token, b: Token) => http().post(`/api/social/users/${b.user.id}/follow`).set(bearer(a.accessToken)).expect(200);
  const userStories = async (viewer: Token, of: Token) => (await http().get(`/api/social/users/${of.user.id}/stories`).set(bearer(viewer.accessToken)).expect(200)).body as Story[];

  it('fotoğraflı ve yazılı hikâye; şeritte takip edilenler, görülmemişler önde; 24 saat sonra arşive düşer', async () => {
    const [me, a, b] = [await user(), await user(), await user()];
    const up = (await http().post('/api/social/stories/media').set(bearer(a.accessToken)).attach('file', PNG, { filename: 'h.png', contentType: 'image/png' }).expect(201)).body as { id: string };
    const s1 = await story(a, { mediaId: up.id, text: 'sabah antrenmanı', location: 'Kadıköy sahil' });
    await story(b, { text: 'günaydın', background: 'ocean' });
    await http().post('/api/social/stories').set(bearer(a.accessToken)).send({}).expect(400);
    // Aynı dosya ikinci kez kullanılamaz
    await http().post('/api/social/stories').set(bearer(a.accessToken)).send({ mediaId: up.id }).expect(400);

    await follow(me, a);
    await follow(me, b);
    await story(me, { text: 'ben' });
    await http().post(`/api/social/stories/${s1.id}/view`).set(bearer(me.accessToken)).expect(200);
    const tray = (await http().get('/api/social/stories/tray').set(bearer(me.accessToken)).expect(200)).body as { author: { id: string }; isMe: boolean; hasUnseen: boolean }[];
    expect(tray.map((t) => t.author.id)).toEqual([me.user.id, b.user.id, a.user.id]);
    expect(tray[2]!.hasUnseen).toBe(false);

    // Süre dolunca görünmez ama sahibinin arşivinde kalır
    await prisma.story.update({ where: { id: s1.id }, data: { expiresAt: new Date(Date.now() - 1000) } });
    expect(await userStories(me, a)).toHaveLength(0);
    const archive = (await http().get('/api/social/stories/archive').set(bearer(a.accessToken)).expect(200)).body as { items: Story[] };
    expect(archive.items.map((s) => s.id)).toEqual([s1.id]);
  });

  it('kitle: sadece takipçiler ve yakın arkadaşlar; gizli hesap kuralı', async () => {
    const owner = await user();
    const [fan, close, stranger] = [await user(), await user(), await user()];
    await follow(fan, owner);
    await follow(close, owner);
    const forFollowers = await story(owner, { text: 'takipçilere', audience: 'FOLLOWERS' });
    await http().post(`/api/social/close-friends/${close.user.id}`).set(bearer(owner.accessToken)).expect(200);
    const forClose = await story(owner, { text: 'yakınlara', audience: 'CLOSE_FRIENDS' });
    const forAll = await story(owner, { text: 'herkese' });

    expect((await userStories(stranger, owner)).map((s) => s.id)).toEqual([forAll.id]);
    expect((await userStories(fan, owner)).map((s) => s.id)).toEqual([forFollowers.id, forAll.id]);
    expect((await userStories(close, owner)).map((s) => s.id)).toEqual([forFollowers.id, forClose.id, forAll.id]);
    const list = (await http().get('/api/social/close-friends').set(bearer(owner.accessToken)).expect(200)).body as { id: string }[];
    expect(list.map((c) => c.id)).toEqual([close.user.id]);

    // Gizli hesapta "herkes" = kabul edilmiş takipçiler
    const secret = await user(false);
    await story(secret, { text: 'gizli hesap' });
    expect(await userStories(stranger, secret)).toHaveLength(0);
    // Engellenen kişi hikâyeyi göremez; yakın arkadaşlıktan da çıkar
    await http().post(`/api/social/users/${close.user.id}/block`).set(bearer(owner.accessToken)).expect(200);
    await http().get(`/api/social/stories/${forAll.id}`).set(bearer(close.accessToken)).expect(404);
    expect((await http().get('/api/social/close-friends').set(bearer(owner.accessToken)).expect(200)).body).toEqual([]);
  });

  it('anket, soru, emoji tepkisi, bahsetme ve bağlantı; izleyenleri sadece sahibi görür', async () => {
    const [owner, viewer, mentioned] = [await user(), await user(), await user()];
    const s = await story(owner, {
      text: 'hangisi?',
      poll: { question: 'Sabah mı akşam mı?', options: ['Sabah', 'Akşam'] },
      question: 'Bugün ne yedin?',
      mentions: [`@${mentioned.body.username}`, 'yok_boyle_biri'],
      link: { url: 'https://ornek.com/plan', label: 'Plan' },
    });
    expect(s.mentions).toEqual([mentioned.body.username]);
    expect(s.poll).toMatchObject({ myVote: null, results: [0, 0] });
    const before = (await http().get(`/api/social/stories/${s.id}`).set(bearer(viewer.accessToken)).expect(200)).body as Story;
    expect(before.poll?.results).toBeNull();

    const voted = (await http().post(`/api/social/stories/${s.id}/vote`).set(bearer(viewer.accessToken)).send({ option: 1 }).expect(200)).body as { myVote: number; results: number[] };
    expect(voted).toMatchObject({ myVote: 1, results: [0, 1] });
    await http().post(`/api/social/stories/${s.id}/vote`).set(bearer(viewer.accessToken)).send({ option: 0 }).expect(409);
    await http().post(`/api/social/stories/${s.id}/vote`).set(bearer(owner.accessToken)).send({ option: 0 }).expect(400);
    await http().post(`/api/social/stories/${s.id}/answer`).set(bearer(viewer.accessToken)).send({ text: 'Yulaf' }).expect(201);
    await http().post(`/api/social/stories/${s.id}/react`).set(bearer(viewer.accessToken)).send({ emoji: '🔥' }).expect(200);
    await http().post(`/api/social/stories/${s.id}/react`).set(bearer(viewer.accessToken)).send({ emoji: '🍔' }).expect(400);

    await http().get(`/api/social/stories/${s.id}/insights`).set(bearer(viewer.accessToken)).expect(403);
    const insights = (await http().get(`/api/social/stories/${s.id}/insights`).set(bearer(owner.accessToken)).expect(200)).body as { views: { person: { id: string }; reaction: string }[]; answers: { text: string }[] };
    expect(insights.views).toEqual([expect.objectContaining({ person: expect.objectContaining({ id: viewer.user.id }), reaction: '🔥' })]);
    expect(insights.answers.map((a) => a.text)).toEqual(['Yulaf']);
    await http().post('/api/social/stories').set(bearer(owner.accessToken)).send({ text: 'x', link: { url: 'javascript:alert(1)' } }).expect(400);
  });

  it('başarı paylaşımı sunucuda doğrulanır; silinen hikâye ve fotoğrafı kalkar', async () => {
    const me = await user();
    const join = (await http().post('/api/library/programs/yuz-masaji-rutini/join').set(bearer(me.accessToken)).send({}).expect(201)).body as { id: string };
    await http().post('/api/social/stories').set(bearer(me.accessToken)).send({ achievement: { kind: 'LIBRARY_DAY_DONE', enrollmentId: join.id, dayIndex: 0 } }).expect(400);
    for (const stepIndex of [0, 1, 2]) {
      await http().post(`/api/me/library/enrollments/${join.id}/steps`).set(bearer(me.accessToken)).send({ dayIndex: 0, stepIndex, done: true }).expect(200);
    }
    const list = (await http().get('/api/social/stories/achievements').set(bearer(me.accessToken)).expect(200)).body as { kind: string; title: string }[];
    expect(list).toContainEqual(expect.objectContaining({ kind: 'LIBRARY_DAY_DONE', dayIndex: 0 }));
    const s = (await http().post('/api/social/stories').set(bearer(me.accessToken)).send({ achievement: { kind: 'LIBRARY_DAY_DONE', enrollmentId: join.id, dayIndex: 0 } }).expect(201)).body as { id: string; achievement: { title: string } };
    expect(s.achievement.title).toContain('1. gün tamam');

    const up = (await http().post('/api/social/stories/media').set(bearer(me.accessToken)).attach('file', PNG, { filename: 'h.png', contentType: 'image/png' }).expect(201)).body as { id: string };
    const withPhoto = await story(me, { mediaId: up.id });
    const other = await user();
    await http().delete(`/api/social/stories/${withPhoto.id}`).set(bearer(other.accessToken)).expect(403);
    await http().delete(`/api/social/stories/${withPhoto.id}`).set(bearer(me.accessToken)).expect(200);
    expect(await prisma.file.count({ where: { id: up.id } })).toBe(0);
    await http().get(`/api/social/stories/${withPhoto.id}`).set(bearer(me.accessToken)).expect(404);
  });
});
