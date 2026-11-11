import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types.js';
import { PrismaService } from '../src/common/prisma/prisma.service.js';
import { STANDARD_QUESTIONS } from '../src/modules/clients/intake-template.js';
import {
  bearer,
  birthDateForAge,
  cleanupTestData,
  createActiveRelationship,
  createTestApp,
  registerApprovedProfessional,
  registerProfessional,
  registerUser,
} from './helpers.js';

describe('Danışan dosyası: ölçümler, anamnez, notlar (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  const http = () => request(app.getHttpServer());

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
  });

  afterAll(async () => {
    await cleanupTestData(app);
    await app.close();
  });

  const weight = (value: number, extra: Record<string, unknown> = {}) => ({ kind: 'WEIGHT', value, method: 'SCALE', ...extra });
  const addSelf = (token: string, body: Record<string, unknown>) => http().post('/api/me/health/measurements').set(bearer(token)).send(body);
  const addByPro = (token: string, clientId: string, body: Record<string, unknown>) =>
    http().post(`/api/clients/${clientId}/measurements`).set(bearer(token)).send(body);
  const summary = (token: string, clientId: string) => http().get(`/api/clients/${clientId}/file`).set(bearer(token));
  const daysAgo = (n: number) => new Date(Date.now() - n * 86_400_000).toISOString();

  describe('ölçümler', () => {
    it('danışan kendi ölçümünü girer; değer yuvarlanır ve birim eklenir', async () => {
      const { client } = await createActiveRelationship(app);
      const res = await addSelf(client.accessToken, weight(70.26)).expect(201);
      expect(res.body).toMatchObject({ kind: 'WEIGHT', value: 70.3, unit: 'kg', method: 'SCALE', source: 'SELF', voided: false });
      const list = await http().get('/api/me/health/measurements').set(bearer(client.accessToken)).expect(200);
      expect(list.body).toHaveLength(1);
    });

    it('sağlık verisi rızası olmayan (ve 18 yaş altı) kişi ölçüm kaydedemez', async () => {
      const noConsent = await registerUser(app);
      expect((await addSelf(noConsent.accessToken, weight(70)).expect(403)).body.code).toBe('HEALTH_CONSENT_REQUIRED');
      const teen = await registerUser(app, { birthDate: birthDateForAge(15) });
      expect((await addSelf(teen.accessToken, weight(60)).expect(403)).body.code).toBe('HEALTH_CONSENT_REQUIRED');
    });

    it('imkânsız değer, uygunsuz yöntem ve gelecek tarih reddedilir', async () => {
      const { client } = await createActiveRelationship(app);
      expect((await addSelf(client.accessToken, weight(700)).expect(400)).body.code).toBe('INVALID_VALUE');
      expect((await addSelf(client.accessToken, weight(70, { method: 'TAPE' })).expect(400)).body.code).toBe('INVALID_METHOD');
      expect((await addSelf(client.accessToken, weight(70, { takenAt: new Date(Date.now() + 86_400_000).toISOString() })).expect(400)).body.code).toBe('INVALID_DATE');
      await addSelf(client.accessToken, weight(70, { takenAt: daysAgo(3) })).expect(201);
    });

    it('uzman sadece paylaşılan kategoriye ölçüm girer; kaynak ve kimin girdiği kaydedilir', async () => {
      const { pro, client } = await createActiveRelationship(app, { sharedData: ['WEIGHT'] });
      const ok = await addByPro(pro.accessToken, client.user.id, weight(82.5)).expect(201);
      expect(ok.body).toMatchObject({ source: 'PROFESSIONAL', value: 82.5 });
      expect(ok.body.enteredBy.username).toBe(pro.body.username);
      expect(await prisma.auditLog.count({ where: { targetUserId: client.user.id, action: 'DATA_CHANGED', category: 'WEIGHT' } })).toBe(1);

      const denied = await addByPro(pro.accessToken, client.user.id, { kind: 'WAIST', value: 90, method: 'TAPE' }).expect(403);
      expect(denied.body.code).toBe('NO_ACCESS');
      const log = await prisma.auditLog.findMany({ where: { targetUserId: client.user.id, action: 'ACCESS_DENIED' } });
      expect(log).toHaveLength(1);
      expect(log[0]).toMatchObject({ category: 'MEASUREMENTS', meta: { reason: 'NOT_SHARED' } });
    });

    it('yanlış giriş silinmez, geçersiz işaretlenir; herkes sadece kendi girdiğini geçersiz kılar', async () => {
      const { pro, client } = await createActiveRelationship(app, { sharedData: ['WEIGHT'] });
      const mine = (await addSelf(client.accessToken, weight(70)).expect(201)).body.id as string;
      const theirs = (await addByPro(pro.accessToken, client.user.id, weight(71)).expect(201)).body.id as string;

      expect((await http().post(`/api/me/health/measurements/${theirs}/void`).set(bearer(client.accessToken)).send({}).expect(403)).body.code).toBe('NOT_YOURS');
      expect((await http().post(`/api/clients/${client.user.id}/measurements/${mine}/void`).set(bearer(pro.accessToken)).send({}).expect(403)).body.code).toBe('NOT_YOURS');

      await http().post(`/api/me/health/measurements/${mine}/void`).set(bearer(client.accessToken)).send({ reason: 'Yanlış yazdım' }).expect(200);
      expect((await http().post(`/api/me/health/measurements/${mine}/void`).set(bearer(client.accessToken)).send({}).expect(409)).body.code).toBe('ALREADY_VOIDED');
      await http().post(`/api/clients/${client.user.id}/measurements/${theirs}/void`).set(bearer(pro.accessToken)).send({}).expect(200);

      const visible = await http().get('/api/me/health/measurements').set(bearer(client.accessToken)).expect(200);
      expect(visible.body).toHaveLength(0);
      const all = await http().get('/api/me/health/measurements?includeVoided=true').set(bearer(client.accessToken)).expect(200);
      expect(all.body).toHaveLength(2);
      expect(all.body.find((m: { id: string }) => m.id === mine).voidReason).toBe('Yanlış yazdım');
    });

    it('uzman ölçüm listesini sadece paylaşılan türler için görür', async () => {
      const { pro, client } = await createActiveRelationship(app, { sharedData: ['WEIGHT'] });
      await addSelf(client.accessToken, weight(70)).expect(201);
      await addSelf(client.accessToken, { kind: 'WAIST', value: 80, method: 'TAPE' }).expect(201);

      const all = await http().get(`/api/clients/${client.user.id}/measurements`).set(bearer(pro.accessToken)).expect(200);
      expect(all.body.map((m: { kind: string }) => m.kind)).toEqual(['WEIGHT']);
      expect((await http().get(`/api/clients/${client.user.id}/measurements?kind=WAIST`).set(bearer(pro.accessToken)).expect(403)).body.code).toBe('NO_ACCESS');
    });
  });

  describe('dosya özeti', () => {
    it('sadece paylaşılan kategoriler görünür; en yeni ölçüm öne çıkar', async () => {
      const { pro, client } = await createActiveRelationship(app, { sharedData: ['WEIGHT'] });
      await addSelf(client.accessToken, weight(80, { takenAt: daysAgo(10) })).expect(201);
      await addSelf(client.accessToken, weight(78, { takenAt: daysAgo(2) })).expect(201);
      await addSelf(client.accessToken, { kind: 'WAIST', value: 90, method: 'TAPE' }).expect(201);

      const res = await summary(pro.accessToken, client.user.id).expect(200);
      expect(res.body.sharing.visible).toEqual(['WEIGHT']);
      expect(res.body.measurements.map((m: { kind: string; value: number }) => [m.kind, m.value])).toEqual([['WEIGHT', 78]]);
      expect(res.body.profile).toBeNull();
      expect(res.body.anamnesis).toBeNull();
    });

    it('görünür kategoriler listesi öğün ve antrenman kayıtlarını da kapsar (diğer sekmeler için)', async () => {
      const { pro, client } = await createActiveRelationship(app, { sharedData: ['MEALS', 'WORKOUTS'] });
      const res = await summary(pro.accessToken, client.user.id).expect(200);
      expect([...(res.body.sharing.visible as string[])].sort((a, b) => a.localeCompare(b))).toEqual(['MEALS', 'WORKOUTS']);
      // Sadece görünürlük bilgisi; bu kategoriler için okuma kaydı yazılmaz
      expect(await prisma.auditLog.count({ where: { targetUserId: client.user.id, action: 'DATA_VIEWED', category: { in: ['MEALS', 'WORKOUTS'] } } })).toBe(0);
    });

    it('anamnez paylaşılınca yaş, cinsiyet ve eksik sorular görünür', async () => {
      const { pro, client } = await createActiveRelationship(app);
      const res = await summary(pro.accessToken, client.user.id).expect(200);
      expect(res.body.profile).toMatchObject({ ageYears: 25 });
      expect(res.body.anamnesis.total).toBe(STANDARD_QUESTIONS.length);
      expect(res.body.anamnesis.answered).toBe(0);
      expect(res.body.anamnesis.missing).toHaveLength(STANDARD_QUESTIONS.length);
      expect(res.body.anamnesis.highlights.length).toBeGreaterThan(0);
    });

    it('danışanlığı olmayan uzman özeti açamaz; rıza geri çekilince dosya boşalır', async () => {
      const { pro, client } = await createActiveRelationship(app);
      const stranger = await registerApprovedProfessional(app);
      expect((await summary(stranger.accessToken, client.user.id).expect(403)).body.code).toBe('NO_ACCESS');

      await addSelf(client.accessToken, weight(70)).expect(201);
      await http().delete('/api/consents/health_data').set(bearer(client.accessToken)).expect(200);
      const res = await summary(pro.accessToken, client.user.id).expect(200);
      expect(res.body.sharing.visible).toEqual([]);
      expect(res.body.measurements).toEqual([]);
      expect(res.body.anamnesis).toBeNull();
    });

    it('aynı uzmanın art arda bakması denetim kaydını şişirmez', async () => {
      const { pro, client } = await createActiveRelationship(app, { sharedData: ['WEIGHT'] });
      await summary(pro.accessToken, client.user.id).expect(200);
      await summary(pro.accessToken, client.user.id).expect(200);
      expect(await prisma.auditLog.count({ where: { targetUserId: client.user.id, action: 'DATA_VIEWED', category: 'WEIGHT' } })).toBe(1);
    });
  });

  describe('anamnez', () => {
    it('danışan standart soruları görür ve yanıtlar; aynı yanıt tekrar kaydedilmez, değişiklik geçmişte kalır', async () => {
      const { client } = await createActiveRelationship(app);
      const view = await http().get('/api/me/health/anamnesis').set(bearer(client.accessToken)).expect(200);
      expect(view.body.templateStatus).toBe('DRAFT');
      expect(view.body.questions).toHaveLength(STANDARD_QUESTIONS.length);

      const put = (key: string, value: unknown) =>
        http().put(`/api/me/health/anamnesis/${key}`).set(bearer(client.accessToken)).send({ value });
      expect((await put('std.allergies', ['egg']).expect(200)).body.changed).toBe(true);
      expect((await put('std.allergies', ['egg']).expect(200)).body.changed).toBe(false);
      expect((await put('std.allergies', ['egg', 'milk']).expect(200)).body.changed).toBe(true);
      expect(await prisma.intakeAnswer.count({ where: { userId: client.user.id, questionKey: 'std.allergies' } })).toBe(2);

      const after = await http().get('/api/me/health/anamnesis').set(bearer(client.accessToken)).expect(200);
      const allergies = after.body.questions.find((q: { key: string }) => q.key === 'std.allergies');
      expect(allergies.answer.value).toEqual(['egg', 'milk']);
      expect(allergies.answer.source).toBe('SELF');
    });

    it('geçersiz yanıtlar reddedilir', async () => {
      const { client } = await createActiveRelationship(app);
      const put = (key: string, value: unknown) =>
        http().put(`/api/me/health/anamnesis/${key}`).set(bearer(client.accessToken)).send({ value });
      for (const [key, value] of [
        ['std.allergies', ['none', 'egg']],
        ['std.allergies', ['uzay']],
        ['std.allergies', []],
        ['std.pregnancy', 'belki'],
        ['std.sleep_hours', 40],
        ['std.sleep_hours', 'yedi'],
        ['std.medications', ''],
      ] as const) {
        expect((await put(key, value).expect(400)).body.code).toBe('INVALID_ANSWER');
      }
      expect((await put('std.yok', 'x').expect(404)).body.code).toBe('QUESTION_NOT_FOUND');
    });

    it('uzman yanıtı görür ve görüşmede danışan adına kaydeder; kaynak ayrı gösterilir', async () => {
      const { pro, client } = await createActiveRelationship(app);
      await http().put('/api/me/health/anamnesis/std.sleep_hours').set(bearer(client.accessToken)).send({ value: 6 }).expect(200);

      const view = await http().get(`/api/clients/${client.user.id}/anamnesis`).set(bearer(pro.accessToken)).expect(200);
      expect(view.body.questions.find((q: { key: string }) => q.key === 'std.sleep_hours').answer.value).toBe(6);

      await http().put(`/api/clients/${client.user.id}/anamnesis/std.sleep_hours`).set(bearer(pro.accessToken)).send({ value: 7 }).expect(200);
      const again = await http().get(`/api/clients/${client.user.id}/anamnesis`).set(bearer(pro.accessToken)).expect(200);
      const q = again.body.questions.find((x: { key: string }) => x.key === 'std.sleep_hours');
      expect(q.answer).toMatchObject({ value: 7, source: 'PROFESSIONAL' });
      expect(q.answer.answeredBy).toContain('Uzman');
      expect(await prisma.auditLog.count({ where: { targetUserId: client.user.id, action: 'DATA_CHANGED', category: 'ANAMNESIS' } })).toBe(1);
    });

    it('anamnez paylaşılmıyorsa uzman ne okur ne yazar', async () => {
      const { pro, client } = await createActiveRelationship(app, { sharedData: ['WEIGHT'] });
      await http().get(`/api/clients/${client.user.id}/anamnesis`).set(bearer(pro.accessToken)).expect(403);
      await http().put(`/api/clients/${client.user.id}/anamnesis/std.sleep_hours`).set(bearer(pro.accessToken)).send({ value: 7 }).expect(403);
    });
  });

  describe('uzmanın kendi soruları', () => {
    const addQuestion = (token: string, body: Record<string, unknown>) =>
      http().post('/api/intake/questions').set(bearer(token)).send(body);

    it('uzman soru ekler; danışanı görür ve yanıtlar; uzman yanıtı okur; kapatılınca soru kalkar', async () => {
      const { pro, client } = await createActiveRelationship(app);
      const created = await addQuestion(pro.accessToken, { text: 'Hafta sonu beslenmen nasıl?', type: 'SINGLE_CHOICE', options: ['Düzenli', 'Düzensiz'] }).expect(201);
      const key = created.body.key as string;

      const view = await http().get('/api/me/health/anamnesis').set(bearer(client.accessToken)).expect(200);
      const q = view.body.questions.find((x: { key: string }) => x.key === key);
      expect(q.askedBy).toContain('Uzman');
      expect(q.options.map((o: { value: string }) => o.value)).toEqual(['Düzenli', 'Düzensiz']);

      await http().put(`/api/me/health/anamnesis/${key}`).set(bearer(client.accessToken)).send({ value: 'Düzensiz' }).expect(200);
      await http().put(`/api/me/health/anamnesis/${key}`).set(bearer(client.accessToken)).send({ value: 'Belki' }).expect(400);
      const proView = await http().get(`/api/clients/${client.user.id}/anamnesis`).set(bearer(pro.accessToken)).expect(200);
      expect(proView.body.questions.find((x: { key: string }) => x.key === key).answer.value).toBe('Düzensiz');

      await http().post(`/api/intake/questions/${(key as string).replace('custom.', '')}/deactivate`).set(bearer(pro.accessToken)).expect(200);
      const gone = await http().get('/api/me/health/anamnesis').set(bearer(client.accessToken)).expect(200);
      expect(gone.body.questions.some((x: { key: string }) => x.key === key)).toBe(false);
    });

    it('başka uzmanın sorusu görünmez ve yanıtlanamaz; onaysız uzman soru ekleyemez; seçenek kuralları', async () => {
      const first = await createActiveRelationship(app);
      const other = await registerApprovedProfessional(app);
      const created = await addQuestion(other.accessToken, { text: 'Başka uzmanın sorusu', type: 'TEXT' }).expect(201);

      const view = await http().get('/api/me/health/anamnesis').set(bearer(first.client.accessToken)).expect(200);
      expect(view.body.questions.some((x: { key: string }) => x.key === created.body.key)).toBe(false);
      await http().put(`/api/me/health/anamnesis/${created.body.key}`).set(bearer(first.client.accessToken)).send({ value: 'x' }).expect(404);
      await http().put(`/api/clients/${first.client.user.id}/anamnesis/${created.body.key}`).set(bearer(first.pro.accessToken)).send({ value: 'x' }).expect(403);

      const pending = await registerProfessional(app);
      expect((await addQuestion(pending.accessToken, { text: 'Deneme sorusu', type: 'TEXT' }).expect(403)).body.code).toBe('NOT_A_PROFESSIONAL');
      expect((await addQuestion(first.pro.accessToken, { text: 'Tek seçenekli', type: 'SINGLE_CHOICE', options: ['Sadece bir'] }).expect(400)).body.code).toBe('INVALID_OPTIONS');
      expect((await addQuestion(first.pro.accessToken, { text: 'Metin sorusu', type: 'TEXT', options: ['a'] }).expect(400)).body.code).toBe('INVALID_OPTIONS');
    });
  });

  describe('notlar', () => {
    it('uzman not ekler ve okur; danışanlık bitince yeni not yazamaz ama eski notlarını okur; başkası okuyamaz', async () => {
      const { pro, client, id } = await createActiveRelationship(app);
      await http().post(`/api/clients/${client.user.id}/notes`).set(bearer(pro.accessToken)).send({ text: 'İlk görüşme yapıldı.' }).expect(201);
      const list = await http().get(`/api/clients/${client.user.id}/notes`).set(bearer(pro.accessToken)).expect(200);
      expect(list.body.map((n: { text: string }) => n.text)).toEqual(['İlk görüşme yapıldı.']);

      const stranger = await registerApprovedProfessional(app);
      await http().get(`/api/clients/${client.user.id}/notes`).set(bearer(stranger.accessToken)).expect(403);
      await http().post(`/api/clients/${client.user.id}/notes`).set(bearer(stranger.accessToken)).send({ text: 'x' }).expect(403);

      await http().post(`/api/relationships/${id}/end`).set(bearer(client.accessToken)).expect(200);
      await http().post(`/api/clients/${client.user.id}/notes`).set(bearer(pro.accessToken)).send({ text: 'Bitti' }).expect(403);
      await http().get(`/api/clients/${client.user.id}/notes`).set(bearer(pro.accessToken)).expect(200);
      // Danışanlık bitince sağlık verisi kapanır
      await summary(pro.accessToken, client.user.id).expect(403);
    });
  });

  describe('zaman çizelgesi', () => {
    it('ölçüm, anamnez yanıtı ve not tek çizelgede en yeniden eskiye sıralanır', async () => {
      const { pro, client } = await createActiveRelationship(app);
      await addSelf(client.accessToken, weight(80, { takenAt: daysAgo(5) })).expect(201);
      await http().put('/api/me/health/anamnesis/std.allergies').set(bearer(client.accessToken)).send({ value: ['egg'] }).expect(200);
      await http().post(`/api/clients/${client.user.id}/notes`).set(bearer(pro.accessToken)).send({ text: 'Not' }).expect(201);

      const res = await http().get(`/api/clients/${client.user.id}/timeline`).set(bearer(pro.accessToken)).expect(200);
      const items = res.body as { type: string; at: string; display?: string }[];
      expect(items.map((i) => i.type)).toEqual(['NOTE', 'ANSWER', 'MEASUREMENT']);
      expect(items[1]!.display).toBe('Yumurta');
      expect(items.map((i) => i.at)).toEqual(items.map((i) => i.at).sort().reverse());
    });

    it('paylaşılmayan kategori çizelgede görünmez', async () => {
      const { pro, client } = await createActiveRelationship(app, { sharedData: ['WEIGHT'] });
      await addSelf(client.accessToken, weight(80)).expect(201);
      await http().put('/api/me/health/anamnesis/std.allergies').set(bearer(client.accessToken)).send({ value: ['egg'] }).expect(200);
      const res = await http().get(`/api/clients/${client.user.id}/timeline`).set(bearer(pro.accessToken)).expect(200);
      expect((res.body as { type: string }[]).map((i) => i.type)).toEqual(['MEASUREMENT']);
    });
  });

  it('giriş yapmadan hiçbir adres açılmaz', async () => {
    await http().get('/api/clients/x/file').expect(401);
    await http().get('/api/me/health/anamnesis').expect(401);
    await http().post('/api/intake/questions').send({}).expect(401);
  });
});
