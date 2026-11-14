import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types.js';
import { bearer, cleanupTestData, createTestApp, registerApprovedProfessional, registerUser } from './helpers.js';

describe('Takip, engelleme ve sessize alma (e2e)', () => {
  let app: INestApplication<App>;
  const http = () => request(app.getHttpServer());
  type Token = { accessToken: string; body: { username: string }; user: { id: string } };
  type Relation = { following: string; followsMe: boolean; requestedMe: boolean; muted: boolean } | null;

  beforeAll(async () => {
    app = await createTestApp();
  });

  afterAll(async () => {
    await cleanupTestData(app);
    await app.close();
  });

  const user = async () => (await registerUser(app)) as Token;
  const profile = async (viewer: Token, of: Token) =>
    (await http().get(`/api/social/profiles/${of.body.username}`).set(bearer(viewer.accessToken)).expect(200)).body as {
      relation: Relation;
      canSeeContent: boolean;
      counts: { followers: number; following: number };
    };
  const follow = (a: Token, b: Token) => http().post(`/api/social/users/${b.user.id}/follow`).set(bearer(a.accessToken));
  const makePublic = (t: Token) => http().patch('/api/users/me').set(bearer(t.accessToken)).send({ isPrivate: false }).expect(200);

  it('açık hesap hemen takip edilir; takibi bırakma ve takipçi çıkarma çalışır', async () => {
    const [a, b] = [await user(), await user()];
    await makePublic(b);
    expect((await follow(a, b).expect(200)).body).toEqual({ following: 'ACCEPTED' });
    // Tekrar takip aynı sonucu verir, kopya oluşmaz
    await follow(a, b).expect(200);
    expect((await profile(a, b)).relation).toMatchObject({ following: 'ACCEPTED', followsMe: false });
    expect((await profile(a, b)).counts.followers).toBe(1);
    expect((await profile(b, a)).relation).toMatchObject({ following: 'NONE', followsMe: true });

    await http().delete(`/api/social/users/${b.user.id}/follow`).set(bearer(a.accessToken)).expect(200);
    expect((await profile(a, b)).counts.followers).toBe(0);

    await follow(a, b).expect(200);
    await http().delete(`/api/social/users/${a.user.id}/follower`).set(bearer(b.accessToken)).expect(200);
    expect((await profile(a, b)).relation?.following).toBe('NONE');
    await http().delete(`/api/social/users/${a.user.id}/follower`).set(bearer(b.accessToken)).expect(404);
    await follow(a, a).expect(400);
  });

  it('gizli hesaba istek gider; kabul edilene kadar içerik ve listeler görünmez', async () => {
    const [a, b, c] = [await user(), await user(), await user()];
    expect((await follow(a, b).expect(200)).body).toEqual({ following: 'PENDING' });
    expect(await profile(a, b)).toMatchObject({ canSeeContent: false, relation: { following: 'PENDING' } });
    await http().get(`/api/social/users/${b.user.id}/followers`).set(bearer(a.accessToken)).expect(404);

    const reqs = (await http().get('/api/social/follow-requests').set(bearer(b.accessToken)).expect(200)).body as { items: { id: string }[] };
    expect(reqs.items.map((r) => r.id)).toEqual([a.user.id]);
    expect((await http().get('/api/social/follow-requests/count').set(bearer(b.accessToken)).expect(200)).body).toEqual({ count: 1 });
    expect((await profile(b, a)).relation?.requestedMe).toBe(true);

    await http().post(`/api/social/follow-requests/${a.user.id}/accept`).set(bearer(b.accessToken)).expect(200);
    expect(await profile(a, b)).toMatchObject({ canSeeContent: true, relation: { following: 'ACCEPTED' } });
    const followers = (await http().get(`/api/social/users/${b.user.id}/followers`).set(bearer(a.accessToken)).expect(200)).body as { items: { id: string; isMe: boolean }[] };
    expect(followers.items).toEqual([expect.objectContaining({ id: a.user.id, isMe: true })]);

    // Reddetme ve geri çekme
    await follow(c, b).expect(200);
    await http().post(`/api/social/follow-requests/${c.user.id}/decline`).set(bearer(b.accessToken)).expect(200);
    await http().post(`/api/social/follow-requests/${c.user.id}/decline`).set(bearer(b.accessToken)).expect(404);
    await follow(c, b).expect(200);
    await http().delete(`/api/social/users/${b.user.id}/follow`).set(bearer(c.accessToken)).expect(200);
    expect((await http().get('/api/social/follow-requests/count').set(bearer(b.accessToken)).expect(200)).body).toEqual({ count: 0 });

    // Hesap açığa çevrilince bekleyen istekler kabul edilir
    await follow(c, b).expect(200);
    await makePublic(b);
    expect((await profile(c, b)).relation?.following).toBe('ACCEPTED');
  });

  it('doğrulanmış profesyonel gizli olamaz: takip hemen kabul edilir', async () => {
    const a = await user();
    const pro = (await registerApprovedProfessional(app, 'TRAINER')) as unknown as Token;
    expect((await follow(a, pro).expect(200)).body).toEqual({ following: 'ACCEPTED' });
  });

  it('engelleme takipleri siler, profili ve takibi kapatır; kaldırılınca geri gelir', async () => {
    const [a, b] = [await user(), await user()];
    await makePublic(a);
    await makePublic(b);
    await follow(a, b).expect(200);
    await follow(b, a).expect(200);

    await http().post(`/api/social/users/${a.user.id}/block`).set(bearer(b.accessToken)).expect(200);
    await http().get(`/api/social/profiles/${b.body.username}`).set(bearer(a.accessToken)).expect(404);
    await http().get(`/api/social/profiles/${a.body.username}`).set(bearer(b.accessToken)).expect(404);
    await follow(a, b).expect(404);
    await follow(b, a).expect(404);
    const blocks = (await http().get('/api/social/blocks').set(bearer(b.accessToken)).expect(200)).body as { id: string }[];
    expect(blocks.map((x) => x.id)).toEqual([a.user.id]);

    await http().delete(`/api/social/users/${a.user.id}/block`).set(bearer(b.accessToken)).expect(200);
    const p = await profile(a, b);
    // Takipler geri gelmez
    expect(p.relation).toMatchObject({ following: 'NONE', followsMe: false });
    expect(p.counts).toEqual({ followers: 0, following: 0, posts: 0 });
  });

  it('sessize alma takibi bozmaz ve karşı taraf görmez', async () => {
    const [a, b] = [await user(), await user()];
    await makePublic(b);
    await follow(a, b).expect(200);
    await http().post(`/api/social/users/${b.user.id}/mute`).set(bearer(a.accessToken)).expect(200);
    expect((await profile(a, b)).relation).toMatchObject({ following: 'ACCEPTED', muted: true });
    expect((await profile(b, a)).relation).toMatchObject({ followsMe: true, muted: false });
    const mutes = (await http().get('/api/social/mutes').set(bearer(a.accessToken)).expect(200)).body as { id: string }[];
    expect(mutes.map((m) => m.id)).toEqual([b.user.id]);
    await http().delete(`/api/social/users/${b.user.id}/mute`).set(bearer(a.accessToken)).expect(200);
    expect((await profile(a, b)).relation?.muted).toBe(false);
  });

  it('takipçi listesi sayfalanır', async () => {
    const b = await user();
    await makePublic(b);
    const fans = await Promise.all(Array.from({ length: 32 }, () => user()));
    for (const f of fans) await follow(f, b).expect(200);
    const first = (await http().get(`/api/social/users/${b.user.id}/followers`).set(bearer(b.accessToken)).expect(200)).body as { items: { id: string }[]; nextCursor: string | null };
    expect(first.items).toHaveLength(30);
    expect(first.nextCursor).toBeTruthy();
    const second = (await http().get(`/api/social/users/${b.user.id}/followers`).query({ cursor: first.nextCursor }).set(bearer(b.accessToken)).expect(200)).body as { items: { id: string }[]; nextCursor: string | null };
    expect(second.items).toHaveLength(2);
    expect(second.nextCursor).toBeNull();
    expect(new Set([...first.items, ...second.items].map((i) => i.id)).size).toBe(32);
    await http().get(`/api/social/users/${b.user.id}/followers`).query({ cursor: 'bozuk' }).set(bearer(b.accessToken)).expect(400);
  });
});
