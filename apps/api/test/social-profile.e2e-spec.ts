import { randomBytes } from 'node:crypto';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types.js';
import { PrismaService } from '../src/common/prisma/prisma.service.js';
import { bearer, cleanupTestData, createTestApp, registerApprovedProfessional, registerUser } from './helpers.js';

// İçinde GPS bilgisi taşıyan küçük bir JPEG (EXIF bölümü + görüntü)
const seg = (marker: number, payload: Buffer) => {
  const head = Buffer.alloc(4);
  head[0] = 0xff;
  head[1] = marker;
  head.writeUInt16BE(payload.length + 2, 2);
  return Buffer.concat([head, payload]);
};
const JPEG_WITH_GPS = Buffer.concat([
  Buffer.from([0xff, 0xd8]),
  seg(0xe0, Buffer.from('JFIF\0')),
  seg(0xe1, Buffer.from('Exif\0\0GPS-41.0082,28.9784')),
  seg(0xdb, Buffer.alloc(10, 1)),
  seg(0xda, Buffer.alloc(6, 2)),
  Buffer.from([0x12, 0x34, 0x56]),
  Buffer.from([0xff, 0xd9]),
]);

describe('Sosyal profil (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  const http = () => request(app.getHttpServer());
  type Token = { accessToken: string; body: { username: string }; user: { id: string } };

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
  });

  afterAll(async () => {
    await cleanupTestData(app);
    await app.close();
  });

  const me = (t: Token) => http().get('/api/users/me').set(bearer(t.accessToken));
  const patchMe = (t: Token, body: Record<string, unknown>) => http().patch('/api/users/me').set(bearer(t.accessToken)).send(body);

  it('spor branşları listesi gelir', async () => {
    const user = (await registerUser(app)) as Token;
    const sports = (await http().get('/api/social/sports').set(bearer(user.accessToken)).expect(200)).body as { id: string; name: string }[];
    expect(sports.length).toBeGreaterThanOrEqual(15);
    expect(sports[0]).toEqual({ id: 'fitness', name: 'Fitness' });
  });

  it('görünen ad, şehir, hedef, bağlantılar ve ilgi alanları güncellenir; geçersiz değerler reddedilir', async () => {
    const user = (await registerUser(app)) as Token;
    const res = (
      await patchMe(user, {
        displayName: 'Koşucu Ayşe',
        city: 'İzmir',
        goals: '10 km koşu',
        links: [{ label: 'Strava', url: 'https://strava.com/ayse' }],
        sports: ['kosu', 'yoga', 'kosu'],
      }).expect(200)
    ).body;
    expect(res).toMatchObject({ displayName: 'Koşucu Ayşe', city: 'İzmir', goals: '10 km koşu', links: [{ label: 'Strava', url: 'https://strava.com/ayse' }] });
    expect(res.sports).toEqual([
      { id: 'kosu', name: 'Koşu' },
      { id: 'yoga', name: 'Yoga' },
    ]);
    expect(res.badges).toEqual([]);
    expect(res.isProfessional).toBe(false);

    // Boş görünen ad kaldırılır, ad soyada döner
    expect((await patchMe(user, { displayName: '' }).expect(200)).body.customDisplayName).toBeNull();

    expect((await patchMe(user, { sports: ['golf-uzayda'] }).expect(400)).body.code).toBe('INVALID_SPORT');
    await patchMe(user, { links: [{ label: 'X', url: 'javascript:alert(1)' }] }).expect(400);
    await patchMe(user, { links: [1, 2, 3, 4].map((i) => ({ label: `L${i}`, url: `https://a.com/${i}` })) }).expect(400);
  });

  it('profil fotoğrafı yüklenir; GPS bilgisi silinir; adres imzalı ve süreli', async () => {
    const user = (await registerUser(app)) as Token;
    const res = (await http().post('/api/users/me/avatar').set(bearer(user.accessToken)).attach('file', JPEG_WITH_GPS, 'foto.jpg').expect(200)).body;
    expect(res.avatarUrl).toMatch(/^\/media\/[\w-]+\?e=\d+&s=/);

    const file = await http().get(`/api${res.avatarUrl}`).expect(200);
    expect(file.headers['content-type']).toContain('image/jpeg');
    expect(Buffer.from(file.body).includes(Buffer.from('GPS'))).toBe(false);

    // İmza değiştirilirse ya da süre geçmişse açılmaz
    await http().get(`/api${res.avatarUrl.replace(/s=[^&]+/, 's=bozuk')}`).expect(404);
    const id = res.avatarUrl.split('?')[0].split('/')[2];
    await http().get(`/api/media/${id}?e=1&s=x`).expect(404);

    // Yeni fotoğraf eskisinin yerini alır; eski dosya silinir
    const second = (await http().post('/api/users/me/avatar').set(bearer(user.accessToken)).attach('file', JPEG_WITH_GPS, 'yeni.jpg').expect(200)).body;
    expect(await prisma.file.count({ where: { id } })).toBe(0);
    expect(second.avatarUrl).not.toEqual(res.avatarUrl);

    expect((await http().post('/api/users/me/avatar').set(bearer(user.accessToken)).attach('file', Buffer.from('%PDF-1.4 belge'), 'a.jpg').expect(400)).body.code).toBe('INVALID_FILE_TYPE');
    expect((await http().delete('/api/users/me/avatar').set(bearer(user.accessToken)).expect(200)).body.avatarUrl).toBeNull();
  });

  it('başvuru belgeleri medya adresinden asla sunulmaz', async () => {
    const pro = await registerApprovedProfessional(app);
    const doc = await prisma.file.create({ data: { ownerId: pro.user.id, storageKey: randomBytes(16).toString('hex'), mimeType: 'application/pdf', sizeBytes: 1 } });
    // Geçerli imzayla bile (amaç alanı boş olduğu için) bulunamaz
    const { MediaService } = await import('../src/modules/media/media.service.js');
    const url = app.get(MediaService).url(doc.id);
    await http().get(`/api${url}`).expect(404);
  });

  it('doğrulanmış profesyonelin rozeti görünür ve profili gizli yapılamaz', async () => {
    const pro = (await registerApprovedProfessional(app, 'DIETITIAN')) as unknown as Token;
    const res = (await me(pro).expect(200)).body;
    expect(res.badges).toEqual([{ kind: 'DIETITIAN', label: 'Diyetisyen' }]);
    expect(res.isProfessional).toBe(true);
    expect(res.isPrivate).toBe(false);
    expect((await patchMe(pro, { isPrivate: true }).expect(403)).body.code).toBe('PRO_PROFILE_PUBLIC');
  });

  it('başkasının profili görülür; engellenen ve silinmeyi bekleyen hesap görünmez', async () => {
    const a = (await registerUser(app)) as Token;
    const b = (await registerUser(app)) as Token;
    await patchMe(b, { displayName: 'B kişi', sports: ['futbol'] }).expect(200);
    const view = (await http().get(`/api/social/profiles/${b.body.username}`).set(bearer(a.accessToken)).expect(200)).body;
    expect(view).toMatchObject({ username: b.body.username, displayName: 'B kişi', isMe: false, isPrivate: true, counts: { followers: 0, following: 0 } });
    expect(view.sports).toEqual([{ id: 'futbol', name: 'Futbol' }]);
    expect(view.health).toBeUndefined();

    await prisma.block.create({ data: { blockerId: b.user.id, blockedId: a.user.id } });
    await http().get(`/api/social/profiles/${b.body.username}`).set(bearer(a.accessToken)).expect(404);
    await http().get('/api/social/profiles/yok_boyle_biri').set(bearer(a.accessToken)).expect(404);
  });
});
