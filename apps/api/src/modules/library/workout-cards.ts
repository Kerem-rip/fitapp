// Antrenman kartları: hazır, bölümlü antrenmanlar (hazırlık → ısınma → ana → bitiş). SAF veri ve fonksiyonlar.
// Her kartta hareketlerin SIRASI, set/tekrar/süre ve DİNLENME aralıkları açıktır; kullanıcı "nereden başlasam" diye düşünmez.
// Kategorinin şablonu ayrıdır: yoga/nefes/postür kartlarında güç antrenmanı sıralaması uygulanmaz.
// Ekipman ve ortam hareketlerden otomatik çıkarılır. Kaynak taraması yapılmamış hareketler arayüzde etiketlidir (kullanıcı kararı:
// içerik sonradan incelenip gerekmeyenler çıkarılacak). Yalnızca "doğrulama sürüyor" (held) hareketler ANA bölümde kullanılmaz.
import { AREA_TITLES, type BodyArea } from '../personal-plan/plan-types.js';
import { PLAN_META } from '../personal-plan/plan-meta.js';
import { findItem, type Level, type Work } from './catalog.js';
import { EVIDENCE } from './evidence.js';
import { parseWork } from './extra-moves.js';
import { workSeconds } from './library-rules.js';

export type CardCategory = 'fitness' | 'yoga' | 'pilates' | 'posture' | 'cardio' | 'mobility' | 'sport';
export type SectionKind = 'PREP' | 'WARMUP' | 'MAIN' | 'FINISH';

export interface CardItemDef {
  itemId: string;
  work?: Work;
  restAfterSec: number;
}
export interface CardSectionDef {
  kind: SectionKind;
  title: string;
  items: CardItemDef[];
}
export interface WorkoutCardDef {
  id: string;
  title: string;
  summary: string;
  category: CardCategory;
  setting: 'home' | 'gym';
  level: Level;
  equipment: string[];
  region: string;
  prep: string[];
  sections: CardSectionDef[];
  basis: string[];
}

export const CATEGORY_TITLES: Record<CardCategory, string> = {
  fitness: 'Fitness ve Güç',
  yoga: 'Yoga',
  pilates: 'Pilates',
  posture: 'Postür',
  cardio: 'Kardiyo',
  mobility: 'Mobilite ve Günlük',
  sport: 'Spor ve Performans',
};
export const SECTION_TITLES: Record<CardCategory, Record<SectionKind, string>> = {
  fitness: { PREP: 'Hazırlık', WARMUP: 'Isınma', MAIN: 'Ana hareketler', FINISH: 'Bitiş' },
  yoga: { PREP: 'Hazırlık', WARMUP: 'Isınma akışı', MAIN: 'Ana duruşlar', FINISH: 'Gevşeme' },
  pilates: { PREP: 'Hazırlık', WARMUP: 'Isınma', MAIN: 'Ana seri', FINISH: 'Bitiş' },
  posture: { PREP: 'Farkındalık', WARMUP: 'Hazırlık hareketi', MAIN: 'Ana hareketler', FINISH: 'Bitiş' },
  cardio: { PREP: 'Hazırlık', WARMUP: 'Isınma', MAIN: 'Kardiyo bloğu', FINISH: 'Soğuma' },
  mobility: { PREP: 'Hazırlık', WARMUP: 'Hazırlık', MAIN: 'Ana hareketler', FINISH: 'Bitiş' },
  sport: { PREP: 'Hazırlık', WARMUP: 'Isınma', MAIN: 'Beceri bloğu', FINISH: 'Soğuma' },
};
// Bölümün neden o sırada olduğu (kartta kısa açıklama)
export const SECTION_HINTS: Record<SectionKind, string> = {
  PREP: 'Başlamadan önce',
  WARMUP: 'Kasları ve eklemleri hazırlar',
  MAIN: 'Asıl çalışma; sırayı bozma',
  FINISH: 'Nabzı ve kasları sakinleştirir',
};

// Açık kurallar (kaynakta olmayan varsayılanlar; kartın "dayanağı" bölümünde de yazılıdır)
export const RULES = {
  R1: 'Başlangıç kartlarında ana hareket başına 2-3 set (uygulama varsayılanı; kaynaklarda kesin set sayısı yoktur).',
  R2: 'Dinlenme: güç hareketlerinde hareketler arası 45 sn (salonda 60 sn), kardiyoda 30 sn, yoga ve postürde 10-15 sn (uygulama varsayılanı; kaynak doğrulanmadı).',
  R3: 'Sıra: ısınma → büyük/çok eklemli hareketler → küçük ve tek eklemli hareketler → bitiş (genel antrenman düzeni; yoga, postür ve nefes kartlarında kendi şablonları).',
  R4: 'Kısıt seçilen bölgeyi yükleyen hareket, aynı hedefli alternatifle değiştirilir; uygun alternatif yoksa çıkarılır.',
  R5: 'Hareketlerin çoğunun kaynak taraması yapılmamıştır; etiketle gösterilir. Ağrı, baş dönmesi ya da göğüs ağrısında dur ve bir sağlık uzmanına danış.',
} as const;

const PREP_BY_CAT: Record<CardCategory, string[]> = {
  fitness: ['Isınmadan başlama; ağrıyla zorlama.', 'Bir sağlık sorunun ya da sakatlığın varsa başlamadan önce bir uzmana danış.'],
  yoga: ['Yüksek tansiyon, glokom, kalp sorunu ya da baş dönmesi öykün varsa uzmana danış.', 'Gerginlik hissettiğin yerde bırak; zorlama.'],
  pilates: ['Bel ya da boyun sorunun varsa başı yerde tut ve uzmana danış.', 'Hamileysen bu kartı yapma.'],
  posture: ['Duruşu düzeltmek zamanla olur; bunlar kısa hatırlatma hareketleridir.', 'Ağrı sürerse ya da hareketler yardım etmezse doktor veya fizyoterapiste başvur.'],
  cardio: ['Isınmadan başlama; konuşabildiğin bir tempoda kal.', 'Kalp, tansiyon ya da eklem sorunun varsa başlamadan önce doktora danış.', 'Kaygan olmayan zeminde yap.'],
  mobility: ['Ağrıya girme; hafif gerilme hissi yeterli.'],
  sport: ['İyice ısındıktan sonra başla; yorulunca form bozulursa dur.', 'Eklem sorunun varsa yüksek etkili hareketlerde kısıt seç.'],
};
// Hareketler arası dinlenme (sn): kategoriye göre, salonda ve ana bölümde daha uzun
const REST: Record<CardCategory, { warm: number; main: number; gym: number }> = {
  fitness: { warm: 10, main: 45, gym: 60 },
  yoga: { warm: 10, main: 10, gym: 10 },
  pilates: { warm: 10, main: 20, gym: 20 },
  posture: { warm: 10, main: 15, gym: 15 },
  cardio: { warm: 15, main: 30, gym: 30 },
  mobility: { warm: 10, main: 10, gym: 10 },
  sport: { warm: 15, main: 60, gym: 60 },
};

type Spec = string; // 'hareket-id' ya da 'hareket-id|3x10 45' (kartta özel yapılış)

function def(spec: Spec, rest: number): CardItemDef {
  const [itemId, w] = spec.split('|') as [string, string | undefined];
  return { itemId, restAfterSec: rest, ...(w ? { work: parseWork(w) } : {}) };
}

const EQUIP_NONE = 'Ekipmansız';

// Kart kurucu: ortam ve ekipman hareketlerden çıkarılır, dinlenmeler kategoriye göre atanır (son hareketin sonrasında dinlenme yok)
function C(id: string, title: string, category: CardCategory, level: Level, region: string, summary: string, warm: Spec[], main: Spec[], finish: Spec[], extraPrep: string[] = []): WorkoutCardDef {
  const all = [...warm, ...main, ...finish].map((s) => s.split('|')[0]!);
  const gym = all.some((i) => PLAN_META[i]?.settings.length === 1 && PLAN_META[i]!.settings[0] === 'GYM');
  const equipment = [...new Set(all.map((i) => findItem(i)?.equipment ?? EQUIP_NONE).filter((e) => e !== EQUIP_NONE))];
  const r = REST[category];
  const mainRest = gym ? r.gym : r.main;
  const section = (kind: SectionKind, specs: Spec[], rest: number, last: boolean): CardSectionDef => ({
    kind,
    title: SECTION_TITLES[category][kind],
    items: specs.map((s, i) => def(s, last && i === specs.length - 1 ? 0 : rest)),
  });
  const sections: CardSectionDef[] = [];
  if (warm.length) sections.push(section('WARMUP', warm, r.warm, false));
  sections.push(section('MAIN', main, mainRest, finish.length === 0));
  if (finish.length) sections.push(section('FINISH', finish, r.warm, true));
  return {
    id,
    title,
    summary,
    category,
    setting: gym ? 'gym' : 'home',
    level,
    equipment,
    region,
    prep: [...PREP_BY_CAT[category], ...extraPrep],
    sections,
    basis: [
      'Sıra, set/tekrar ve dinlenme açık kurallara dayanır (aşağıda); kaynaklı hareketlerde kaynak, hareket sayfasındadır.',
      category === 'fitness' || category === 'cardio' || category === 'sport' ? RULES.R1 : 'Süreli hareketlerde süre, hareketin kendi önerisidir.',
      RULES.R2,
      RULES.R3,
      RULES.R5,
    ],
  };
}

export const CARDS: WorkoutCardDef[] = [
  // ── Fitness: tüm vücut ──
  C('chair-start', 'Sandalyeli başlangıç', 'fitness', 'beginner', 'Tüm vücut', 'Sandalye ve duvarla yapılan hafif tüm vücut antrenmanı.',
    ['arm-circles', 'hip-circles'], ['sit-to-stand', 'mini-squat', 'calf-raise', 'wall-push-up'], ['deep-breathing|1x60s 0'], ['Tekerleksiz, kolçaksız, kaymayan bir sandalye kullan.']),
  C('fullbody-home', 'Tüm vücut: evde', 'fitness', 'beginner', 'Tüm vücut', 'Ekipmansız, tüm kas gruplarına dengeli bir antrenman.',
    ['arm-circles', 'hip-circles', 'march-in-place|1x60s 0'], ['sumo-squat', 'knee-push-up', 'glute-bridge', 'dead-bug', 'superman'], ['child-pose|1x45s 0']),
  C('fullbody-dumbbell', 'Tüm vücut: dambıllı', 'fitness', 'intermediate', 'Tüm vücut', 'Tek çift dambılla tüm vücut.',
    ['arm-circles', 'hip-circles', 'march-in-place|1x60s 0'], ['goblet-squat', 'db-floor-press', 'single-arm-row', 'romanian-deadlift', 'overhead-press', 'plank'], ['hamstring-stretch|1x30s/s 0']),
  C('quick-10', '10 dakikalık hızlı antrenman', 'fitness', 'beginner', 'Tüm vücut', 'Vaktin kısaysa: 4 hareket, kısa dinlenme.',
    ['march-in-place|1x45s 0'], ['squat|2x10 30', 'knee-push-up|2x8 30', 'glute-bridge|2x12 30', 'plank|2x20s 30'], []),
  // ── Fitness: kalça ──
  C('hip-beginner', 'Kalça: başlangıç', 'fitness', 'beginner', 'Kalça', 'Zeminde, ekipmansız kalça çalışması.',
    ['hip-circles', 'leg-swings'], ['glute-bridge', 'donkey-kick', 'fire-hydrant', 'clamshell'], ['piriformis-stretch|1x30s/s 0']),
  C('hip-mid', 'Kalça: orta', 'fitness', 'intermediate', 'Kalça', 'Ekipmansız, daha zorlayıcı kalça serisi.',
    ['hip-circles', 'leg-swings'], ['sumo-squat', 'curtsy-lunge', 'single-leg-glute-bridge', 'side-leg-raise', 'donkey-kick'], ['piriformis-stretch|1x30s/s 0']),
  C('hip-band', 'Kalça: bantlı', 'fitness', 'beginner', 'Kalça', 'Direnç bandıyla kalça ve bacak yanı.',
    ['hip-circles', 'leg-swings'], ['band-squat', 'band-lateral-walk', 'glute-bridge', 'clamshell'], ['piriformis-stretch|1x30s/s 0']),
  C('hip-gym', 'Kalça: salon', 'fitness', 'intermediate', 'Kalça', 'Salonda kalça ve arka bacak.',
    ['hip-circles', 'march-in-place|1x60s 0'], ['hip-thrust', 'romanian-deadlift', 'leg-curl', 'hip-abduction-machine'], ['piriformis-stretch|1x30s/s 0']),
  // ── Fitness: bacak ──
  C('legs-home', 'Bacak: evde', 'fitness', 'beginner', 'Bacak', 'Ekipmansız bacak antrenmanı.',
    ['leg-swings', 'march-in-place|1x60s 0'], ['squat', 'side-lunge', 'wall-sit', 'step-up', 'calf-raise'], ['quad-stretch|1x30s/s 0', 'hamstring-stretch|1x30s/s 0']),
  C('home-lower-mid', 'Evde alt vücut ve itme', 'fitness', 'intermediate', 'Alt vücut ve göğüs', 'Ekipmansız, orta seviye bacak, kalça ve göğüs.',
    ['hip-circles', 'arm-circles'], ['squat', 'single-leg-glute-bridge', 'knee-push-up', 'bird-dog'], ['hamstring-stretch|1x30s/s 0']),
  C('legs-gym', 'Bacak: salon', 'fitness', 'intermediate', 'Bacak', 'Salon makineleri ve halterle bacak.',
    ['march-in-place|1x90s 0', 'hip-circles'], ['barbell-squat', 'leg-press', 'leg-extension', 'leg-curl', 'calf-raise'], ['quad-stretch|1x30s/s 0', 'hamstring-stretch|1x30s/s 0']),
  C('dumbbell-lower', 'Bacak: dambıllı', 'fitness', 'intermediate', 'Bacak ve kalça', 'Tek dambılla bacak ve kalça.',
    ['hip-circles', 'march-in-place|1x60s 0'], ['goblet-squat', 'single-leg-rdl', 'bulgarian-split-squat', 'calf-raise'], ['quad-stretch|1x30s/s 0']),
  // ── Fitness: üst vücut ──
  C('chest-home', 'Göğüs ve kol: evde', 'fitness', 'beginner', 'Göğüs ve arka kol', 'Ekipmansız itme hareketleri.',
    ['arm-circles', 'shoulder-rolls'], ['incline-push-up', 'knee-push-up', 'diamond-push-up|3x6 60', 'bench-dips'], ['doorway-stretch|1x30s 0']),
  C('chest-gym', 'Göğüs ve omuz: salon', 'fitness', 'intermediate', 'Göğüs ve omuz', 'Salonda itme günü.',
    ['arm-circles', 'band-shoulder-pass'], ['bench-press', 'incline-db-press', 'cable-fly', 'shoulder-press-machine', 'lateral-raise', 'triceps-pushdown'], ['doorway-stretch|1x30s 0']),
  C('back-home', 'Sırt ve kol: bantlı', 'fitness', 'beginner', 'Sırt ve kol', 'Direnç bandıyla çekme hareketleri.',
    ['arm-circles', 'shoulder-rolls'], ['band-row', 'band-pull-apart', 'superman', 'band-biceps-curl'], ['child-pose|1x45s 0']),
  C('back-gym', 'Sırt ve kol: salon', 'fitness', 'intermediate', 'Sırt ve kol', 'Salonda çekme günü.',
    ['arm-circles', 'band-shoulder-pass'], ['lat-pulldown', 'seated-cable-row', 'single-arm-row', 'face-pull', 'biceps-curl', 'hammer-curl'], ['child-pose|1x45s 0']),
  C('shoulder-dumbbell', 'Omuz: dambıllı', 'fitness', 'intermediate', 'Omuz', 'Hafif dambıllarla omuz çalışması.',
    ['arm-circles', 'band-shoulder-pass'], ['overhead-press', 'lateral-raise', 'reverse-fly', 'band-pull-apart'], ['doorway-stretch|1x30s 0']),
  C('arms-dumbbell', 'Kol: dambıllı', 'fitness', 'beginner', 'Kollar', 'Biceps ve triceps.',
    ['arm-circles', 'wrist-circles'], ['biceps-curl', 'hammer-curl', 'triceps-extension', 'bench-dips'], ['wrist-flexor-stretch|1x20s/s 0']),
  // ── Fitness: core ──
  C('core-hip-start', 'Core ve kalça: başlangıç', 'fitness', 'beginner', 'Core ve kalça', 'Zeminde sakin tempolu core ve kalça.',
    ['cat-cow|1x45s 0'], ['glute-bridge', 'bird-dog', 'dead-bug'], ['child-pose|1x45s 0']),
  C('core-mid', 'Karın: orta', 'fitness', 'intermediate', 'Karın', 'Ekipmansız karın serisi.',
    ['cat-cow|1x45s 0', 'pelvic-tilt'], ['crunch', 'bicycle-crunch', 'reverse-crunch', 'side-plank', 'russian-twist'], ['child-pose|1x45s 0']),
  C('core-advanced', 'Karın: ileri', 'fitness', 'advanced', 'Karın ve core', 'İleri seviye karın ve core.',
    ['cat-cow|1x45s 0', 'pelvic-tilt'], ['hollow-hold', 'leg-raise', 'plank-shoulder-tap', 'flutter-kick', 'ab-wheel'], ['child-pose|1x45s 0']),
  // ── Postür ──
  C('posture-short', 'Duruş molası', 'posture', 'beginner', 'Boyun ve omuz', 'Masa başında kısa mola; boyun ve nefes.',
    ['shoulder-rolls'], ['chin-tuck|3x10 15', 'doorway-stretch|2x20s 10'], ['deep-breathing|1x120s 0']),
  C('posture-desk', 'Masa başı 5 dakika', 'posture', 'beginner', 'Boyun, omuz, bilek', 'Oturduğun yerde yapılabilen kısa seri.',
    [], ['desk-stretch', 'neck-stretch-side', 'wrist-flexor-stretch', 'shoulder-rolls', 'thoracic-rotation'], []),
  C('posture-neck', 'Boyun ve omuz rahatlatma', 'posture', 'beginner', 'Boyun ve omuz', 'Gerginliği azaltan hafif hareketler.',
    ['shoulder-rolls'], ['neck-rotation', 'neck-stretch-side', 'chin-tuck|3x10 15', 'doorway-stretch|2x20s 10'], ['deep-breathing|1x120s 0']),
  C('posture-upper-back', 'Üst sırt ve duruş', 'posture', 'beginner', 'Üst sırt', 'Yuvarlak omuz ve kamburlaşmaya karşı.',
    ['cat-cow|1x45s 0'], ['thread-needle', 'scapular-squeeze', 'prone-y-raise', 'band-pull-apart'], ['child-pose|1x45s 0']),
  C('posture-hip-back', 'Kalça ve bel rahatlatma', 'posture', 'beginner', 'Kalça ve bel', 'Uzun oturmaya karşı.',
    ['pelvic-tilt'], ['piriformis-stretch', 'hip-flexor-stretch', 'supine-twist', 'cat-cow|1x45s 0'], ['deep-breathing|1x120s 0']),
  // ── Yoga ──
  C('yoga-calm', 'Sakin yoga akışı', 'yoga', 'beginner', 'Sırt, omuz ve arka bacak', 'Yavaş tempo, nefes odaklı başlangıç.',
    ['deep-breathing|1x60s 0', 'cat-cow|1x60s 0'], ['downward-dog|3x15s 10', 'low-lunge', 'seated-forward-fold'], ['child-pose|1x60s 0', 'deep-breathing|1x120s 0']),
  C('yoga-flow-mid', 'Yoga akışı: orta', 'yoga', 'intermediate', 'Bacak, kalça ve denge', 'Ayakta duruşlarla orta seviye akış.',
    ['deep-breathing|1x60s 0', 'cat-cow|1x60s 0'], ['chair-pose', 'warrior-one', 'warrior-two', 'triangle-pose', 'tree-pose', 'downward-dog|2x20s 10'], ['child-pose|1x60s 0', 'supine-twist']),
  C('yoga-flex', 'Esneklik', 'yoga', 'beginner', 'Bacak arkası ve kalça', 'Yavaş, uzun tutuşlu esneme.',
    ['deep-breathing|1x60s 0'], ['hamstring-stretch|2x30s 10', 'seated-forward-fold', 'pigeon-pose', 'happy-baby', 'supine-twist'], ['child-pose|1x60s 0']),
  C('yoga-relax', 'Gevşeme ve nefes', 'yoga', 'beginner', 'Tüm vücut', 'Gün sonu gevşeme: nefes ve sakinleşme.',
    [], ['box-breathing', 'legs-up-wall', 'body-scan'], ['deep-breathing|1x120s 0']),
  // ── Pilates ──
  C('pilates-start', 'Pilates: başlangıç', 'pilates', 'beginner', 'Core ve kalça', 'Temel pilates hareketleri.',
    ['pelvic-tilt', 'cat-cow|1x45s 0'], ['dead-bug', 'pilates-leg-circles', 'pilates-side-leg-series', 'pilates-single-leg-stretch'], ['child-pose|1x45s 0']),
  C('pilates-mid', 'Pilates: orta', 'pilates', 'intermediate', 'Core ve omurga', 'Daha uzun seri; kontrollü nefes.',
    ['pelvic-tilt', 'cat-cow|1x45s 0'], ['pilates-hundred', 'pilates-roll-up', 'pilates-single-leg-stretch', 'pilates-swimming'], ['child-pose|1x45s 0']),
  // ── Kardiyo ──
  C('cardio-low', 'Düşük etkili kardiyo', 'cardio', 'beginner', 'Tüm vücut', 'Zıplamasız, eklem dostu kardiyo.',
    ['march-in-place|1x90s 0'], ['step-jacks', 'shadow-boxing', 'jogging-in-place', 'stair-climb|1x180s 0'], ['deep-breathing|1x90s 0']),
  C('cardio-hiit', 'Yüksek tempolu aralıklar', 'cardio', 'intermediate', 'Tüm vücut', 'Kısa ve yoğun; eklem sorunun varsa uygun değil.',
    ['march-in-place|1x90s 0', 'leg-swings'], ['jumping-jack', 'high-knees', 'skater', 'squat-jump', 'burpee'], ['deep-breathing|1x90s 0'], ['Yüksek etkili harekettir: diz, ayak bileği ya da bel sorunun varsa kısıt seç.']),
  C('cardio-steady', 'Dayanıklılık yürüyüşü', 'cardio', 'beginner', 'Kalp ve dolaşım', 'Sabit tempolu, uzun süreli.',
    ['march-in-place|1x60s 0'], ['brisk-walk'], ['hamstring-stretch|1x30s/s 0']),
  C('cardio-agility', 'Kısa kardiyo ve çeviklik', 'cardio', 'intermediate', 'Tüm vücut', 'Yüksek etkili, kısa aralıklı.',
    ['march-in-place|1x90s 0'], ['lateral-shuffle', 'squat-jump'], ['deep-breathing|1x90s 0']),
  // ── Mobilite ve günlük ──
  C('mobility-morning', 'Sabah mobilite', 'mobility', 'beginner', 'Tüm vücut', 'Güne uyanmak için hafif hareketler.',
    [], ['cat-cow|1x60s 0', 'worlds-greatest-stretch', 'hip-circles', 'arm-circles', 'inchworm'], ['deep-breathing|1x60s 0']),
  C('daily-break', 'Günlük hareket molası', 'mobility', 'beginner', 'Bacak ve denge', 'Gün içinde oturmayı bölmek için.',
    [], ['standing-break', 'chair-march', 'heel-toe-walk', 'toe-raise', 'ankle-circles'], []),
  // ── Spor ve performans ──
  C('sport-agility', 'Çeviklik ve hız', 'sport', 'intermediate', 'Bacak ve ayak çevikliği', 'Hızlı ayak ve yön değiştirme.',
    ['march-in-place|1x90s 0', 'leg-swings'], ['agility-ladder', 'lateral-shuffle', 'skater', 'bear-crawl'], ['hamstring-stretch|1x30s/s 0']),
  C('sport-power', 'Patlayıcı güç', 'sport', 'advanced', 'Bacak', 'Sıçrama ve patlayıcılık; iyi bir temel gerektirir.',
    ['march-in-place|1x90s 0', 'leg-swings'], ['squat-jump', 'broad-jump', 'lateral-bound', 'box-jump', 'sprint-intervals'], ['hamstring-stretch|1x30s/s 0'], ['İniş tekniğini bilmiyorsan bu kartı yapma.']),
  C('sport-balance', 'Denge ve koordinasyon', 'sport', 'beginner', 'Denge', 'Tek ayak ve kontrol.',
    ['ankle-circles'], ['single-leg-balance', 'tree-pose', 'heel-toe-walk', 'single-leg-rdl|3x6/s 45'], ['child-pose|1x45s 0']),
];

// Kartın görsel anahtarı, hedefi ve hedef bölgeleri (liste kartı ve filtre çipleri için)
const HERO_RULES: [RegExp, string][] = [
  [/^hip-/, 'hip'], [/^(legs-|dumbbell-lower)/, 'legs'], [/^chest-/, 'chest'], [/^back-/, 'back'], [/^shoulder-/, 'shoulder'], [/^arms-/, 'arms'], [/^core-/, 'core'],
  [/^(fullbody|quick-10|chair-start|home-lower-mid)/, 'fullbody'], [/^posture-/, 'posture'], [/^yoga-/, 'yoga'], [/^pilates-/, 'pilates'],
  [/^cardio-/, 'cardio'], [/^(mobility|daily-)/, 'mobility'], [/^sport-/, 'sport'],
];
const AREAS: Record<string, string[]> = {
  hip: ['Kalça', 'Glute'], legs: ['Bacak'], chest: ['Göğüs', 'Arka kol'], back: ['Sırt', 'Kol'], shoulder: ['Omuz'], arms: ['Kol'], core: ['Karın', 'Core'],
  fullbody: ['Tüm vücut'], posture: ['Boyun', 'Omuz', 'Üst sırt'], yoga: ['Yoga', 'Esneklik'], pilates: ['Pilates', 'Core'], cardio: ['Kardiyo'], mobility: ['Mobilite'], sport: ['Spor'],
};
const GOALS: Record<CardCategory, string> = {
  fitness: 'Kas kazanmak', yoga: 'Esneklik ve rahatlama', pilates: 'Core ve duruş', posture: 'Duruşu iyileştirmek', cardio: 'Kondisyon ve yağ yakımı', mobility: 'Hareket kabiliyeti', sport: 'Performans',
};
export function cardMeta(c: WorkoutCardDef) {
  const hero = HERO_RULES.find(([re]) => re.test(c.id))?.[1] ?? 'fullbody';
  const goal = c.id === 'quick-10' ? 'Kısa ve etkili antrenman' : c.id === 'cardio-low' ? 'Yağ yakımı (eklem dostu)' : GOALS[c.category];
  return { hero, goal, areas: AREAS[hero] ?? [] };
}

export const findCard = (id: string) => CARDS.find((c) => c.id === id);
// Bir hareketin yer aldığı kartlar (hareket sayfasında "hangi antrenmanda" listesi)
export const cardsWithItem = (itemId: string) => CARDS.filter((c) => c.sections.some((s) => s.items.some((i) => i.itemId === itemId)));

// ───── Kısıta göre kişiselleştirme (R4) ─────

export const RESTRICTION_AREAS: BodyArea[] = ['KNEE', 'LOW_BACK', 'WRIST', 'SHOULDER', 'ANKLE', 'NECK', 'HIP'];
export const RESTRICTION_LABELS = Object.fromEntries(RESTRICTION_AREAS.map((a) => [a, AREA_TITLES[a]])) as Record<BodyArea, string>;

const stressed = (id: string, avoid: BodyArea[]) => {
  const m = PLAN_META[id];
  return !!m && m.stress.some((s) => avoid.includes(s));
};

// Hareketin yerine geçecek, kısıtı yüklemeyen ilk alternatif (yoksa null)
export function safeAlternative(id: string, avoid: BodyArea[], used: Set<string>): string | null {
  const candidates = [...(EVIDENCE[id]?.alternatives.filter((a) => a.type !== 'HARDER').map((a) => a.id) ?? []), ...(PLAN_META[id]?.alternatives ?? [])];
  for (const c of candidates) {
    if (!findItem(c) || used.has(c)) continue;
    if (!stressed(c, avoid) && !(PLAN_META[c]?.highImpact && avoid.some((a) => a === 'KNEE' || a === 'ANKLE'))) return c;
  }
  return null;
}

export interface ResolvedCardItem {
  itemId: string;
  title: string;
  workText: string;
  work: Work;
  durationSec: number;
  restAfterSec: number;
  verification: 'ok' | 'partial' | 'held' | 'none';
  // Çalışan ana bölgeler (satırdaki küçük resim ve etiket için)
  primary: string[];
  // Kısıt nedeniyle değiştirildiyse özgün hareket
  replacedFrom?: { id: string; title: string };
}

export function resolveCard(card: WorkoutCardDef, avoid: BodyArea[], workText: (w: Work) => string) {
  const used = new Set(card.sections.flatMap((s) => s.items.map((i) => i.itemId)));
  const swapped: { from: string; fromTitle: string; to: string | null; toTitle: string | null; area: string }[] = [];
  let order = 0;
  const sections = card.sections
    .map((s) => {
      const items: (ResolvedCardItem & { order: number })[] = [];
      for (const d of s.items) {
        let id = d.itemId;
        let replacedFrom: ResolvedCardItem['replacedFrom'];
        const high = PLAN_META[id]?.highImpact && avoid.some((a) => a === 'KNEE' || a === 'ANKLE');
        if (stressed(id, avoid) || high) {
          const alt = safeAlternative(id, avoid, used);
          const area = (PLAN_META[id]?.stress.find((a) => avoid.includes(a)) ?? 'KNEE') as BodyArea;
          swapped.push({ from: id, fromTitle: findItem(id)!.title, to: alt, toTitle: alt ? findItem(alt)!.title : null, area: AREA_TITLES[area] });
          if (!alt) continue;
          replacedFrom = { id, title: findItem(id)!.title };
          used.add(alt);
          id = alt;
        }
        const item = findItem(id)!;
        const work = (id === d.itemId ? d.work : undefined) ?? item.work!;
        items.push({
          order: ++order,
          itemId: id,
          title: item.title,
          workText: workText(work),
          work,
          durationSec: workSeconds(work),
          restAfterSec: d.restAfterSec,
          verification: EVIDENCE[id]?.verification ?? 'none',
          primary: item.primary ?? [],
          ...(replacedFrom ? { replacedFrom } : {}),
        });
      }
      return { kind: s.kind, title: s.title, hint: SECTION_HINTS[s.kind], items };
    })
    .filter((s) => s.items.length > 0);
  // Son hareketin sonrasında dinlenme olmaz
  const flat = sections.flatMap((s) => s.items);
  if (flat.length) flat[flat.length - 1]!.restAfterSec = 0;
  const durationSec = flat.reduce((sum, i) => sum + i.durationSec + i.restAfterSec, 0);
  return { sections, swapped, moveCount: flat.length, estimatedMinutes: Math.max(1, Math.round(durationSec / 60)), durationSec };
}
