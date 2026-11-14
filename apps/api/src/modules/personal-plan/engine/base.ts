// Program motoru temel parçaları: deterministik rastgelelik, haftalık takvim, uygunluk süzgeci, set/tekrar belirleme.
// Her karar açıklanabilir ve testlidir; dışarıya (yapay zekâ vb.) hiçbir çağrı yapılmaz.
import { findItem, type LibraryItem, type Work } from '../../library/catalog.js';
import { workSeconds } from '../../library/library-rules.js';
import { entryKcal } from '../energy.js';
import { availableEquipment, type PlanGoal, type PlanIntake, type ScreeningResult } from '../intake.js';
import { PLAN_META, type PlanMeta } from '../plan-meta.js';
import type { BodyArea, Role, Section } from '../plan-types.js';

// ───── Deterministik rastgelelik (aynı girdi → aynı program; test edilebilir) ─────
export function hashSeed(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
export function rng(seed: string): () => number {
  let a = hashSeed(seed);
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ───── Haftalık takvim ─────
// Haftanın kaçıncı günleri antrenman (1-7). Aralar toparlanma içindir; kaçırılan antrenman sonraki güne yığılmaz.
export const TRAINING_OFFSETS: Record<number, number[]> = { 2: [1, 4], 3: [1, 3, 5], 4: [1, 2, 4, 6], 5: [1, 2, 4, 5, 7], 6: [1, 2, 3, 5, 6, 7] };

export type Focus = 'FULL_A' | 'FULL_B' | 'FULL_C' | 'UPPER' | 'LOWER' | 'CARDIO' | 'MOBILITY';
export const FOCUS_TITLES: Record<Focus, string> = {
  FULL_A: 'Tüm vücut A',
  FULL_B: 'Tüm vücut B',
  FULL_C: 'Tüm vücut C',
  UPPER: 'Üst vücut',
  LOWER: 'Alt vücut',
  CARDIO: 'Kardiyo',
  MOBILITY: 'Esneme ve duruş',
};

// Hedefe göre antrenman günlerinin odak sırası
export function focusSequence(goal: PlanGoal, days: number): Focus[] {
  const table: Record<PlanGoal, Focus[][]> = {
    BUILD_MUSCLE: [['FULL_A', 'FULL_B'], ['FULL_A', 'FULL_B', 'FULL_C'], ['UPPER', 'LOWER', 'UPPER', 'LOWER'], ['UPPER', 'LOWER', 'FULL_A', 'UPPER', 'LOWER'], ['UPPER', 'LOWER', 'FULL_A', 'UPPER', 'LOWER', 'FULL_B']],
    LOSE_FAT: [['FULL_A', 'CARDIO'], ['FULL_A', 'CARDIO', 'FULL_B'], ['UPPER', 'CARDIO', 'LOWER', 'CARDIO'], ['FULL_A', 'CARDIO', 'FULL_B', 'CARDIO', 'FULL_C'], ['UPPER', 'LOWER', 'CARDIO', 'UPPER', 'LOWER', 'CARDIO']],
    ENDURANCE: [['CARDIO', 'FULL_A'], ['CARDIO', 'FULL_A', 'CARDIO'], ['CARDIO', 'FULL_A', 'CARDIO', 'FULL_B'], ['CARDIO', 'FULL_A', 'CARDIO', 'FULL_B', 'CARDIO'], ['CARDIO', 'UPPER', 'CARDIO', 'LOWER', 'CARDIO', 'MOBILITY']],
    MOBILITY_POSTURE: [['MOBILITY', 'FULL_A'], ['MOBILITY', 'FULL_A', 'MOBILITY'], ['MOBILITY', 'FULL_A', 'MOBILITY', 'FULL_B'], ['MOBILITY', 'FULL_A', 'MOBILITY', 'FULL_B', 'MOBILITY'], ['MOBILITY', 'FULL_A', 'MOBILITY', 'FULL_B', 'MOBILITY', 'CARDIO']],
    GENERAL_HEALTH: [['FULL_A', 'CARDIO'], ['FULL_A', 'CARDIO', 'FULL_B'], ['FULL_A', 'CARDIO', 'FULL_B', 'MOBILITY'], ['FULL_A', 'CARDIO', 'FULL_B', 'MOBILITY', 'CARDIO'], ['FULL_A', 'CARDIO', 'FULL_B', 'MOBILITY', 'CARDIO', 'FULL_C']],
    SPORT_PERFORMANCE: [['FULL_A', 'CARDIO'], ['FULL_A', 'CARDIO', 'FULL_B'], ['UPPER', 'CARDIO', 'LOWER', 'CARDIO'], ['FULL_A', 'CARDIO', 'FULL_B', 'CARDIO', 'FULL_C'], ['UPPER', 'LOWER', 'CARDIO', 'UPPER', 'LOWER', 'CARDIO']],
  };
  return table[goal][Math.min(6, Math.max(2, days)) - 2]!;
}

// ───── Parametreler ve çıktı biçimleri ─────
export interface PlanParams {
  intake: PlanIntake;
  ageYears: number;
  screening: ScreeningResult;
  // En fazla hangi zorluk basamağındaki hareketler seçilir
  level: 1 | 2 | 3;
  // Aynı girdiyle aynı program üretilsin diye (kullanıcı + dönem sırası)
  seed: string;
  // Önceki dönemde kullanılan hareketler (yeni programda çeşitlilik için geri plana itilir)
  avoid: string[];
  // Ağrı bildirimleriyle genişleyen kısıt bölgeleri
  restrictedAreas: BodyArea[];
  // Ağrı tekrarında hafifletilmiş mod
  needsProfessional: boolean;
}

export interface EntrySpec {
  index: number;
  section: Section;
  itemId: string;
  sets: number;
  reps?: number;
  seconds?: number;
  perSide?: boolean;
  restSec: number;
  // Antrenman dışı isteğe bağlı görev (toparlanma günü hareketi)
  optional?: boolean;
  // Bu hareket neden seçildi / neden değişti (uzman incelemesi için)
  rationale: string;
  // Anlık uyarlama ile değiştirildiyse ilk hareket
  originalItemId?: string;
}

export interface DaySpec {
  dayNumber: number;
  weekNumber: number;
  kind: 'TRAINING' | 'REST';
  focus: Focus | null;
  title: string;
  entries: EntrySpec[];
  estimatedMinutes: number;
  estimatedKcal: number;
}

export const itemOf = (id: string): LibraryItem => {
  const item = findItem(id);
  if (!item?.work) throw new Error(`Programda tanımsız hareket: ${id}`);
  return item;
};

// ───── Uygunluk ─────
export function isEligible(id: string, p: PlanParams, maxLevel: number = p.level): boolean {
  const meta = PLAN_META[id];
  if (!meta || !findItem(id)?.work) return false;
  if (!meta.settings.includes(p.intake.setting)) return false;
  const have = availableEquipment(p.intake.setting, p.intake.equipment);
  if (!meta.equipment.every((e) => have.has(e))) return false;
  if (meta.level > maxLevel) return false;
  if (meta.stress.some((a) => p.restrictedAreas.includes(a))) return false;
  if (meta.highImpact && p.screening.lowImpactOnly) return false;
  return true;
}

// Bir hareket için kullanılabilir alternatifler (anlık uyarlama): aynı kalıp, kısıtlara uygun, bugün kullanılmamış
export function alternativesFor(id: string, p: PlanParams, taken: ReadonlySet<string> = new Set(), maxLevel: number = p.level): string[] {
  const meta = PLAN_META[id];
  if (!meta) return [];
  return meta.alternatives.filter((alt) => alt !== id && !taken.has(alt) && isEligible(alt, p, maxLevel));
}

// Hareketin yerine konacak seçenek: önce tanımlı alternatifler, yoksa aynı kalıptan uygun bir ana hareket
export function replacementFor(id: string, p: PlanParams, taken: ReadonlySet<string>, maxLevel: number = p.level): string | null {
  const alt = alternativesFor(id, p, taken, maxLevel)[0];
  if (alt) return alt;
  const meta = PLAN_META[id];
  if (!meta) return null;
  const pool = Object.keys(PLAN_META).filter((x) => x !== id && !taken.has(x) && PLAN_META[x]!.pattern === meta.pattern && PLAN_META[x]!.roles.some((r) => meta.roles.includes(r)) && isEligible(x, p, maxLevel));
  pool.sort((a, b) => Math.abs(PLAN_META[a]!.level - meta.level) - Math.abs(PLAN_META[b]!.level - meta.level) || a.localeCompare(b));
  return pool[0] ?? null;
}

// ───── Set / tekrar / süre / dinlenme ─────
const LEVEL_SCALE = { 1: 0.8, 2: 1, 3: 1.1 } as const;

export function prescribe(id: string, p: PlanParams, role: Role): Pick<EntrySpec, 'sets' | 'reps' | 'seconds' | 'perSide' | 'restSec'> {
  const w: Work = itemOf(id).work!;
  const vf = p.screening.volumeFactor * (p.needsProfessional ? 0.7 : 1);
  if (role !== 'MAIN') {
    // Isınma ve soğuma kısa tutulur; hacim çarpanı sadece süreye uygulanır
    return { sets: Math.min(w.sets, 2), ...(w.reps !== undefined ? { reps: Math.max(6, Math.round(w.reps * vf)) } : {}), ...(w.seconds !== undefined ? { seconds: Math.max(15, Math.round((w.seconds * vf) / 5) * 5) } : {}), ...(w.perSide ? { perSide: true } : {}), restSec: w.restSec };
  }
  const goalReps = p.intake.goal === 'LOSE_FAT' || p.intake.goal === 'ENDURANCE' ? 1.15 : 1;
  const lv = LEVEL_SCALE[p.level];
  const sets = p.level === 1 && w.sets > 2 ? w.sets - 1 : w.sets;
  const restFloor = p.intake.goal === 'BUILD_MUSCLE' && w.reps !== undefined ? 60 : 0;
  return {
    sets,
    ...(w.reps !== undefined ? { reps: Math.max(6, Math.round(w.reps * lv * goalReps * vf)) } : {}),
    ...(w.seconds !== undefined ? { seconds: Math.max(15, Math.round((w.seconds * lv * vf) / 5) * 5) } : {}),
    ...(w.perSide ? { perSide: true } : {}),
    restSec: Math.max(w.restSec, restFloor),
  };
}

export const workOf = (e: Pick<EntrySpec, 'sets' | 'reps' | 'seconds' | 'perSide' | 'restSec'>): Work => ({ sets: e.sets, reps: e.reps, seconds: e.seconds, perSide: e.perSide, restSec: e.restSec });

// Günün tahmini süresi (dakika) ve enerji harcaması. Enerji TAHMİNDİR.
export function dayEstimates(entries: EntrySpec[], weightKg: number): { estimatedMinutes: number; estimatedKcal: number } {
  let seconds = 0;
  let kcal = 0;
  for (const e of entries) {
    if (e.optional) continue;
    const w = workOf(e);
    seconds += workSeconds(w) + 20;
    kcal += entryKcal(w, PLAN_META[e.itemId]?.met ?? 3, weightKg);
  }
  return { estimatedMinutes: Math.round(seconds / 60), estimatedKcal: Math.round(kcal / 5) * 5 };
}

export const metaOf = (id: string): PlanMeta | undefined => PLAN_META[id];
