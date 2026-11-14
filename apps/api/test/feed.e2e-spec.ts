import { randomBytes } from 'node:crypto';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types.js';
import { bearer, cleanupTestData, createTestApp, registerApprovedProfessional, registerUser } from './helpers.js';

describe('Akış ve Keşfet (e2e)', () => {
  let app: INestApplication<App>;
  const http = () => request(app.getHttpServer());
  type Token = { accessToken: string; body: { username: string }; user: { id: string } };
  type Page = { items: { id: string; author: { id: string } }[]; nextCursor: string | null };

  beforeAll(async () => {
    app = await createTestApp();
  });

  afterAll(async () => {
    await cleanupTestData(app);
    await app.close();
  });

  const user = async (opts: { publicAccount?: boolean; sports?: string[]; city?: string; displayName?: string } = {}) => {
    const t = (await registerUser(app)) as Token;
    await http()
      .patch('/api/users/me')
      .set(bearer(t.accessToken))
      .send({ isPrivate: !(opts.publicAccount ?? true), ...(opts.sports ? { sports: opts.sports } : {}), ...(opts.city ? { city: opts.city } : {}), ...(opts.displayName ? { displayName: opts.displayName } : {}) })
      .expect(200);
    return t;
  };
  const post = async (t: Token, text: string) => ((await http().post('/api/social/posts').set(bearer(t.accessToken)).send({ text }).expect(201)).body as { id: string }).id;
  const feed = async (t: Token, mode: string, cursor?: string) =>
    (await http().get('/api/social/feed').query({ mode, ...(cursor ? { cursor } : {}) }).set(bearer(t.accessToken)).expect(200)).body as Page;

  it('Takip ettiklerin: sadece takip edilenler ve kendisi; sessize alınan ve gizli hesap görünmez', async () => {
    const me = await user();
    const [friend, other, muted] = [await user(), await user(), await user()];
    const secret = await user({ publicAccount: false });
    const ids = {
      mine: await post(me, 'benim'),
      friend: await post(friend, 'arkadaş'),
      other: await post(other, 'yabancı'),
      muted: await post(muted, 'sessiz'),
      secret: await post(secret, 'gizli'),
    };
    for (const t of [friend, muted]) await http().post(`/api/social/users/${t.user.id}/follow`).set(bearer(me.accessToken)).expect(200);
    await http().post(`/api/social/users/${muted.user.id}/mute`).set(bearer(me.accessToken)).expect(200);
    const following = (await feed(me, 'following')).items.map((i) => i.id);
    expect(following).toEqual([ids.friend, ids.mine]);

    const forYou = (await feed(me, 'for_you')).items.map((i) => i.id);
    expect(forYou).not.toContain(ids.muted);
    expect(forYou).not.toContain(ids.secret);
  });

  it('Senin için: takip edilen ve etkileşimi yüksek gönderi öne çıkar; sayfalar çakışmaz', async () => {
    const me = await user({ sports: ['kosu'] });
    const [friend, popular, quiet] = [await user(), await user(), await user()];
    const fp = await post(friend, 'takip ettiğim');
    const pp = await post(popular, 'çok beğenilen');
    const qp = await post(quiet, 'sessiz sakin');
    await http().post(`/api/social/users/${friend.user.id}/follow`).set(bearer(me.accessToken)).expect(200);
    for (let i = 0; i < 4; i++) {
      const fan = await user();
      await http().post(`/api/social/posts/${pp}/like`).set(bearer(fan.accessToken)).expect(200);
    }
    const all: string[] = [];
    let cursor: string | undefined;
    do {
      const page = await feed(me, 'for_you', cursor);
      all.push(...page.items.map((i) => i.id));
      cursor = page.nextCursor ?? undefined;
    } while (cursor && all.length < 400);
    expect(new Set(all).size).toBe(all.length);
    expect(all.indexOf(fp)).toBeLessThan(all.indexOf(qp));
    expect(all.indexOf(pp)).toBeLessThan(all.indexOf(qp));
  });

  it('Keşfet araması: kişi, branş/şehir filtresi, etiket, gönderi ve doğrulanmış uzman', async () => {
    const me = await user();
    const tag = `etiket${randomBytes(3).toString('hex')}`;
    const name = `Aranan ${randomBytes(3).toString('hex')}`;
    const target = await user({ sports: ['tenis'], city: 'Eskişehir', displayName: name });
    const hidden = await user({ displayName: name });
    await http().post(`/api/social/users/${me.user.id}/block`).set(bearer(hidden.accessToken)).expect(200);
    const pid = await post(target, `Bugün maç vardı #${tag}`);

    const s = (await http().get('/api/social/search').query({ q: name }).set(bearer(me.accessToken)).expect(200)).body as { users: { id: string }[] };
    expect(s.users.map((u) => u.id)).toEqual([target.user.id]);
    const filtered = (await http().get('/api/social/search').query({ type: 'users', sport: 'tenis', city: 'eskişehir', q: name }).set(bearer(me.accessToken)).expect(200)).body as { users: { id: string }[] };
    expect(filtered.users.map((u) => u.id)).toEqual([target.user.id]);
    const none = (await http().get('/api/social/search').query({ type: 'users', sport: 'yuzme', q: name }).set(bearer(me.accessToken)).expect(200)).body as { users: unknown[] };
    expect(none.users).toHaveLength(0);

    const tags = (await http().get('/api/social/search').query({ type: 'tags', q: `#${tag.slice(0, 8)}` }).set(bearer(me.accessToken)).expect(200)).body as { tags: { tag: string; posts: number }[] };
    expect(tags.tags).toContainEqual({ tag, posts: 1 });
    const tagPage = (await http().get(`/api/social/tags/${tag}/posts`).set(bearer(me.accessToken)).expect(200)).body as Page & { count: number };
    expect(tagPage.items.map((i) => i.id)).toEqual([pid]);
    const posts = (await http().get('/api/social/search').query({ type: 'posts', q: tag }).set(bearer(me.accessToken)).expect(200)).body as { posts: { id: string }[] };
    expect(posts.posts.map((p) => p.id)).toEqual([pid]);

    const pro = (await registerApprovedProfessional(app, 'DIETITIAN')) as unknown as Token;
    const pros = (await http().get('/api/social/search').query({ type: 'pros', q: pro.body.username }).set(bearer(me.accessToken)).expect(200)).body as { pros: { id: string; badges: unknown[] }[] };
    expect(pros.pros.map((p) => p.id)).toEqual([pro.user.id]);
    expect(pros.pros[0]!.badges).toHaveLength(1);
  });

  it('öneriler ortak ilgi alanını kullanır; takip edilen ve engellenen önerilmez', async () => {
    const sport = 'tirmanis';
    const me = await user({ sports: [sport] });
    const climber = await user({ sports: [sport] });
    const followed = await user({ sports: [sport] });
    await http().post(`/api/social/users/${followed.user.id}/follow`).set(bearer(me.accessToken)).expect(200);
    const list = (await http().get('/api/social/suggestions').set(bearer(me.accessToken)).expect(200)).body as { id: string; reason: string }[];
    const ids = list.map((s) => s.id);
    expect(ids).not.toContain(followed.user.id);
    expect(ids).not.toContain(me.user.id);
    await http().post(`/api/social/users/${climber.user.id}/block`).set(bearer(me.accessToken)).expect(200);
    const after = ((await http().get('/api/social/suggestions').set(bearer(me.accessToken)).expect(200)).body as { id: string }[]).map((s) => s.id);
    expect(after).not.toContain(climber.user.id);
  });

  it('Keşfet ana sayfası öne çıkan gönderileri ve etiketleri döner', async () => {
    const me = await user();
    const res = (await http().get('/api/social/explore').set(bearer(me.accessToken)).expect(200)).body as { posts: unknown[]; tags: unknown[] };
    expect(Array.isArray(res.posts)).toBe(true);
    expect(Array.isArray(res.tags)).toBe(true);
  });
});
