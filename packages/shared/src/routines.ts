// Günün düzeni (premium): her saat dilimi için kişisel bakım, egzersiz ve yemek ÖNERİLERİ. Üç şerit ayrıdır, karışmaz.
// Öneriler cinsiyete, amaca ve sporcu türüne göre sıralanır; kullanıcı istediğini seçer ya da kendisi girer.
// Hijyen/bakım önerileri genel alışkanlıklardır (tıbbi tavsiye ya da sonuç vaadi değildir). Yemek değerleri TAHMİNİDİR.
import type { ToolGoal, SportKind } from './calorie-tool';
import { MEAL_SLOTS, suggestMenu, type Allergen, type DietPreference, type FoodItem, type MealSlot, type Sex } from './nutrition';
import { SEED_FOODS } from './seed/foods';

export type RoutineSlot = 'morning' | 'noon' | 'afternoon' | 'evening' | 'anytime';
export type RoutineLane = 'care' | 'exercise' | 'meal';

export const SLOT_INFO: { key: Exclude<RoutineSlot, 'anytime'>; label: string; time: string }[] = [
  { key: 'morning', label: 'Sabah rutini', time: '06:00 – 10:00' },
  { key: 'noon', label: 'Öğle rutini', time: '11:00 – 14:00' },
  { key: 'afternoon', label: 'İkindi rutini', time: '15:00 – 18:00' },
  { key: 'evening', label: 'Akşam rutini', time: '18:00 – 23:00' },
];
export const LANE_LABELS: Record<RoutineLane, string> = { care: 'Kişisel bakım', exercise: 'Egzersiz', meal: 'Yemek' };

export interface Nutrients {
  kcal: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
}
export interface MealItem extends Nutrients {
  name: string;
  portion: string;
  servings: number;
}

export interface RoutineOption {
  // Kararlı kimlik (aynı öneri her seferinde aynı kimliği taşır)
  id: string;
  slot: Exclude<RoutineSlot, 'anytime'>;
  lane: RoutineLane;
  // CARD: antrenman kartı (refId = kart kimliği); CARE: bakım alışkanlığı; FOOD: örnek öğün
  kind: 'CARD' | 'CARE' | 'FOOD';
  title: string;
  subtitle?: string;
  refId?: string;
  items?: MealItem[];
  nutrients?: Nutrients;
}

export interface RoutineProfile {
  sex: Sex;
  goal?: ToolGoal | null;
  sport?: SportKind | null;
  targetKcal: number;
  diet?: DietPreference;
  allergens?: Allergen[];
  // "Başka öner" için artırılır
  variant?: number;
}

// ── Kişisel bakım (hijyen ve cilt alışkanlıkları) ──
const CARE: Record<Exclude<RoutineSlot, 'anytime'>, { id: string; title: string; subtitle: string; card?: string }[]> = {
  morning: [
    { id: 'care-morning-water', title: 'Güne bir bardak suyla başla', subtitle: 'Uyanınca ılık ya da oda sıcaklığında bir bardak su.' },
    { id: 'care-morning-teeth', title: 'Dişlerini fırçala', subtitle: 'En az 2 dakika; dilini de temizle.' },
    { id: 'care-morning-cleanse', title: 'Yüzünü temizle ve nemlendir', subtitle: 'Ilık su ve nazik bir temizleyici; ardından nemlendirici.' },
    { id: 'care-morning-spf', title: 'Güneş koruyucu sür (SPF 30+)', subtitle: 'Dışarı çıkmadan önce yüz ve boyna; kapalı havada da.' },
    { id: 'care-morning-face', title: 'Sabah yüz egzersizi', subtitle: 'Kısa yüz egzersizi rutini. Etkisi için kanıt sınırlıdır.', card: 'face-morning' },
  ],
  noon: [
    { id: 'care-noon-hands', title: 'Ellerini yıka ve nemlendir', subtitle: 'Yemekten önce ve gün içinde.' },
    { id: 'care-noon-posture', title: 'Boyun ve omuz molası', subtitle: 'Masa başındaysan kısa bir gerginlik molası.', card: 'posture-short' },
  ],
  afternoon: [
    { id: 'care-afternoon-lips', title: 'Dudak ve el nemlendirici', subtitle: 'Kuruluk hissettiğinde.' },
    { id: 'care-afternoon-face', title: 'Yüzünü serin suyla ferahlat', subtitle: 'Cildini ovmadan, hafifçe kurula.' },
  ],
  evening: [
    { id: 'care-evening-cleanse', title: 'Günün kirini ve makyajı temizle', subtitle: 'Yatmadan önce yüzünü temizle.' },
    { id: 'care-evening-moisturize', title: 'Gece nemlendiricisi sür', subtitle: 'Temiz cilde, hafif bir tabaka.' },
    { id: 'care-evening-massage', title: 'Akşam rahatlatıcı yüz masajı', subtitle: 'Hafif dokunuşlarla. Cildin hassassa uygulama.', card: 'face-evening' },
    { id: 'care-evening-teeth', title: 'Dişlerini fırçala ve diş ipi kullan', subtitle: 'Yatmadan önce.' },
  ],
};

// ── Egzersiz kartları (kart kimlikleri sunucudaki antrenman kartlarıdır) ──
const LIGHT: Record<Exclude<RoutineSlot, 'anytime'>, string[]> = {
  morning: ['mobility-morning', 'yoga-calm', 'cardio-steady'],
  noon: ['posture-desk', 'daily-break', 'posture-short'],
  afternoon: [],
  evening: ['yoga-relax', 'posture-hip-back', 'yoga-flex'],
};

function mainCards(p: RoutineProfile): string[] {
  const female = p.sex === 'female';
  const male = p.sex === 'male';
  if (p.goal === 'breastfeeding') return ['posture-hip-back', 'yoga-calm', 'cardio-steady'];
  if (p.goal === 'athlete') {
    switch (p.sport) {
      case 'gym':
        return female ? ['hip-gym', 'legs-gym', 'back-gym', 'chest-gym', 'shoulder-gym', 'arms-gym'] : male ? ['chest-gym', 'back-gym', 'legs-gym', 'shoulder-gym', 'arms-gym', 'hip-gym'] : ['legs-gym', 'back-gym', 'chest-gym', 'shoulder-gym', 'hip-gym', 'arms-gym'];
      case 'endurance':
        return ['cardio-steady', 'cardio-low', 'cardio-hiit', 'legs-home'];
      case 'team':
        return ['sport-agility', 'sport-power', 'cardio-agility', 'legs-dumbbell'];
      case 'combat':
        return ['cardio-hiit', 'core-mid', 'fullbody-dumbbell', 'sport-agility'];
      default:
        return ['fullbody-dumbbell', 'cardio-low', 'core-mid'];
    }
  }
  const base = female ? ['hip-beginner', 'legs-home', 'core-beginner', 'pilates-start', 'fullbody-home'] : male ? ['chest-home', 'back-home', 'arms-beginner', 'core-mid', 'fullbody-home'] : ['fullbody-home', 'core-beginner', 'legs-home', 'chest-beginner'];
  if (p.goal === 'lose') return ['cardio-low', ...base];
  return base;
}

// ── Yemek: örnek menü (porsiyon değerleri tahmini) ──
const SLOT_TO_MEAL: Record<Exclude<RoutineSlot, 'anytime'>, MealSlot> = { morning: 'breakfast', noon: 'lunch', afternoon: 'snack', evening: 'dinner' };
const MEAL_LABEL: Record<MealSlot, string> = { breakfast: 'Örnek kahvaltı', lunch: 'Örnek öğle yemeği', snack: 'Örnek ara öğün', dinner: 'Örnek akşam yemeği' };

function sum(items: MealItem[]): Nutrients {
  const t = items.reduce((s, i) => ({ kcal: s.kcal + i.kcal, proteinG: s.proteinG + i.proteinG, carbsG: s.carbsG + i.carbsG, fatG: s.fatG + i.fatG }), { kcal: 0, proteinG: 0, carbsG: 0, fatG: 0 });
  return { kcal: Math.round(t.kcal), proteinG: Math.round(t.proteinG * 10) / 10, carbsG: Math.round(t.carbsG * 10) / 10, fatG: Math.round(t.fatG * 10) / 10 };
}

const toItem = (food: FoodItem, servings: number): MealItem => ({
  name: food.name,
  portion: food.portion,
  servings,
  kcal: Math.round(food.kcal * servings),
  proteinG: Math.round(food.proteinG * servings * 10) / 10,
  carbsG: Math.round(food.carbsG * servings * 10) / 10,
  fatG: Math.round(food.fatG * servings * 10) / 10,
});

export function mealOptions(p: RoutineProfile, slot: Exclude<RoutineSlot, 'anytime'>, count = 3): RoutineOption[] {
  const meal = SLOT_TO_MEAL[slot];
  const base = p.variant ?? 0;
  const seen = new Set<string>();
  const out: RoutineOption[] = [];
  for (let v = base; v < base + count * 3 && out.length < count; v++) {
    const menu = suggestMenu(SEED_FOODS, { targetKcal: p.targetKcal, allergens: p.allergens, diet: p.diet, variant: v });
    const s = menu.slots.find((x) => x.slot === meal);
    if (!s || s.items.length === 0) continue;
    const key = s.items.map((i) => `${i.food.id}x${i.servings}`).join('|');
    if (seen.has(key)) continue;
    seen.add(key);
    const items = s.items.map((i) => toItem(i.food, i.servings));
    out.push({ id: `meal-${slot}-${key}`, slot, lane: 'meal', kind: 'FOOD', title: MEAL_LABEL[meal], subtitle: items.map((i) => i.name).join(', '), items, nutrients: sum(items) });
  }
  return out;
}

// Tüm önerileri üretir (slot × şerit); cinsiyete ve amaca göre sıralıdır
export function routineOptions(p: RoutineProfile): RoutineOption[] {
  const all: RoutineOption[] = [];
  for (const { key } of SLOT_INFO) {
    for (const c of CARE[key]) all.push({ id: c.id, slot: key, lane: 'care', kind: c.card ? 'CARD' : 'CARE', title: c.title, subtitle: c.subtitle, ...(c.card ? { refId: c.card } : {}) });
    const cards = key === 'afternoon' ? mainCards(p) : LIGHT[key];
    for (const card of cards) all.push({ id: `ex-${key}-${card}`, slot: key, lane: 'exercise', kind: 'CARD', title: card, refId: card });
    all.push(...mealOptions(p, key));
  }
  return all;
}

export const MEAL_SLOT_ORDER = MEAL_SLOTS;
