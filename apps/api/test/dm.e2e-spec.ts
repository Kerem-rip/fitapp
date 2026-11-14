import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types.js';
import { PrismaService } from '../src/common/prisma/prisma.service.js';
import { buildTestMp4 } from './fixtures/mp4.js';
import { bearer, cleanupTestData, createTestApp, registerUser } from './helpers.js';

const PNG = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  Buffer.from('0000000d49484452000000010000000108060000001f15c489', 'hex'),
  Buffer.from('0000000049454e44ae426082', 'hex'),
]);

describe('Mesajlar ve gruplar (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  const http = () => request(app.getHttpServer());
  type Token = { accessToken: string; body: { username: string }; user: { id: string } };
  type Msg = { id: string; kind: string; text: string | null; status: string | null; unsent: boolean; media: { url: string } | null; post: { id: string; available?: boolean } | null };

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
  });

  afterAll(async () => {
    await cleanupTestData(app);
    await app.close();
  });

  const user = async (settings: Record<string, unknown> = {}) => {
    const t = (await registerUser(app)) as Token;
    await http().patch('/api/users/me').set(bearer(t.accessToken)).send({ isPrivate: false, ...settings }).expect(200);
    return t;
  };
  const follow = (a: Token, b: Token) => http().post(`/api/social/users/${b.user.id}/follow`).set(bearer(a.accessToken)).expect(200);
  const open = async (a: Token, b: Token) => ((await http().post(`/api/social/dm/direct/${b.user.id}`).set(bearer(a.accessToken)).expect(200)).body as { id: string; pendingRequest: boolean });
  const send = (t: Token, cid: string, body: Record<string, unknown>) => http().post(`/api/social/dm/conversations/${cid}/messages`).set(bearer(t.accessToken)).send(body);
  const list = async (t: Token, box = 'inbox') => (await http().get('/api/social/dm/conversations').query({ box }).set(bearer(t.accessToken)).expect(200)).body as { id: string; unread: number; lastMessage: { preview: string } }[];
  const messages = async (t: Token, cid: string) => ((await http().get(`/api/social/dm/conversations/${cid}/messages`).set(bearer(t.accessToken)).expect(200)).body as { items: Msg[] }).items;

  it('takip eden kişiye mesaj kutuya, takip etmeyene isteğe düşer; istek kabul edilmeden medya gönderilmez', async () => {
    const [a, b, c] = [await user(), await user(), await user()];
    await follow(b, a); // b, a'yı takip ediyor → a'nın mesajı b'nin kutusuna
    const ab = await open(a, b);
    expect(ab.pendingRequest).toBe(false);
    await send(a, ab.id, { text: 'Selam!' }).expect(201);
    expect((await list(b)).map((x) => x.id)).toEqual([ab.id]);
    expect((await list(b))[0]!.unread).toBe(1);

    const ca = await open(c, a); // a, c'yi takip etmiyor → istek
    expect(ca.pendingRequest).toBe(true);
    await send(c, ca.id, { text: 'Merhaba, tanışalım mı?' }).expect(201);
    expect((await list(a, 'requests')).map((x) => x.id)).toEqual([ca.id]);
    expect((await list(a)).map((x) => x.id)).not.toContain(ca.id);
    const up = (await http().post('/api/social/dm/media').set(bearer(c.accessToken)).attach('file', PNG, { filename: 'a.png', contentType: 'image/png' }).expect(201)).body as { id: string };
    expect((await send(c, ca.id, { mediaId: up.id }).expect(403)).body.code).toBe('MEDIA_NOT_ALLOWED');

    // Yanıt vermek isteği kabul eder; artık fotoğraf gönderilebilir
    await send(a, ca.id, { text: 'Olur' }).expect(201);
    expect((await list(a)).map((x) => x.id)).toContain(ca.id);
    const photo = (await send(c, ca.id, { mediaId: up.id }).expect(201)).body as Msg;
    expect(photo.kind).toBe('IMAGE');
  });

  it('mesaj gizliliği ve engel: sadece takip ettiklerim yazabilir; engelli kişi yazamaz', async () => {
    const [a, b] = [await user({ dmPolicy: 'FOLLOWING' }), await user()];
    expect((await http().post(`/api/social/dm/direct/${a.user.id}`).set(bearer(b.accessToken)).expect(403)).body.code).toBe('DM_NOT_ALLOWED');
    await follow(a, b);
    const ba = await open(b, a);
    await send(b, ba.id, { text: 'şimdi olur' }).expect(201);
    await http().post(`/api/social/users/${b.user.id}/block`).set(bearer(a.accessToken)).expect(200);
    await send(b, ba.id, { text: 'engelden sonra' }).expect(403);
    expect((await list(a)).map((x) => x.id)).not.toContain(ba.id);
  });

  it('durumlar (gönderildi/iletildi/görüldü), yanıtla, benden sil, geri al', async () => {
    const [a, b] = [await user(), await user()];
    await follow(b, a);
    const cid = (await open(a, b)).id;
    const m1 = (await send(a, cid, { text: 'ilk' }).expect(201)).body as Msg;
    expect(m1.status).toBe('sent');
    await messages(b, cid); // b'ye iletildi
    expect((await messages(a, cid))[0]!.status).toBe('delivered');
    await http().post(`/api/social/dm/conversations/${cid}/read`).set(bearer(b.accessToken)).expect(200);
    expect((await messages(a, cid))[0]!.status).toBe('seen');
    expect((await list(b))[0]!.unread).toBe(0);

    const reply = (await send(b, cid, { text: 'yanıt', replyToId: m1.id }).expect(201)).body as Msg & { replyTo: { id: string } };
    expect(reply.replyTo.id).toBe(m1.id);

    await http().delete(`/api/social/dm/messages/${reply.id}`).set(bearer(a.accessToken)).expect(200);
    expect((await messages(a, cid)).map((m) => m.id)).not.toContain(reply.id);
    expect((await messages(b, cid)).map((m) => m.id)).toContain(reply.id);

    await http().post(`/api/social/dm/messages/${m1.id}/unsend`).set(bearer(b.accessToken)).expect(403);
    await http().post(`/api/social/dm/messages/${m1.id}/unsend`).set(bearer(a.accessToken)).expect(200);
    const after = (await messages(b, cid)).find((m) => m.id === m1.id)!;
    expect(after).toMatchObject({ unsent: true, text: null });
  });

  it('gönderi paylaşma, hikâyeye yanıt ve video/ses mesajı', async () => {
    const [a, b] = [await user(), await user()];
    await follow(b, a);
    await follow(a, b);
    const post = (await http().post('/api/social/posts').set(bearer(a.accessToken)).send({ text: 'bak' }).expect(201)).body as { id: string };
    const shared = (await http().post(`/api/social/dm/users/${b.user.id}/messages`).set(bearer(a.accessToken)).send({ postId: post.id, text: 'şuna bak' }).expect(201)).body as { conversationId: string; message: Msg };
    expect(shared.message.kind).toBe('POST');
    expect(shared.message.post?.id).toBe(post.id);

    const story = (await http().post('/api/social/stories').set(bearer(b.accessToken)).send({ text: 'hikâyem' }).expect(201)).body as { id: string };
    const sr = (await http().post(`/api/social/dm/users/${b.user.id}/messages`).set(bearer(a.accessToken)).send({ storyId: story.id, text: 'harika!' }).expect(201)).body as { conversationId: string; message: Msg };
    expect(sr.message.kind).toBe('STORY_REPLY');
    expect(sr.conversationId).toBe(shared.conversationId);
    // Hikâyeye yanıt sadece sahibine gider
    const c = await user();
    await follow(c, a);
    await http().post(`/api/social/dm/users/${c.user.id}/messages`).set(bearer(a.accessToken)).send({ storyId: story.id }).expect(400);

    const video = (await http().post('/api/social/dm/media').set(bearer(a.accessToken)).attach('file', buildTestMp4({ seconds: 5 }), { filename: 'v.mp4', contentType: 'video/mp4' }).expect(201)).body as { id: string; kind: string };
    expect(video.kind).toBe('VIDEO');
    const voice = (await http().post('/api/social/dm/media').set(bearer(a.accessToken)).attach('file', buildTestMp4({ seconds: 20, brand: 'M4A ' }), { filename: 's.m4a', contentType: 'audio/mp4' }).expect(201)).body as { id: string; kind: string };
    expect(voice.kind).toBe('VOICE');
    const vm = (await send(a, shared.conversationId, { mediaId: voice.id }).expect(201)).body as Msg;
    expect(vm.kind).toBe('VOICE');
    await http().post('/api/social/dm/media').set(bearer(a.accessToken)).attach('file', buildTestMp4({ seconds: 130, brand: 'M4A ' }), { filename: 's.m4a', contentType: 'audio/mp4' }).expect(400);
  });

  it('grup: oluştur, yönetici ekler/çıkarır, ad değiştirir; son yönetici ayrılınca yönetim devredilir', async () => {
    const [owner, m1, m2, m3] = [await user(), await user(), await user(), await user()];
    for (const m of [m1, m2, m3]) await follow(m, owner);
    const g = (await http().post('/api/social/dm/groups').set(bearer(owner.accessToken)).send({ title: 'Koşu ekibi', memberIds: [m1.user.id, m2.user.id] }).expect(201)).body as { id: string; members: { id: string; role: string }[] };
    expect(g.members).toHaveLength(3);
    await send(m1, g.id, { text: 'Yarın 7de?' }).expect(201);
    expect((await list(m2)).map((x) => x.id)).toContain(g.id);

    await http().post(`/api/social/dm/conversations/${g.id}/members`).set(bearer(m1.accessToken)).send({ memberIds: [m3.user.id] }).expect(403);
    await http().post(`/api/social/dm/conversations/${g.id}/members`).set(bearer(owner.accessToken)).send({ memberIds: [m3.user.id] }).expect(200);
    await http().patch(`/api/social/dm/conversations/${g.id}`).set(bearer(owner.accessToken)).send({ title: 'Sabah koşusu' }).expect(200);
    await http().delete(`/api/social/dm/conversations/${g.id}/members/${m2.user.id}`).set(bearer(owner.accessToken)).expect(200);
    await http().get(`/api/social/dm/conversations/${g.id}/messages`).set(bearer(m2.accessToken)).expect(404);

    await http().post(`/api/social/dm/conversations/${g.id}/leave`).set(bearer(owner.accessToken)).expect(200);
    const d = (await http().get(`/api/social/dm/conversations/${g.id}`).set(bearer(m1.accessToken)).expect(200)).body as { title: string; myRole: string };
    expect(d).toMatchObject({ title: 'Sabah koşusu', myRole: 'ADMIN' });
    const sys = (await messages(m1, g.id)).filter((m) => m.kind === 'SYSTEM').map((m) => m.text);
    expect(sys.some((t) => t?.includes('gruptan ayrıldı'))).toBe(true);
  });

  it('anlık olaylar: bekleyen istek yeni mesajla hemen döner; son görülme gizlenebilir', async () => {
    const [a, b] = [await user(), await user({ showActivity: false })];
    await follow(b, a);
    const cid = (await open(a, b)).id;
    const first = (await http().get('/api/social/dm/events').set(bearer(b.accessToken)).expect(200)).body as { boot: string; seq: number; reset: boolean };
    expect(first.reset).toBe(true);
    const waiting = http().get('/api/social/dm/events').query({ boot: first.boot, after: first.seq }).set(bearer(b.accessToken));
    await new Promise((r) => setTimeout(r, 150));
    await send(a, cid, { text: 'anlık' }).expect(201);
    const res = (await waiting.expect(200)).body as { events: { type: string; conversationId: string }[] };
    expect(res.events).toEqual([expect.objectContaining({ type: 'message', conversationId: cid })]);

    // b etkinliğini gizlediği için a, b'nin çevrimiçi bilgisini görmez
    const detail = (await http().get(`/api/social/dm/conversations/${cid}`).set(bearer(a.accessToken)).expect(200)).body as { members: { id: string; online?: boolean | null }[] };
    expect(detail.members.find((m) => m.id === b.user.id)?.online).toBeNull();
    const unread = (await http().get('/api/social/dm/unread').set(bearer(b.accessToken)).expect(200)).body as { unread: number };
    expect(unread.unread).toBe(1);
    expect(await prisma.dmConversation.count({ where: { id: cid } })).toBe(1);
  });
});
