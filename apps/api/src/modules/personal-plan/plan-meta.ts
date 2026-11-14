// Hareketlerin program motoru için meta verisi. Hareketin kendisi (adım, uyarı, set/tekrar) library/catalog.ts içinde durur;
// burada kategori, ortam, ekipman, hareket kalıbı, yüklendiği bölgeler, zorluk basamağı ve alternatifler tutulur.
// Aynı hareket tek kayıttır; birden çok kategoriye ve programa ilişkilendirilir (çoğaltılmaz).
// İçerik TASLAKTIR: antrenör incelemesine açık; hareket kütüphanesi genişledikçe buraya satır eklenir.
import { ITEMS } from '../library/catalog.js';
import type { BodyArea, Equipment, Pattern, PlanCategory, Role, Setting } from './plan-types.js';

export interface PlanMeta {
  categories: { category: PlanCategory; subcategory: string }[];
  // Hareketin yapılabildiği ortamlar
  settings: Setting[];
  // Gerekli ekipman (boş = ekipmansız)
  equipment: Equipment[];
  pattern: Pattern;
  roles: Role[];
  // Zorluk basamağı: 1 başlangıç, 2 orta, 3 ileri
  level: 1 | 2 | 3;
  // Yüklendiği bölgeler: ağrı/sakatlık bildirilen bölgelerdeki hareketler elenir
  stress: BodyArea[];
  highImpact?: boolean;
  // Anlık uyarlama için uygun alternatifler (aynı kalıp, güvenli seçenek)
  alternatives: string[];
  // Haftalık uyarlamada bir üst / bir alt basamak
  progressTo?: string;
  regressTo?: string;
  // Tahmini enerji harcaması için MET değeri
  met: number;
}

const ALL: Setting[] = ['HOME_NONE', 'HOME_EQUIP', 'GYM'];
const HOME: Setting[] = ['HOME_NONE', 'HOME_EQUIP', 'GYM'];
const EQUIPPED: Setting[] = ['HOME_EQUIP', 'GYM'];
const GYM: Setting[] = ['GYM'];

const cat = (category: PlanCategory, subcategory: string) => [{ category, subcategory }];

export const PLAN_META: Record<string, PlanMeta> = {
  // ── Fitness ve Güç ──
  squat: { categories: cat('STRENGTH', 'lower_body'), settings: HOME, equipment: [], pattern: 'SQUAT', roles: ['MAIN'], level: 1, stress: ['KNEE'], alternatives: ['glute-bridge', 'step-up'], progressTo: 'goblet-squat', met: 5 },
  'goblet-squat': { categories: cat('STRENGTH', 'lower_body'), settings: EQUIPPED, equipment: ['DUMBBELL'], pattern: 'SQUAT', roles: ['MAIN'], level: 2, stress: ['KNEE', 'LOW_BACK'], alternatives: ['squat', 'step-up'], regressTo: 'squat', met: 5 },
  lunge: { categories: cat('STRENGTH', 'lower_body'), settings: HOME, equipment: [], pattern: 'LUNGE', roles: ['MAIN'], level: 2, stress: ['KNEE', 'ANKLE'], alternatives: ['step-up', 'glute-bridge'], regressTo: 'step-up', met: 5 },
  'step-up': { categories: cat('STRENGTH', 'lower_body'), settings: HOME, equipment: ['STEP'], pattern: 'LUNGE', roles: ['MAIN'], level: 1, stress: ['KNEE'], alternatives: ['glute-bridge', 'calf-raise'], progressTo: 'lunge', met: 5 },
  'glute-bridge': { categories: cat('STRENGTH', 'lower_body'), settings: ALL, equipment: [], pattern: 'HINGE', roles: ['MAIN'], level: 1, stress: ['LOW_BACK'], alternatives: ['bird-dog', 'calf-raise'], progressTo: 'single-leg-glute-bridge', met: 4 },
  'single-leg-glute-bridge': { categories: cat('STRENGTH', 'lower_body'), settings: ALL, equipment: [], pattern: 'HINGE', roles: ['MAIN'], level: 2, stress: ['LOW_BACK'], alternatives: ['glute-bridge'], regressTo: 'glute-bridge', met: 4.5 },
  'romanian-deadlift': { categories: cat('STRENGTH', 'lower_body'), settings: GYM, equipment: ['DUMBBELL'], pattern: 'HINGE', roles: ['MAIN'], level: 3, stress: ['LOW_BACK'], alternatives: ['glute-bridge', 'single-leg-glute-bridge'], regressTo: 'single-leg-glute-bridge', met: 5.5 },
  'leg-press': { categories: cat('STRENGTH', 'lower_body'), settings: GYM, equipment: ['MACHINE'], pattern: 'SQUAT', roles: ['MAIN'], level: 2, stress: ['KNEE'], alternatives: ['squat', 'goblet-squat'], regressTo: 'squat', met: 5 },
  'calf-raise': { categories: cat('STRENGTH', 'lower_body'), settings: ALL, equipment: [], pattern: 'SQUAT', roles: ['MAIN'], level: 1, stress: ['ANKLE'], alternatives: ['glute-bridge'], met: 3.5 },
  'wall-push-up': { categories: cat('STRENGTH', 'upper_push'), settings: ALL, equipment: [], pattern: 'PUSH', roles: ['MAIN'], level: 1, stress: ['WRIST'], alternatives: ['knee-push-up', 'db-floor-press'], progressTo: 'knee-push-up', met: 3.8 },
  'knee-push-up': { categories: cat('STRENGTH', 'upper_push'), settings: ALL, equipment: [], pattern: 'PUSH', roles: ['MAIN'], level: 1, stress: ['WRIST', 'SHOULDER'], alternatives: ['wall-push-up', 'db-floor-press'], progressTo: 'push-up', regressTo: 'wall-push-up', met: 4 },
  'push-up': { categories: cat('STRENGTH', 'upper_push'), settings: ALL, equipment: [], pattern: 'PUSH', roles: ['MAIN'], level: 2, stress: ['WRIST', 'SHOULDER'], alternatives: ['knee-push-up', 'db-floor-press'], regressTo: 'knee-push-up', met: 5 },
  'db-floor-press': { categories: cat('STRENGTH', 'upper_push'), settings: EQUIPPED, equipment: ['DUMBBELL'], pattern: 'PUSH', roles: ['MAIN'], level: 1, stress: ['SHOULDER'], alternatives: ['wall-push-up', 'knee-push-up'], met: 4.5 },
  'overhead-press': { categories: cat('STRENGTH', 'upper_push'), settings: EQUIPPED, equipment: ['DUMBBELL'], pattern: 'PUSH', roles: ['MAIN'], level: 2, stress: ['SHOULDER', 'NECK', 'LOW_BACK'], alternatives: ['db-floor-press', 'wall-push-up'], met: 4.5 },
  'band-row': { categories: cat('STRENGTH', 'upper_pull'), settings: EQUIPPED, equipment: ['BAND'], pattern: 'PULL', roles: ['MAIN'], level: 1, stress: ['LOW_BACK'], alternatives: ['scapular-squeeze', 'dumbbell-row'], met: 4 },
  'dumbbell-row': { categories: cat('STRENGTH', 'upper_pull'), settings: EQUIPPED, equipment: ['DUMBBELL'], pattern: 'PULL', roles: ['MAIN'], level: 2, stress: ['LOW_BACK', 'SHOULDER'], alternatives: ['band-row', 'scapular-squeeze'], regressTo: 'band-row', met: 4.5 },
  'lat-pulldown': { categories: cat('STRENGTH', 'upper_pull'), settings: GYM, equipment: ['MACHINE'], pattern: 'PULL', roles: ['MAIN'], level: 2, stress: ['SHOULDER'], alternatives: ['dumbbell-row', 'band-row'], met: 4.5 },
  'scapular-squeeze': { categories: [...cat('POSTURE', 'upper_back'), ...cat('STRENGTH', 'upper_pull')], settings: ALL, equipment: [], pattern: 'PULL', roles: ['MAIN'], level: 1, stress: [], alternatives: ['wall-angel', 'chin-tuck'], progressTo: 'band-row', met: 3 },
  plank: { categories: cat('STRENGTH', 'core'), settings: ALL, equipment: [], pattern: 'CORE', roles: ['MAIN'], level: 1, stress: ['SHOULDER', 'WRIST', 'LOW_BACK'], alternatives: ['dead-bug', 'bird-dog'], progressTo: 'side-plank', regressTo: 'dead-bug', met: 3.8 },
  'side-plank': { categories: cat('STRENGTH', 'core'), settings: ALL, equipment: [], pattern: 'CORE', roles: ['MAIN'], level: 2, stress: ['SHOULDER', 'WRIST'], alternatives: ['plank', 'dead-bug'], regressTo: 'plank', met: 3.8 },
  'dead-bug': { categories: cat('STRENGTH', 'core'), settings: ALL, equipment: [], pattern: 'CORE', roles: ['MAIN'], level: 1, stress: [], alternatives: ['bird-dog', 'plank'], progressTo: 'plank', met: 3.3 },
  'bird-dog': { categories: cat('STRENGTH', 'core'), settings: ALL, equipment: [], pattern: 'CORE', roles: ['MAIN'], level: 1, stress: ['WRIST'], alternatives: ['dead-bug'], progressTo: 'plank', met: 3.3 },
  'pilates-single-leg-stretch': { categories: cat('YOGA_PILATES', 'pilates_core'), settings: ALL, equipment: [], pattern: 'CORE', roles: ['MAIN'], level: 2, stress: ['LOW_BACK', 'NECK'], alternatives: ['dead-bug', 'bird-dog'], regressTo: 'dead-bug', met: 3.5 },
  // ── Yoga, esneme, mobilite ──
  'cat-cow': { categories: [...cat('POSTURE', 'upper_back'), ...cat('YOGA_PILATES', 'yoga_flow')], settings: ALL, equipment: [], pattern: 'MOBILITY', roles: ['WARMUP', 'COOLDOWN', 'MAIN'], level: 1, stress: ['WRIST'], alternatives: ['child-pose', 'arm-circles'], met: 2.5 },
  'child-pose': { categories: cat('YOGA_PILATES', 'yoga_flow'), settings: ALL, equipment: [], pattern: 'MOBILITY', roles: ['COOLDOWN', 'MAIN'], level: 1, stress: ['KNEE'], alternatives: ['deep-breathing', 'cat-cow'], met: 2 },
  'downward-dog': { categories: cat('YOGA_PILATES', 'yoga_flow'), settings: ALL, equipment: [], pattern: 'MOBILITY', roles: ['MAIN', 'COOLDOWN'], level: 1, stress: ['WRIST', 'SHOULDER'], alternatives: ['child-pose', 'cat-cow'], met: 3 },
  'warrior-two': { categories: cat('YOGA_PILATES', 'yoga_flow'), settings: ALL, equipment: [], pattern: 'MOBILITY', roles: ['MAIN'], level: 2, stress: ['KNEE', 'HIP'], alternatives: ['hip-flexor-stretch', 'child-pose'], met: 3 },
  'hamstring-stretch': { categories: cat('YOGA_PILATES', 'stretching'), settings: ALL, equipment: [], pattern: 'MOBILITY', roles: ['COOLDOWN'], level: 1, stress: ['LOW_BACK'], alternatives: ['child-pose', 'quad-stretch'], met: 2 },
  'quad-stretch': { categories: cat('YOGA_PILATES', 'stretching'), settings: ALL, equipment: [], pattern: 'MOBILITY', roles: ['COOLDOWN'], level: 1, stress: ['KNEE'], alternatives: ['hip-flexor-stretch', 'hamstring-stretch'], met: 2 },
  'hip-flexor-stretch': { categories: [...cat('POSTURE', 'hip_pelvis'), ...cat('YOGA_PILATES', 'stretching')], settings: ALL, equipment: [], pattern: 'MOBILITY', roles: ['COOLDOWN', 'MAIN'], level: 1, stress: ['KNEE'], alternatives: ['quad-stretch', 'child-pose'], met: 2 },
  'doorway-stretch': { categories: cat('POSTURE', 'neck_shoulder'), settings: ALL, equipment: [], pattern: 'MOBILITY', roles: ['COOLDOWN', 'MAIN'], level: 1, stress: ['SHOULDER'], alternatives: ['wall-angel', 'chin-tuck'], met: 2 },
  'wall-angel': { categories: cat('POSTURE', 'upper_back'), settings: ALL, equipment: [], pattern: 'MOBILITY', roles: ['WARMUP', 'MAIN'], level: 1, stress: ['SHOULDER', 'NECK'], alternatives: ['scapular-squeeze', 'doorway-stretch'], met: 2.5 },
  'chin-tuck': { categories: cat('POSTURE', 'neck_shoulder'), settings: ALL, equipment: [], pattern: 'MOBILITY', roles: ['COOLDOWN', 'MAIN'], level: 1, stress: ['NECK'], alternatives: ['doorway-stretch'], met: 2 },
  'arm-circles': { categories: cat('WELLNESS_DAILY', 'mobility'), settings: ALL, equipment: [], pattern: 'MOBILITY', roles: ['WARMUP'], level: 1, stress: ['SHOULDER'], alternatives: ['cat-cow', 'march-in-place'], met: 2.5 },
  'hip-circles': { categories: cat('WELLNESS_DAILY', 'mobility'), settings: ALL, equipment: [], pattern: 'MOBILITY', roles: ['WARMUP'], level: 1, stress: ['HIP'], alternatives: ['march-in-place', 'cat-cow'], met: 2.5 },
  'deep-breathing': { categories: cat('WELLNESS_DAILY', 'breathing_relax'), settings: ALL, equipment: [], pattern: 'BREATH', roles: ['COOLDOWN'], level: 1, stress: [], alternatives: ['child-pose'], met: 1.3 },
  // ── Kardiyo ve yağ yakımı ──
  'march-in-place': { categories: cat('CARDIO_FAT_BURN', 'low_impact'), settings: ALL, equipment: [], pattern: 'CARDIO', roles: ['WARMUP', 'MAIN'], level: 1, stress: [], alternatives: ['step-jacks', 'standing-break'], progressTo: 'step-jacks', met: 3.5 },
  'step-jacks': { categories: cat('CARDIO_FAT_BURN', 'low_impact'), settings: ALL, equipment: [], pattern: 'CARDIO', roles: ['WARMUP', 'MAIN'], level: 1, stress: ['SHOULDER'], alternatives: ['march-in-place', 'shadow-boxing'], progressTo: 'jumping-jack', regressTo: 'march-in-place', met: 5 },
  'jumping-jack': { categories: cat('CARDIO_FAT_BURN', 'high_intensity'), settings: ALL, equipment: [], pattern: 'CARDIO', roles: ['MAIN'], level: 2, stress: ['KNEE', 'ANKLE'], highImpact: true, alternatives: ['step-jacks', 'march-in-place'], regressTo: 'step-jacks', met: 8 },
  'high-knees': { categories: cat('CARDIO_FAT_BURN', 'high_intensity'), settings: ALL, equipment: [], pattern: 'CARDIO', roles: ['MAIN'], level: 2, stress: ['KNEE', 'ANKLE', 'HIP'], highImpact: true, alternatives: ['march-in-place', 'step-jacks'], regressTo: 'march-in-place', met: 8 },
  'mountain-climber': { categories: cat('CARDIO_FAT_BURN', 'high_intensity'), settings: ALL, equipment: [], pattern: 'CARDIO', roles: ['MAIN'], level: 3, stress: ['WRIST', 'SHOULDER', 'LOW_BACK'], alternatives: ['step-jacks', 'dead-bug'], regressTo: 'step-jacks', met: 8 },
  'shadow-boxing': { categories: [...cat('CARDIO_FAT_BURN', 'low_impact'), ...cat('SPORT_PERFORMANCE', 'sport_specific')], settings: ALL, equipment: [], pattern: 'CARDIO', roles: ['MAIN'], level: 1, stress: ['SHOULDER'], alternatives: ['step-jacks', 'march-in-place'], met: 5.5 },
  'brisk-walk': { categories: cat('CARDIO_FAT_BURN', 'steady_state'), settings: ALL, equipment: [], pattern: 'CARDIO', roles: ['MAIN'], level: 1, stress: [], alternatives: ['march-in-place', 'standing-break'], met: 3.8 },
  // ── Spor ve performans ──
  'lateral-shuffle': { categories: cat('SPORT_PERFORMANCE', 'agility'), settings: ALL, equipment: [], pattern: 'CARDIO', roles: ['MAIN'], level: 2, stress: ['KNEE', 'ANKLE', 'HIP'], highImpact: true, alternatives: ['step-jacks', 'march-in-place'], regressTo: 'step-jacks', met: 6 },
  // ── Yüz ve kişisel bakım (isteğe bağlı ek; soğumaya eklenir) ──
  'face-temple': { categories: cat('FACE_CARE', 'face_massage'), settings: ALL, equipment: [], pattern: 'BREATH', roles: ['COOLDOWN'], level: 1, stress: [], alternatives: ['face-brow', 'face-cheek'], met: 1.5 },
  'face-brow': { categories: cat('FACE_CARE', 'face_massage'), settings: ALL, equipment: [], pattern: 'BREATH', roles: ['COOLDOWN'], level: 1, stress: [], alternatives: ['face-temple', 'face-cheek'], met: 1.5 },
  'face-cheek': { categories: cat('FACE_CARE', 'face_massage'), settings: ALL, equipment: [], pattern: 'BREATH', roles: ['COOLDOWN'], level: 1, stress: [], alternatives: ['face-temple', 'face-brow'], met: 1.5 },
  // ── Günlük hareket ──
  'standing-break': { categories: cat('WELLNESS_DAILY', 'daily_movement'), settings: ALL, equipment: [], pattern: 'CARDIO', roles: ['MAIN'], level: 1, stress: [], alternatives: ['march-in-place'], met: 2.5 },
};

export const META_IDS = Object.keys(PLAN_META);
export const metaOf = (id: string): PlanMeta | undefined => PLAN_META[id];

// Programda kullanılabilen hareketler: kütüphanede var olan ve metası tanımlı olanlar
export function planItems() {
  return ITEMS.filter((i) => i.work && PLAN_META[i.id]);
}
