// İçerik kütüphanesi: uygulamanın kendi ücretsiz hareketleri, yüz masajları, beslenme rehberleri ve programları.
// Şimdilik kodda tutulur (değiştirmek için bu dosya güncellenir); ileride yönetici içerik ekranına taşınabilir.
// Kimlikler (id) kalıcıdır: kayıtlı programlar ve görevler bunlara bağlıdır, değiştirilmemeli.
// Tüm içerik genel bilgidir; tanı veya kişiye özel tedavi değildir.

export type ItemKind = 'MOVE' | 'FACE' | 'GUIDE';
export type ItemCategory = 'home' | 'fitness' | 'posture' | 'face' | 'nutrition';
export type Level = 'beginner' | 'intermediate' | 'advanced';

// Hareketin yapılışı: tekrarla ya da süreyle; setler arası dinlenme
export interface Work {
  sets: number;
  reps?: number;
  seconds?: number;
  perSide?: boolean;
  restSec: number;
}

export interface LibraryItem {
  id: string;
  kind: ItemKind;
  category: ItemCategory;
  title: string;
  summary: string;
  level: Level;
  equipment?: string;
  primary?: string[];
  secondary?: string[];
  steps: string[];
  mistakes?: string[];
  warnings?: string[];
  // Hareketlerde varsayılan yapılış (programlarda değiştirilebilir)
  work?: Work;
  // Rehberlerde okuma süresi ve bölümler
  minutes?: number;
  sections?: { heading: string; text: string }[];
}

export interface ProgramStep {
  itemId: string;
  work: Work;
  // Bu hareketten sonra bir sonrakine geçmeden önceki dinlenme
  restAfterSec: number;
}

export interface ProgramDayDef {
  title: string;
  steps: ProgramStep[];
}

export interface LibraryProgram {
  id: string;
  title: string;
  description: string;
  category: ItemCategory;
  level: Level;
  weeks: number;
  daysPerWeek: number;
  // Ücretsiz programlar herkese açıktır (ücretli ve reklamla açılan paketler sonraki bir aşamada)
  access: 'FREE';
  days: ProgramDayDef[];
}

export const CATEGORY_LABELS: Record<ItemCategory, string> = {
  home: 'Evde',
  fitness: 'Salon',
  posture: 'Duruş ve esneme',
  face: 'Yüz masajı',
  nutrition: 'Beslenme',
};

const KNEE = 'Dizinde keskin ağrı hissedersen dur.';
const BACK = 'Belinde ağrı hissedersen dur; ağrı sürerse doktora başvur.';
const SKIN = 'Cildin hassassa veya yüzünde yara varsa uygulama.';

const reps = (sets: number, n: number, restSec: number, perSide = false): Work => ({ sets, reps: n, restSec, ...(perSide ? { perSide } : {}) });
const time = (sets: number, seconds: number, restSec: number, perSide = false): Work => ({ sets, seconds, restSec, ...(perSide ? { perSide } : {}) });

function move(
  id: string,
  title: string,
  category: Exclude<ItemCategory, 'nutrition'>,
  level: Level,
  equipment: string,
  work: Work,
  primary: string[],
  secondary: string[],
  steps: string[],
  mistakes: string[],
  warnings: string[],
): LibraryItem {
  return {
    id,
    kind: category === 'face' ? 'FACE' : 'MOVE',
    category,
    title,
    summary: `${primary.join(', ')} · ${equipment}`,
    level,
    equipment,
    primary,
    secondary,
    steps,
    mistakes,
    warnings,
    work,
  };
}

export const ITEMS: LibraryItem[] = [
  move('squat', 'Squat', 'home', 'beginner', 'Ekipmansız', reps(3, 12, 45), ['Ön bacak', 'Kalça'], ['Arka bacak', 'Karın'],
    ['Ayaklarını omuz genişliğinde aç.', 'Göğsünü dik tutup kalçanı geriye ve aşağı it.', 'Uyluklar yere paralel olunca dur.', 'Topuklarından iterek ayağa kalk.'],
    ['Dizlerin içe kapanması', 'Topukların yerden kalkması'], [KNEE]),
  move('push-up', 'Şınav', 'home', 'beginner', 'Ekipmansız', reps(3, 8, 60), ['Göğüs', 'Arka kol'], ['Ön omuz', 'Karın'],
    ['Ellerini omuzlarının hizasında yere koy.', 'Vücudunu baştan topuğa düz bir çizgide tut.', 'Göğsün yere yaklaşana kadar in.', 'Yere iterek başlangıca dön.'],
    ['Belin çökmesi', 'Dirseklerin çok açılması'], ['Zorlanırsan dizlerini yere koyarak yap.']),
  move('plank', 'Plank', 'home', 'beginner', 'Ekipmansız', time(3, 30, 30), ['Karın', 'Core'], ['Omuz', 'Kalça'],
    ['Dirseklerini omuzlarının altına koy.', 'Vücudunu baştan topuğa düz tut.', 'Karnını hafifçe içeri çek ve nefes almaya devam et.'],
    ['Kalçanın havaya kalkması', 'Nefesi tutmak'], [BACK]),
  move('lunge', 'Ters hamle', 'home', 'intermediate', 'Ekipmansız', reps(3, 10, 45, true), ['Ön bacak', 'Kalça'], ['Arka bacak', 'Denge kasları'],
    ['Dik dur, bir ayağınla geriye büyük bir adım at.', 'Her iki dizin yaklaşık 90 derece olana kadar in.', 'Ön topuğundan iterek başlangıca dön.'],
    ['Ön dizin ayak ucunu geçmesi', 'Gövdenin öne eğilmesi'], [KNEE]),
  move('glute-bridge', 'Kalça köprüsü', 'home', 'beginner', 'Ekipmansız', reps(3, 15, 30), ['Kalça', 'Arka bacak'], ['Karın', 'Bel'],
    ['Sırtüstü yat, dizlerini bük, ayaklarını yere bas.', 'Kalçanı omuzlarınla dizlerin aynı çizgide olana kadar kaldır.', 'Tepede bir saniye sık ve yavaşça in.'],
    ['Belin aşırı kavislenmesi'], [BACK]),
  move('bird-dog', 'Kuş-köpek', 'home', 'beginner', 'Ekipmansız', reps(3, 10, 30, true), ['Core', 'Bel'], ['Kalça', 'Omuz'],
    ['Dört ayak üzerine gel; eller omuz, dizler kalça altında.', 'Sağ kolunu ve sol bacağını aynı anda uzat.', 'Kalçanı sabit tutup başlangıca dön, tarafı değiştir.'],
    ['Kalçanın yana kayması'], [BACK]),
  move('dumbbell-row', 'Dambıl çekiş', 'fitness', 'beginner', 'Dambıl, bank', reps(3, 10, 60, true), ['Sırt', 'Arka omuz'], ['Pazı'],
    ['Bir elini ve dizini banka koy, sırtını düz tut.', 'Dambılı karnına doğru dirseğinle çek.', 'Kürek kemiğini sıkıp yavaşça indir.'],
    ['Gövdeyi sallamak', 'Ağırlığı omuzla çekmek'], [BACK]),
  move('overhead-press', 'Omuz press', 'fitness', 'intermediate', 'Dambıl', reps(3, 10, 75), ['Omuz'], ['Arka kol', 'Üst göğüs'],
    ['Dambılları omuz hizasında tut.', 'Karnını sıkıp kollarını yukarı doğru uzat.', 'Kontrollü şekilde omuz hizasına indir.'],
    ['Belin geriye kavislenmesi'], ['Omzunda ağrı hissedersen dur.']),
  move('lat-pulldown', 'Kablo yukarıdan çekiş', 'fitness', 'beginner', 'Kablo makinesi', reps(3, 12, 60), ['Sırt kanatları'], ['Pazı', 'Arka omuz'],
    ['Tutacağı omuzlarından biraz geniş tut.', 'Göğsünü dik tutup tutacağı köprücük kemiğine çek.', 'Kollarını kontrollü şekilde yukarı bırak.'],
    ['Gövdeyi geriye atmak'], ['Ağırlığı gövde sallamadan çekebileceğin seviyede tut.']),
  move('leg-press', 'Leg press', 'fitness', 'beginner', 'Makine', reps(3, 12, 75), ['Ön bacak', 'Kalça'], ['Arka bacak'],
    ['Sırtını ve kalçanı minderden ayırma.', 'Ayaklarını omuz genişliğinde platforma koy.', 'Dizlerini bükerek in, topuklarından iterek uzat.'],
    ['Dizleri tamamen kilitlemek', 'Kalçanın minderden kalkması'], [KNEE]),
  move('romanian-deadlift', 'Romanya ölü kaldırma', 'fitness', 'intermediate', 'Dambıl', reps(3, 10, 75), ['Arka bacak', 'Kalça'], ['Bel', 'Sırt'],
    ['Dambılları uyluklarının önünde tut.', 'Dizlerini hafif bükerek kalçanı geriye it.', 'Dambıllar diz hizasına inince kalçanı öne iterek kalk.'],
    ['Sırtın yuvarlanması'], [BACK]),
  move('wall-angel', 'Duvar melek', 'posture', 'beginner', 'Ekipmansız', reps(2, 10, 30), ['Omuz arkası', 'Üst sırt'], ['Boyun', 'Göğüs'],
    ['Sırtını, kalçanı ve başını duvara yasla.', 'Kollarını dirsekten bükerek duvara bastır.', 'Kollarını duvar boyunca yukarı kaydır, sonra indir.'],
    ['Belin duvardan ayrılması', 'Omuzların yukarı kalkması'], ['Ağrın varsa önce doktora başvur.']),
  move('chin-tuck', 'Çene geri çekme (boyun)', 'posture', 'beginner', 'Ekipmansız', reps(3, 10, 20), ['Derin boyun kasları'], ['Üst sırt'],
    ['Dik otur veya dur, bakışın karşıda olsun.', 'Çeneni boynunu uzatarak geriye çek (çift çene yapar gibi).', 'Beş saniye tut ve bırak.'],
    ['Başı aşağı eğmek'], ['Boynunda uyuşma veya baş dönmesi olursa bırak ve doktora başvur.']),
  move('cat-cow', 'Kedi-inek', 'posture', 'beginner', 'Ekipmansız', reps(2, 10, 20), ['Omurga', 'Karın'], ['Omuz'],
    ['Dört ayak üzerine gel.', 'Nefes verirken sırtını yuvarla, çeneni göğsüne yaklaştır.', 'Nefes alırken göğsünü aç ve sırtını hafifçe kavisle.'],
    ['Çok hızlı yapmak'], [BACK]),
  move('doorway-stretch', 'Kapı eşiğinde göğüs açma', 'posture', 'beginner', 'Kapı eşiği', time(3, 30, 15), ['Göğüs', 'Ön omuz'], ['Pazı'],
    ['Kolunu dirsekten 90 derece bük, kapı pervazına yasla.', 'Bir adım ileri çıkıp göğsünü hafifçe öne aç.', 'Göğsünde gerilme hissedince 30 saniye bekle.'],
    ['Belin öne kavislenmesi'], ['Omzunda keskin ağrı olursa bırak.']),
  move('scapular-squeeze', 'Kürek kemiği sıkma', 'posture', 'beginner', 'Ekipmansız', reps(3, 12, 20), ['Orta sırt', 'Kürek çevresi'], ['Arka omuz'],
    ['Dik otur, kollarını yanlarında rahat bırak.', 'Kürek kemiklerini birbirine yaklaştır.', 'Üç saniye sık ve bırak.'],
    ['Omuzları kulağa çekmek'], ['Ağrın varsa önce doktora başvur.']),
  move('hip-flexor-stretch', 'Kalça önü germe', 'posture', 'beginner', 'Ekipmansız', time(3, 30, 15, true), ['Kalça önü'], ['Ön bacak'],
    ['Bir dizinin üstüne çök, diğer ayağını öne koy.', 'Kalçanı hafifçe öne ver, gövdeni dik tut.', 'Kalça önünde gerilme hissedince 30 saniye bekle.'],
    ['Belin kavislenmesi'], [KNEE]),
  move('face-temple', 'Şakak masajı', 'face', 'beginner', 'Parmak uçları', time(1, 60, 0), ['Şakak çevresi'], [],
    ['Ellerini temiz tut, parmak uçlarını şakaklarına koy.', 'Hafif baskıyla küçük daireler çiz.', 'Nefesini yavaş ver ve bir dakika devam et.'],
    ['Çok sert bastırmak'], [SKIN]),
  move('face-brow', 'Alın ve kaş masajı', 'face', 'beginner', 'Parmak uçları', time(1, 60, 0), ['Alın', 'Kaş çevresi'], [],
    ['Parmak uçlarını kaş arasına koy.', 'Hafif baskıyla alnın ortasından saç çizgisine doğru ilerle.', 'Kaşlarının üstünden dışa doğru kaydır.'],
    ['Cildi çekiştirmek'], [SKIN]),
  move('face-cheek', 'Yanak ve çene hattı masajı', 'face', 'beginner', 'Parmak uçları', time(1, 120, 0), ['Yanak', 'Çene hattı'], [],
    ['Parmaklarını çenenin ortasına koy.', 'Hafif baskıyla kulağa doğru kaydır.', 'Yanaklarında küçük daireler çizerek bitir.'],
    ['Cildi aşağı doğru çekmek'], [SKIN]),

  // ── Beslenme rehberleri (okuma kartları; kişiye özel plan için diyetisyene yönlendirir) ──
  guide('akdeniz', 'Akdeniz tipi beslenme', 4, 'Sebze, baklagil, zeytinyağı ve balık ağırlıklı, sürdürülmesi kolay bir beslenme düzeni.', [
    { heading: 'Nedir', text: 'Sebze, meyve, baklagil, tam tahıl, zeytinyağı ve balığı öne çıkarır; kırmızı et ve işlenmiş gıdayı azaltır.' },
    { heading: 'Kimlere uygun olabilir', text: 'Dengeli ve uzun süre sürdürülebilir bir düzen arayanlara uygun olabilir.' },
    { heading: 'Dikkat', text: 'Balık, süt ürünü veya gluten alerjisi varsa seçimler değişir. Size uygun olup olmadığını öğrenmek için bir diyetisyene danışın.' },
  ]),
  guide('aralikli-oruc', 'Aralıklı oruç', 4, 'Yemek yenen ve yenmeyen saatleri düzenleyen bir yaklaşım.', [
    { heading: 'Nedir', text: 'Günün belirli saatlerinde yemek yeme, diğer saatlerde yememe düzenidir (ör. 8 saat yeme, 16 saat ara).' },
    { heading: 'Kimler kaçınmalı', text: 'Hamileler, emziren anneler, yeme bozukluğu geçmişi olanlar, diyabet ve tansiyon ilacı kullananlar ile 18 yaş altı bu düzeni denememelidir.' },
    { heading: 'Dikkat', text: 'Başlamadan önce bir diyetisyen veya doktora danışın.' },
  ]),
  guide('vejetaryen', 'Vejetaryen beslenme', 3, 'Et ve balık yenmeyen, bitkisel kaynaklı protein ağırlıklı beslenme.', [
    { heading: 'Nedir', text: 'Et ve balık yerine baklagil, yumurta, süt ürünleri ve tam tahıllarla protein alınır.' },
    { heading: 'Dikkat', text: 'B12, demir ve çinko takibi önemlidir. Plan için diyetisyen desteği alın.' },
  ]),
  guide('yuksek-protein', 'Yüksek protein beslenme', 3, 'Kas koruma ve tokluk için protein payını artıran beslenme.', [
    { heading: 'Nedir', text: 'Her öğüne tavuk, balık, yumurta, yoğurt veya baklagil ekleyerek protein payını artırır.' },
    { heading: 'Dikkat', text: 'Böbrek sorunu olanlar önce doktora danışmalıdır. Aşırıya kaçmak yerine dengeli kalın.' },
  ]),
  guide('dengeli-tabak', 'Dengeli tabak nasıl olur', 3, 'Tabağın yarısı sebze, çeyreği protein, çeyreği tahıl.', [
    { heading: 'Basit kural', text: 'Tabağının yarısını sebze veya salata, çeyreğini protein (yumurta, tavuk, baklagil), çeyreğini tahıl (pilav, ekmek, makarna) yap.' },
    { heading: 'İpucu', text: 'Yemeği yavaş ye ve doyduğunu hissedince dur.' },
  ]),
  guide('su-aliskanligi', 'Su içme alışkanlığı', 2, 'Gün içinde suyu yaymak için küçük ipuçları.', [
    { heading: 'İpuçları', text: 'Yanında su şişesi taşı, her öğünle bir bardak iç, telefona hatırlatıcı kur.' },
  ]),
  guide('atistirmalik', 'Atıştırmalık seçimleri', 3, 'Ara öğünde enerjini dengede tutan seçenekler.', [
    { heading: 'Seçenekler', text: 'Meyve, yoğurt, ayran veya bir avuç kuruyemiş (alerjin yoksa) iyi ara öğünlerdir. Şekerli içecekleri azaltmak iyi bir başlangıçtır.' },
  ]),
];

function guide(id: string, title: string, minutes: number, summary: string, sections: { heading: string; text: string }[]): LibraryItem {
  return { id, kind: 'GUIDE', category: 'nutrition', title, summary, level: 'beginner', steps: [], minutes, sections };
}

// ───────────── Programlar ─────────────

// Gün şablonundaki hareketler sırayla yapılır; her hareketten sonra kısa geçiş dinlenmesi
const step = (itemId: string, restAfterSec = 60, work?: Work): ProgramStep => {
  const item = ITEMS.find((i) => i.id === itemId);
  if (!item?.work) throw new Error(`Programda tanımsız hareket: ${itemId}`);
  return { itemId, work: work ?? item.work, restAfterSec };
};

function days(templates: ProgramStep[][], count: number): ProgramDayDef[] {
  return Array.from({ length: count }, (_, i) => ({ title: `Gün ${i + 1}`, steps: templates[i % templates.length]! }));
}

export const PROGRAMS: LibraryProgram[] = [
  {
    id: 'ev-baslangic',
    title: 'Evde başlangıç',
    description: 'Ekipmansız, 4 haftada temel güç ve dayanıklılık. Yeni başlayanlar için.',
    category: 'home',
    level: 'beginner',
    weeks: 4,
    daysPerWeek: 3,
    access: 'FREE',
    days: days(
      [
        [step('squat'), step('push-up'), step('glute-bridge'), step('plank', 0)],
        [step('lunge'), step('bird-dog'), step('plank'), step('glute-bridge', 0)],
        [step('squat'), step('lunge'), step('push-up'), step('bird-dog', 0)],
      ],
      12,
    ),
  },
  {
    id: 'masa-basi-durus',
    title: 'Masa başı duruş programı',
    description: 'Gün boyu oturanlar için boyun, omuz ve kalça rahatlatma egzersizleri.',
    category: 'posture',
    level: 'beginner',
    weeks: 3,
    daysPerWeek: 5,
    access: 'FREE',
    days: days(
      [
        [step('wall-angel', 30), step('chin-tuck', 30), step('scapular-squeeze', 0)],
        [step('doorway-stretch', 30), step('cat-cow', 30), step('hip-flexor-stretch', 0)],
        [step('chin-tuck', 30), step('wall-angel', 30), step('cat-cow', 0)],
      ],
      15,
    ),
  },
  {
    id: 'yuz-masaji-rutini',
    title: 'Sabah yüz masajı rutini',
    description: 'Rahatlatan ve kan dolaşımını destekleyen kısa sabah yüz masajı rutini.',
    category: 'face',
    level: 'beginner',
    weeks: 2,
    daysPerWeek: 7,
    access: 'FREE',
    days: days([[step('face-temple', 10), step('face-brow', 10), step('face-cheek', 0)]], 14),
  },
  {
    id: 'salon-baslangic',
    title: 'Salon başlangıç',
    description: 'Salona yeni başlayanlar için makine ve dambıl ağırlıklı 6 haftalık program.',
    category: 'fitness',
    level: 'beginner',
    weeks: 6,
    daysPerWeek: 3,
    access: 'FREE',
    days: days(
      [
        [step('leg-press', 90), step('lat-pulldown', 90), step('overhead-press', 0)],
        [step('romanian-deadlift', 90), step('dumbbell-row', 90), step('plank', 0)],
        [step('leg-press', 90), step('dumbbell-row', 90), step('overhead-press', 0)],
      ],
      18,
    ),
  },
];

export const findItem = (id: string) => ITEMS.find((i) => i.id === id);
export const findProgram = (id: string) => PROGRAMS.find((p) => p.id === id);
