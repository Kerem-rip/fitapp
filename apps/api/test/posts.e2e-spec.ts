import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types.js';
import { PrismaService } from '../src/common/prisma/prisma.service.js';
import { buildTestMp4 } from './fixtures/mp4.js';
import { bearer, cleanupTestData, createTestApp, registerUser } from './helpers.js';

// Küçük geçerli PNG başlığı + IEND (tür tespiti için yeterli)
const PNG = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  Buffer.from('0000000d49484452000000010000000108060000001f15c489', 'hex'),
  Buffer.from('0000000049454e44ae426082', 'hex'),
]);

describe('Gönderiler (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  const http = () => request(app.getHttpServer());
  type Token = { accessToken: string; body: { username: string }; user: { id: string } };
  type PostView = {
    id: string;
    text: string | null;
    media: { id: string; url: string; kind: string; durationMs: number | null }[];
    counts: { likes: number; comments: number };
    liked: boolean;
    saved: boolean;
    pinned: boolean;
    isMine: boolean;
    mentions: string[];
    quoted: { id: string; available: boolean } | null;
  };

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
    if (publicAccount) await http().patch('/api/users/me').set(bearer(t.accessToken)).send({ isPrivate: false }).expect(200);
    return t;
  };
  const upload = async (t: Token) => (await http().post('/api/social/media').set(bearer(t.accessToken)).attach('file', PNG, { filename: 'a.png', contentType: 'image/png' }).expect(201)).body as { id: string; url: string };
  const post = async (t: Token, body: Record<string, unknown>) => (await http().post('/api/social/posts').set(bearer(t.accessToken)).send(body).expect(201)).body as PostView;
  const view = (t: Token, id: string) => http().get(`/api/social/posts/${id}`).set(bearer(t.accessToken));

  it('metin ve fotoğrafla gönderi; etiket ve bahsetme kaydedilir; kurallar uygulanır', async () => {
    const [a, b] = [await user(), await user()];
    const m1 = await upload(a);
    const m2 = await upload(a);
    const p = await post(a, { text: `Sabah koşusu #Koşu #sabah @${b.body.username} @yok_boyle`, mediaIds: [m1.id, m2.id] });
    expect(p.media.map((m) => m.id)).toEqual([m1.id, m2.id]);
    expect(p.mentions).toEqual([b.body.username]);
    expect(p.isMine).toBe(true);
    const tags = await prisma.postHashtag.findMany({ where: { postId: p.id }, orderBy: { tag: 'asc' } });
    expect(tags.map((t) => t.tag)).toEqual(['koşu', 'sabah']);
    // Fotoğraf imzalı adresle okunur
    await http().get(`/api${p.media[0]!.url}`).expect(200);

    await http().post('/api/social/posts').set(bearer(a.accessToken)).send({ text: '   ' }).expect(400);
    // Aynı fotoğraf iki gönderide, başkasının fotoğrafı kullanılamaz
    await http().post('/api/social/posts').set(bearer(a.accessToken)).send({ mediaIds: [m1.id] }).expect(400);
    const mb = await upload(b);
    await http().post('/api/social/posts').set(bearer(a.accessToken)).send({ mediaIds: [mb.id] }).expect(400);
    const many = await Promise.all(Array.from({ length: 6 }, () => upload(a)));
    await http().post('/api/social/posts').set(bearer(a.accessToken)).send({ mediaIds: many.map((m) => m.id) }).expect(400);
    await http().post('/api/social/posts').set(bearer(a.accessToken)).send({ text: 'x'.repeat(2201) }).expect(400);
  });

  it('gizli hesabın gönderisi sadece kabul edilmiş takipçiye görünür; engel iki yönlü gizler', async () => {
    const owner = await user(false);
    const [fan, stranger] = [await user(), await user()];
    const p = await post(owner, { text: 'sadece takipçilere' });
    await view(stranger, p.id).expect(404);
    await http().get(`/api/social/users/${owner.user.id}/posts`).set(bearer(stranger.accessToken)).expect(404);

    await http().post(`/api/social/users/${owner.user.id}/follow`).set(bearer(fan.accessToken)).expect(200);
    await view(fan, p.id).expect(404);
    await http().post(`/api/social/follow-requests/${fan.user.id}/accept`).set(bearer(owner.accessToken)).expect(200);
    await view(fan, p.id).expect(200);
    const list = (await http().get(`/api/social/users/${owner.user.id}/posts`).set(bearer(fan.accessToken)).expect(200)).body as { items: PostView[] };
    expect(list.items.map((i) => i.id)).toEqual([p.id]);

    await http().post(`/api/social/users/${fan.user.id}/block`).set(bearer(owner.accessToken)).expect(200);
    await view(fan, p.id).expect(404);
  });

  it('beğeni, kaydetme, düzenleme, sabitleme ve silme', async () => {
    const [a, b] = [await user(), await user()];
    const p = await post(a, { text: 'ilk #eski' });
    expect((await http().post(`/api/social/posts/${p.id}/like`).set(bearer(b.accessToken)).expect(200)).body).toEqual({ liked: true, likes: 1 });
    await http().post(`/api/social/posts/${p.id}/like`).set(bearer(b.accessToken)).expect(200);
    expect(((await view(b, p.id).expect(200)).body as PostView)).toMatchObject({ liked: true, counts: { likes: 1 } });
    const likers = (await http().get(`/api/social/posts/${p.id}/likes`).set(bearer(a.accessToken)).expect(200)).body as { items: { id: string }[] };
    expect(likers.items.map((l) => l.id)).toEqual([b.user.id]);
    await http().delete(`/api/social/posts/${p.id}/like`).set(bearer(b.accessToken)).expect(200);

    await http().post(`/api/social/posts/${p.id}/save`).set(bearer(b.accessToken)).expect(200);
    const saved = (await http().get('/api/social/saved').set(bearer(b.accessToken)).expect(200)).body as { items: PostView[] };
    expect(saved.items.map((s) => s.id)).toEqual([p.id]);

    // Düzenleme: sadece sahibi; etiketler yenilenir
    await http().patch(`/api/social/posts/${p.id}`).set(bearer(b.accessToken)).send({ text: 'hack' }).expect(403);
    const edited = (await http().patch(`/api/social/posts/${p.id}`).set(bearer(a.accessToken)).send({ text: 'yeni #taze' }).expect(200)).body as PostView & { editedAt: string };
    expect(edited.text).toBe('yeni #taze');
    expect(edited.editedAt).toBeTruthy();
    expect((await prisma.postHashtag.findMany({ where: { postId: p.id } })).map((t) => t.tag)).toEqual(['taze']);

    // Sabitleme: en fazla 3
    const extra = await Promise.all([1, 2, 3].map((n) => post(a, { text: `ek ${n}` })));
    await http().post(`/api/social/posts/${p.id}/pin`).set(bearer(a.accessToken)).expect(200);
    await http().post(`/api/social/posts/${extra[0]!.id}/pin`).set(bearer(a.accessToken)).expect(200);
    await http().post(`/api/social/posts/${extra[1]!.id}/pin`).set(bearer(a.accessToken)).expect(200);
    await http().post(`/api/social/posts/${extra[2]!.id}/pin`).set(bearer(a.accessToken)).expect(409);
    const profile = (await http().get(`/api/social/users/${a.user.id}/posts`).set(bearer(b.accessToken)).expect(200)).body as { pinned: PostView[]; items: PostView[] };
    expect(profile.pinned).toHaveLength(3);
    expect(profile.items.map((i) => i.id)).toEqual([extra[2]!.id]);

    // Silme: sadece sahibi; fotoğraf da silinir
    const m = await upload(a);
    const withPhoto = await post(a, { mediaIds: [m.id] });
    await http().delete(`/api/social/posts/${withPhoto.id}`).set(bearer(b.accessToken)).expect(403);
    await http().delete(`/api/social/posts/${withPhoto.id}`).set(bearer(a.accessToken)).expect(200);
    await view(b, withPhoto.id).expect(404);
    expect(await prisma.file.count({ where: { id: m.id } })).toBe(0);
    // Silinen gönderi kaydedilenlerde görünmez
    await http().post(`/api/social/posts/${p.id}/save`).set(bearer(b.accessToken)).expect(200);
    await http().delete(`/api/social/posts/${p.id}`).set(bearer(a.accessToken)).expect(200);
    expect(((await http().get('/api/social/saved').set(bearer(b.accessToken)).expect(200)).body as { items: unknown[] }).items).toHaveLength(0);
  });

  it('yorum ve tek seviye yanıt; yorumu yazan ya da gönderi sahibi siler', async () => {
    const [a, b, c] = [await user(), await user(), await user()];
    const p = await post(a, { text: 'yorumlayın' });
    const c1 = (await http().post(`/api/social/posts/${p.id}/comments`).set(bearer(b.accessToken)).send({ text: 'harika' }).expect(201)).body as { id: string; canDelete: boolean };
    expect(c1.canDelete).toBe(true);
    const r1 = (await http().post(`/api/social/posts/${p.id}/comments`).set(bearer(c.accessToken)).send({ text: 'katılıyorum', parentId: c1.id }).expect(201)).body as { id: string; parentId: string };
    // Yanıtın yanıtı ana yorumun altına gider
    const r2 = (await http().post(`/api/social/posts/${p.id}/comments`).set(bearer(a.accessToken)).send({ text: 'teşekkürler', parentId: r1.id }).expect(201)).body as { parentId: string };
    expect(r1.parentId).toBe(c1.id);
    expect(r2.parentId).toBe(c1.id);

    const top = (await http().get(`/api/social/posts/${p.id}/comments`).set(bearer(c.accessToken)).expect(200)).body as { items: { id: string; replyCount: number; canDelete: boolean }[] };
    expect(top.items).toEqual([expect.objectContaining({ id: c1.id, replyCount: 2, canDelete: false })]);
    const replies = (await http().get(`/api/social/posts/${p.id}/comments/${c1.id}/replies`).set(bearer(b.accessToken)).expect(200)).body as { items: unknown[] };
    expect(replies.items).toHaveLength(2);
    expect(((await view(c, p.id).expect(200)).body as PostView).counts.comments).toBe(3);

    await http().delete(`/api/social/comments/${r1.id}`).set(bearer(b.accessToken)).expect(403);
    await http().delete(`/api/social/comments/${r1.id}`).set(bearer(a.accessToken)).expect(200);
    // Ana yorum silinince yanıtları da görünmez
    await http().delete(`/api/social/comments/${c1.id}`).set(bearer(b.accessToken)).expect(200);
    expect(((await view(c, p.id).expect(200)).body as PostView).counts.comments).toBe(0);
    await http().post(`/api/social/posts/${p.id}/comments`).set(bearer(b.accessToken)).send({ text: 'x'.repeat(501) }).expect(400);
  });

  it('video: en fazla 30 sn; konum bilgisi silinir; parça parça okunur; gönderide süresiyle görünür', async () => {
    const a = await user();
    const long = buildTestMp4({ seconds: 31 });
    const tooLong = await http().post('/api/social/media').set(bearer(a.accessToken)).attach('file', long, { filename: 'v.mp4', contentType: 'video/mp4' }).expect(400);
    expect(tooLong.body.code).toBe('VIDEO_TOO_LONG');

    const clip = buildTestMp4({ seconds: 12, location: '+41.0082+028.9784/' });
    const up = (await http().post('/api/social/media').set(bearer(a.accessToken)).attach('file', clip, { filename: 'v.mp4', contentType: 'video/mp4' }).expect(201)).body as { id: string; url: string; kind: string; durationMs: number };
    expect(up).toMatchObject({ kind: 'VIDEO', durationMs: 12000 });
    const full = await http().get(`/api${up.url}`).buffer(true).parse((res, cb) => {
      const chunks: Buffer[] = [];
      res.on('data', (c: Buffer) => chunks.push(c));
      res.on('end', () => cb(null, Buffer.concat(chunks)));
    }).expect(200);
    expect(full.headers['content-type']).toContain('video/mp4');
    expect((full.body as Buffer).includes(Buffer.from('+41.0082'))).toBe(false);
    const part = await http().get(`/api${up.url}`).set('Range', 'bytes=0-15').expect(206);
    expect(part.headers['content-range']).toBe(`bytes 0-15/${clip.length}`);
    await http().get(`/api${up.url}`).set('Range', `bytes=${clip.length + 10}-`).expect(416);

    const photo = await upload(a);
    const p = await post(a, { text: 'antrenman', mediaIds: [up.id, photo.id] });
    expect(p.media.map((m) => m.kind)).toEqual(['VIDEO', 'IMAGE']);
    expect(p.media[0]!.durationMs).toBe(12000);
  });

  it('alıntı: alıntılanan silinince ya da görülemeyince "görüntülenemiyor"', async () => {
    const [a, b] = [await user(), await user()];
    const original = await post(a, { text: 'orijinal' });
    const q = await post(b, { text: 'buna bakın', quotedPostId: original.id });
    expect(q.quoted).toMatchObject({ id: original.id, available: true });
    await http().delete(`/api/social/posts/${original.id}`).set(bearer(a.accessToken)).expect(200);
    expect(((await view(b, q.id).expect(200)).body as PostView).quoted).toEqual({ id: original.id, available: false });
    const hidden = await user(false);
    const secret = await post(hidden, { text: 'gizli' });
    await http().post('/api/social/posts').set(bearer(b.accessToken)).send({ quotedPostId: secret.id, text: 'x' }).expect(404);
  });
});
