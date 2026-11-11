// Demo içeriği: egzersizler, programlar, rehberler, uzman ipuçları.
// Gerçek yayında bunlar admin panelinden yönetilir; videolar sonradan eklenir (kodla eşleşir).
import type { Exercise, ExerciseCategory, Level, Program, ProgramDay } from './types';

export const CATEGORY_LABELS: Record<ExerciseCategory, string> = {
  fitness: 'Fitness',
  home: 'Evde',
  posture: 'Duruş',
  face: 'Yüz masajı',
};

export const LEVEL_LABELS: Record<Level, string> = {
  beginner: 'Başlangıç',
  intermediate: 'Orta',
  advanced: 'İleri',
};

function ex(
  id: string,
  name: string,
  category: ExerciseCategory,
  level: Level,
  equipment: string,
  duration: string,
  primary: string[],
  secondary: string[],
  steps: string[],
  mistakes: string[],
  warnings: string[],
): Exercise {
  return { id, name, category, level, equipment, duration, primary, secondary, steps, mistakes, warnings };
}

const KNEE = 'Dizinde keskin ağrı hissedersen dur.';
const BACK = 'Belinde ağrı hissedersen dur; ağrı sürerse doktora başvur.';

export const EXERCISES: Exercise[] = [
  ex('squat', 'Squat', 'home', 'beginner', 'Ekipmansız', '3 × 12 tekrar', ['Ön bacak', 'Kalça'], ['Arka bacak', 'Karın'],
    ['Ayaklarını omuz genişliğinde aç.', 'Göğsünü dik tutup kalçanı geriye ve aşağı it.', 'Uyluklar yere paralel olunca dur.', 'Topuklarından iterek ayağa kalk.'],
    ['Dizlerin içe kapanması', 'Topukların yerden kalkması'], [KNEE]),
  ex('push-up', 'Şınav', 'home', 'beginner', 'Ekipmansız', '3 × 8 tekrar', ['Göğüs', 'Arka kol'], ['Ön omuz', 'Karın'],
    ['Ellerini omuzlarının hizasında yere koy.', 'Vücudunu baştan topuğa düz bir çizgide tut.', 'Göğsün yere yaklaşana kadar in.', 'Yere iterek başlangıca dön.'],
    ['Belin çökmesi', 'Dirseklerin çok açılması'], ['Zorlanırsan dizlerini yere koyarak yap.']),
  ex('plank', 'Plank', 'home', 'beginner', 'Ekipmansız', '3 × 30 saniye', ['Karın', 'Core'], ['Omuz', 'Kalça'],
    ['Dirseklerini omuzlarının altına koy.', 'Vücudunu baştan topuğa düz tut.', 'Karnını hafifçe içeri çek ve nefes almaya devam et.'],
    ['Kalçanın havaya kalkması', 'Nefesi tutmak'], [BACK]),
  ex('lunge', 'Ters hamle', 'home', 'intermediate', 'Ekipmansız', '3 × 10 tekrar (her bacak)', ['Ön bacak', 'Kalça'], ['Arka bacak', 'Denge kasları'],
    ['Dik dur, bir ayağınla geriye büyük bir adım at.', 'Her iki dizin yaklaşık 90 derece olana kadar in.', 'Ön topuğundan iterek başlangıca dön.'],
    ['Ön dizin ayak ucunu geçmesi', 'Gövdenin öne eğilmesi'], [KNEE]),
  ex('glute-bridge', 'Kalça köprüsü', 'home', 'beginner', 'Ekipmansız', '3 × 15 tekrar', ['Kalça', 'Arka bacak'], ['Karın', 'Bel'],
    ['Sırtüstü yat, dizlerini bük, ayaklarını yere bas.', 'Kalçanı omuzlarınla dizlerin aynı çizgide olana kadar kaldır.', 'Tepede bir saniye sık ve yavaşça in.'],
    ['Belin aşırı kavislenmesi'], [BACK]),
  ex('bird-dog', 'Kuş-köpek', 'home', 'beginner', 'Ekipmansız', '3 × 10 tekrar (her yan)', ['Core', 'Bel'], ['Kalça', 'Omuz'],
    ['Dört ayak üzerine gel; eller omuz, dizler kalça altında.', 'Sağ kolunu ve sol bacağını aynı anda uzat.', 'Kalçanı sabit tutup başlangıca dön, tarafı değiştir.'],
    ['Kalçanın yana kayması'], [BACK]),
  ex('dumbbell-row', 'Dambıl çekiş', 'fitness', 'beginner', 'Dambıl, bank', '3 × 10 tekrar (her kol)', ['Sırt', 'Arka omuz'], ['Pazı'],
    ['Bir elini ve dizini banka koy, sırtını düz tut.', 'Dambılı karnına doğru dirseğinle çek.', 'Kürek kemiğini sıkıp yavaşça indir.'],
    ['Gövdeyi sallamak', 'Ağırlığı omuzla çekmek'], [BACK]),
  ex('overhead-press', 'Omuz press', 'fitness', 'intermediate', 'Dambıl', '3 × 10 tekrar', ['Omuz'], ['Arka kol', 'Üst göğüs'],
    ['Dambılları omuz hizasında tut.', 'Karnını sıkıp kollarını yukarı doğru uzat.', 'Kontrollü şekilde omuz hizasına indir.'],
    ['Belin geriye kavislenmesi'], ['Omzunda ağrı hissedersen dur.']),
  ex('lat-pulldown', 'Kablo yukarıdan çekiş', 'fitness', 'beginner', 'Kablo makinesi', '3 × 12 tekrar', ['Sırt kanatları'], ['Pazı', 'Arka omuz'],
    ['Tutacağı omuzlarından biraz geniş tut.', 'Göğsünü dik tutup tutacağı köprücük kemiğine çek.', 'Kollarını kontrollü şekilde yukarı bırak.'],
    ['Gövdeyi geriye atmak'], ['Ağırlığı gövde sallamadan çekebileceğin seviyede tut.']),
  ex('leg-press', 'Leg press', 'fitness', 'beginner', 'Makine', '3 × 12 tekrar', ['Ön bacak', 'Kalça'], ['Arka bacak'],
    ['Sırtını ve kalçanı minderden ayırma.', 'Ayaklarını omuz genişliğinde platforma koy.', 'Dizlerini bükerek in, topuklarından iterek uzat.'],
    ['Dizleri tamamen kilitlemek', 'Kalçanın minderden kalkması'], [KNEE]),
  ex('romanian-deadlift', 'Romanya ölü kaldırma', 'fitness', 'intermediate', 'Dambıl', '3 × 10 tekrar', ['Arka bacak', 'Kalça'], ['Bel', 'Sırt'],
    ['Dambılları uyluklarının önünde tut.', 'Dizlerini hafif bükerek kalçanı geriye it.', 'Dambıllar diz hizasına inince kalçanı öne iterek kalk.'],
    ['Sırtın yuvarlanması'], [BACK]),
  ex('wall-angel', 'Duvar melek', 'posture', 'beginner', 'Ekipmansız', '2 × 10 tekrar', ['Omuz arkası', 'Üst sırt'], ['Boyun', 'Göğüs'],
    ['Sırtını, kalçanı ve başını duvara yasla.', 'Kollarını dirsekten bükerek duvara bastır.', 'Kollarını duvar boyunca yukarı kaydır, sonra indir.'],
    ['Belin duvardan ayrılması', 'Omuzların yukarı kalkması'], ['Ağrın varsa önce doktora başvur.']),
  ex('chin-tuck', 'Çene geri çekme (boyun)', 'posture', 'beginner', 'Ekipmansız', '3 × 10 tekrar', ['Derin boyun kasları'], ['Üst sırt'],
    ['Dik otur veya dur, bakışın karşıda olsun.', 'Çeneni boynunu uzatarak geriye çek (çift çene yapar gibi).', 'Beş saniye tut ve bırak.'],
    ['Başı aşağı eğmek'], ['Boynunda uyuşma veya baş dönmesi olursa bırak ve doktora başvur.']),
  ex('cat-cow', 'Kedi-inek', 'posture', 'beginner', 'Ekipmansız', '2 × 10 tekrar', ['Omurga', 'Karın'], ['Omuz'],
    ['Dört ayak üzerine gel.', 'Nefes verirken sırtını yuvarla, çeneni göğsüne yaklaştır.', 'Nefes alırken göğsünü aç ve sırtını hafifçe kavisle.'],
    ['Çok hızlı yapmak'], [BACK]),
  ex('doorway-stretch', 'Kapı eşiğinde göğüs açma', 'posture', 'beginner', 'Kapı eşiği', '3 × 30 saniye', ['Göğüs', 'Ön omuz'], ['Pazı'],
    ['Kolunu dirsekten 90 derece bük, kapı pervazına yasla.', 'Bir adım ileri çıkıp göğsünü hafifçe öne aç.', 'Göğsünde gerilme hissedince 30 saniye bekle.'],
    ['Belin öne kavislenmesi'], ['Omzunda keskin ağrı olursa bırak.']),
  ex('scapular-squeeze', 'Kürek kemiği sıkma', 'posture', 'beginner', 'Ekipmansız', '3 × 12 tekrar', ['Orta sırt', 'Kürek çevresi'], ['Arka omuz'],
    ['Dik otur, kollarını yanlarında rahat bırak.', 'Kürek kemiklerini birbirine yaklaştır.', 'Üç saniye sık ve bırak.'],
    ['Omuzları kulağa çekmek'], ['Ağrın varsa önce doktora başvur.']),
  ex('hip-flexor-stretch', 'Kalça önü germe', 'posture', 'beginner', 'Ekipmansız', '3 × 30 saniye (her bacak)', ['Kalça önü'], ['Ön bacak'],
    ['Bir dizinin üstüne çök, diğer ayağını öne koy.', 'Kalçanı hafifçe öne ver, gövdeni dik tut.', 'Kalça önünde gerilme hissedince 30 saniye bekle.'],
    ['Belin kavislenmesi'], [KNEE]),
  ex('face-temple', 'Şakak masajı', 'face', 'beginner', 'Parmak uçları', '1 dakika', ['Şakak çevresi'], [],
    ['Ellerini temiz tut, parmak uçlarını şakaklarına koy.', 'Hafif baskıyla küçük daireler çiz.', 'Nefesini yavaş ver ve bir dakika devam et.'],
    ['Çok sert bastırmak'], ['Cildin hassassa veya yüzünde yara varsa uygulama.']),
  ex('face-brow', 'Alın ve kaş masajı', 'face', 'beginner', 'Parmak uçları', '1 dakika', ['Alın', 'Kaş çevresi'], [],
    ['Parmak uçlarını kaş arasına koy.', 'Hafif baskıyla alnın ortasından saç çizgisine doğru ilerle.', 'Kaşlarının üstünden dışa doğru kaydır.'],
    ['Cildi çekiştirmek'], ['Cildin hassassa veya yüzünde yara varsa uygulama.']),
  ex('face-cheek', 'Yanak ve çene hattı masajı', 'face', 'beginner', 'Parmak uçları', '2 dakika', ['Yanak', 'Çene hattı'], [],
    ['Parmaklarını çenenin ortasına koy.', 'Hafif baskıyla kulağa doğru kaydır.', 'Yanaklarında küçük daireler çizerek bitir.'],
    ['Cildi aşağı doğru çekmek'], ['Cildin hassassa veya yüzünde yara varsa uygulama.']),
];

export function findExercise(id: string): Exercise | undefined {
  return EXERCISES.find((e) => e.id === id);
}

// ───────────── Programlar ─────────────

function buildDays(templates: string[][], count: number): ProgramDay[] {
  return Array.from({ length: count }, (_, i) => ({
    title: `Gün ${i + 1}`,
    exerciseIds: templates[i % templates.length]!,
  }));
}

export const PLATFORM_PROGRAMS: Program[] = [
  {
    id: 'ev-baslangic',
    title: 'Evde başlangıç',
    description: 'Ekipmansız, 4 haftada temel güç ve dayanıklılık. Yeni başlayanlar için.',
    level: 'beginner',
    weeks: 4,
    daysPerWeek: 3,
    category: 'home',
    authorId: null,
    authorName: 'fitapp',
    status: 'published',
    days: buildDays(
      [
        ['squat', 'push-up', 'glute-bridge', 'plank'],
        ['lunge', 'bird-dog', 'plank', 'glute-bridge'],
        ['squat', 'lunge', 'push-up', 'bird-dog'],
      ],
      12,
    ),
  },
  {
    id: 'masa-basi-durus',
    title: 'Masa başı duruş programı',
    description: 'Gün boyu oturanlar için boyun, omuz ve kalça rahatlatma egzersizleri.',
    level: 'beginner',
    weeks: 3,
    daysPerWeek: 5,
    category: 'posture',
    authorId: null,
    authorName: 'fitapp',
    status: 'published',
    days: buildDays(
      [
        ['wall-angel', 'chin-tuck', 'scapular-squeeze'],
        ['doorway-stretch', 'cat-cow', 'hip-flexor-stretch'],
        ['chin-tuck', 'wall-angel', 'cat-cow'],
      ],
      15,
    ),
  },
  {
    id: 'yuz-masaji-rutini',
    title: 'Sabah 10 dakika yüz masajı',
    description: 'Rahatlatan ve kan dolaşımını destekleyen sabah yüz masajı rutini.',
    level: 'beginner',
    weeks: 2,
    daysPerWeek: 7,
    category: 'face',
    authorId: null,
    authorName: 'fitapp',
    status: 'published',
    days: buildDays([['face-temple', 'face-brow', 'face-cheek']], 14),
  },
  {
    id: 'salon-baslangic',
    title: 'Salon başlangıç',
    description: 'Salona yeni başlayanlar için makine ve dambıl ağırlıklı 6 haftalık program.',
    level: 'beginner',
    weeks: 6,
    daysPerWeek: 3,
    category: 'fitness',
    authorId: null,
    authorName: 'fitapp',
    status: 'published',
    days: buildDays(
      [
        ['leg-press', 'lat-pulldown', 'overhead-press'],
        ['romanian-deadlift', 'dumbbell-row', 'plank'],
        ['leg-press', 'dumbbell-row', 'overhead-press'],
      ],
      18,
    ),
  },
];

export const TRAINER_PROGRAMS: Program[] = [
  {
    id: 'burak-kuvvet-temeli',
    title: 'Kuvvet temeli',
    description: 'Temel hareketlerle 8 haftada kuvvet artışı.',
    level: 'intermediate',
    weeks: 8,
    daysPerWeek: 3,
    category: 'fitness',
    authorId: 'acc-burak',
    authorName: 'Burak Yıldız',
    status: 'published',
    days: buildDays(
      [
        ['squat', 'dumbbell-row', 'overhead-press'],
        ['romanian-deadlift', 'push-up', 'plank'],
        ['leg-press', 'lat-pulldown', 'lunge'],
      ],
      24,
    ),
  },
  {
    id: 'burak-durus-duzeltme',
    title: 'Duruş düzeltme',
    description: 'Omuz ve sırt için 3 haftalık egzersiz rutini.',
    level: 'beginner',
    weeks: 3,
    daysPerWeek: 4,
    category: 'posture',
    authorId: 'acc-burak',
    authorName: 'Burak Yıldız',
    status: 'draft',
    days: buildDays([['wall-angel', 'scapular-squeeze', 'cat-cow']], 12),
  },
  {
    id: 'burak-ileri-kuvvet',
    title: 'Kuvvet ileri seviye',
    description: 'Deneyimliler için 10 haftalık kuvvet programı.',
    level: 'advanced',
    weeks: 10,
    daysPerWeek: 4,
    category: 'fitness',
    authorId: 'acc-burak',
    authorName: 'Burak Yıldız',
    status: 'pending',
    days: buildDays([['romanian-deadlift', 'overhead-press', 'dumbbell-row', 'plank']], 40),
  },
];

// ───────────── Beslenme rehberleri ─────────────

export interface Article {
  id: string;
  title: string;
  minutes: number;
  tag: 'Diyet türü' | 'Alışkanlık';
  summary: string;
  sections: { heading: string; text: string }[];
  forTeens: boolean;
}

export const ARTICLES: Article[] = [
  {
    id: 'akdeniz',
    title: 'Akdeniz tipi beslenme',
    minutes: 4,
    tag: 'Diyet türü',
    summary: 'Sebze, baklagil, zeytinyağı ve balık ağırlıklı, sürdürülmesi kolay bir beslenme düzeni.',
    forTeens: false,
    sections: [
      { heading: 'Nedir', text: 'Sebze, meyve, baklagil, tam tahıl, zeytinyağı ve balığı öne çıkarır; kırmızı et ve işlenmiş gıdayı azaltır.' },
      { heading: 'Kimlere uygun olabilir', text: 'Dengeli ve uzun süre sürdürülebilir bir düzen arayanlara uygun olabilir.' },
      { heading: 'Dikkat', text: 'Balık, süt ürünü veya gluten alerjisi varsa seçimler değişir. Size uygun olup olmadığını öğrenmek için bir diyetisyene danışın.' },
    ],
  },
  {
    id: 'aralikli-oruc',
    title: 'Aralıklı oruç',
    minutes: 4,
    tag: 'Diyet türü',
    summary: 'Yemek yenen ve yenmeyen saatleri düzenleyen bir yaklaşım.',
    forTeens: false,
    sections: [
      { heading: 'Nedir', text: 'Günün belirli saatlerinde yemek yeme, diğer saatlerde yememe düzenidir (ör. 8 saat yeme, 16 saat ara).' },
      { heading: 'Kimler kaçınmalı', text: 'Hamileler, emziren anneler, yeme bozukluğu geçmişi olanlar, diyabet ve tansiyon ilacı kullananlar ile 18 yaş altı bu düzeni denememelidir.' },
      { heading: 'Dikkat', text: 'Başlamadan önce bir diyetisyen veya doktora danışın.' },
    ],
  },
  {
    id: 'vejetaryen',
    title: 'Vejetaryen beslenme',
    minutes: 3,
    tag: 'Diyet türü',
    summary: 'Et ve balık yenmeyen, bitkisel kaynaklı protein ağırlıklı beslenme.',
    forTeens: false,
    sections: [
      { heading: 'Nedir', text: 'Et ve balık yerine baklagil, yumurta, süt ürünleri ve tam tahıllarla protein alınır.' },
      { heading: 'Dikkat', text: 'B12, demir ve çinko takibi önemlidir. Plan için diyetisyen desteği alın.' },
    ],
  },
  {
    id: 'yuksek-protein',
    title: 'Yüksek protein beslenme',
    minutes: 3,
    tag: 'Diyet türü',
    summary: 'Kas koruma ve tokluk için protein payını artıran beslenme.',
    forTeens: false,
    sections: [
      { heading: 'Nedir', text: 'Her öğüne tavuk, balık, yumurta, yoğurt veya baklagil ekleyerek protein payını artırır.' },
      { heading: 'Dikkat', text: 'Böbrek sorunu olanlar önce doktora danışmalıdır. Aşırıya kaçmak yerine dengeli kalın.' },
    ],
  },
  {
    id: 'dengeli-tabak',
    title: 'Dengeli tabak nasıl olur',
    minutes: 3,
    tag: 'Alışkanlık',
    summary: 'Tabağın yarısı sebze, çeyreği protein, çeyreği tahıl.',
    forTeens: true,
    sections: [
      { heading: 'Basit kural', text: 'Tabağının yarısını sebze veya salata, çeyreğini protein (yumurta, tavuk, baklagil), çeyreğini tahıl (pilav, ekmek, makarna) yap.' },
      { heading: 'İpucu', text: 'Yemeği yavaş ye ve doyduğunu hissedince dur.' },
    ],
  },
  {
    id: 'su-aliskanligi',
    title: 'Su içme alışkanlığı',
    minutes: 2,
    tag: 'Alışkanlık',
    summary: 'Gün içinde suyu yaymak için küçük ipuçları.',
    forTeens: true,
    sections: [
      { heading: 'İpuçları', text: 'Yanında su şişesi taşı, her öğünle bir bardak iç, telefona hatırlatıcı kur.' },
    ],
  },
  {
    id: 'atistirmalik',
    title: 'Atıştırmalık seçimleri',
    minutes: 3,
    tag: 'Alışkanlık',
    summary: 'Ara öğünde enerjini dengede tutan seçenekler.',
    forTeens: true,
    sections: [
      { heading: 'Seçenekler', text: 'Meyve, yoğurt, ayran veya bir avuç kuruyemiş (alerjin yoksa) iyi ara öğünlerdir. Şekerli içecekleri azaltmak iyi bir başlangıçtır.' },
    ],
  },
];

export function findArticle(id: string): Article | undefined {
  return ARTICLES.find((a) => a.id === id);
}

// ───────────── Uzman ipuçları (ana sayfa akışı) ─────────────

export interface TipPost {
  id: string;
  proId: string;
  text: string;
  tag: string;
  minutesAgo: number;
  likes: number;
}

export const TIP_POSTS: TipPost[] = [
  { id: 'tip-1', proId: 'pro-zeynep', text: 'Akşam yemeğinden sonra 10 dakikalık bir yürüyüş, hem sindirimi hem de uykuyu destekler.', tag: 'Beslenme', minutesAgo: 35, likes: 128 },
  { id: 'tip-2', proId: 'pro-burak', text: 'Squat yaparken dizlerin ayak ucunla aynı yöne baksın. Aynada veya telefonla kendini çek, farkı hemen görürsün.', tag: 'Egzersiz', minutesAgo: 140, likes: 96 },
  { id: 'tip-3', proId: 'pro-murat', text: 'Antrenmandan sonra protein almak için shake şart değil; bir kase yoğurt veya iki yumurta da iş görür.', tag: 'Spor beslenmesi', minutesAgo: 380, likes: 74 },
  { id: 'tip-4', proId: 'pro-fitmerkez', text: 'Bu hafta sonu duruş egzersizleri atölyesi: Cumartesi 11:00, Fit Merkez. Katılım herkese açık.', tag: 'Etkinlik', minutesAgo: 600, likes: 51 },
  { id: 'tip-5', proId: 'pro-elcin', text: 'Mutfakta gözünün önünde meyve olsun, atıştırmalık dolabı biraz yukarıda. Küçük düzen farkı büyük alışkanlık yaratır.', tag: 'Alışkanlık', minutesAgo: 1100, likes: 203 },
];
