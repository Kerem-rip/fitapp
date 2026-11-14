// 1. hafta üretimi: antrenman günleri, ısınma → ana çalışma → soğuma ve toparlanma günleri.
// Hareket seçimi: ortam, ekipman, seviye, ağrı bölgeleri ve etki düzeyi süzgecinden geçen hareketler arasından;
// kalıp (itiş, çekiş, çömelme...) çeşitliliği ve önceki dönemden farklılık gözetilerek.
import { PLAN_META } from '../plan-meta.js';
import { planItems } from '../plan-meta.js';
import type { Pattern, PlanCategory } from '../plan-types.js';
import { workSeconds } from '../../library/library-rules.js';
import { dayEstimates, FOCUS_TITLES, focusSequence, isEligible, itemOf, prescribe, rng, TRAINING_OFFSETS, workOf, type DaySpec, type EntrySpec, type Focus, type PlanParams } from './base.js';

const PATTERN_TITLES: Record<Pattern, string> = {
  SQUAT: 'çömelme',
  HINGE: 'kalça menteşesi',
  LUNGE: 'tek bacak',
  PUSH: 'itiş',
  PULL: 'çekiş',
  CORE: 'karın ve gövde',
  CARDIO: 'kardiyo',
  MOBILITY: 'esneklik ve duruş',
  BREATH: 'nefes',
};

// Her odak için ana çalışma kalıpları (öncelik sırasıyla)
const SLOTS: Record<Focus, Pattern[]> = {
  // İlk 5 kalıp çekirdek antrenmandır; sonrakiler süre bütçesi izin verirse eklenir
  FULL_A: ['SQUAT', 'PUSH', 'HINGE', 'PULL', 'CORE', 'LUNGE', 'PULL', 'CORE'],
  FULL_B: ['LUNGE', 'PULL', 'PUSH', 'HINGE', 'CORE', 'SQUAT', 'PUSH', 'CORE'],
  FULL_C: ['SQUAT', 'PULL', 'PUSH', 'LUNGE', 'CORE', 'HINGE', 'PUSH', 'CORE'],
  UPPER: ['PUSH', 'PULL', 'PUSH', 'PULL', 'CORE', 'PUSH', 'CORE'],
  LOWER: ['SQUAT', 'HINGE', 'LUNGE', 'HINGE', 'CORE', 'SQUAT', 'CORE'],
  CARDIO: ['CARDIO', 'CARDIO', 'CARDIO', 'CORE', 'CARDIO', 'CARDIO'],
  MOBILITY: ['MOBILITY', 'MOBILITY', 'CORE', 'MOBILITY', 'MOBILITY', 'MOBILITY'],
};

// Soğumada tercih edilen esnemeler (odağa göre)
const COOLDOWN_PREF: Record<Focus, string[]> = {
  FULL_A: ['hamstring-stretch', 'doorway-stretch', 'child-pose'],
  FULL_B: ['quad-stretch', 'hip-flexor-stretch', 'chin-tuck'],
  FULL_C: ['hamstring-stretch', 'hip-flexor-stretch', 'doorway-stretch'],
  UPPER: ['doorway-stretch', 'chin-tuck', 'child-pose'],
  LOWER: ['hamstring-stretch', 'quad-stretch', 'hip-flexor-stretch'],
  CARDIO: ['quad-stretch', 'hamstring-stretch', 'child-pose'],
  MOBILITY: ['child-pose', 'cat-cow', 'hip-flexor-stretch'],
};
const WARMUP_PREF: Record<Focus, string[]> = {
  FULL_A: ['march-in-place', 'cat-cow', 'hip-circles'],
  FULL_B: ['march-in-place', 'hip-circles', 'arm-circles'],
  FULL_C: ['step-jacks', 'cat-cow', 'arm-circles'],
  UPPER: ['march-in-place', 'arm-circles', 'wall-angel'],
  LOWER: ['march-in-place', 'hip-circles', 'cat-cow'],
  CARDIO: ['march-in-place', 'arm-circles', 'hip-circles'],
  MOBILITY: ['march-in-place', 'arm-circles', 'cat-cow'],
};

const PREFERRED_CATEGORY: Record<string, PlanCategory[]> = {
  LOSE_FAT: ['CARDIO_FAT_BURN', 'STRENGTH'],
  ENDURANCE: ['CARDIO_FAT_BURN'],
  SPORT_PERFORMANCE: ['SPORT_PERFORMANCE', 'STRENGTH'],
  MOBILITY_POSTURE: ['POSTURE', 'YOGA_PILATES'],
  BUILD_MUSCLE: ['STRENGTH'],
  GENERAL_HEALTH: ['STRENGTH', 'CARDIO_FAT_BURN', 'YOGA_PILATES'],
};

const WARMUP_COOLDOWN_MIN = 8;

function pickMain(p: PlanParams, pattern: Pattern, taken: Set<string>, usedThisWeek: Set<string>, rnd: () => number): string | null {
  const preferred = PREFERRED_CATEGORY[p.intake.goal] ?? [];
  let best: { id: string; score: number } | null = null;
  for (const item of planItems()) {
    const meta = PLAN_META[item.id]!;
    if (meta.pattern !== pattern || !meta.roles.includes('MAIN') || taken.has(item.id) || !isEligible(item.id, p)) continue;
    // Seviyeye yakın hareket tercih edilir; hedefe uygun kategori, çeşitlilik ve önceki dönemden farklılık puan verir
    let score = meta.level === p.level ? 1 : meta.level === p.level - 1 ? 0.6 : 0.3;
    if (meta.categories.some((c) => preferred.includes(c.category))) score += 0.5;
    if (p.avoid.includes(item.id)) score -= 0.8;
    if (usedThisWeek.has(item.id)) score -= 0.6;
    score += rnd() * 0.5;
    if (!best || score > best.score) best = { id: item.id, score };
  }
  return best?.id ?? null;
}

function pickRole(p: PlanParams, role: 'WARMUP' | 'COOLDOWN', preferred: string[], taken: Set<string>, rnd: () => number): string | null {
  const pool = preferred.filter((id) => !taken.has(id) && PLAN_META[id]?.roles.includes(role) && isEligible(id, p));
  if (pool.length) return pool[Math.floor(rnd() * Math.min(2, pool.length))]!;
  const any = planItems().filter((i) => !taken.has(i.id) && PLAN_META[i.id]!.roles.includes(role) && isEligible(i.id, p));
  return any.length ? any[Math.floor(rnd() * any.length)]!.id : null;
}

export function buildSession(p: PlanParams, focus: Focus, usedThisWeek: Set<string>, rnd: () => number): EntrySpec[] {
  const entries: Omit<EntrySpec, 'index'>[] = [];
  const taken = new Set<string>();

  // Isınma: hafif kardiyo + odağa uygun hareketlilik
  const warmups: string[] = [];
  for (const pref of [WARMUP_PREF[focus].slice(0, 1), WARMUP_PREF[focus].slice(1)]) {
    const id = pickRole(p, 'WARMUP', pref, taken, rnd);
    if (id) {
      warmups.push(id);
      taken.add(id);
    }
  }
  for (const id of warmups) entries.push({ section: 'WARMUP', itemId: id, ...prescribe(id, p, 'WARMUP'), rationale: 'Isınma: kasları ve eklemleri antrenmana hazırlar.' });

  // Ana çalışma: süre bütçesine sığdığı kadar hareket
  const budgetSec = Math.max(5, p.intake.minutesPerSession - WARMUP_COOLDOWN_MIN) * 60;
  let used = 0;
  let mains = 0;
  for (const pattern of SLOTS[focus]) {
    const id = pickMain(p, pattern, taken, usedThisWeek, rnd);
    if (!id) continue;
    const rx = prescribe(id, p, 'MAIN');
    const sec = workSeconds(workOf(rx)) + 20;
    // En az 3 ana hareket; sonrası süre bütçesine bağlı
    if (mains >= 3 && used + sec > budgetSec) continue;
    taken.add(id);
    usedThisWeek.add(id);
    used += sec;
    mains += 1;
    const meta = PLAN_META[id]!;
    const levelNote = meta.level < p.level ? 'bir alt basamak' : 'senin basamağında';
    entries.push({ section: 'MAIN', itemId: id, ...rx, rationale: `${PATTERN_TITLES[pattern][0]!.toLocaleUpperCase('tr')}${PATTERN_TITLES[pattern].slice(1)} kalıbı: hedefine, ortamına ve seviyene uygun (${levelNote}).` });
  }

  // Soğuma: odağa uygun 2 esneme + nefes (+ istenirse yüz bakımı)
  const cools: string[] = [];
  for (const pref of [COOLDOWN_PREF[focus].slice(0, 2), COOLDOWN_PREF[focus].slice(1), ['deep-breathing']]) {
    const id = pickRole(p, 'COOLDOWN', pref, taken, rnd);
    if (id) {
      cools.push(id);
      taken.add(id);
    }
  }
  for (const id of cools) entries.push({ section: 'COOLDOWN', itemId: id, ...prescribe(id, p, 'COOLDOWN'), rationale: 'Soğuma: çalışan bölgeleri gevşetir, toparlanmayı destekler.' });
  if (p.intake.extras.includes('FACE_CARE')) {
    const face = ['face-temple', 'face-brow', 'face-cheek'].find((id) => !taken.has(id) && isEligible(id, p));
    if (face) entries.push({ section: 'COOLDOWN', itemId: face, ...prescribe(face, p, 'COOLDOWN'), rationale: 'İstediğin ek: yüz bakımı.' });
  }
  return entries.map((e, index) => ({ ...e, index }));
}

// Toparlanma günü: hafif, isteğe bağlı günlük hareket (programın tamamlanma sayısına katılmaz)
export function restEntries(p: PlanParams): EntrySpec[] {
  const id = ['standing-break', 'march-in-place'].find((x) => isEligible(x, p));
  return id ? [{ index: 0, section: 'RECOVERY', itemId: id, ...prescribe(id, p, 'COOLDOWN'), optional: true, rationale: 'Toparlanma günü: isteğe bağlı hafif hareket.' }] : [];
}

// 7 günlük bir hafta (dayNumber: (hafta-1)*7 + 1..7)
export function generateWeek1(p: PlanParams): DaySpec[] {
  const rnd = rng(`${p.seed}:w1`);
  const offsets = TRAINING_OFFSETS[Math.min(6, Math.max(2, p.intake.daysPerWeek))]!;
  const sequence = focusSequence(p.intake.goal, offsets.length);
  const usedThisWeek = new Set<string>();
  const days: DaySpec[] = [];
  for (let d = 1; d <= 7; d++) {
    const at = offsets.indexOf(d);
    if (at === -1) {
      const entries = restEntries(p);
      days.push({ dayNumber: d, weekNumber: 1, kind: 'REST', focus: null, title: 'Toparlanma günü', entries, ...dayEstimates(entries, p.intake.weightKg) });
      continue;
    }
    const focus = sequence[at]!;
    const entries = buildSession(p, focus, usedThisWeek, rnd);
    days.push({ dayNumber: d, weekNumber: 1, kind: 'TRAINING', focus, title: FOCUS_TITLES[focus], entries, ...dayEstimates(entries, p.intake.weightKg) });
  }
  return days;
}

export { itemOf };
