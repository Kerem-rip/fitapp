// Demo başlangıç verisi. Tarihler her zaman "bugüne göre" üretilir, böylece uygulama hep canlı görünür.
// Bu dosya sadece demo içindir; gerçek yayında veriler sunucudan gelir.
import type { ClientRecord, DemoAccount, DemoState, ProProfile, SharedState, UserData } from './types';
import { dateKey, isoNow } from './dates';
import { PLATFORM_PROGRAMS, TRAINER_PROGRAMS } from './content';

export const DEMO_STATE_VERSION = 1;
export const DEMO_PASSWORD = 'Demo1234!';

const account = (a: Omit<DemoAccount, 'password' | 'isSeed'>): DemoAccount => ({ ...a, password: DEMO_PASSWORD, isSeed: true });

export const SEED_ACCOUNTS: DemoAccount[] = [
  account({
    id: 'acc-ayse', roleKey: 'user', email: 'ayse@demo.test', username: 'ayse_k', firstName: 'Ayşe', lastName: 'Korkmaz',
    birthDate: '1998-03-15', sex: 'female', city: 'İstanbul', bio: 'Evde spor, duruş egzersizleri ve dengeli beslenme.',
  }),
  account({
    id: 'acc-mert', roleKey: 'teen', email: 'mert@demo.test', username: 'mert_a', firstName: 'Mert', lastName: 'Aksoy',
    birthDate: '2011-06-20', sex: 'male', city: 'Ankara', bio: 'Basketbol ve yüzme.',
  }),
  account({
    id: 'acc-zeynep', roleKey: 'dietitian', email: 'zeynep@demo.test', username: 'dyt_zeynep', firstName: 'Zeynep', lastName: 'Arslan',
    birthDate: '1988-09-02', sex: 'female', city: 'İstanbul', title: 'Diyetisyen',
    bio: 'Kilo yönetimi ve sürdürülebilir beslenme. Planlar kişiye özel hazırlanır.',
  }),
  account({
    id: 'acc-burak', roleKey: 'trainer', email: 'burak@demo.test', username: 'burak_pt', firstName: 'Burak', lastName: 'Yıldız',
    birthDate: '1992-01-18', sex: 'male', city: 'Ankara', title: 'Bağımsız eğitmen',
    bio: 'Kuvvet ve evde antrenman. Online ve yüz yüze dersler.',
  }),
  account({
    id: 'acc-selim', roleKey: 'gymManager', email: 'selim@demo.test', username: 'selim_fit', firstName: 'Selim', lastName: 'Kaya',
    birthDate: '1985-11-30', sex: 'male', city: 'İstanbul', title: 'Salon yöneticisi', gymId: 'gym-fitmerkez',
    bio: 'Fit Merkez spor salonu yöneticisi.',
  }),
  account({
    id: 'acc-deniz', roleKey: 'gymStaff', email: 'deniz@demo.test', username: 'deniz_pt', firstName: 'Deniz', lastName: 'Kaya',
    birthDate: '1996-05-09', sex: 'female', city: 'İstanbul', title: 'Salon eğitmeni', gymId: 'gym-fitmerkez',
    bio: 'Pilates ve fonksiyonel antrenman eğitmeni.',
  }),
];

const weights = (values: number[]) =>
  values.map((kg, i) => ({ date: dateKey(-7 * (values.length - 1 - i)), kg }));

const emptyUserData = (): UserData => ({
  isPrivate: true,
  goal: 'maintain',
  heightCm: 170,
  weightKg: 70,
  activity: 'moderate',
  allergens: [],
  diet: 'none',
  targetKcal: null,
  meals: {},
  waterMl: {},
  weights: [],
  enrollments: {},
  consents: { health_data: false, marketing: false },
  sharing: { meals: false, weight: false, measurements: false, photos: false },
  parentalApproval: 'none',
  following: [],
  likes: [],
  saves: [],
  deletionRequestedAt: null,
});

export function newUserData(overrides: Partial<UserData> = {}): UserData {
  return { ...emptyUserData(), ...overrides };
}

const client = (c: Partial<ClientRecord> & Pick<ClientRecord, 'id' | 'name' | 'ageYears' | 'sex' | 'heightCm' | 'weightKg'>): ClientRecord => ({
  targetWeightKg: c.weightKg,
  goal: 'maintain',
  activity: 'moderate',
  allergens: [],
  diet: 'none',
  weights: weights([c.weightKg]),
  lastEntryDaysAgo: 1,
  sharing: { meals: true, weight: true, measurements: true, photos: false },
  mealsToday: [],
  note: '',
  ...c,
});

export const SEED_PROS: ProProfile[] = [
  { id: 'pro-zeynep', kind: 'dietitian', accountId: 'acc-zeynep', name: 'Dyt. Zeynep Arslan', title: 'Diyetisyen', city: 'İstanbul', mode: 'both', specialties: ['Kilo yönetimi', 'Sürdürülebilir beslenme'], rating: 4.9, clientCount: 48, followers: 312, bio: 'Kilo yönetimi ve sürdürülebilir beslenme. Planlar kişiye özel hazırlanır.', priceRange: 'Kendi beyanı' },
  { id: 'pro-murat', kind: 'dietitian', name: 'Dyt. Murat Aydın', title: 'Diyetisyen', city: 'İzmir', mode: 'online', specialties: ['Spor beslenmesi', 'Kas kazanımı'], rating: 4.7, clientCount: 31, followers: 188, bio: 'Sporcular ve aktif yaşayanlar için beslenme planları.', priceRange: 'Kendi beyanı' },
  { id: 'pro-elcin', kind: 'dietitian', name: 'Dyt. Elçin Tan', title: 'Diyetisyen', city: 'Bursa', mode: 'both', specialties: ['Vejetaryen beslenme', 'Çocuk ve ergen'], rating: 4.8, clientCount: 26, followers: 244, bio: 'Bitkisel beslenme ve aile beslenmesi.', priceRange: 'Kendi beyanı' },
  { id: 'pro-burak', kind: 'trainer', accountId: 'acc-burak', name: 'Burak Yıldız', title: 'Bağımsız eğitmen', city: 'Ankara', mode: 'both', specialties: ['Kuvvet', 'Evde antrenman'], rating: 4.8, clientCount: 22, followers: 145, bio: 'Kuvvet ve evde antrenman. Online ve yüz yüze dersler.', priceRange: 'Kendi beyanı' },
  { id: 'pro-aylin', kind: 'trainer', name: 'Aylin Sever', title: 'Eğitmen', city: 'İstanbul', mode: 'in_person', specialties: ['Pilates', 'Duruş egzersizleri'], rating: 4.9, clientCount: 35, followers: 276, bio: 'Pilates ve duruş egzersizleri üzerine çalışır.', priceRange: 'Kendi beyanı' },
  { id: 'pro-fitmerkez', kind: 'gym', accountId: 'acc-selim', name: 'Fit Merkez', title: 'Spor salonu', city: 'İstanbul · Kadıköy', mode: 'in_person', specialties: ['Fitness', 'Pilates', 'Spinning'], rating: 4.7, clientCount: 412, followers: 530, bio: 'Kadıköy\'de modern ekipmanlı spor salonu. Grup dersleri ve özel dersler.', priceRange: 'Aylık üyelik' },
  { id: 'pro-gucatolyesi', kind: 'gym', name: 'Güç Atölyesi', title: 'Spor salonu', city: 'Ankara · Çankaya', mode: 'in_person', specialties: ['Ağırlık', 'Fonksiyonel'], rating: 4.6, clientCount: 260, followers: 310, bio: 'Kuvvet antrenmanı odaklı salon.', priceRange: 'Aylık üyelik' },
  { id: 'pro-nefes', kind: 'gym', name: 'Nefes Studio', title: 'Stüdyo', city: 'İzmir · Alsancak', mode: 'in_person', specialties: ['Yoga', 'Pilates'], rating: 4.9, clientCount: 140, followers: 402, bio: 'Yoga ve pilates stüdyosu.', priceRange: 'Aylık üyelik' },
];

function buildSeedShared(): SharedState {
  const today = dateKey(0);
  const tomorrow = dateKey(1);
  const nowIso = isoNow();
  const minutesAgo = (m: number) => new Date(Date.now() - m * 60000).toISOString();
  const daysAgoIso = (d: number) => new Date(Date.now() - d * 86400000).toISOString();

  const clients: Record<string, ClientRecord> = {
    'cl-ayse': client({ id: 'cl-ayse', accountId: 'acc-ayse', name: 'Ayşe Korkmaz', ageYears: 28, sex: 'female', heightCm: 165, weightKg: 72, targetWeightKg: 66, goal: 'lose' }),
    'cl-elif': client({
      id: 'cl-elif', name: 'Elif K.', ageYears: 34, sex: 'female', heightCm: 165, weightKg: 76, targetWeightKg: 70, goal: 'lose',
      allergens: null, weights: weights([82, 80.5, 79.2, 78, 77, 76]), lastEntryDaysAgo: 1,
      mealsToday: [{ slot: 'breakfast', name: 'Yulaf, süt', kcal: 290 }, { slot: 'lunch', name: 'Mercimek çorbası', kcal: 180 }],
      note: 'Akşam yemeği için soru sordu.',
    }),
    'cl-can': client({
      id: 'cl-can', name: 'Can T.', ageYears: 41, sex: 'male', heightCm: 178, weightKg: 92, targetWeightKg: 84, goal: 'lose', activity: 'light',
      weights: weights([94, 93.5, 93, 92.6, 92.2, 92]), lastEntryDaysAgo: 5,
      sharing: { meals: false, weight: true, measurements: true, photos: false }, note: 'Ölçü girişi yapmıyor.',
    }),
    'cl-selin': client({
      id: 'cl-selin', name: 'Selin A.', ageYears: 27, sex: 'female', heightCm: 160, weightKg: 58, targetWeightKg: 58, goal: 'maintain', activity: 'active',
      allergens: ['milk'], weights: weights([58, 58.2, 58]), lastEntryDaysAgo: 2, note: 'Yeni plan bekliyor.',
    }),
    'cl-burcu': client({
      id: 'cl-burcu', name: 'Burcu Y.', ageYears: 45, sex: 'female', heightCm: 158, weightKg: 80, targetWeightKg: 70, goal: 'lose', activity: 'sedentary',
      allergens: ['egg'], weights: weights([84, 83, 82, 81.2, 80.5, 80]), lastEntryDaysAgo: 3,
    }),
    'cl-ahmet': client({ id: 'cl-ahmet', name: 'Ahmet S.', ageYears: 31, sex: 'male', heightCm: 180, weightKg: 82, targetWeightKg: 86, goal: 'muscle', activity: 'active', weights: weights([80, 80.6, 81, 81.5, 82]), lastEntryDaysAgo: 1, note: 'Haftalık uyum %90' }),
    'cl-naz': client({ id: 'cl-naz', name: 'Naz B.', ageYears: 29, sex: 'female', heightCm: 168, weightKg: 64, targetWeightKg: 62, goal: 'maintain', weights: weights([64, 64, 64.2]), lastEntryDaysAgo: 6, note: 'Sol diz hassasiyeti. Bu hafta antrenmanı atladı.' }),
    'cl-kaan': client({ id: 'cl-kaan', name: 'Kaan T.', ageYears: 24, sex: 'male', heightCm: 176, weightKg: 70, targetWeightKg: 75, goal: 'muscle', weights: weights([70]), lastEntryDaysAgo: 2, note: 'Yeni · program bekliyor.' }),
    'cl-derya': client({ id: 'cl-derya', name: 'Derya M.', ageYears: 36, sex: 'female', heightCm: 163, weightKg: 66, targetWeightKg: 60, goal: 'lose', weights: weights([69, 68, 67.2, 66.5, 66]), lastEntryDaysAgo: 2 }),
  };

  const link = (id: string, proId: string, clientId: string, daysAgo: number) => ({
    id, proId, clientId, status: 'active' as const, startedAt: daysAgoIso(daysAgo),
  });

  return {
    clients,
    clientLinks: [
      link('lnk-1', 'acc-zeynep', 'cl-ayse', 95),
      link('lnk-2', 'acc-zeynep', 'cl-elif', 120),
      link('lnk-3', 'acc-zeynep', 'cl-can', 60),
      link('lnk-4', 'acc-zeynep', 'cl-selin', 2),
      link('lnk-5', 'acc-zeynep', 'cl-burcu', 40),
      link('lnk-6', 'acc-burak', 'cl-ahmet', 150),
      link('lnk-7', 'acc-burak', 'cl-naz', 70),
      link('lnk-8', 'acc-burak', 'cl-kaan', 2),
      link('lnk-9', 'acc-burak', 'cl-derya', 45),
    ],
    plans: [],
    reviews: [
      { id: 'rev-1', proId: 'pro-zeynep', authorName: 'Elif K.', rating: 5, text: 'Planı çok kolay uyguladım, mutfakta yapılabilir şeylerle ilerledik.', clientFor: '4 ay', createdAt: daysAgoIso(20) },
      { id: 'rev-2', proId: 'pro-zeynep', authorName: 'Can T.', rating: 5, text: 'Sorularıma hep aynı gün cevap verdi.', clientFor: '2 ay', createdAt: daysAgoIso(35) },
      { id: 'rev-3', proId: 'pro-zeynep', authorName: 'Burcu Y.', rating: 4, text: 'Ölçülerim düzenli takip edildi, motive edici.', clientFor: '1 ay', createdAt: daysAgoIso(9) },
      { id: 'rev-4', proId: 'pro-burak', authorName: 'Ahmet S.', rating: 5, text: 'Program tam seviyeme göreydi, güçlendiğimi hissediyorum.', clientFor: '5 ay', createdAt: daysAgoIso(14) },
      { id: 'rev-5', proId: 'pro-burak', authorName: 'Derya M.', rating: 5, text: 'Online derslerde formumu çok iyi düzeltti.', clientFor: '1 ay', createdAt: daysAgoIso(6) },
      { id: 'rev-6', proId: 'pro-murat', authorName: 'Okan Y.', rating: 5, text: 'Spor beslenmesi planı çok net.', clientFor: '3 ay', createdAt: daysAgoIso(40) },
      { id: 'rev-7', proId: 'pro-aylin', authorName: 'Merve D.', rating: 5, text: 'Duruş egzersizleri günlük hayatımı rahatlattı.', clientFor: '2 ay', createdAt: daysAgoIso(11) },
    ],
    programs: [...PLATFORM_PROGRAMS, ...TRAINER_PROGRAMS],
    assignments: [{ id: 'asg-1', programId: 'burak-kuvvet-temeli', clientId: 'cl-ahmet', trainerId: 'acc-burak', at: daysAgoIso(30) }],
    appointments: [
      { id: 'apt-1', ownerId: 'acc-zeynep', title: 'İlk görüşme', clientName: 'Elif K.', date: today, time: '10:00', kind: 'online' },
      { id: 'apt-2', ownerId: 'acc-zeynep', title: 'Kontrol', clientName: 'Can T.', date: today, time: '11:30', kind: 'in_person' },
      { id: 'apt-3', ownerId: 'acc-zeynep', title: 'Plan teslimi', clientName: 'Selin A.', date: today, time: '14:00', kind: 'online' },
      { id: 'apt-4', ownerId: 'acc-zeynep', title: 'Aylık kontrol', clientName: 'Ayşe Korkmaz', date: tomorrow, time: '10:00', kind: 'online' },
      { id: 'apt-5', ownerId: 'acc-burak', title: 'Kuvvet dersi', clientName: 'Ahmet S.', date: today, time: '09:00', kind: 'online' },
      { id: 'apt-6', ownerId: 'acc-burak', title: 'Evde program', clientName: 'Naz B.', date: today, time: '13:00', kind: 'online' },
      { id: 'apt-7', ownerId: 'acc-burak', title: 'Kuvvet dersi', clientName: 'Kaan T.', date: today, time: '18:30', kind: 'in_person' },
      { id: 'apt-8', ownerId: 'acc-burak', title: 'Program değerlendirme', clientName: 'Derya M.', date: tomorrow, time: '12:00', kind: 'online' },
    ],
    conversations: [
      {
        id: 'cv-ayse-zeynep',
        a: { id: 'acc-ayse', name: 'Ayşe Korkmaz' },
        b: { id: 'acc-zeynep', name: 'Dyt. Zeynep Arslan' },
        messages: [
          { id: 'm1', fromId: 'acc-ayse', text: 'Merhaba, bu haftaki ölçülerimi girdim.', at: minutesAgo(2900) },
          { id: 'm2', fromId: 'acc-zeynep', text: 'Teşekkürler Ayşe, harika gidiyorsun. Akşam yemeklerinde protein payını biraz artıralım.', at: minutesAgo(2850) },
        ],
        reads: { 'acc-ayse': nowIso, 'acc-zeynep': nowIso },
      },
      {
        id: 'cv-zeynep-elif',
        a: { id: 'cl-elif', name: 'Elif K.' },
        b: { id: 'acc-zeynep', name: 'Dyt. Zeynep Arslan' },
        messages: [{ id: 'm3', fromId: 'cl-elif', text: 'Akşam yemeği için bir sorum var.', at: minutesAgo(80) }],
        reads: { 'acc-zeynep': minutesAgo(5000) },
      },
      {
        id: 'cv-zeynep-merve',
        a: { id: 'p-merve', name: 'Merve D.' },
        b: { id: 'acc-zeynep', name: 'Dyt. Zeynep Arslan' },
        messages: [{ id: 'm4', fromId: 'p-merve', text: 'Merhaba, kilo vermek istiyorum. Randevu alabilir miyim?', at: minutesAgo(45) }],
        reads: { 'acc-zeynep': minutesAgo(5000) },
      },
      {
        id: 'cv-zeynep-okan',
        a: { id: 'p-okan', name: 'Okan Y.' },
        b: { id: 'acc-zeynep', name: 'Dyt. Zeynep Arslan' },
        messages: [{ id: 'm5', fromId: 'p-okan', text: 'Fiyat bilgisi alabilir miyim?', at: minutesAgo(110) }],
        reads: { 'acc-zeynep': minutesAgo(5000) },
      },
      {
        id: 'cv-burak-naz',
        a: { id: 'cl-naz', name: 'Naz B.' },
        b: { id: 'acc-burak', name: 'Burak Yıldız' },
        messages: [{ id: 'm6', fromId: 'cl-naz', text: 'Bu hafta dizim ağrıdığı için antrenmanı atladım, ne yapayım?', at: minutesAgo(200) }],
        reads: { 'acc-burak': minutesAgo(5000) },
      },
      {
        id: 'cv-burak-emre',
        a: { id: 'p-emre', name: 'Emre T.' },
        b: { id: 'acc-burak', name: 'Burak Yıldız' },
        messages: [{ id: 'm7', fromId: 'p-emre', text: 'Evde antrenman programı için ders alabilir miyim?', at: minutesAgo(300) }],
        reads: { 'acc-burak': minutesAgo(5000) },
      },
    ],
    notifications: [
      { id: 'nt-1', toAccountId: 'acc-ayse', title: 'Hoş geldin', text: 'Dyt. Zeynep seni danışanı olarak ekledi.', at: daysAgoIso(95), read: true },
      { id: 'nt-2', toAccountId: 'acc-zeynep', title: 'Hatırlatıcı', text: 'Can T. 5 gündür kayıt girmedi.', at: minutesAgo(30), read: false },
      { id: 'nt-3', toAccountId: 'acc-deniz', title: 'Yeni görev', text: 'Yönetici sana "Ekipman bakımı" görevini atadı.', at: minutesAgo(90), read: false },
    ],
    gyms: [{ id: 'gym-fitmerkez', name: 'Fit Merkez', district: 'Kadıköy, İstanbul', hoursWeekday: '06:00–23:00', hoursWeekend: '08:00–20:00' }],
    gymStaff: [
      { id: 'st-onur', gymId: 'gym-fitmerkez', name: 'Onur A.', role: 'trainer', shifts: ['08:00–16:00', '08:00–16:00', '08:00–16:00', '08:00–16:00', '08:00–16:00', 'İzinli', 'İzinli'], invited: false },
      { id: 'st-deniz', gymId: 'gym-fitmerkez', accountId: 'acc-deniz', name: 'Deniz K.', role: 'trainer', shifts: ['12:00–20:00', '12:00–20:00', '12:00–20:00', '12:00–20:00', '12:00–20:00', '10:00–16:00', 'İzinli'], invited: false },
      { id: 'st-ece', gymId: 'gym-fitmerkez', name: 'Ece T.', role: 'reception', shifts: ['08:00–20:00', '08:00–20:00', '08:00–20:00', '08:00–20:00', '08:00–20:00', '08:00–20:00', 'İzinli'], invited: false },
    ],
    gymTasks: [
      { id: 'tk-1', gymId: 'gym-fitmerkez', title: 'Ekipman bakımı', assigneeId: 'st-deniz', due: 'Bugün', done: false, createdAt: minutesAgo(90) },
      { id: 'tk-2', gymId: 'gym-fitmerkez', title: 'Yeni üye karşılama', assigneeId: 'st-ece', due: 'Yarın', done: false, createdAt: minutesAgo(300) },
      { id: 'tk-3', gymId: 'gym-fitmerkez', title: 'Kardiyo alanı temizliği', assigneeId: 'st-onur', due: 'Bugün', done: false, createdAt: minutesAgo(400) },
      { id: 'tk-4', gymId: 'gym-fitmerkez', title: 'Soyunma odası kontrolü', assigneeId: 'st-ece', due: 'Bugün', done: true, createdAt: minutesAgo(600) },
      { id: 'tk-5', gymId: 'gym-fitmerkez', title: 'Grup dersi müziklerini hazırla', assigneeId: 'st-deniz', due: 'Yarın', done: false, createdAt: minutesAgo(200) },
    ],
    gymMembers: [
      { id: 'mb-1', gymId: 'gym-fitmerkez', name: 'Selin D.', membership: 'expiring', daysLeft: 5, privateLessonsLeft: 2, trainerId: 'st-deniz' },
      { id: 'mb-2', gymId: 'gym-fitmerkez', name: 'Kaan B.', membership: 'active', daysLeft: 120, privateLessonsLeft: 5, trainerId: 'st-deniz' },
      { id: 'mb-3', gymId: 'gym-fitmerkez', name: 'Arda M.', membership: 'active', daysLeft: 60, privateLessonsLeft: 3, trainerId: 'st-onur' },
      { id: 'mb-4', gymId: 'gym-fitmerkez', name: 'Ceren L.', membership: 'active', daysLeft: 200, privateLessonsLeft: 0 },
    ],
    gymLessons: [
      { id: 'ls-1', gymId: 'gym-fitmerkez', title: 'Özel ders', date: today, time: '10:00', trainerId: 'st-onur', kind: 'private', memberName: 'Arda M.' },
      { id: 'ls-2', gymId: 'gym-fitmerkez', title: 'Özel ders', date: today, time: '13:00', trainerId: 'st-deniz', kind: 'private', memberName: 'Selin D.' },
      { id: 'ls-3', gymId: 'gym-fitmerkez', title: 'Pilates', date: today, time: '18:00', trainerId: 'st-deniz', kind: 'group' },
      { id: 'ls-4', gymId: 'gym-fitmerkez', title: 'Özel ders', date: today, time: '19:00', trainerId: 'st-deniz', kind: 'private', memberName: 'Kaan B.' },
      { id: 'ls-5', gymId: 'gym-fitmerkez', title: 'Spinning', date: today, time: '19:30', trainerId: 'st-onur', kind: 'group' },
      { id: 'ls-6', gymId: 'gym-fitmerkez', title: 'Pilates', date: tomorrow, time: '18:00', trainerId: 'st-deniz', kind: 'group' },
      { id: 'ls-7', gymId: 'gym-fitmerkez', title: 'Özel ders', date: tomorrow, time: '11:00', trainerId: 'st-onur', kind: 'private', memberName: 'Arda M.' },
    ],
  };
}

function buildSeedUserData(): Record<string, UserData> {
  const today = dateKey(0);
  return {
    'acc-ayse': newUserData({
      isPrivate: true,
      goal: 'lose',
      heightCm: 165,
      weightKg: 72,
      activity: 'moderate',
      allergens: ['gluten', 'peanut'],
      weights: weights([76, 75.2, 74.5, 73.6, 72.8, 72]),
      meals: {
        [today]: [
          { id: 'me-1', slot: 'breakfast', foodId: 'omlet', servings: 1 },
          { id: 'me-2', slot: 'breakfast', foodId: 'zeytin', servings: 1 },
          { id: 'me-3', slot: 'breakfast', foodId: 'domates-salatalik', servings: 1 },
          { id: 'me-4', slot: 'snack', foodId: 'elma', servings: 1 },
        ],
      },
      waterMl: { [today]: 1250 },
      enrollments: { 'ev-baslangic': { startedAt: dateKey(-7), completedDays: [1, 2] } },
      consents: { health_data: true, marketing: false },
      sharing: { meals: true, weight: true, measurements: false, photos: false },
      following: ['pro-zeynep', 'pro-burak', 'pro-elcin'],
    }),
    'acc-mert': newUserData({
      isPrivate: true,
      goal: 'maintain',
      heightCm: 168,
      weightKg: 57,
      activity: 'light',
      waterMl: { [today]: 1200 },
      enrollments: { 'ev-baslangic': { startedAt: dateKey(-3), completedDays: [1] } },
      parentalApproval: 'requested',
    }),
  };
}

export function createSeed(): DemoState {
  return {
    version: DEMO_STATE_VERSION,
    session: null,
    accounts: SEED_ACCOUNTS,
    userData: buildSeedUserData(),
    shared: buildSeedShared(),
    ui: { themePref: 'system', onboarding: null },
  };
}
