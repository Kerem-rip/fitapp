// Genişletilmiş hareket tablosu: ev, salon, yoga, pilates, postür, mobilite, kardiyo ve spor hareketleri.
// KAYNAK TARAMASI YAPILMAMIŞTIR (kullanıcı kararı: içerik sonradan incelenip gerekmeyenler çıkarılacak); evidence.ts'te kaydı olmayan her hareket
// arayüzde "Henüz taranmadı" etiketiyle görünür. Hareketler tek kayıttır; plan motoru meta verisi de buradan üretilir.
import type { ItemCategory, LibraryItem, Level, Work } from './catalog.js';

type Cat = 'STRENGTH' | 'YOGA_PILATES' | 'POSTURE' | 'CARDIO_FAT_BURN' | 'SPORT_PERFORMANCE' | 'WELLNESS_DAILY';
type Pat = 'SQUAT' | 'HINGE' | 'LUNGE' | 'PUSH' | 'PULL' | 'CORE' | 'CARDIO' | 'MOBILITY' | 'BREATH';
type Role = 'WARMUP' | 'MAIN' | 'COOLDOWN';

interface Group {
  ic: ItemCategory;
  pc: Cat;
  sub: string;
  pat: Pat;
  roles: Role[];
  met: number;
}
const GROUPS: Record<string, Group> = {
  lowS: { ic: 'home', pc: 'STRENGTH', sub: 'lower_body', pat: 'SQUAT', roles: ['MAIN'], met: 5 },
  lowH: { ic: 'home', pc: 'STRENGTH', sub: 'lower_body', pat: 'HINGE', roles: ['MAIN'], met: 4.5 },
  lowL: { ic: 'home', pc: 'STRENGTH', sub: 'lower_body', pat: 'LUNGE', roles: ['MAIN'], met: 5 },
  push: { ic: 'home', pc: 'STRENGTH', sub: 'upper_push', pat: 'PUSH', roles: ['MAIN'], met: 4 },
  pull: { ic: 'home', pc: 'STRENGTH', sub: 'upper_pull', pat: 'PULL', roles: ['MAIN'], met: 4 },
  core: { ic: 'home', pc: 'STRENGTH', sub: 'core', pat: 'CORE', roles: ['MAIN'], met: 3.5 },
  yoga: { ic: 'mobility', pc: 'YOGA_PILATES', sub: 'yoga_flow', pat: 'MOBILITY', roles: ['MAIN', 'COOLDOWN'], met: 2.5 },
  pil: { ic: 'home', pc: 'YOGA_PILATES', sub: 'pilates_core', pat: 'CORE', roles: ['MAIN'], met: 3.5 },
  str: { ic: 'mobility', pc: 'YOGA_PILATES', sub: 'stretching', pat: 'MOBILITY', roles: ['COOLDOWN'], met: 2 },
  postN: { ic: 'posture', pc: 'POSTURE', sub: 'neck_shoulder', pat: 'MOBILITY', roles: ['MAIN', 'COOLDOWN'], met: 2 },
  postU: { ic: 'posture', pc: 'POSTURE', sub: 'upper_back', pat: 'MOBILITY', roles: ['MAIN', 'WARMUP'], met: 2.5 },
  postH: { ic: 'posture', pc: 'POSTURE', sub: 'hip_pelvis', pat: 'MOBILITY', roles: ['MAIN', 'COOLDOWN'], met: 2 },
  mob: { ic: 'mobility', pc: 'WELLNESS_DAILY', sub: 'mobility', pat: 'MOBILITY', roles: ['WARMUP'], met: 2.5 },
  breath: { ic: 'mobility', pc: 'WELLNESS_DAILY', sub: 'breathing_relax', pat: 'BREATH', roles: ['COOLDOWN'], met: 1.3 },
  daily: { ic: 'mobility', pc: 'WELLNESS_DAILY', sub: 'daily_movement', pat: 'MOBILITY', roles: ['MAIN', 'WARMUP'], met: 2.5 },
  cardL: { ic: 'cardio', pc: 'CARDIO_FAT_BURN', sub: 'low_impact', pat: 'CARDIO', roles: ['MAIN', 'WARMUP'], met: 5 },
  cardH: { ic: 'cardio', pc: 'CARDIO_FAT_BURN', sub: 'high_intensity', pat: 'CARDIO', roles: ['MAIN'], met: 8 },
  cardS: { ic: 'cardio', pc: 'CARDIO_FAT_BURN', sub: 'steady_state', pat: 'CARDIO', roles: ['MAIN'], met: 6 },
  agil: { ic: 'cardio', pc: 'SPORT_PERFORMANCE', sub: 'agility', pat: 'CARDIO', roles: ['MAIN'], met: 6 },
  power: { ic: 'cardio', pc: 'SPORT_PERFORMANCE', sub: 'power', pat: 'CARDIO', roles: ['MAIN'], met: 8 },
  spo: { ic: 'cardio', pc: 'SPORT_PERFORMANCE', sub: 'sport_specific', pat: 'CARDIO', roles: ['MAIN', 'WARMUP'], met: 5 },
};

// Ekipman kodu: - yok, D dambıl, B bant, S basamak/sandalye, M makine, G salon ekipmanı (halter, kablo...)
const EQUIP_TEXT: Record<string, string> = { '-': 'Ekipmansız', D: 'Dambıl', B: 'Direnç bandı', S: 'Basamak ya da sağlam sandalye', M: 'Makine', G: 'Salon ekipmanı' };
const EQUIP_CODE: Record<string, string> = { D: 'DUMBBELL', B: 'BAND', S: 'STEP', M: 'MACHINE' };
// Yük bölgesi kodları: K diz, B bel, W bilek, S omuz, A ayak bileği, N boyun, H kalça, I yüksek etkili
const AREA: Record<string, string> = { K: 'KNEE', B: 'LOW_BACK', W: 'WRIST', S: 'SHOULDER', A: 'ANKLE', N: 'NECK', H: 'HIP' };
const LEVELS: Level[] = ['beginner', 'intermediate', 'advanced'];

// "3x12 45" tekrar, "3x30s 30" süre, "/s" her taraf; son sayı set arası dinlenme (sn)
export function parseWork(w: string): Work {
  const m = /^(\d+)x(\d+)(s?)(\/s)? (\d+)$/.exec(w)!;
  return { sets: +m[1]!, ...(m[3] ? { seconds: +m[2]! } : { reps: +m[2]! }), ...(m[4] ? { perSide: true } : {}), restSec: +m[5]! };
}

export interface ExtraMeta {
  categories: { category: Cat; subcategory: string }[];
  settings: ('HOME_NONE' | 'HOME_EQUIP' | 'GYM')[];
  equipment: string[];
  pattern: Pat;
  roles: Role[];
  level: 1 | 2 | 3;
  stress: string[];
  highImpact?: boolean;
  alternatives: string[];
  met: number;
}

interface Row {
  item: LibraryItem;
  meta: ExtraMeta;
  en: string;
}
const ROWS: Row[] = [];

function x(id: string, title: string, en: string, g: string, level: 1 | 2 | 3, equip: string, primary: string[], steps: string[], mistake: string, warning: string, work: string, stress: string, alt: string[]) {
  const G = GROUPS[g]!;
  const gymOnly = equip === 'M' || equip === 'G';
  const equipped = equip !== '-';
  const cat: ItemCategory = gymOnly ? 'fitness' : G.ic;
  ROWS.push({
    en,
    item: {
      id,
      kind: 'MOVE',
      category: cat,
      title,
      summary: `${primary.join(', ')} · ${EQUIP_TEXT[equip]}`,
      level: LEVELS[level - 1]!,
      equipment: EQUIP_TEXT[equip],
      primary,
      secondary: [],
      steps,
      mistakes: [mistake],
      warnings: [warning],
      work: parseWork(work),
    },
    meta: {
      categories: [{ category: G.pc, subcategory: G.sub }],
      settings: gymOnly ? ['GYM'] : equipped ? ['HOME_EQUIP', 'GYM'] : ['HOME_NONE', 'HOME_EQUIP', 'GYM'],
      equipment: EQUIP_CODE[equip] ? [EQUIP_CODE[equip]!] : [],
      pattern: G.pat,
      roles: G.roles,
      level,
      stress: stress.split('').filter((c) => AREA[c]).map((c) => AREA[c]!),
      ...(stress.includes('I') ? { highImpact: true } : {}),
      alternatives: alt,
      met: G.met,
    },
  });
}

// Ortak güvenlik cümleleri
const KNEE = 'Dizinde keskin ağrı hissedersen dur.';
const BACK = 'Belinde ağrı hissedersen dur; ağrı sürerse doktora başvur.';
const SHOULDER = 'Omzunda keskin ağrı hissedersen dur.';
const WRIST = 'Bileğinde ağrı hissedersen yumruk yap ya da bırak.';
const NECK = 'Boynunda ağrı ya da uyuşma hissedersen dur.';
const HIGH = 'Yüksek etkili harekettir; eklem sorunun varsa daha hafif alternatifi seç.';
const STRETCH = 'Ağrıya girme; hafif gerilme hissi yeterli, sıçrama yapma.';
const GYM = 'Ağır ağırlıkta güvenlik için yardımcı ya da uzman gözetimi önerilir.';

// ───────── Alt vücut ─────────
x('sumo-squat', 'Sumo squat', 'Sumo squat', 'lowS', 1, '-', ['İç bacak', 'Kalça'], ['Ayaklar omuzdan geniş, parmaklar hafif dışa.', 'Göğüs dik, kalçayı aşağı bırak; dizler ayak yönünde.', 'Topuklardan iterek kalk.'], 'Dizlerin içe çökmesi', KNEE, '3x12 45', 'K', ['squat', 'glute-bridge']);
x('wall-sit', 'Duvara yaslanarak squat', 'Wall sit', 'lowS', 1, '-', ['Ön bacak'], ['Sırtını duvara yasla, ayaklar bir adım önde.', 'Kalçayı dizler yaklaşık 90 derece olana kadar kaydır.', 'Pozisyonu koru, normal nefes al.'], 'Dizlerin ayak ucunu çok geçmesi', KNEE, '3x30s 45', 'K', ['mini-squat', 'glute-bridge']);
x('side-lunge', 'Yan hamle', 'Side lunge', 'lowL', 2, '-', ['İç bacak', 'Kalça'], ['Geniş dur, bir yana adım at.', 'Adım attığın dizi bük, diğer bacak düz kalsın.', 'İterek başlangıca dön.'], 'Dizin içe kapanması', KNEE, '3x10/s 45', 'KH', ['lunge', 'step-up']);
x('bulgarian-split-squat', 'Bulgar split squat', 'Bulgarian split squat', 'lowL', 3, 'S', ['Ön bacak', 'Kalça'], ['Arka ayağını sandalyeye koy.', 'Öndeki dizi bük, gövde dik.', 'Ön topukla iterek yüksel.'], 'Ön dizin öne çok kayması', KNEE, '3x8/s 60', 'KA', ['lunge', 'step-up']);
x('curtsy-lunge', 'Kurtsy hamle', 'Curtsy lunge', 'lowL', 2, '-', ['Kalça', 'Ön bacak'], ['Bir ayağınla çapraz, geriye adım at.', 'İki dizi bük, kalça hizalı kalsın.', 'Başlangıca dön.'], 'Dengeyi kaybetmek', KNEE, '3x10/s 45', 'KH', ['lunge', 'glute-bridge']);
x('band-squat', 'Bantlı squat', 'Banded squat', 'lowS', 1, 'B', ['Ön bacak', 'Kalça'], ['Bandı dizlerinin hemen üstüne tak.', 'Squat yaparken dizleri banda karşı dışa it.', 'Yavaş kalk.'], 'Dizlerin içe çökmesi', KNEE, '3x12 45', 'K', ['squat', 'sumo-squat']);
x('barbell-squat', 'Halter squat', 'Barbell back squat', 'lowS', 3, 'G', ['Ön bacak', 'Kalça', 'Sırt'], ['Halteri omuzların arkasında dengele, ayaklar omuz genişliğinde.', 'Core sıkı, kalça ve diz birlikte bükülür; uyluk yere paralel.', 'Topuklardan iterek kalk.'], 'Belin yuvarlanması', `${BACK} ${GYM}`, '4x6 120', 'KB', ['goblet-squat', 'leg-press']);
x('leg-extension', 'Bacak açma makinesi', 'Leg extension', 'lowS', 1, 'M', ['Ön bacak'], ['Makineyi ayarla; dizler eksenle hizalı.', 'Bacakları yavaşça uzat, tepede kısa bekle.', 'Kontrollü indir.'], 'Ağırlığı sallayarak kaldırmak', KNEE, '3x12 60', 'K', ['squat', 'leg-press']);
x('leg-curl', 'Bacak bükme makinesi', 'Leg curl', 'lowH', 1, 'M', ['Arka bacak'], ['Makineyi ayarla; bilek pedinde.', 'Topukları kalçaya doğru çek.', 'Yavaşça bırak.'], 'Kalçanın kalkması', KNEE, '3x12 60', 'K', ['glute-bridge', 'romanian-deadlift']);
x('hip-thrust', 'Kalça itişi', 'Hip thrust', 'lowH', 2, 'S', ['Kalça', 'Arka bacak'], ['Sırtının üstünü sandalye ya da bench kenarına yasla.', 'Ayaklar yerde, kalçayı gövde düz olana kadar yukarı it.', 'Tepede sık, yavaş indir.'], 'Belin çukurlaşması', BACK, '3x12 60', 'B', ['glute-bridge', 'single-leg-glute-bridge']);
x('donkey-kick', 'Eşek tekmesi', 'Donkey kick', 'lowH', 1, '-', ['Kalça'], ['Dört ayak pozisyonu al.', 'Bir bacağı dizi bükük şekilde tavana doğru it.', 'Kontrollü indir; belini çukurlaştırma.'], 'Belin çukurlaşması', BACK, '3x12/s 30', 'W', ['glute-bridge', 'fire-hydrant']);
x('fire-hydrant', 'Ateş çiçeği', 'Fire hydrant', 'lowH', 1, '-', ['Kalça yanı'], ['Dört ayak pozisyonu al.', 'Dizi bükük şekilde yana kaldır.', 'Kalça sabit, kontrollü indir.'], 'Gövdenin yana kayması', WRIST, '3x12/s 30', 'W', ['clamshell', 'side-leg-raise']);
x('side-leg-raise', 'Yan bacak kaldırma', 'Side leg raise', 'lowH', 1, '-', ['Kalça yanı'], ['Yan yat, alttaki diz hafif bükük.', 'Üstteki bacağı düz yukarı kaldır.', 'Yavaş indir; kalça öne-arkaya dönmesin.'], 'Kalçanın geriye dönmesi', BACK, '3x15/s 30', '', ['clamshell', 'fire-hydrant']);
x('hip-abduction-machine', 'Kalça açma makinesi', 'Hip abduction machine', 'lowH', 1, 'M', ['Kalça yanı'], ['Oturup sırtını yasla, pedleri dizlerin dışına yerleştir.', 'Bacakları dışa aç.', 'Yavaş kapat.'], 'Ağırlığı sallamak', BACK, '3x15 45', '', ['side-leg-raise', 'clamshell']);
x('single-leg-rdl', 'Tek bacak Rus deadlift', 'Single-leg Romanian deadlift', 'lowH', 2, 'D', ['Arka bacak', 'Kalça'], ['Bir bacakta dur; hafif bükük diz.', 'Kalçayı geriye iterek gövdeyi öne eğ, diğer bacak geriye uzansın.', 'Kalçayı sıkarak dön.'], 'Belin yuvarlanması', BACK, '3x8/s 60', 'B', ['romanian-deadlift', 'glute-bridge']);
x('clamshell', 'Midye', 'Clamshell', 'lowH', 1, '-', ['Kalça yanı'], ['Yan yat, dizler bükük, topuklar bitişik.', 'Topukları ayırmadan üstteki dizi aç.', 'Yavaş kapat.'], 'Kalçanın geriye dönmesi', BACK, '3x15/s 30', '', ['side-leg-raise', 'fire-hydrant']);
x('band-lateral-walk', 'Bantlı yan yürüyüş', 'Banded lateral walk', 'lowL', 1, 'B', ['Kalça yanı'], ['Bandı dizlerinin üstüne tak, hafif çömel.', 'Yana küçük adımlarla yürü.', 'Ayaklar paralel, bant gergin kalsın.'], 'Dizlerin içe çökmesi', KNEE, '3x12/s 45', 'K', ['side-leg-raise', 'clamshell']);

// ───────── İtme ─────────
x('incline-push-up', 'Yüksek zeminde şınav', 'Incline push-up', 'push', 1, 'S', ['Göğüs', 'Arka kol'], ['Ellerini sağlam bir sandalye ya da basamağa koy.', 'Vücudun düz çizgi; göğsünü yaklaştır.', 'İterek yüksel.'], 'Belin çökmesi', WRIST, '3x10 45', 'WS', ['wall-push-up', 'knee-push-up']);
x('diamond-push-up', 'Dar şınav', 'Diamond push-up', 'push', 3, '-', ['Arka kol', 'Göğüs'], ['Ellerin başparmak ve işaret parmakları birbirine değsin.', 'Dirsekler vücuda yakın, aşağı in.', 'İterek yüksel.'], 'Dirseklerin dışa açılması', WRIST, '3x8 60', 'WS', ['knee-push-up', 'push-up']);
x('pike-push-up', 'Pike şınav', 'Pike push-up', 'push', 3, '-', ['Omuz', 'Arka kol'], ['Kalçan yukarıda ters V pozisyonu al.', 'Başını ellerinin arasına doğru indir.', 'İterek yüksel.'], 'Boynu aşırı bükmek', `${SHOULDER} ${NECK}`, '3x8 60', 'WSN', ['push-up', 'db-floor-press']);
x('bench-dips', 'Sandalyede dips', 'Bench dips', 'push', 2, 'S', ['Arka kol'], ['Ellerin sandalyenin kenarında, bacaklar önde.', 'Dirsekleri geriye bükerek in.', 'Kollarla it.'], 'Omuzların kulağa çıkması', SHOULDER, '3x10 45', 'SW', ['knee-push-up', 'triceps-extension']);
x('bench-press', 'Bench press', 'Bench press', 'push', 3, 'G', ['Göğüs', 'Omuz', 'Arka kol'], ['Bench\'e uzan, ayaklar yerde, kürekler sıkı.', 'Halteri göğüs hizasına indir.', 'Kontrollü it.'], 'Kalçanın bench\'ten kalkması', `${SHOULDER} ${GYM}`, '4x6 120', 'S', ['db-floor-press', 'chest-press-machine']);
x('incline-db-press', 'Eğimli dambıl press', 'Incline dumbbell press', 'push', 2, 'D', ['Üst göğüs', 'Omuz'], ['Eğimli bench\'e otur, dambıllar omuz hizasında.', 'Yukarı doğru it.', 'Yavaş indir.'], 'Dirseklerin çok açılması', SHOULDER, '3x10 60', 'S', ['db-floor-press', 'wall-push-up']);
x('lateral-raise', 'Yan omuz kaldırma', 'Lateral raise', 'push', 1, 'D', ['Omuz'], ['Hafif dambıllarla dur, dirsekler hafif bükük.', 'Kolları omuz hizasına kadar yana kaldır.', 'Yavaş indir.'], 'Omuzları kulağa çıkarmak', SHOULDER, '3x12 45', 'S', ['band-pull-apart', 'arm-circles']);
x('cable-fly', 'Kablo çaprazlama', 'Cable fly', 'push', 2, 'G', ['Göğüs'], ['Kolları yana açık, hafif bükük dirsekle tut.', 'Önde birleştir.', 'Kontrollü aç.'], 'Dirsekleri kilitlemek', SHOULDER, '3x12 60', 'S', ['db-floor-press', 'wall-push-up']);
x('chest-press-machine', 'Göğüs press makinesi', 'Chest press machine', 'push', 1, 'M', ['Göğüs', 'Arka kol'], ['Oturağı kolları göğüs hizasına ayarla.', 'İleri it.', 'Yavaş bırak.'], 'Omuzları öne yuvarlamak', SHOULDER, '3x10 60', 'S', ['db-floor-press', 'wall-push-up']);
x('shoulder-press-machine', 'Omuz press makinesi', 'Shoulder press machine', 'push', 1, 'M', ['Omuz'], ['Oturağı ayarla, sırt yaslı.', 'Yukarı it.', 'Kontrollü indir.'], 'Belin çukurlaşması', `${SHOULDER} ${BACK}`, '3x10 60', 'SB', ['lateral-raise', 'band-shoulder-press']);
x('triceps-extension', 'Dambıl triceps açma', 'Dumbbell triceps extension', 'push', 2, 'D', ['Arka kol'], ['Bir dambılı iki elle başının arkasında tut.', 'Dirsekleri sabit, kolları yukarı uzat.', 'Yavaş indir.'], 'Dirseklerin dışa açılması', SHOULDER, '3x12 45', 'S', ['bench-dips', 'triceps-pushdown']);
x('triceps-pushdown', 'Kablo triceps itiş', 'Triceps pushdown', 'push', 1, 'G', ['Arka kol'], ['Dirsekleri vücuda yakın tut.', 'Kabloyu aşağı it.', 'Yavaş yukarı bırak.'], 'Gövdeyi sallamak', 'Dirseğinde ağrı hissedersen dur.', '3x12 45', '', ['triceps-extension', 'bench-dips']);
x('band-chest-press', 'Bantlı göğüs press', 'Band chest press', 'push', 1, 'B', ['Göğüs'], ['Bandı sırtından geçir, uçları ellerinde.', 'İleri it.', 'Kontrollü bırak.'], 'Omuzların kalkması', SHOULDER, '3x12 45', 'S', ['wall-push-up', 'knee-push-up']);
x('band-shoulder-press', 'Bantlı omuz press', 'Band shoulder press', 'push', 1, 'B', ['Omuz'], ['Bandın ortasına bas, uçlar omuz hizasında.', 'Yukarı it.', 'Yavaş indir.'], 'Belin çukurlaşması', `${SHOULDER} ${BACK}`, '3x12 45', 'SB', ['lateral-raise', 'wall-push-up']);

// ───────── Çekme ─────────
x('table-row', 'Masa altı row', 'Table row', 'pull', 2, '-', ['Sırt', 'Kol önü'], ['Sağlam bir masanın altına uzan, kenarı tut.', 'Göğsünü masaya doğru çek.', 'Yavaş in.'], 'Kalçanın sarkması', 'Masanın sağlam ve kaymaz olduğundan emin ol.', '3x8 60', 'S', ['band-row', 'scapular-squeeze']);
x('towel-row', 'Havlu ile row', 'Towel row', 'pull', 1, 'S', ['Sırt'], ['Havluyu sağlam bir kola/kapı koluna dola.', 'Geriye eğil, kollarını çek.', 'Kontrollü ilerle.'], 'Sağlam olmayan noktaya bağlamak', 'Bağlanan noktanın sağlam olduğundan emin ol.', '3x10 45', 'S', ['band-row', 'scapular-squeeze']);
x('band-pull-apart', 'Bant açma', 'Band pull-apart', 'pull', 1, 'B', ['Arka omuz', 'Üst sırt'], ['Bandı omuz hizasında tut.', 'Kollarını yana aç.', 'Yavaş kapat.'], 'Omuzları yukarı çekmek', SHOULDER, '3x15 30', 'S', ['scapular-squeeze', 'band-row']);
x('single-arm-row', 'Tek kol row', 'Single-arm dumbbell row', 'pull', 1, 'D', ['Sırt', 'Kol önü'], ['Bir elini ve dizini sandalye ya da bench\'e koy.', 'Dambılı belin yanına çek.', 'Yavaş indir.'], 'Gövdeyi döndürmek', BACK, '3x10/s 45', 'B', ['dumbbell-row', 'band-row']);
x('seated-cable-row', 'Oturarak kablo row', 'Seated cable row', 'pull', 1, 'G', ['Sırt'], ['Sırt dik oturup kolu tut.', 'Karnına doğru çek, kürekleri sık.', 'Yavaş bırak.'], 'Gövdeyi geri sallamak', BACK, '3x12 60', 'B', ['band-row', 'dumbbell-row']);
x('face-pull', 'Face pull', 'Face pull', 'pull', 2, 'B', ['Arka omuz', 'Üst sırt'], ['Bandı göz hizasına bağla.', 'Yüzüne doğru çek, dirsekler yukarıda.', 'Yavaş bırak.'], 'Dirsekleri düşürmek', SHOULDER, '3x15 30', 'S', ['band-pull-apart', 'scapular-squeeze']);
x('reverse-fly', 'Ters kanat', 'Reverse fly', 'pull', 2, 'D', ['Arka omuz'], ['Öne eğil, dambıllar aşağıda.', 'Kolları yana aç.', 'Yavaş indir.'], 'Belin yuvarlanması', BACK, '3x12 45', 'B', ['band-pull-apart', 'scapular-squeeze']);
x('biceps-curl', 'Biceps curl', 'Biceps curl', 'pull', 1, 'D', ['Kol önü'], ['Dambıllar yanda, dirsekler sabit.', 'Omuzlara doğru kaldır.', 'Yavaş indir.'], 'Gövdeyi sallamak', 'Dirsekte ağrı olursa dur.', '3x12 45', '', ['band-biceps-curl', 'hammer-curl']);
x('hammer-curl', 'Çekiç curl', 'Hammer curl', 'pull', 1, 'D', ['Kol önü', 'Ön kol'], ['Avuçlar içe bakacak şekilde tut.', 'Omuzlara kaldır.', 'Yavaş indir.'], 'Dirsekleri öne kaydırmak', 'Dirsekte ağrı olursa dur.', '3x12 45', '', ['biceps-curl', 'band-biceps-curl']);
x('band-biceps-curl', 'Bantlı biceps curl', 'Band biceps curl', 'pull', 1, 'B', ['Kol önü'], ['Bandın ortasına bas.', 'Uçları omuza doğru çek.', 'Yavaş bırak.'], 'Gövdeyi sallamak', 'Dirsekte ağrı olursa dur.', '3x15 30', '', ['biceps-curl', 'hammer-curl']);
x('pull-up', 'Barfiks', 'Pull-up', 'pull', 3, 'G', ['Sırt', 'Kol önü'], ['Bara omuzdan geniş tut.', 'Çeneni bar hizasına çek.', 'Kontrollü in.'], 'Sallanarak çekmek', `${SHOULDER} Güvenlik için tamamen kontrollü ve emniyetli bir barda yap.`, '3x5 120', 'S', ['assisted-pull-up', 'band-row']);
x('assisted-pull-up', 'Yardımlı barfiks', 'Assisted pull-up', 'pull', 2, 'M', ['Sırt', 'Kol önü'], ['Makineyi ya da bantı yardım için ayarla.', 'Çeneyi bar hizasına çek.', 'Yavaş in.'], 'Sallanarak çekmek', SHOULDER, '3x8 90', 'S', ['band-row', 'dumbbell-row']);
x('superman', 'Süpermen', 'Superman', 'pull', 1, '-', ['Bel', 'Sırt'], ['Yüzüstü yat, kollar önde.', 'Kol ve bacakları hafifçe kaldır.', 'Kısa bekle, indir.'], 'Boynu geriye bükmek', `${BACK} ${NECK}`, '3x10 30', 'BN', ['bird-dog', 'dead-bug']);

// ───────── Core ─────────
x('crunch', 'Mekik', 'Crunch', 'core', 1, '-', ['Karın'], ['Sırtüstü yat, dizler bükük, eller göğüste.', 'Omuzları yerden hafifçe kaldır.', 'Yavaş in.'], 'Boynu elle çekmek', NECK, '3x15 30', 'N', ['dead-bug', 'plank']);
x('bicycle-crunch', 'Bisiklet mekiği', 'Bicycle crunch', 'core', 2, '-', ['Karın', 'Karın yanı'], ['Sırtüstü yat, elleri başının yanına koy.', 'Dirsek ile karşı dizi buluştur.', 'Yavaş değiştir.'], 'Boynu çekmek', `${BACK} ${NECK}`, '3x12/s 30', 'BN', ['crunch', 'dead-bug']);
x('reverse-crunch', 'Ters mekik', 'Reverse crunch', 'core', 2, '-', ['Alt karın'], ['Sırtüstü yat, dizler 90 derece.', 'Kalçayı yerden hafifçe kaldır.', 'Yavaş indir.'], 'Sallanarak kaldırmak', BACK, '3x12 30', 'B', ['dead-bug', 'crunch']);
x('leg-raise', 'Bacak kaldırma', 'Lying leg raise', 'core', 3, '-', ['Alt karın'], ['Sırtüstü yat, bacaklar düz.', 'Belin yerde, bacakları kaldır.', 'Yavaş indir.'], 'Belin yerden kalkması', BACK, '3x10 45', 'B', ['dead-bug', 'reverse-crunch']);
x('russian-twist', 'Rus dönüşü', 'Russian twist', 'core', 2, '-', ['Karın yanı'], ['Dizler bükük otur, gövde hafif geride.', 'Gövdeyi sağa sola çevir.', 'Kontrollü yap.'], 'Sadece kolları sallamak', BACK, '3x12/s 30', 'B', ['dead-bug', 'side-plank']);
x('flutter-kick', 'Makas bacak', 'Flutter kick', 'core', 2, '-', ['Alt karın'], ['Sırtüstü yat, bacaklar hafif yerden havada.', 'Küçük hareketlerle sırayla yukarı aşağı.', 'Beli yere bastır.'], 'Belin kalkması', BACK, '3x30s 30', 'B', ['dead-bug', 'reverse-crunch']);
x('ab-wheel', 'Karın tekeri', 'Ab wheel rollout', 'core', 3, 'G', ['Karın', 'Omuz'], ['Dizlerinin üstünde tekerleği tut.', 'Kontrollü öne yuvarla.', 'Core ile geri çek.'], 'Belin çökmesi', `${BACK} Başlangıçta kısa mesafeyle yap.`, '3x8 60', 'BS', ['plank', 'dead-bug']);
x('cable-woodchop', 'Kablo odun kesme', 'Cable woodchop', 'core', 2, 'G', ['Karın yanı'], ['Kabloyu iki elle tut.', 'Yukarıdan aşağı çapraz çek.', 'Kontrollü dön.'], 'Dizleri kilitlemek', BACK, '3x12/s 45', 'B', ['russian-twist', 'dead-bug']);
x('plank-shoulder-tap', 'Plankta omuz dokunma', 'Plank shoulder tap', 'core', 2, '-', ['Core', 'Omuz'], ['Yüksek plank pozisyonu al.', 'Elinle karşı omzuna dokun.', 'Kalça sabit kalsın.'], 'Kalçanın sallanması', `${WRIST} ${BACK}`, '3x20s 30', 'WSB', ['plank', 'dead-bug']);
x('hollow-hold', 'Boş gövde tutuşu', 'Hollow hold', 'core', 3, '-', ['Karın'], ['Sırtüstü yat, kollar ve bacaklar hafif havada.', 'Belin yerde, pozisyonu koru.', 'Normal nefes al.'], 'Belin yerden kalkması', BACK, '3x20s 45', 'B', ['dead-bug', 'plank']);
x('heel-touch', 'Topuk dokunma', 'Heel touch', 'core', 1, '-', ['Karın yanı'], ['Sırtüstü yat, dizler bükük.', 'Omuzları hafif kaldırıp sağ, sol topuğa uzan.', 'Yavaş yap.'], 'Boynu çekmek', NECK, '3x15 30', 'N', ['crunch', 'dead-bug']);
x('pallof-press', 'Pallof press', 'Pallof press', 'core', 2, 'B', ['Core', 'Karın yanı'], ['Bandı yana bağla, göğüs hizasında tut.', 'Kolları öne uzat, bandın seni çevirmesine izin verme.', 'Yavaş geri çek.'], 'Gövdenin dönmesi', BACK, '3x10/s 45', 'B', ['side-plank', 'dead-bug']);

// ───────── Yoga ─────────
x('warrior-one', 'Savaşçı 1 pozu', 'Warrior I', 'yoga', 2, '-', ['Bacak', 'Kalça'], ['Bir ayak önde, arka ayak hafif dışa.', 'Öndeki dizi bük, kolları yukarı uzat.', 'Nefes alarak tut.'], 'Önde dizin içe çökmesi', KNEE, '2x30s/s 15', 'KH', ['warrior-two', 'child-pose']);
x('tree-pose', 'Ağaç pozu', 'Tree pose', 'yoga', 1, '-', ['Denge', 'Bacak'], ['Bir ayakta dur, diğer ayağı baldır ya da uyluk iç kısmına koy (dize basma).', 'Eller göğüste ya da yukarıda.', 'Bakışını sabit bir noktaya ver.'], 'Ayağı dize bastırmak', 'Dengeni kaybedersen duvardan destek al.', '2x30s/s 15', 'A', ['child-pose', 'single-leg-balance']);
x('triangle-pose', 'Üçgen pozu', 'Triangle pose', 'yoga', 2, '-', ['Bacak arkası', 'Gövde yanı'], ['Geniş dur, ön ayak dışa.', 'Gövdeyi yana uzat, bir el bacağa diğeri yukarı.', 'Nefes alarak tut.'], 'Gövdeyi öne yuvarlamak', BACK, '2x20s/s 15', 'B', ['hamstring-stretch', 'child-pose']);
x('cobra-pose', 'Kobra pozu', 'Cobra pose', 'yoga', 1, '-', ['Sırt', 'Karın'], ['Yüzüstü yat, eller omuz altında.', 'Göğsü yavaşça kaldır, kalça yerde.', 'Omuzları kulaklardan uzak tut.'], 'Boynu geriye bükmek', `${BACK} Hamileysen yapma.`, '2x20s 15', 'B', ['child-pose', 'cat-cow']);
x('pigeon-pose', 'Güvercin pozu', 'Pigeon pose', 'yoga', 2, '-', ['Kalça', 'Arka kalça'], ['Dört ayaktan bir dizi öne al.', 'Gövdeyi öne yavaşça indir.', 'Derin nefes al.'], 'Dizi zorlamak', 'Dizde ya da kalçada ağrı varsa girme.', '2x30s/s 15', 'KH', ['hip-flexor-stretch', 'child-pose']);
x('chair-pose', 'Sandalye pozu', 'Chair pose', 'yoga', 2, '-', ['Bacak', 'Kalça'], ['Ayaklar bitişik, dizleri bük.', 'Kalçayı geriye bırak, kollar yukarı.', 'Tut.'], 'Dizlerin ayak ucunu geçmesi', KNEE, '2x20s 15', 'K', ['mini-squat', 'child-pose']);
x('low-lunge', 'Alçak hamle pozu', 'Low lunge', 'yoga', 1, '-', ['Kalça önü', 'Bacak'], ['Bir adım öne gel, arka diz yerde.', 'Kalçayı öne kaydır.', 'Gövdeyi dik tut.'], 'Belin çukurlaşması', KNEE, '2x30s/s 15', 'KH', ['hip-flexor-stretch', 'child-pose']);
x('seated-forward-fold', 'Oturarak öne eğilme', 'Seated forward fold', 'yoga', 1, '-', ['Arka bacak', 'Bel'], ['Bacaklar önde uzanık otur.', 'Kalçadan öne eğil, sırt uzun.', 'Nefes ver, gevşe.'], 'Sırtı yuvarlamak', BACK, '2x30s 15', 'B', ['hamstring-stretch', 'child-pose']);
x('supine-twist', 'Sırtüstü omurga döndürme', 'Supine spinal twist', 'yoga', 1, '-', ['Bel', 'Kalça'], ['Sırtüstü yat, dizler göğüste.', 'Dizleri bir yana bırak, omuzlar yerde.', 'Diğer tarafa geç.'], 'Omuzların yerden kalkması', BACK, '2x30s/s 15', 'B', ['child-pose', 'cat-cow']);
x('happy-baby', 'Mutlu bebek pozu', 'Happy baby', 'yoga', 1, '-', ['Kalça', 'İç bacak'], ['Sırtüstü yat, ayakları tut.', 'Dizleri koltuk altına doğru aç.', 'Hafifçe salla.'], 'Boynu kaldırmak', 'Hamileysen yapma.', '2x30s 15', '', ['child-pose', 'hip-flexor-stretch']);
x('legs-up-wall', 'Bacaklar duvarda', 'Legs up the wall', 'yoga', 1, '-', ['Bacak', 'Gevşeme'], ['Kalçanı duvara yaklaştır, uzan.', 'Bacakları duvara yasla.', 'Derin nefes al.'], 'Fazla uzun kalmak', 'Baş dönmesi olursa yavaşça çık.', '1x180s 0', '', ['child-pose', 'deep-breathing']);

// ───────── Pilates ─────────
x('pilates-hundred', 'Pilates Hundred', 'Pilates hundred', 'pil', 2, '-', ['Karın', 'Core'], ['Sırtüstü yat, bacak ve kolları uzat, omuz ve başı kaldır.', 'Kolları pompala; 5 sayıda nefes al, 5 sayıda ver.', 'Yüz sayıya kadar devam et.'], 'Boynu çekmek', `${NECK} Hamileysen yapma; boyun sorunu varsa başı yerde tut.`, '1x60s 0', 'NB', ['dead-bug', 'crunch']);
x('pilates-roll-up', 'Roll-up', 'Pilates roll-up', 'pil', 3, '-', ['Karın', 'Omurga'], ['Sırtüstü yat, kollar yukarıda.', 'Omurga omurga doğrulup öne uzan.', 'Yavaş geri in.'], 'Momentumla kalkmak', BACK, '3x6 30', 'B', ['dead-bug', 'crunch']);
x('pilates-leg-circles', 'Bacak daireleri', 'Leg circles', 'pil', 2, '-', ['Kalça', 'Core'], ['Sırtüstü yat, bir bacağı tavana kaldır.', 'Küçük daireler çiz.', 'Pelvis sabit.'], 'Pelvisin kıpırdaması', BACK, '3x8/s 30', 'BH', ['dead-bug', 'fire-hydrant']);
x('pilates-side-leg-series', 'Yan bacak serisi', 'Side leg series', 'pil', 1, '-', ['Kalça yanı', 'Core'], ['Yan yat, gövde düz.', 'Üstteki bacağı kaldır, küçük hareketler yap.', 'Pelvis sabit.'], 'Gövdenin yuvarlanması', BACK, '3x12/s 30', 'B', ['side-leg-raise', 'clamshell']);
x('pilates-swimming', 'Pilates yüzme', 'Swimming', 'pil', 2, '-', ['Sırt', 'Kalça'], ['Yüzüstü yat, kol ve bacakları hafif kaldır.', 'Karşı kol ve bacağı sırayla çırp.', 'Nefes düzenli.'], 'Boynu geriye atmak', `${BACK} ${NECK}`, '3x20s 30', 'BN', ['superman', 'bird-dog']);

// ───────── Postür ─────────
x('neck-stretch-side', 'Boyun yan germe', 'Side neck stretch', 'postN', 1, '-', ['Boyun yanı'], ['Omuzlar gevşek otur.', 'Kulağını omzuna doğru yavaşça indir.', 'Diğer tarafa geç.'], 'Omzu yukarı çekmek', `${NECK} ${STRETCH}`, '2x20s/s 10', 'N', ['chin-tuck', 'shoulder-rolls']);
x('neck-rotation', 'Boyun çevirme', 'Neck rotation', 'postN', 1, '-', ['Boyun'], ['Dik otur.', 'Başını yavaşça sağa, sola çevir.', 'Zorlamadan, ağrısız aralıkta kal.'], 'Hızlı çevirmek', NECK, '2x8/s 10', 'N', ['chin-tuck', 'shoulder-rolls']);
x('piriformis-stretch', 'Kalça arkası germe', 'Piriformis stretch', 'postH', 1, '-', ['Kalça arkası'], ['Sırtüstü yat, bir ayağı karşı dizin üstüne koy.', 'Karşı bacağı göğse doğru çek.', 'Diğer tarafa geç.'], 'Boynu kaldırmak', `${STRETCH} ${KNEE}`, '2x30s/s 10', 'K', ['hip-flexor-stretch', 'supine-twist']);
x('thoracic-rotation', 'Sırt rotasyonu', 'Thoracic rotation', 'postU', 1, '-', ['Üst sırt'], ['Dört ayak pozisyonunda bir elini başının arkasına koy.', 'Dirseği tavana doğru aç.', 'Geri dön.'], 'Beli çevirmek', BACK, '2x8/s 10', 'W', ['cat-cow', 'wall-angel']);
x('wrist-flexor-stretch', 'Bilek germe', 'Wrist flexor stretch', 'postU', 1, '-', ['Ön kol', 'Bilek'], ['Kolunu öne uzat, avuç yukarı.', 'Diğer elinle parmakları hafifçe geri çek.', 'Diğer tarafa geç.'], 'Zorlamak', 'Bilekte uyuşma olursa bırak.', '2x20s/s 10', 'W', ['wrist-circles', 'arm-circles']);
x('wrist-circles', 'Bilek çevirme', 'Wrist circles', 'postU', 1, '-', ['Bilek'], ['Kollar öne uzanık.', 'Bileği yavaş daireler çiz.', 'İki yöne de yap.'], 'Hızlı çevirmek', 'Bilekte ağrı olursa bırak.', '2x10/s 10', 'W', ['wrist-flexor-stretch', 'arm-circles']);
x('shoulder-rolls', 'Omuz çevirme', 'Shoulder rolls', 'postU', 1, '-', ['Omuz'], ['Rahat dur.', 'Omuzları yukarı, geriye, aşağı çevir.', 'Yön değiştir.'], 'Hızlı yapmak', SHOULDER, '2x10 10', 'S', ['arm-circles', 'scapular-squeeze']);
x('thread-needle', 'İğne deliği', 'Thread the needle', 'postU', 1, '-', ['Üst sırt', 'Omuz'], ['Dört ayak pozisyonu al.', 'Bir kolu karşı kolun altından kaydır.', 'Omzu yere yaklaştır.'], 'Boynu zorlamak', `${NECK} ${SHOULDER}`, '2x20s/s 10', 'SW', ['cat-cow', 'child-pose']);
x('prone-y-raise', 'Y kaldırma', 'Prone Y raise', 'postU', 2, '-', ['Üst sırt', 'Omuz'], ['Yüzüstü yat, kollar Y şeklinde.', 'Kolları hafifçe kaldır.', 'Yavaş indir.'], 'Boynu kaldırmak', `${SHOULDER} ${NECK}`, '3x10 30', 'SN', ['scapular-squeeze', 'superman']);
x('pelvic-tilt', 'Pelvik tilt', 'Pelvic tilt', 'postH', 1, '-', ['Alt karın', 'Bel'], ['Sırtüstü yat, dizler bükük.', 'Belini yere yaklaştır.', 'Yavaş bırak.'], 'Kalçayı kaldırmak', BACK, '2x12 15', 'B', ['glute-bridge', 'cat-cow']);

// ───────── Mobilite ─────────
x('worlds-greatest-stretch', 'Dünyanın en iyi germesi', "World's greatest stretch", 'mob', 2, '-', ['Kalça', 'Sırt', 'Bacak'], ['Büyük bir hamle adımı at.', 'İç taraf elini yere koy, diğer kolu tavana aç.', 'Geri gel, diğer tarafa geç.'], 'Hızlı geçmek', KNEE, '2x5/s 15', 'KH', ['hip-flexor-stretch', 'cat-cow']);
x('ankle-circles', 'Ayak bileği çevirme', 'Ankle circles', 'mob', 1, '-', ['Ayak bileği'], ['Bir ayağını yerden kaldır.', 'Bileği daireler çiz.', 'İki yöne de yap.'], 'Hızlı yapmak', 'Ayak bileğinde ağrı olursa bırak.', '2x10/s 10', 'A', ['calf-raise', 'march-in-place']);
x('leg-swings', 'Bacak sallama', 'Leg swings', 'mob', 1, '-', ['Kalça', 'Arka bacak'], ['Bir yere tutun.', 'Bacağını öne arkaya sallandır.', 'Yan yana da yap.'], 'Gövdeyi sallamak', BACK, '2x10/s 10', 'BH', ['hip-circles', 'march-in-place']);
x('inchworm', 'Tırtıl', 'Inchworm', 'mob', 2, '-', ['Arka bacak', 'Omuz', 'Core'], ['Ayakta öne eğil, ellerini yere koy.', 'Ellerini plank pozisyonuna yürüt.', 'Geri yürü.'], 'Dizleri kilitlemek', `${WRIST} ${BACK}`, '2x6 15', 'WB', ['cat-cow', 'hamstring-stretch']);
x('hip-9090', 'Kalça 90/90', '90/90 hip switch', 'mob', 2, '-', ['Kalça'], ['Oturup iki dizi 90 derece bük.', 'Dizleri yana yatır.', 'Diğer tarafa geç.'], 'Zorlamak', `${KNEE} ${STRETCH}`, '2x8 15', 'KH', ['hip-circles', 'happy-baby']);
x('band-shoulder-pass', 'Bantla omuz geçirme', 'Band shoulder pass-through', 'mob', 1, 'B', ['Omuz'], ['Bandı geniş tut.', 'Kolları önden arkaya geçir.', 'Geri getir.'], 'Çok dar tutmak', SHOULDER, '2x10 15', 'S', ['arm-circles', 'wall-angel']);

// ───────── Nefes ve gevşeme ─────────
x('box-breathing', 'Kutu nefesi', 'Box breathing', 'breath', 1, '-', ['Diyafram'], ['Rahat otur.', '4 sn nefes al, 4 sn tut, 4 sn ver, 4 sn bekle.', 'Rahatça devam et.'], 'Zorlayarak tutmak', 'Baş dönmesi olursa normal nefese dön.', '1x180s 0', '', ['deep-breathing', 'child-pose']);
x('body-scan', 'Vücut taraması', 'Body scan', 'breath', 1, '-', ['Gevşeme'], ['Uzan, gözlerini kapat.', 'Dikkatini ayaktan başa doğru gezdir.', 'Gerginlikleri fark edip bırak.'], 'Acele etmek', 'Uykuya dalma isteği normal; araç kullanırken yapma.', '1x300s 0', '', ['deep-breathing', 'legs-up-wall']);

// ───────── Günlük ─────────
x('desk-stretch', 'Masa başı germe', 'Desk stretch', 'daily', 1, 'S', ['Sırt', 'Boyun', 'Omuz'], ['Oturduğun yerde kollarını yukarı uzat.', 'Gövdeyi yana, sonra dönerek esnet.', 'Boynu hafif eğ.'], 'Ağrıya girmek', STRETCH, '1x90s 0', '', ['shoulder-rolls', 'neck-stretch-side']);
x('chair-march', 'Sandalyede yürüyüş', 'Seated march', 'daily', 1, 'S', ['Bacak', 'Karın'], ['Sağlam bir sandalyede otur.', 'Dizlerini sırayla yukarı çek.', 'Dik otur.'], 'Eğilmek', 'Sandalye sağlam ve kaymaz olmalı.', '2x30s 20', '', ['march-in-place', 'standing-break']);
x('heel-toe-walk', 'Topuk-parmak yürüyüşü', 'Heel-to-toe walk', 'daily', 1, '-', ['Denge'], ['Düz bir çizgide, bir ayağın topuğu diğerinin parmağına değerek yürü.', 'Kollarını yana aç.', 'Yavaş git.'], 'Bakışı yere sabitlemek', 'Düşme riski varsa bir duvarın yanında yap.', '2x10 20', '', ['march-in-place', 'single-leg-balance']);
x('toe-raise', 'Parmak kaldırma', 'Toe raise', 'daily', 1, '-', ['Ön kaval'], ['Duvara yaslan, ayaklar önde.', 'Ayak ucunu yukarı kaldır.', 'Yavaş indir.'], 'Hızlı yapmak', 'Ayak bileğinde ağrı olursa dur.', '2x15 20', 'A', ['calf-raise', 'ankle-circles']);

// ───────── Kardiyo ─────────
x('burpee', 'Basit burpee', 'Burpee (basic)', 'cardH', 3, '-', ['Tüm vücut'], ['Çömel, ellerini yere koy.', 'Bacakları plank pozisyonuna at.', 'Geri çek ve zıplayarak kalk.'], 'Belin çökmesi', `${HIGH} ${BACK}`, '3x8 60', 'KABWI', ['squat-jump', 'step-jacks']);
x('skater', 'Paten adımı', 'Skater hop', 'cardH', 2, '-', ['Bacak', 'Kalça'], ['Bir ayakla yana sıçra, diğer bacak arkadan geçsin.', 'Yumuşak in.', 'Yön değiştir.'], 'Sert inmek', HIGH, '3x30s 30', 'KAI', ['step-jacks', 'lateral-shuffle']);
x('jump-rope', 'İp atlama', 'Jump rope', 'cardH', 2, '-', ['Bacak', 'Kalp-dolaşım'], ['Bilekle çevir, dirsekler yanda.', 'Ayak ucunda küçük zıpla.', 'Düzenli ritim tut.'], 'Çok yüksek zıplamak', HIGH, '3x45s 30', 'KAI', ['step-jacks', 'jumping-jack']);
x('stair-climb', 'Merdiven çıkma', 'Stair climb', 'cardL', 1, '-', ['Bacak', 'Kalp-dolaşım'], ['Sabit bir tempoda çık.', 'Tüm ayağını basamağa koy.', 'İnerken korkuluğa tutun.'], 'Korkuluksuz hızlı inmek', 'Diz ağrısı varsa inerken yavaş ol.', '1x300s 0', 'K', ['brisk-walk', 'march-in-place']);
x('butt-kicks', 'Topuk vurma', 'Butt kicks', 'cardH', 1, '-', ['Arka bacak'], ['Yerinde koşarken topukları kalçaya çek.', 'Dik dur.', 'Yumuşak in.'], 'Öne eğilmek', HIGH, '3x30s 30', 'KAI', ['march-in-place', 'step-jacks']);
x('jogging-in-place', 'Yerinde koşu', 'Jogging in place', 'cardL', 1, '-', ['Bacak', 'Kalp-dolaşım'], ['Hafif tempoda yerinde koş.', 'Kolları rahat salla.', 'Yumuşak in.'], 'Çok hızlı başlamak', 'Eklem sorunun varsa yerinde yürüyüşe geç.', '3x60s 30', '', ['march-in-place', 'step-jacks']);
x('cycling', 'Bisiklet', 'Cycling', 'cardS', 1, 'G', ['Bacak', 'Kalp-dolaşım'], ['Selenin yüksekliğini ayarla.', 'Konuşabildiğin bir tempoda pedal çevir.', 'Son dakikalarda yavaşla.'], 'Selenin çok alçak olması', KNEE, '1x1200s 0', 'K', ['brisk-walk', 'march-in-place']);
x('rowing-machine', 'Kürek makinesi', 'Rowing machine', 'cardS', 2, 'M', ['Tüm vücut'], ['Ayakları sabitle, itme ile başla.', 'Sonra gövde, sonra kollar.', 'Aynı sırayla geri dön.'], 'Önce kollarla çekmek', BACK, '1x600s 0', 'B', ['brisk-walk', 'cycling']);
x('swimming', 'Yüzme', 'Swimming', 'cardS', 1, 'G', ['Tüm vücut'], ['Havuzda sakin bir tempoyla yüz.', 'Nefesini düzenli ver.', 'Yorulunca dinlen.'], 'Tek başına derin suda yüzmek', 'Cankurtaran bulunan havuzda yap; kalp ya da nefes sorunu varsa doktora danış.', '1x900s 0', '', ['brisk-walk', 'cycling']);

// ───────── Spor ve performans ─────────
x('agility-ladder', 'Çeviklik merdiveni', 'Agility ladder', 'agil', 2, 'G', ['Ayak çevikliği'], ['Her kareye hızlı kısa adımlar at.', 'Ayak ucunda kal.', 'Düzenli ritim.'], 'Kareye basmak', 'Düz ve kaymaz zeminde yap.', '3x30s 30', 'KA', ['lateral-shuffle', 'step-jacks']);
x('box-jump', 'Kutuya zıplama', 'Box jump', 'power', 3, 'G', ['Bacak', 'Kalça'], ['Sağlam bir kutuya karşı dur.', 'Kollarla sallanıp zıpla.', 'Yumuşak in, adım adım in.'], 'Kutudan zıplayarak inmek', `${HIGH} Kutunun sağlam olduğundan emin ol.`, '3x5 90', 'KAI', ['squat-jump', 'step-up']);
x('broad-jump', 'Uzun atlama', 'Broad jump', 'power', 3, '-', ['Bacak', 'Kalça'], ['Çömelip kollarla sallan.', 'İleri uzun zıpla.', 'Yumuşak in.'], 'Sert inmek', HIGH, '3x5 90', 'KAI', ['squat-jump', 'mini-squat']);
x('lateral-bound', 'Yan sıçrama', 'Lateral bound', 'power', 3, '-', ['Kalça yanı', 'Bacak'], ['Bir ayakta dur.', 'Yana sıçra, diğer ayağa in.', 'Dengeni koru.'], 'Dizi içe çökertmek', HIGH, '3x8/s 60', 'KAI', ['lateral-shuffle', 'skater']);
x('single-leg-balance', 'Tek ayak denge', 'Single-leg balance', 'spo', 1, '-', ['Denge', 'Ayak bileği'], ['Bir ayağınla dur.', 'Gözünü sabit bir noktaya ver.', 'Diğer tarafa geç.'], 'Dizi kilitlemek', 'Gerekirse duvara dokun.', '3x30s/s 20', 'A', ['tree-pose', 'heel-toe-walk']);
x('sprint-intervals', 'Kısa sprint', 'Short sprints', 'power', 3, '-', ['Bacak', 'Kalp-dolaşım'], ['İyice ısındıktan sonra 10-15 sn hızlı koş.', 'Tam dinlen.', 'Tekrarla.'], 'Isınmadan başlamak', `${HIGH} Isınmadan yapma.`, '6x15s 60', 'KABI', ['jogging-in-place', 'brisk-walk']);
x('bear-crawl', 'Ayı yürüyüşü', 'Bear crawl', 'power', 2, '-', ['Core', 'Omuz', 'Bacak'], ['Dizler yerden hafif kalkık, dört ayak pozisyonu.', 'Karşı el ve ayağı birlikte ilerlet.', 'Kalça sabit.'], 'Kalçayı yükseltmek', `${WRIST} ${SHOULDER}`, '3x20s 45', 'WS', ['bird-dog', 'plank']);

export const EXTRA_ITEMS: LibraryItem[] = ROWS.map((r) => r.item);
export const EXTRA_META: Record<string, ExtraMeta> = Object.fromEntries(ROWS.map((r) => [r.item.id, r.meta]));
export const EXTRA_EN: Record<string, string> = Object.fromEntries(ROWS.map((r) => [r.item.id, r.en]));
