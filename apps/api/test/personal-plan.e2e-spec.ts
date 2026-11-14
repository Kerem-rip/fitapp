import { randomUUID } from 'node:crypto';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types.js';
import { addLocalDays, localDay } from '../src/common/local-day.js';
import { PrismaService } from '../src/common/prisma/prisma.service.js';
import { bearer, cleanupTestData, createTestApp, registerUser } from './helpers.js';

const SCREENING_NO = { HEART_CONDITION: 'NO', CHEST_PAIN: 'NO', DIZZINESS: 'NO', PREGNANCY: 'NO', RECENT_SURGERY: 'NO', ACUTE_INJURY: 'NO', PAIN_NOW: 'NO', CHRONIC_CONDITION: 'NO', DOCTOR_ADVISED_NO: 'NO' };
const intakeBody = (over: Record<string, unknown> = {}) => ({
  goal: 'GENERAL_HEALTH',
  experience: 'BEGINNER',
  capacity: 'MEDIUM',
  setting: 'HOME_NONE',
  daysPerWeek: 3,
  minutesPerSession: 40,
  dailyActivity: 'LIGHT',
  sex: 'female',
  heightCm: 168,
  weightKg: 64,
  screening: SCREENING_NO,
  ...over,
});

describe('Kişisel 28 günlük program (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  const http = () => request(app.getHttpServer());
  type Token = { accessToken: string; user: { id: string } };
  type Entry = { index: number; section: string; itemId: string; optional: boolean; log: { status: string } | null; alternatives: { id: string }[]; original: unknown };
  type Day = { dayNumber: number; kind: string; date: string; entries: Entry[]; progress: { plannedMain: number; doneMain: number } };

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
  });

  afterAll(async () => {
    await cleanupTestData(app);
    await app.close();
  });

  const post = (t: Token, path: string, body: Record<string, unknown> = {}) => http().post(`/api/plan/${path}`).set(bearer(t.accessToken)).send(body);
  const get = (t: Token, path: string) => http().get(`/api/plan/${path}`).set(bearer(t.accessToken));
  const intake = async (t: Token, over: Record<string, unknown> = {}) => (await post(t, 'intake', intakeBody(over)).expect(201)).body as { intakeId: string; eligible: boolean; screening: { status: string; reasons: string[]; referToProfessional: boolean } };
  const buy = async (t: Token, key = randomUUID()) => (await post(t, 'purchases', { idempotencyKey: key }).expect(201)).body as { id: string; startWindowEndsAt: string; purchaseDay: string; demo: boolean };

  // Satın alıp bugün başlayan program
  const startPlan = async (t: Token, over: Record<string, unknown> = {}, startDate = localDay()) => {
    await intake(t, over);
    const purchase = await buy(t);
    const started = (await post(t, `purchases/${purchase.id}/start`, { startDate }).expect(200)).body as { instanceId: string };
    return { purchase, instanceId: started.instanceId };
  };
  // Test için takvimi kaydırır: program başlangıcı verilen güne alınır (günlerin tarihleri de)
  const shiftStart = async (instanceId: string, startDate: string) => {
    await prisma.planInstance.update({ where: { id: instanceId }, data: { startDate: new Date(`${startDate}T00:00:00Z`), endDate: new Date(`${addLocalDays(startDate, 27)}T00:00:00Z`) } });
    const days = await prisma.planDay.findMany({ where: { instanceId }, select: { id: true, dayNumber: true } });
    for (const d of days) await prisma.planDay.update({ where: { id: d.id }, data: { date: new Date(`${addLocalDays(startDate, d.dayNumber - 1)}T00:00:00Z`) } });
  };
  const dayOf = async (t: Token, instanceId: string, n: number) => (await get(t, `instances/${instanceId}/days/${n}`).expect(200)).body as Day;
  const logWeek = async (t: Token, instanceId: string, week: number, over: Record<string, unknown> = { rpe: 6 }) => {
    for (let n = (week - 1) * 7 + 1; n <= week * 7; n++) {
      const d = await dayOf(t, instanceId, n);
      if (d.kind !== 'TRAINING') continue;
      for (const e of d.entries.filter((x) => x.section === 'MAIN')) await post(t, `instances/${instanceId}/days/${n}/entries/${e.index}/log`, { status: 'DONE', ...over }).expect(200);
    }
  };

  it('kategoriler ve form seçenekleri; oturum gerekir', async () => {
    const t = (await registerUser(app)) as Token;
    const c = (await get(t, 'catalog').expect(200)).body as { categories: { id: string; subcategories: unknown[] }[]; minAge: number; startWindowDays: number; price: { demo: boolean; amountMinor: number | null } };
    expect(c.categories.map((x) => x.id)).toHaveLength(7);
    expect(c.categories.every((x) => x.subcategories.length > 0)).toBe(true);
    expect(c).toMatchObject({ minAge: 18, startWindowDays: 14, price: { demo: true, amountMinor: null } });
    await http().get('/api/plan/catalog').expect(401);
  });

  it('güvenlik kapısı: riskli ya da emin değilim cevabında program üretilmez ve satın alma engellenir; 18 yaş altı engellenir', async () => {
    const t = (await registerUser(app)) as Token;
    const r = await intake(t, { screening: { ...SCREENING_NO, CHEST_PAIN: 'YES' } });
    expect(r).toMatchObject({ eligible: false, screening: { status: 'BLOCKED', referToProfessional: true } });
    expect((await post(t, 'purchases', { idempotencyKey: randomUUID() }).expect(403)).body.code).toBe('NOT_ELIGIBLE');
    const unsure = await intake(t, { screening: { ...SCREENING_NO, CHRONIC_CONDITION: 'UNSURE' } });
    expect(unsure.eligible).toBe(false);
    // Eksik soru ve geçersiz değerler reddedilir
    await post(t, 'intake', intakeBody({ screening: { ...SCREENING_NO, DIZZINESS: undefined } })).expect(400);
    await post(t, 'intake', intakeBody({ heightCm: 40 })).expect(400);
    // 18 yaş altı
    const teen = (await registerUser(app)) as Token;
    await prisma.user.update({ where: { id: teen.user.id }, data: { birthDate: new Date(Date.now() - 17 * 365.25 * 86_400_000) } });
    const tr = await intake(teen);
    expect(tr).toMatchObject({ eligible: false });
    expect(tr.screening.reasons.join(' ')).toContain('18 yaş');
    await post(teen, 'purchases', { idempotencyKey: randomUUID() }).expect(403);
  });

  it('satın alma: aynı anahtar çift kayıt oluşturmaz; paralel istekler tek kayıt; bekleyen satın alma varken ikincisi yok', async () => {
    const t = (await registerUser(app)) as Token;
    await post(t, 'purchases', { idempotencyKey: randomUUID() }).expect(400); // form yok
    await intake(t);
    const key = randomUUID();
    const results = await Promise.all(Array.from({ length: 5 }, () => post(t, 'purchases', { idempotencyKey: key })));
    expect(results.map((r) => r.status)).toEqual([201, 201, 201, 201, 201]);
    expect(new Set(results.map((r) => (r.body as { id: string }).id)).size).toBe(1);
    expect(await prisma.planPurchase.count({ where: { userId: t.user.id } })).toBe(1);
    expect(results[0]!.body).toMatchObject({ demo: true, purchaseDay: localDay(), startWindowEndsAt: addLocalDays(localDay(), 14) });
    // Farklı anahtarla ikinci satın alma: başlangıç tarihi seçilmediği sürece reddedilir
    expect((await post(t, 'purchases', { idempotencyKey: randomUUID() }).expect(409)).body.code).toBe('PURCHASE_PENDING');
    const cur = (await get(t, 'current').expect(200)).body as { phase: string; purchase: { id: string } | null; instance: unknown };
    expect(cur).toMatchObject({ phase: 'AWAITING_START', instance: null });
    // Farklı kullanıcılar aynı anda farklı anahtarla: her biri kendi kaydını alır
    const other = (await registerUser(app)) as Token;
    await intake(other);
    await buy(other);
    expect(await prisma.planPurchase.count({ where: { userId: other.user.id } })).toBe(1);
  });

  it('başlangıç tarihi: geçmiş ve 14 günden uzak reddedilir; bir kez seçilir; başkası erişemez', async () => {
    const t = (await registerUser(app)) as Token;
    await intake(t);
    const p = await buy(t);
    const today = localDay();
    expect((await post(t, `purchases/${p.id}/start`, { startDate: addLocalDays(today, -1) }).expect(400)).body.code).toBe('START_IN_PAST');
    expect((await post(t, `purchases/${p.id}/start`, { startDate: addLocalDays(today, 15) }).expect(400)).body.code).toBe('START_TOO_LATE');
    await post(t, `purchases/${p.id}/start`, { startDate: 'yarın' }).expect(400);
    const other = (await registerUser(app)) as Token;
    await post(other, `purchases/${p.id}/start`, { startDate: today }).expect(404);

    const start = addLocalDays(today, 14);
    const ok = (await post(t, `purchases/${p.id}/start`, { startDate: start }).expect(200)).body as { instanceId: string; endDate: string };
    expect(ok.endDate).toBe(addLocalDays(start, 27));
    // Aynı istek tekrar: aynı program; farklı tarih: reddedilir
    expect((await post(t, `purchases/${p.id}/start`, { startDate: start }).expect(200)).body).toMatchObject({ instanceId: ok.instanceId });
    expect((await post(t, `purchases/${p.id}/start`, { startDate: today }).expect(409)).body.code).toBe('START_ALREADY_CHOSEN');
    expect(await prisma.planInstance.count({ where: { userId: t.user.id } })).toBe(1);
    await get(other, `instances/${ok.instanceId}`).expect(404);
    await get(other, `instances/${ok.instanceId}/days/1`).expect(404);

    // Başlangıç ileri tarihliyse program bekler; ilk hafta hazırdır ama günler henüz işaretlenemez
    const cur = (await get(t, 'current').expect(200)).body as { phase: string; instance: { startDate: string; currentDay: number | null } };
    expect(cur).toMatchObject({ phase: 'AWAITING_START', instance: { startDate: start, currentDay: null } });
    const d1 = await dayOf(t, ok.instanceId, 1);
    await post(t, `instances/${ok.instanceId}/days/1/entries/${d1.entries[0]!.index}/log`, { status: 'DONE' }).expect(400);
    // 2. hafta henüz hazırlanmadı
    expect((await get(t, `instances/${ok.instanceId}/days/8`).expect(404)).body.code).toBe('DAY_NOT_PREPARED');
  });

  it('günlük görev: işaretleme, atlama, zorlanma, ağrı güvenliği ve anlık alternatif', async () => {
    const t = (await registerUser(app)) as Token;
    const { instanceId } = await startPlan(t, { setting: 'GYM', experience: 'INTERMEDIATE', daysPerWeek: 4, goal: 'BUILD_MUSCLE' });
    const o = (await get(t, `instances/${instanceId}`).expect(200)).body as { days: { dayNumber: number; kind: string }[]; phase: string; engineVersion: string; level: number };
    expect(o).toMatchObject({ phase: 'ACTIVE', engineVersion: 'rules-1.0' });
    expect(o.days).toHaveLength(7);
    expect(o.days.filter((d) => d.kind === 'TRAINING')).toHaveLength(4);

    const first = o.days.find((d) => d.kind === 'TRAINING')!.dayNumber;
    const day = await dayOf(t, instanceId, first);
    expect(day.date).toBe(localDay());
    const mains = day.entries.filter((e) => e.section === 'MAIN');
    // Tamamlandı + zorlanma
    const done = (await post(t, `instances/${instanceId}/days/${first}/entries/${mains[0]!.index}/log`, { status: 'DONE', rpe: 7, actualReps: 12 }).expect(200)).body as { dayProgress: { doneMain: number } };
    expect(done.dayProgress.doneMain).toBe(1);
    // Atlandı
    await post(t, `instances/${instanceId}/days/${first}/entries/${mains[1]!.index}/log`, { status: 'SKIPPED' }).expect(200);
    await post(t, `instances/${instanceId}/days/${first}/entries/${mains[2]!.index}/log`, { status: 'DONE', rpe: 11 }).expect(400);
    // Ağrı: güvenlik mesajı, şiddetliyse uzmana yönlendirme
    const pain = (await post(t, `instances/${instanceId}/days/${first}/entries/${mains[2]!.index}/log`, { status: 'DONE', painArea: 'KNEE', painSharp: true }).expect(200)).body as { safety: string; seeProfessional: boolean };
    expect(pain.safety).toContain('doktora');
    expect(pain.seeProfessional).toBe(true);
    // Yarının günü işaretlenemez
    const tomorrow = o.days.find((d) => d.dayNumber > first && d.kind === 'TRAINING');
    if (tomorrow) await post(t, `instances/${instanceId}/days/${tomorrow.dayNumber}/entries/1/log`, { status: 'DONE' }).expect(400);

    // Anlık uyarlama: sadece önerilen alternatifler kabul edilir; yapılmış hareket değiştirilemez
    const fresh = await dayOf(t, instanceId, first);
    const target = fresh.entries.find((e) => e.section === 'MAIN' && e.log === null)!;
    expect(target.alternatives.length).toBeGreaterThan(0);
    await post(t, `instances/${instanceId}/days/${first}/entries/${target.index}/swap`, { itemId: 'face-cheek' }).expect(400);
    const swapped = (await post(t, `instances/${instanceId}/days/${first}/entries/${target.index}/swap`, { itemId: target.alternatives[0]!.id }).expect(200)).body as Day;
    const sw = swapped.entries.find((e) => e.index === target.index)!;
    expect(sw.itemId).toBe(target.alternatives[0]!.id);
    expect(sw.original).toMatchObject({ id: target.itemId });
    await post(t, `instances/${instanceId}/days/${first}/entries/${mains[0]!.index}/swap`, { itemId: 'plank' }).expect(409);
  });

  it('Görevlerim: program görevleri kaynağıyla birlikte günün listesinde, diğer kaynaklardan ayrı gelir', async () => {
    const t = (await registerUser(app)) as Token;
    const { instanceId } = await startPlan(t);
    await http().post('/api/library/programs/yuz-masaji-rutini/join').set(bearer(t.accessToken)).send({}).expect(201);
    const res = (await http().get(`/api/me/program?date=${localDay()}`).set(bearer(t.accessToken)).expect(200)).body as {
      personalPlan: { source: { kind: string; instanceId: string }; entries: { title: string }[] } | null;
      programs: { program: { id: string } }[];
    };
    expect(res.programs.map((p) => p.program.id)).toEqual(['yuz-masaji-rutini']);
    expect(res.personalPlan).toMatchObject({ source: { kind: 'SOCIALFIT_PLAN', instanceId } });
    expect(res.personalPlan!.entries.length).toBeGreaterThan(0);
    // Başkasının programı görünmez
    const other = (await registerUser(app)) as Token;
    const o = (await http().get(`/api/me/program?date=${localDay()}`).set(bearer(other.accessToken)).expect(200)).body as { personalPlan: unknown };
    expect(o.personalPlan).toBeNull();
  });

  it('haftalık uyarlama: hafta başladığında önceki haftanın performansına göre üretilir; ağrı bölgesi çıkar', async () => {
    const t = (await registerUser(app)) as Token;
    const { instanceId } = await startPlan(t, { daysPerWeek: 3 });
    const today = localDay();
    await shiftStart(instanceId, addLocalDays(today, -6));
    const before = await dayOf(t, instanceId, 1);
    const painful = before.entries.find((e) => e.section === 'MAIN')!;
    await logWeek(t, instanceId, 1, { rpe: 5 });
    // Bir harekette diz/bel/omuz ağrısı bildir
    const area = painful.itemId === 'squat' || painful.itemId === 'lunge' ? 'KNEE' : 'SHOULDER';
    await post(t, `instances/${instanceId}/days/1/entries/${painful.index}/log`, { status: 'DONE', rpe: 5, painArea: area }).expect(200);
    expect((await get(t, `instances/${instanceId}`).expect(200)).body).toMatchObject({ generatedWeeks: 1 });
    await shiftStart(instanceId, addLocalDays(today, -7));
    const o = (await get(t, `instances/${instanceId}`).expect(200)).body as { generatedWeeks: number; adaptationLog: string[]; pendingWeeks: unknown[] };
    expect(o.generatedWeeks).toBe(2);
    expect(o.pendingWeeks).toHaveLength(2);
    expect(o.adaptationLog.join(' ')).toContain('Hafta 2');
    const w2 = await dayOf(t, instanceId, 8);
    expect(w2.entries.length).toBeGreaterThan(0);
    // Ağrı bildirilen hareket, ikinci haftanın hiçbir gününde yok
    for (const n of [8, 9, 10, 11, 12, 13, 14]) {
      const d = await dayOf(t, instanceId, n);
      expect(d.entries.some((e) => e.itemId === painful.itemId)).toBe(false);
    }
    // Aynı hafta ikinci kez üretilmez
    await get(t, `instances/${instanceId}`).expect(200);
    expect(await prisma.planDay.count({ where: { instanceId } })).toBe(14);
  });

  it('28 günün tamamı: haftalar sırayla üretilir, hepsi yapılırsa TAMAMLANDI; süre dolması ayrı değerlendirilir; rapor ve yeni dönem', async () => {
    const t = (await registerUser(app)) as Token;
    const { instanceId } = await startPlan(t, { daysPerWeek: 3 });
    const today = localDay();
    for (let w = 1; w <= 4; w++) {
      await shiftStart(instanceId, addLocalDays(today, -(7 * w - 1)));
      await logWeek(t, instanceId, w, { rpe: 6 });
    }
    const done = (await get(t, 'current').expect(200)).body as { phase: string; instance: { generatedWeeks: number; progress: { allCompleted: boolean; completedDays: number; trainingDays: number } } };
    expect(done.instance.generatedWeeks).toBe(4);
    expect(done.instance.progress).toMatchObject({ allCompleted: true, completedDays: 12, trainingDays: 12 });
    expect(done.phase).toBe('COMPLETED');

    // Süre dolunca: rapor oluşur, durum TAMAMLANDI kalır, yeniden satın alma beklenir
    await shiftStart(instanceId, addLocalDays(today, -30));
    const ended = (await get(t, 'current').expect(200)).body as { phase: string; awaitingRepurchase: boolean; canPurchase: boolean; instance: { hasReport: boolean } };
    expect(ended).toMatchObject({ phase: 'COMPLETED', awaitingRepurchase: true, canPurchase: true });
    expect(ended.instance.hasReport).toBe(true);
    const rep = (await get(t, `instances/${instanceId}/report`).expect(200)).body as { final: boolean; report: { totals: { completionRate: number; completedDays: number }; weeks: unknown[]; disclaimer: string } };
    expect(rep.final).toBe(true);
    expect(rep.report.totals).toMatchObject({ completionRate: 1, completedDays: 12 });
    expect(rep.report.weeks).toHaveLength(4);
    expect(rep.report.disclaimer).toContain('garantisi');
    // Bittikten sonra kayıt eklenemez
    const d1 = await dayOf(t, instanceId, 1);
    await post(t, `instances/${instanceId}/days/1/entries/${d1.entries.find((e) => e.section === 'MAIN')!.index}/log`, { status: 'DONE' }).expect(409);

    // Yeni satın alma: ölçüler ve hedefler yeniden doğrulanmadan olmaz (form, programdan önce doldurulmuştu)
    await prisma.planIntake.updateMany({ where: { userId: t.user.id }, data: { createdAt: new Date(Date.now() - 20 * 86_400_000) } });
    expect((await post(t, 'purchases', { idempotencyKey: randomUUID() }).expect(409)).body.code).toBe('INTAKE_RECONFIRM');
    const reconfirm = (await get(t, 'intake/prefill').expect(200)).body as { needsConfirmation: boolean };
    expect(reconfirm.needsConfirmation).toBe(true);
    await intake(t, { weightKg: 62, goal: 'LOSE_FAT' });
    const p2 = await buy(t);
    const second = (await post(t, `purchases/${p2.id}/start`, { startDate: today }).expect(200)).body as { instanceId: string };
    expect(second.instanceId).not.toBe(instanceId);

    // Yeni program bağımsızdır; eski program olduğu gibi korunur
    const first = await prisma.planDay.findMany({ where: { instanceId }, orderBy: { dayNumber: 'asc' } });
    const next = await prisma.planDay.findMany({ where: { instanceId: second.instanceId }, orderBy: { dayNumber: 'asc' } });
    expect(first).toHaveLength(28);
    expect(next).toHaveLength(7);
    expect(JSON.stringify(next.map((d) => d.entries))).not.toEqual(JSON.stringify(first.slice(0, 7).map((d) => d.entries)));
    const inst2 = await prisma.planInstance.findUniqueOrThrow({ where: { id: second.instanceId } });
    expect(inst2).toMatchObject({ sequence: 2, previousInstanceId: instanceId, engineVersion: 'rules-1.0' });
    expect(await prisma.planEntryLog.count({ where: { instanceId } })).toBeGreaterThan(0);
  });

  it('süresi dolan program TAMAMLANDI sayılmaz; kaçırılan antrenmanlar ileriye yığılmaz ve bitiş tarihi değişmez', async () => {
    const t = (await registerUser(app)) as Token;
    const { instanceId } = await startPlan(t, { daysPerWeek: 3 });
    const today = localDay();
    const start = addLocalDays(today, -28);
    await shiftStart(instanceId, start);
    const before = await prisma.planInstance.findUniqueOrThrow({ where: { id: instanceId } });
    const cur = (await get(t, 'current').expect(200)).body as { phase: string; awaitingRepurchase: boolean; instance: { generatedWeeks: number; endDate: string } };
    expect(cur).toMatchObject({ phase: 'EXPIRED', awaitingRepurchase: true });
    expect(cur.instance.endDate).toBe(addLocalDays(start, 27));
    expect(cur.instance.generatedWeeks).toBe(4);
    const rep = (await get(t, `instances/${instanceId}/report`).expect(200)).body as { final: boolean; report: { totals: { completionRate: number; skippedMain: number }; notes: string[] } };
    expect(rep).toMatchObject({ final: true, report: { totals: { completionRate: 0 } } });
    expect(rep.report.totals.skippedMain).toBeGreaterThan(0);
    // Hiç yapılmayan haftalarda yük artmaz (kaçırılanlar sonraki güne yığılmaz: gün sayısı sabit)
    const days = await prisma.planDay.findMany({ where: { instanceId, kind: 'TRAINING' } });
    expect(days).toHaveLength(12);
    expect(before.endDate.toISOString().slice(0, 10)).toBe(addLocalDays(start, 27));
  });

  it('başlangıç penceresi (14 gün) kaçırılırsa program son günde otomatik başlar; tekrar istek aynı programı verir', async () => {
    const t = (await registerUser(app)) as Token;
    await intake(t);
    const p = await buy(t);
    const purchaseDay = addLocalDays(localDay(), -15);
    await prisma.planPurchase.update({ where: { id: p.id }, data: { purchaseDay: new Date(`${purchaseDay}T00:00:00Z`) } });
    const cur = (await get(t, 'current').expect(200)).body as { phase: string; purchase: unknown; instance: { startDate: string; endDate: string; currentDay: number | null } };
    // Son gün = satın alma günü + 14; program o günden itibaren 28 gün kesintisiz ilerler
    const start = addLocalDays(purchaseDay, 14);
    expect(cur.purchase).toBeNull();
    expect(cur.instance).toMatchObject({ startDate: start, endDate: addLocalDays(start, 27), currentDay: 2 });
    expect(cur.phase).toBe('ACTIVE');
    expect(await prisma.planInstance.count({ where: { userId: t.user.id } })).toBe(1);
    // Kullanıcı sonradan tarih seçmeye çalışırsa yeni program oluşmaz; aynı program döner
    const again = (await post(t, `purchases/${p.id}/start`, { startDate: localDay() }).expect(200)).body as { instanceId: string; startDate: string };
    expect(again.startDate).toBe(start);
    expect(await prisma.planInstance.count({ where: { userId: t.user.id } })).toBe(1);
    // Görevlerim'de de görünür
    const tasks = (await http().get(`/api/me/program?date=${localDay()}`).set(bearer(t.accessToken)).expect(200)).body as { personalPlan: unknown };
    expect(tasks.personalPlan).not.toBeNull();
  });
});
