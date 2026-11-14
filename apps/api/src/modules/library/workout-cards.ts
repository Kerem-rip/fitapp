// Antrenman kartları: hazır, bölümlü antrenmanlar (hazırlık → ısınma → ana → bitiş). SAF veri ve fonksiyonlar.
// Kural: ANA bölümdeki her hareket kanıt katmanında en az "kısmen doğrulandı" olmalı (testle denetlenir).
// Kaynaklı değer hareketin kendi `work`ünde (evidence.ts CONTENT); kartın kendi değeri varsa 'RULE' olarak etiketlenir.
// Her kategorinin şablonu ayrıdır: yoga/nefes kartlarında güç antrenmanı sıralaması uygulanmaz.
import { AREA_TITLES, type BodyArea } from '../personal-plan/plan-types.js';
import { PLAN_META } from '../personal-plan/plan-meta.js';
import { findItem, type Level, type Work } from './catalog.js';
import { EVIDENCE } from './evidence.js';
import { workSeconds } from './library-rules.js';

export type CardCategory = 'fitness' | 'yoga' | 'posture' | 'cardio';
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
  // Kartın hedef bölgesi (arayüzde etiket)
  region: string;
  // Hazırlık notları (ilk bölümden önce gösterilir)
  prep: string[];
  sections: CardSectionDef[];
  // Kuralın dayanağı (kaynak ya da açık kural)
  basis: string[];
}

export const CATEGORY_TITLES: Record<CardCategory, string> = { fitness: 'Fitness ve Güç', yoga: 'Yoga ve Nefes', posture: 'Postür ve Duruş', cardio: 'Kardiyo' };
export const SECTION_TITLES: Record<CardCategory, Record<SectionKind, string>> = {
  fitness: { PREP: 'Hazırlık', WARMUP: 'Isınma', MAIN: 'Ana hareketler', FINISH: 'Bitiş' },
  yoga: { PREP: 'Hazırlık', WARMUP: 'Isınma akışı', MAIN: 'Ana duruşlar', FINISH: 'Gevşeme' },
  posture: { PREP: 'Farkındalık', WARMUP: 'Hazırlık hareketi', MAIN: 'Ana hareketler', FINISH: 'Gün içi hatırlatma' },
  cardio: { PREP: 'Hazırlık', WARMUP: 'Isınma', MAIN: 'Kardiyo bloğu', FINISH: 'Soğuma' },
};

// Açık kurallar (kaynakta olmayan varsayılanlar bu listede ve kartın "basis" alanında belirtilir)
export const RULES = {
  R1: 'Başlangıç kartlarında ana hareket başına 2-3 set (uygulama varsayılanı; kaynaklarda kesin set sayısı yoktur).',
  R2: 'Set arası dinlenme 30-60 sn, hareketler arası 30-45 sn (uygulama varsayılanı; kaynak doğrulanmadı).',
  R3: 'Sıra: önce hazırlık/ısınma, sonra çok eklemli hareketler, en son tek eklemli/hafif hareketler ve bitiş (genel antrenman düzeni; kategoriye göre şablon değişir).',
  R4: 'Kısıt seçilen bölgeyi yükleyen hareket, aynı hedefli alternatifle değiştirilir; uygun alternatif yoksa çıkarılır.',
} as const;

const NOTE_NHS = 'NHS: haftada en az 2 kez, yavaş yavaş tekrarı artır.';
const STD_PREP = ['Isınmadan başlama, ağrıyla zorlama.', 'Bir sağlık sorunun ya da sakatlığın varsa başlamadan önce bir uzmana danış.'];

const it = (itemId: string, restAfterSec = 30, work?: Work): CardItemDef => ({ itemId, restAfterSec, ...(work ? { work } : {}) });

export const CARDS: WorkoutCardDef[] = [
  {
    id: 'chair-start',
    title: 'Sandalyeli başlangıç',
    summary: 'Ekipmansız, sandalye ve duvarla yapılan hafif bir tüm vücut antrenmanı.',
    category: 'fitness', setting: 'home', level: 'beginner', equipment: ['Sandalye'], region: 'Tüm vücut',
    prep: [...STD_PREP, 'Tekerleksiz, kolçaksız, kaymayan bir sandalye kullan.'],
    sections: [
      { kind: 'WARMUP', title: 'Isınma', items: [it('arm-circles', 15), it('hip-circles', 15)] },
      { kind: 'MAIN', title: 'Ana hareketler', items: [it('sit-to-stand', 45), it('mini-squat', 45), it('calf-raise', 45), it('wall-push-up', 45)] },
      { kind: 'FINISH', title: 'Bitiş', items: [it('deep-breathing', 0, { sets: 1, seconds: 60, restSec: 0 })] },
    ],
    basis: ['Hareket seçimi ve 5 tekrar başlangıcı: NHS strength exercises.', NOTE_NHS, RULES.R1, RULES.R2],
  },
  {
    id: 'core-hip-start',
    title: 'Core ve kalça: başlangıç',
    summary: 'Zeminde, ekipmansız; kalça ve karın bölgesi için sakin tempolu bir antrenman.',
    category: 'fitness', setting: 'home', level: 'beginner', equipment: [], region: 'Kalça ve core',
    prep: STD_PREP,
    sections: [
      { kind: 'WARMUP', title: 'Isınma', items: [it('cat-cow', 15, { sets: 1, seconds: 45, restSec: 0 })] },
      { kind: 'MAIN', title: 'Ana hareketler', items: [it('glute-bridge', 45), it('bird-dog', 45)] },
      { kind: 'FINISH', title: 'Bitiş', items: [it('child-pose', 0, { sets: 1, seconds: 45, restSec: 0 })] },
    ],
    basis: ['Köprü: ACE glute bridge. Kuş-köpek: Harvard Health (10 tekrar).', RULES.R1, RULES.R2],
  },
  {
    id: 'home-lower-mid',
    title: 'Evde alt vücut ve itme',
    summary: 'Ekipmansız, orta seviye; bacak, kalça ve göğüs için.',
    category: 'fitness', setting: 'home', level: 'intermediate', equipment: [], region: 'Alt vücut ve göğüs',
    prep: STD_PREP,
    sections: [
      { kind: 'WARMUP', title: 'Isınma', items: [it('hip-circles', 15), it('arm-circles', 15)] },
      { kind: 'MAIN', title: 'Ana hareketler', items: [it('squat', 45), it('single-leg-glute-bridge', 45), it('knee-push-up', 45), it('bird-dog', 45)] },
      { kind: 'FINISH', title: 'Bitiş', items: [it('hamstring-stretch', 0, { sets: 1, seconds: 30, restSec: 0, perSide: true })] },
    ],
    basis: ['Hareket ilişkileri (squat, tek bacaklı köprü, dizli şınav) kanıt katmanından.', RULES.R1, RULES.R2, RULES.R3],
  },
  {
    id: 'dumbbell-lower',
    title: 'Dambıllı alt vücut',
    summary: 'Tek dambılla bacak ve kalça antrenmanı.',
    category: 'fitness', setting: 'gym', level: 'intermediate', equipment: ['Dambıl'], region: 'Bacak ve kalça',
    prep: STD_PREP,
    sections: [
      { kind: 'WARMUP', title: 'Isınma', items: [it('hip-circles', 15), it('march-in-place', 20, { sets: 1, seconds: 60, restSec: 0 })] },
      { kind: 'MAIN', title: 'Ana hareketler', items: [it('goblet-squat', 60), it('single-leg-glute-bridge', 45), it('calf-raise', 45)] },
      { kind: 'FINISH', title: 'Bitiş', items: [it('quad-stretch', 0, { sets: 1, seconds: 30, restSec: 0, perSide: true })] },
    ],
    basis: ['Goblet squat: ACE ve NASM.', RULES.R1, RULES.R2, RULES.R3],
  },
  {
    id: 'posture-short',
    title: 'Duruş molası',
    summary: 'Masa başında yapılabilecek kısa mola; boyun ve nefes.',
    category: 'posture', setting: 'home', level: 'beginner', equipment: [], region: 'Boyun ve omuz',
    prep: ['Duruşu düzeltmek zamanla olur; bunlar kısa hatırlatma hareketleridir.', 'Ağrı sürerse ya da hareketler yardım etmezse doktor veya fizyoterapiste başvur.'],
    sections: [
      { kind: 'WARMUP', title: 'Hazırlık hareketi', items: [it('arm-circles', 10, { sets: 1, seconds: 30, restSec: 0 })] },
      { kind: 'MAIN', title: 'Ana hareketler', items: [it('chin-tuck', 15, { sets: 3, reps: 10, restSec: 15 }), it('deep-breathing', 0, { sets: 1, seconds: 120, restSec: 0 })] },
      { kind: 'FINISH', title: 'Gün içi hatırlatma', items: [] },
    ],
    basis: ['Çene geri çekme: Cleveland Clinic (klinisyen görüşü; çalışma atfı yok). Tekrar/set sayısı kaynakta net değil; açık kural olarak 3×10.', 'Diyafram nefesi: Cleveland Clinic, Johns Hopkins.', RULES.R2],
  },
  {
    id: 'yoga-calm',
    title: 'Sakin yoga akışı',
    summary: 'Yavaş tempo, nefes odaklı başlangıç akışı.',
    category: 'yoga', setting: 'home', level: 'beginner', equipment: ['Mat'], region: 'Sırt, omuz ve arka bacak',
    prep: ['Yüksek tansiyon, glokom, kalp sorunu ya da baş dönmesi öykün varsa aşağı bakan köpeği atla ve uzmana danış.', 'Gerginlik hissettiğin yerde bırak.'],
    sections: [
      { kind: 'PREP', title: 'Hazırlık', items: [it('deep-breathing', 10, { sets: 1, seconds: 60, restSec: 0 })] },
      { kind: 'WARMUP', title: 'Isınma akışı', items: [it('cat-cow', 10, { sets: 1, seconds: 60, restSec: 0 })] },
      { kind: 'MAIN', title: 'Ana duruşlar', items: [it('downward-dog', 15)] },
      { kind: 'FINISH', title: 'Gevşeme', items: [it('child-pose', 10, { sets: 1, seconds: 60, restSec: 0 }), it('deep-breathing', 0, { sets: 1, seconds: 120, restSec: 0 })] },
    ],
    basis: ['Aşağı bakan köpek: Cleveland Clinic (10-15 sn).', 'Nefes: Cleveland Clinic, Johns Hopkins.', 'Yoga kartı güç antrenmanı sırasına uymaz: nefes → akış → duruş → gevşeme.'],
  },
  {
    id: 'cardio-agility',
    title: 'Kısa kardiyo ve çeviklik',
    summary: 'Yüksek etkili, kısa aralıklı; eklem sorunun varsa uygun değil.',
    category: 'cardio', setting: 'home', level: 'intermediate', equipment: [], region: 'Tüm vücut',
    prep: [...STD_PREP, 'Yüksek etkili harekettir: diz, ayak bileği ya da bel sorunun varsa kısıt seç ya da bu kartı yapma.', 'Kaygan olmayan zeminde yap.'],
    sections: [
      { kind: 'WARMUP', title: 'Isınma', items: [it('march-in-place', 20, { sets: 1, seconds: 90, restSec: 0 })] },
      { kind: 'MAIN', title: 'Kardiyo bloğu', items: [it('lateral-shuffle', 45), it('squat-jump', 60)] },
      { kind: 'FINISH', title: 'Soğuma', items: [it('deep-breathing', 0, { sets: 1, seconds: 90, restSec: 0 })] },
    ],
    basis: ['Yana kayma: ACE lateral shuffles. Zıpla-squat: ACE squat jump (iniş tekniği ön koşul).', RULES.R1, RULES.R2],
  },
];

export const findCard = (id: string) => CARDS.find((c) => c.id === id);

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
  // Kısıt nedeniyle değiştirildiyse özgün hareket
  replacedFrom?: { id: string; title: string };
}

export function resolveCard(card: WorkoutCardDef, avoid: BodyArea[], workText: (w: Work) => string) {
  const used = new Set(card.sections.flatMap((s) => s.items.map((i) => i.itemId)));
  const swapped: { from: string; fromTitle: string; to: string | null; toTitle: string | null; area: string }[] = [];
  const sections = card.sections.map((s) => {
    const items: ResolvedCardItem[] = [];
    for (const def of s.items) {
      let id = def.itemId;
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
      const work = (id === def.itemId ? def.work : undefined) ?? item.work!;
      items.push({
        itemId: id,
        title: item.title,
        workText: workText(work),
        work,
        durationSec: workSeconds(work),
        restAfterSec: def.restAfterSec,
        verification: EVIDENCE[id]?.verification ?? 'none',
        ...(replacedFrom ? { replacedFrom } : {}),
      });
    }
    return { kind: s.kind, title: SECTION_TITLES[card.category][s.kind] ?? s.title, items };
  }).filter((s) => s.items.length > 0);
  const flat = sections.flatMap((s) => s.items);
  const durationSec = flat.reduce((sum, i) => sum + i.durationSec + i.restAfterSec, 0);
  return { sections, swapped, moveCount: flat.length, estimatedMinutes: Math.max(1, Math.round(durationSec / 60)), durationSec };
}
