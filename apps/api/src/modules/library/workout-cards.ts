// Antrenman kartları: bölgesel, sıralı antrenmanlar (hazırlık → ısınma → ana → bitiş). SAF veri ve fonksiyonlar.
// KURAL: fitness bölgelerinde (kalça, bacak, göğüs, sırt, omuz, kol, karın) her ANA hareket yalnızca tek bir bölgede yer alır; karma antrenmanlar "Tüm vücut"tadır.
// Her kartta hareketlerin SIRASI, set/tekrar/süre ve DİNLENME aralıkları açıktır; kullanıcı "nereden başlasam" diye düşünmez.
// Kategorinin şablonu ayrıdır: yoga/nefes/postür kartlarında güç antrenmanı sıralaması uygulanmaz.
// Kaynak taraması yapılmamış hareketler arayüzde etiketlidir (karar: içerik sonradan incelenir). "Doğrulama sürüyor" (held) hareket ANA bölümde kullanılmaz (yüz hariç; yüz için kanıt uyarısı vardır).
import { AREA_TITLES, type BodyArea } from '../personal-plan/plan-types.js';
import { PLAN_META } from '../personal-plan/plan-meta.js';
import { findItem, ITEMS, type Level, type Work } from './catalog.js';
import { EVIDENCE } from './evidence.js';
import { parseWork } from './extra-moves.js';
import { FACE_META, FACE_REGIONS, type FaceRegion } from './face-moves.js';
import { workSeconds } from './library-rules.js';

export type CardCategory = 'fitness' | 'yoga' | 'pilates' | 'posture' | 'cardio' | 'mobility' | 'sport' | 'face';
export type SectionKind = 'PREP' | 'WARMUP' | 'MAIN' | 'FINISH';
export type RegionKey = 'hip' | 'legs' | 'chest' | 'back' | 'shoulder' | 'arms' | 'core' | 'fullbody' | 'yoga' | 'pilates' | 'posture' | 'cardio' | 'mobility' | 'sport' | FaceRegion;

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
  regionKey: RegionKey;
  setting: 'home' | 'gym';
  level: Level;
  equipment: string[];
  // Bölgenin adı (etiket)
  region: string;
  prep: string[];
  sections: CardSectionDef[];
  basis: string[];
}

export const CATEGORY_TITLES: Record<CardCategory, string> = {
  fitness: 'Fitness',
  yoga: 'Yoga',
  pilates: 'Pilates',
  posture: 'Postür',
  cardio: 'Kardiyo',
  mobility: 'Mobilite',
  sport: 'Spor',
  face: 'Yüz',
};

// Bölgeler: kütüphanedeki büyük kutular. hero = görsel anahtarı
export interface RegionDef {
  key: RegionKey;
  title: string;
  category: CardCategory;
  hero: string;
}
export const REGIONS: RegionDef[] = [
  { key: 'hip', title: 'Kalça', category: 'fitness', hero: 'hip' },
  { key: 'legs', title: 'Bacak', category: 'fitness', hero: 'legs' },
  { key: 'chest', title: 'Göğüs', category: 'fitness', hero: 'chest' },
  { key: 'back', title: 'Sırt', category: 'fitness', hero: 'back' },
  { key: 'shoulder', title: 'Omuz', category: 'fitness', hero: 'shoulder' },
  { key: 'arms', title: 'Kol', category: 'fitness', hero: 'arms' },
  { key: 'core', title: 'Karın', category: 'fitness', hero: 'core' },
  { key: 'fullbody', title: 'Tüm vücut', category: 'fitness', hero: 'fullbody' },
  { key: 'yoga', title: 'Yoga', category: 'yoga', hero: 'yoga' },
  { key: 'pilates', title: 'Pilates', category: 'pilates', hero: 'pilates' },
  { key: 'posture', title: 'Postür', category: 'posture', hero: 'posture' },
  { key: 'cardio', title: 'Kardiyo', category: 'cardio', hero: 'cardio' },
  { key: 'mobility', title: 'Mobilite ve günlük', category: 'mobility', hero: 'mobility' },
  { key: 'sport', title: 'Spor ve performans', category: 'sport', hero: 'sport' },
  ...FACE_REGIONS.map((r) => ({ key: r.key as RegionKey, title: r.title, category: 'face' as const, hero: 'face' })),
];
const regionOf = (k: RegionKey) => REGIONS.find((r) => r.key === k)!;

export const SECTION_TITLES: Record<CardCategory, Record<SectionKind, string>> = {
  fitness: { PREP: 'Hazırlık', WARMUP: 'Isınma', MAIN: 'Ana hareketler', FINISH: 'Bitiş' },
  yoga: { PREP: 'Hazırlık', WARMUP: 'Isınma akışı', MAIN: 'Ana duruşlar', FINISH: 'Gevşeme' },
  pilates: { PREP: 'Hazırlık', WARMUP: 'Isınma', MAIN: 'Ana seri', FINISH: 'Bitiş' },
  posture: { PREP: 'Farkındalık', WARMUP: 'Hazırlık hareketi', MAIN: 'Ana hareketler', FINISH: 'Bitiş' },
  cardio: { PREP: 'Hazırlık', WARMUP: 'Isınma', MAIN: 'Kardiyo bloğu', FINISH: 'Soğuma' },
  mobility: { PREP: 'Hazırlık', WARMUP: 'Hazırlık', MAIN: 'Ana hareketler', FINISH: 'Bitiş' },
  sport: { PREP: 'Hazırlık', WARMUP: 'Isınma', MAIN: 'Beceri bloğu', FINISH: 'Soğuma' },
  face: { PREP: 'Hazırlık', WARMUP: 'Isınma', MAIN: 'Hareketler', FINISH: 'Bitiş' },
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
  R2: 'Dinlenme: güç hareketlerinde hareketler arası 45 sn (salonda 60 sn), kardiyoda 30 sn, yoga, postür ve yüzde 5-15 sn (uygulama varsayılanı; kaynak doğrulanmadı).',
  R3: 'Sıra: ısınma → büyük/çok eklemli hareketler → küçük ve tek eklemli hareketler → bitiş (genel antrenman düzeni; yoga, postür, nefes ve yüz kartlarında kendi şablonları).',
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
  face: [
    'Yüz egzersizi ve masajının etkisi için bilimsel kanıt sınırlıdır; sonuç garanti edilmez.',
    'Temiz ellerle yap; cildin hassassa, yüzünde yara, enfeksiyon ya da yeni botoks/dolgu varsa yapma.',
    'Çene eklemi sorunun varsa çene hareketlerini yapma; ağrı olursa dur.',
  ],
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
  face: { warm: 5, main: 10, gym: 10 },
};

type Spec = string; // 'hareket-id' ya da 'hareket-id|3x10 45' (kartta özel yapılış)

function def(spec: Spec, rest: number): CardItemDef {
  const [itemId, w] = spec.split('|') as [string, string | undefined];
  return { itemId, restAfterSec: rest, ...(w ? { work: parseWork(w) } : {}) };
}

const EQUIP_NONE = 'Ekipmansız';

// Kart kurucu: ortam ve ekipman hareketlerden çıkarılır, dinlenmeler kategoriye göre atanır (son hareketin sonrasında dinlenme yok)
function C(id: string, title: string, regionKey: RegionKey, level: Level, summary: string, warm: Spec[], main: Spec[], finish: Spec[], extraPrep: string[] = []): WorkoutCardDef {
  const region = regionOf(regionKey);
  const category = region.category;
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
    regionKey,
    setting: gym ? 'gym' : 'home',
    level,
    equipment,
    region: region.title,
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

const HIP_WARM = ['hip-circles', 'leg-swings'];
const UPPER_WARM = ['arm-circles', 'shoulder-rolls'];
const STRETCH = (id: string) => `${id}|1x30s/s 0`;

const FITNESS_CARDS: WorkoutCardDef[] = [
  // ── Kalça ──
  C('hip-beginner', 'Kalça: başlangıç', 'hip', 'beginner', 'Zeminde, ekipmansız kalça çalışması.', HIP_WARM, ['glute-bridge', 'donkey-kick', 'fire-hydrant', 'clamshell'], [STRETCH('piriformis-stretch')]),
  C('hip-band', 'Kalça: bantlı', 'hip', 'beginner', 'Direnç bandıyla kalça yanı ve arkası.', HIP_WARM, ['band-lateral-walk', 'glute-bridge', 'clamshell', 'fire-hydrant'], [STRETCH('piriformis-stretch')]),
  C('hip-mid', 'Kalça: orta', 'hip', 'intermediate', 'Ekipmansız, daha zorlayıcı kalça serisi.', HIP_WARM, ['curtsy-lunge', 'single-leg-glute-bridge', 'side-leg-raise', 'donkey-kick'], [STRETCH('piriformis-stretch')]),
  C('hip-gym', 'Kalça: salon', 'hip', 'intermediate', 'Salonda kalça ve arka zincir.', ['hip-circles', 'march-in-place|1x60s 0'], ['hip-thrust', 'romanian-deadlift', 'hip-abduction-machine'], [STRETCH('piriformis-stretch')]),
  // ── Bacak ──
  C('legs-beginner', 'Bacak: başlangıç', 'legs', 'beginner', 'Sandalye destekli, hafif bacak antrenmanı.', ['leg-swings', 'march-in-place|1x60s 0'], ['sit-to-stand', 'mini-squat', 'wall-sit', 'calf-raise'], [STRETCH('quad-stretch'), STRETCH('hamstring-stretch')], ['Tekerleksiz, kolçaksız, kaymayan bir sandalye kullan.']),
  C('legs-home', 'Bacak: evde', 'legs', 'beginner', 'Ekipmansız bacak antrenmanı.', ['leg-swings', 'march-in-place|1x60s 0'], ['squat', 'sumo-squat', 'lunge', 'side-lunge', 'calf-raise'], [STRETCH('quad-stretch'), STRETCH('hamstring-stretch')]),
  C('legs-band', 'Bacak: bantlı', 'legs', 'beginner', 'Direnç bandıyla bacak.', ['leg-swings', 'march-in-place|1x60s 0'], ['band-squat', 'squat', 'lunge', 'calf-raise'], [STRETCH('quad-stretch')]),
  C('legs-dumbbell', 'Bacak: dambıllı', 'legs', 'intermediate', 'Tek dambılla bacak.', ['leg-swings', 'march-in-place|1x60s 0'], ['goblet-squat', 'bulgarian-split-squat', 'step-up', 'calf-raise'], [STRETCH('quad-stretch'), STRETCH('hamstring-stretch')]),
  C('legs-gym', 'Bacak: salon', 'legs', 'intermediate', 'Salon makineleri ve halterle bacak.', ['march-in-place|1x90s 0', 'leg-swings'], ['barbell-squat', 'leg-press', 'leg-extension', 'leg-curl'], [STRETCH('quad-stretch'), STRETCH('hamstring-stretch')]),
  // ── Göğüs ──
  C('chest-beginner', 'Göğüs: başlangıç', 'chest', 'beginner', 'Duvar ve yükseltilmiş zeminle hafif itiş.', UPPER_WARM, ['wall-push-up', 'incline-push-up', 'knee-push-up'], ['doorway-stretch|1x30s 0']),
  C('chest-home', 'Göğüs: evde', 'chest', 'intermediate', 'Ekipmansız şınav varyasyonları.', UPPER_WARM, ['incline-push-up', 'knee-push-up', 'push-up'], ['doorway-stretch|1x30s 0']),
  C('chest-dumbbell', 'Göğüs: dambıllı', 'chest', 'intermediate', 'Dambıllarla göğüs.', UPPER_WARM, ['db-floor-press', 'incline-db-press', 'band-chest-press'], ['doorway-stretch|1x30s 0']),
  C('chest-gym', 'Göğüs: salon', 'chest', 'intermediate', 'Salonda göğüs günü.', ['arm-circles', 'band-shoulder-pass'], ['bench-press', 'incline-db-press', 'cable-fly', 'chest-press-machine'], ['doorway-stretch|1x30s 0']),
  // ── Sırt ──
  C('back-beginner', 'Sırt: başlangıç', 'back', 'beginner', 'Hafif sırt ve kürek çalışması.', ['cat-cow|1x45s 0', 'shoulder-rolls'], ['superman', 'scapular-squeeze', 'band-row'], ['child-pose|1x45s 0']),
  C('back-home', 'Sırt: evde', 'back', 'intermediate', 'Masa ve havlu ile evde sırt.', ['cat-cow|1x45s 0', 'shoulder-rolls'], ['table-row', 'towel-row', 'superman', 'scapular-squeeze'], ['child-pose|1x45s 0']),
  C('back-dumbbell', 'Sırt: dambıllı', 'back', 'intermediate', 'Dambıllarla sırt.', ['cat-cow|1x45s 0', 'shoulder-rolls'], ['dumbbell-row', 'single-arm-row', 'superman'], ['child-pose|1x45s 0']),
  C('back-gym', 'Sırt: salon', 'back', 'intermediate', 'Salonda sırt günü.', ['cat-cow|1x45s 0', 'band-shoulder-pass'], ['lat-pulldown', 'seated-cable-row', 'assisted-pull-up'], ['child-pose|1x45s 0']),
  // ── Omuz ──
  C('shoulder-beginner', 'Omuz: başlangıç', 'shoulder', 'beginner', 'Bantla ve hafif dambılla omuz.', UPPER_WARM, ['band-pull-apart', 'lateral-raise', 'band-shoulder-press'], ['doorway-stretch|1x30s 0']),
  C('shoulder-dumbbell', 'Omuz: dambıllı', 'shoulder', 'intermediate', 'Dambıllarla omuz.', UPPER_WARM, ['overhead-press', 'lateral-raise', 'reverse-fly'], ['doorway-stretch|1x30s 0']),
  C('shoulder-gym', 'Omuz: salon', 'shoulder', 'intermediate', 'Salonda omuz.', ['arm-circles', 'band-shoulder-pass'], ['shoulder-press-machine', 'lateral-raise', 'face-pull'], ['doorway-stretch|1x30s 0']),
  // ── Kol ──
  C('arms-beginner', 'Kol: başlangıç', 'arms', 'beginner', 'Biceps ve triceps için hafif seri.', ['arm-circles', 'wrist-circles'], ['biceps-curl', 'triceps-extension', 'bench-dips'], ['wrist-flexor-stretch|1x20s/s 0']),
  C('arms-band', 'Kol: bantlı', 'arms', 'beginner', 'Direnç bandıyla ve vücut ağırlığıyla kol.', ['arm-circles', 'wrist-circles'], ['band-biceps-curl', 'bench-dips', 'diamond-push-up|3x6 60'], ['wrist-flexor-stretch|1x20s/s 0']),
  C('arms-dumbbell', 'Kol: dambıllı', 'arms', 'intermediate', 'Biceps ve triceps dambıllarla.', ['arm-circles', 'wrist-circles'], ['biceps-curl', 'hammer-curl', 'triceps-extension'], ['wrist-flexor-stretch|1x20s/s 0']),
  C('arms-gym', 'Kol: salon', 'arms', 'intermediate', 'Salonda kol.', ['arm-circles', 'wrist-circles'], ['triceps-pushdown', 'hammer-curl', 'biceps-curl'], ['wrist-flexor-stretch|1x20s/s 0']),
  // ── Karın ──
  C('core-beginner', 'Karın: başlangıç', 'core', 'beginner', 'Sakin tempolu temel karın ve core.', ['cat-cow|1x45s 0', 'pelvic-tilt'], ['dead-bug', 'bird-dog', 'plank', 'heel-touch'], ['child-pose|1x45s 0']),
  C('core-mid', 'Karın: orta', 'core', 'intermediate', 'Ekipmansız karın serisi.', ['cat-cow|1x45s 0', 'pelvic-tilt'], ['crunch', 'bicycle-crunch', 'reverse-crunch', 'side-plank', 'russian-twist'], ['child-pose|1x45s 0']),
  C('core-advanced', 'Karın: ileri', 'core', 'advanced', 'İleri seviye karın ve core.', ['cat-cow|1x45s 0', 'pelvic-tilt'], ['hollow-hold', 'leg-raise', 'plank-shoulder-tap', 'flutter-kick'], ['child-pose|1x45s 0']),
  C('core-equip', 'Karın: ekipmanlı', 'core', 'intermediate', 'Bant ve salon ekipmanıyla core.', ['cat-cow|1x45s 0', 'pelvic-tilt'], ['pallof-press', 'cable-woodchop', 'ab-wheel'], ['child-pose|1x45s 0']),
  // ── Tüm vücut (karma) ──
  C('chair-start', 'Sandalyeli başlangıç', 'fullbody', 'beginner', 'Sandalye ve duvarla yapılan hafif tüm vücut antrenmanı.', ['arm-circles', 'hip-circles'], ['sit-to-stand', 'mini-squat', 'calf-raise', 'wall-push-up'], ['deep-breathing|1x60s 0'], ['Tekerleksiz, kolçaksız, kaymayan bir sandalye kullan.']),
  C('fullbody-home', 'Tüm vücut: evde', 'fullbody', 'beginner', 'Ekipmansız, tüm kas gruplarına dengeli bir antrenman.', ['arm-circles', 'hip-circles', 'march-in-place|1x60s 0'], ['sumo-squat', 'knee-push-up', 'glute-bridge', 'dead-bug', 'superman'], ['child-pose|1x45s 0']),
  C('fullbody-dumbbell', 'Tüm vücut: dambıllı', 'fullbody', 'intermediate', 'Tek çift dambılla tüm vücut.', ['arm-circles', 'hip-circles', 'march-in-place|1x60s 0'], ['goblet-squat', 'db-floor-press', 'single-arm-row', 'romanian-deadlift', 'overhead-press', 'plank'], [STRETCH('hamstring-stretch')]),
  C('quick-10', '10 dakikalık hızlı antrenman', 'fullbody', 'beginner', 'Vaktin kısaysa: 4 hareket, kısa dinlenme.', ['march-in-place|1x45s 0'], ['squat|2x10 30', 'knee-push-up|2x8 30', 'glute-bridge|2x12 30', 'plank|2x20s 30'], []),
  C('home-lower-mid', 'Alt vücut ve itme', 'fullbody', 'intermediate', 'Ekipmansız, orta seviye bacak, kalça ve göğüs.', ['hip-circles', 'arm-circles'], ['squat', 'single-leg-glute-bridge', 'knee-push-up', 'bird-dog'], [STRETCH('hamstring-stretch')]),
  C('core-hip-start', 'Core ve kalça: başlangıç', 'fullbody', 'beginner', 'Zeminde sakin tempolu core ve kalça.', ['cat-cow|1x45s 0'], ['glute-bridge', 'bird-dog', 'dead-bug'], ['child-pose|1x45s 0']),
];

const OTHER_CARDS: WorkoutCardDef[] = [
  // ── Postür ──
  C('posture-short', 'Duruş molası', 'posture', 'beginner', 'Masa başında kısa mola; boyun ve nefes.', ['shoulder-rolls'], ['chin-tuck|3x10 15', 'doorway-stretch|2x20s 10'], ['deep-breathing|1x120s 0']),
  C('posture-desk', 'Masa başı 5 dakika', 'posture', 'beginner', 'Oturduğun yerde yapılabilen kısa seri.', [], ['desk-stretch', 'neck-stretch-side', 'wrist-flexor-stretch', 'shoulder-rolls', 'thoracic-rotation'], []),
  C('posture-neck', 'Boyun ve omuz rahatlatma', 'posture', 'beginner', 'Gerginliği azaltan hafif hareketler.', ['shoulder-rolls'], ['neck-rotation', 'neck-stretch-side', 'chin-tuck|3x10 15', 'doorway-stretch|2x20s 10'], ['deep-breathing|1x120s 0']),
  C('posture-upper-back', 'Üst sırt ve duruş', 'posture', 'beginner', 'Yuvarlak omuz ve kamburlaşmaya karşı.', ['cat-cow|1x45s 0'], ['thread-needle', 'scapular-squeeze', 'prone-y-raise', 'band-pull-apart'], ['child-pose|1x45s 0']),
  C('posture-hip-back', 'Kalça ve bel rahatlatma', 'posture', 'beginner', 'Uzun oturmaya karşı.', ['pelvic-tilt'], ['piriformis-stretch', 'hip-flexor-stretch', 'supine-twist', 'cat-cow|1x45s 0'], ['deep-breathing|1x120s 0']),
  // ── Yoga ──
  C('yoga-calm', 'Sakin yoga akışı', 'yoga', 'beginner', 'Yavaş tempo, nefes odaklı başlangıç.', ['deep-breathing|1x60s 0', 'cat-cow|1x60s 0'], ['downward-dog|3x15s 10', 'low-lunge', 'seated-forward-fold'], ['child-pose|1x60s 0', 'deep-breathing|1x120s 0']),
  C('yoga-flow-mid', 'Yoga akışı: orta', 'yoga', 'intermediate', 'Ayakta duruşlarla orta seviye akış.', ['deep-breathing|1x60s 0', 'cat-cow|1x60s 0'], ['chair-pose', 'warrior-one', 'warrior-two', 'triangle-pose', 'tree-pose', 'downward-dog|2x20s 10'], ['child-pose|1x60s 0', 'supine-twist']),
  C('yoga-flex', 'Esneklik', 'yoga', 'beginner', 'Yavaş, uzun tutuşlu esneme.', ['deep-breathing|1x60s 0'], ['hamstring-stretch|2x30s 10', 'seated-forward-fold', 'pigeon-pose', 'happy-baby', 'supine-twist'], ['child-pose|1x60s 0']),
  C('yoga-relax', 'Gevşeme ve nefes', 'yoga', 'beginner', 'Gün sonu gevşeme: nefes ve sakinleşme.', [], ['box-breathing', 'legs-up-wall', 'body-scan'], ['deep-breathing|1x120s 0']),
  // ── Pilates ──
  C('pilates-start', 'Pilates: başlangıç', 'pilates', 'beginner', 'Temel pilates hareketleri.', ['pelvic-tilt', 'cat-cow|1x45s 0'], ['dead-bug', 'pilates-leg-circles', 'pilates-side-leg-series', 'pilates-single-leg-stretch'], ['child-pose|1x45s 0']),
  C('pilates-mid', 'Pilates: orta', 'pilates', 'intermediate', 'Daha uzun seri; kontrollü nefes.', ['pelvic-tilt', 'cat-cow|1x45s 0'], ['pilates-hundred', 'pilates-roll-up', 'pilates-single-leg-stretch', 'pilates-swimming'], ['child-pose|1x45s 0']),
  // ── Kardiyo ──
  C('cardio-low', 'Düşük etkili kardiyo', 'cardio', 'beginner', 'Zıplamasız, eklem dostu kardiyo.', ['march-in-place|1x90s 0'], ['step-jacks', 'shadow-boxing', 'jogging-in-place', 'stair-climb|1x180s 0'], ['deep-breathing|1x90s 0']),
  C('cardio-hiit', 'Yüksek tempolu aralıklar', 'cardio', 'intermediate', 'Kısa ve yoğun; eklem sorunun varsa uygun değil.', ['march-in-place|1x90s 0', 'leg-swings'], ['jumping-jack', 'high-knees', 'skater', 'squat-jump', 'burpee'], ['deep-breathing|1x90s 0'], ['Yüksek etkili harekettir: diz, ayak bileği ya da bel sorunun varsa kısıt seç.']),
  C('cardio-steady', 'Dayanıklılık yürüyüşü', 'cardio', 'beginner', 'Sabit tempolu, uzun süreli.', ['march-in-place|1x60s 0'], ['brisk-walk'], [STRETCH('hamstring-stretch')]),
  C('cardio-agility', 'Kısa kardiyo ve çeviklik', 'cardio', 'intermediate', 'Yüksek etkili, kısa aralıklı.', ['march-in-place|1x90s 0'], ['lateral-shuffle', 'squat-jump'], ['deep-breathing|1x90s 0']),
  // ── Mobilite ve günlük ──
  C('mobility-morning', 'Sabah mobilite', 'mobility', 'beginner', 'Güne uyanmak için hafif hareketler.', [], ['cat-cow|1x60s 0', 'worlds-greatest-stretch', 'hip-circles', 'arm-circles', 'inchworm'], ['deep-breathing|1x60s 0']),
  C('daily-break', 'Günlük hareket molası', 'mobility', 'beginner', 'Gün içinde oturmayı bölmek için.', [], ['standing-break', 'chair-march', 'heel-toe-walk', 'toe-raise', 'ankle-circles'], []),
  // ── Spor ve performans ──
  C('sport-agility', 'Çeviklik ve hız', 'sport', 'intermediate', 'Hızlı ayak ve yön değiştirme.', ['march-in-place|1x90s 0', 'leg-swings'], ['agility-ladder', 'lateral-shuffle', 'skater', 'bear-crawl'], [STRETCH('hamstring-stretch')]),
  C('sport-power', 'Patlayıcı güç', 'sport', 'advanced', 'Sıçrama ve patlayıcılık; iyi bir temel gerektirir.', ['march-in-place|1x90s 0', 'leg-swings'], ['squat-jump', 'broad-jump', 'lateral-bound', 'box-jump', 'sprint-intervals'], [STRETCH('hamstring-stretch')], ['İniş tekniğini bilmiyorsan bu kartı yapma.']),
  C('sport-balance', 'Denge ve koordinasyon', 'sport', 'beginner', 'Tek ayak ve kontrol.', ['ankle-circles'], ['single-leg-balance', 'tree-pose', 'heel-toe-walk', 'single-leg-rdl|3x6/s 45'], ['child-pose|1x45s 0']),
];

// ── Yüz Egzersizi ve Masajlar: her bölge için egzersiz ve masaj kartı + hazır rutinler ──
const FACE_CARDS: WorkoutCardDef[] = [
  ...FACE_REGIONS.flatMap((r) =>
    (['ex', 'ms'] as const).flatMap((type) => {
      const ids = ITEMS.filter((i) => FACE_META[i.id]?.region === r.key && FACE_META[i.id]!.type === type).map((i) => i.id);
      if (ids.length === 0) return [];
      const label = type === 'ex' ? 'egzersizler' : 'masaj';
      return [
        C(`${r.key}-${type}`, `${r.title}: ${label}`, r.key, 'beginner', type === 'ex' ? `${r.title} bölgesi için yüz egzersizleri.` : `${r.title} bölgesi için hafif masaj hareketleri.`, type === 'ms' ? ['face-avuc-isit'] : [], ids, ['deep-breathing|1x30s 0']),
      ];
    }),
  ),
  C('face-morning', 'Sabah yüz egzersizi', 'face-tum', 'beginner', 'Kısa sabah yüz egzersizi rutini.', ['face-yuz-isinma'], ['face-kas-kaldir', 'face-balik-surati', 'face-genis-gulumse', 'face-cene-yukari', 'face-yuzu-saga-sola', 'face-aslan-yuzu'], ['deep-breathing|1x30s 0']),
  C('face-evening', 'Akşam rahatlatıcı masaj', 'face-tum', 'beginner', 'Gün sonu hafif yüz masajı.', ['face-avuc-isit'], ['face-yuz-genel-siva', 'face-alin-yana-siva', 'face-elmacik-daire', 'face-cene-hatti-siva', 'face-gidi-asagidan-yukari', 'face-kulak-masaji'], ['deep-breathing|1x60s 0']),
  C('face-jaw-neck', 'Çene hattı ve gıdı egzersizi', 'face-cene', 'beginner', 'Çene hattı ve boyun için egzersiz rutini.', ['face-yuz-isinma'], ['face-cene-yukari', 'face-gidi-oper', 'face-dil-damak', 'face-yuzu-saga-sola', 'face-alt-dudak', 'face-boyun-uzat'], ['deep-breathing|1x30s 0']),
];

export const CARDS: WorkoutCardDef[] = [...FITNESS_CARDS, ...OTHER_CARDS, ...FACE_CARDS];

// Kartın hedefi ve hedef bölgeleri (liste kartı ve filtre çipleri için); görsel anahtarı bölgeden gelir
const GOALS: Record<CardCategory, string> = {
  fitness: 'Kas kazanmak',
  yoga: 'Esneklik ve rahatlama',
  pilates: 'Core ve duruş',
  posture: 'Duruşu iyileştirmek',
  cardio: 'Kondisyon ve yağ yakımı',
  mobility: 'Hareket kabiliyeti',
  sport: 'Performans',
  face: 'Yüz kaslarını çalıştırmak ve rahatlamak',
};
const AREA_TAGS: Partial<Record<RegionKey, string[]>> = { hip: ['Kalça', 'Glute'], chest: ['Göğüs', 'Arka kol'], back: ['Sırt'], core: ['Karın', 'Core'], posture: ['Boyun', 'Omuz', 'Üst sırt'], pilates: ['Pilates', 'Core'] };
export function cardMeta(c: WorkoutCardDef) {
  const region = regionOf(c.regionKey);
  const goal = c.id === 'quick-10' ? 'Kısa ve etkili antrenman' : c.id === 'cardio-low' ? 'Yağ yakımı (eklem dostu)' : c.id.endsWith('-ms') || c.id === 'face-evening' ? 'Rahatlama' : GOALS[c.category];
  return { hero: region.hero, goal, regionKey: c.regionKey, areas: AREA_TAGS[c.regionKey] ?? [region.title] };
}

export const findCard = (id: string) => CARDS.find((c) => c.id === id);
// Bir hareketin yer aldığı kartlar (hareket sayfasında "hangi antrenmanda" listesi)
export const cardsWithItem = (itemId: string) => CARDS.filter((c) => c.sections.some((s) => s.items.some((i) => i.itemId === itemId)));

// Bölge özeti: kutudaki "N Hareket" ve bölgenin hareket listesi (fitness bölgelerinde yalnızca ANA hareketler)
export function regionSummaries() {
  return REGIONS.map((r) => {
    const cards = CARDS.filter((c) => c.regionKey === r.key);
    const ids = [...new Set(cards.flatMap((c) => c.sections.filter((s) => s.kind === 'MAIN').flatMap((s) => s.items.map((i) => i.itemId))))];
    const moves = ids.flatMap((id) => {
      const it = findItem(id);
      return it ? [{ id, title: it.title, level: it.level, workText: '' }] : [];
    });
    return { key: r.key, title: r.title, category: r.category, hero: r.hero, cardCount: cards.length, moveCount: moves.length, moves };
  }).filter((r) => r.cardCount > 0);
}

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
