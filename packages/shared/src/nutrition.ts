// Kalori hesabı ve örnek menü önerisi — docs/features/nutrition.md
// Tüm değerler TAHMİNİDİR. Güvenlik kuralları:
//  - Hedef kalori güvenli alt sınırın altına inmez.
//  - 18 yaş altında kilo verme hedefi uygulanmaz (genç modu).
//  - Zayıf (BMI < 18,5) kullanıcıya kilo verme hedefi uygulanmaz.
//  - Alerjen bilgisi eksik yemekler, alerjisi olan kullanıcıya önerilmez.

export type Sex = 'female' | 'male' | 'other';
export type ActivityLevel = 'sedentary' | 'light' | 'moderate' | 'active' | 'very_active';
export type Goal = 'lose' | 'gain' | 'muscle' | 'maintain';

export const ACTIVITY_FACTORS: Record<ActivityLevel, number> = {
  sedentary: 1.2,
  light: 1.375,
  moderate: 1.55,
  active: 1.725,
  very_active: 1.9,
};

// Günlük hedef bu değerlerin altına inemez
export const MIN_DAILY_KCAL: Record<Sex, number> = { female: 1200, male: 1500, other: 1350 };

export interface CalorieInput {
  sex: Sex;
  ageYears: number;
  heightCm: number;
  weightKg: number;
  activity: ActivityLevel;
  goal: Goal;
}

export type CalorieNote =
  | 'floor_applied'
  | 'teen_maintain_only'
  | 'underweight_maintain_only'
  | 'fast_loss_capped';

export interface CalorieResult {
  bmr: number;
  tdee: number;
  target: number;
  // Gerçekte uygulanan hedef (güvenlik kuralları istenen hedefi değiştirmiş olabilir)
  goal: Goal;
  deltaKcal: number;
  weeklyChangeKg: number;
  bmi: number;
  macros: { proteinG: number; carbsG: number; fatG: number };
  notes: CalorieNote[];
}

export type CalorieInputError = 'age' | 'height' | 'weight';

export function validateCalorieInput(input: CalorieInput): CalorieInputError | null {
  if (!(input.ageYears >= 13 && input.ageYears <= 99)) return 'age';
  if (!(input.heightCm >= 120 && input.heightCm <= 230)) return 'height';
  if (!(input.weightKg >= 30 && input.weightKg <= 300)) return 'weight';
  return null;
}

export function bmiOf(weightKg: number, heightCm: number): number {
  const m = heightCm / 100;
  return weightKg / (m * m);
}

// Mifflin-St Jeor denklemi
export function basalMetabolicRate(input: Pick<CalorieInput, 'sex' | 'ageYears' | 'heightCm' | 'weightKg'>): number {
  const base = 10 * input.weightKg + 6.25 * input.heightCm - 5 * input.ageYears;
  return base + (input.sex === 'male' ? 5 : input.sex === 'female' ? -161 : -78);
}

const PROTEIN_PER_KG: Record<Goal, number> = { lose: 1.8, muscle: 2.0, gain: 1.6, maintain: 1.4 };

export function estimateCalories(input: CalorieInput): CalorieResult {
  const notes: CalorieNote[] = [];
  const bmr = basalMetabolicRate(input);
  const tdee = bmr * ACTIVITY_FACTORS[input.activity];
  const bmi = bmiOf(input.weightKg, input.heightCm);

  let goal = input.goal;
  if (input.ageYears < 18 && goal !== 'maintain') {
    goal = 'maintain';
    notes.push('teen_maintain_only');
  } else if (bmi < 18.5 && goal === 'lose') {
    goal = 'maintain';
    notes.push('underweight_maintain_only');
  }

  let delta = 0;
  if (goal === 'lose') {
    const cap = tdee * 0.2;
    delta = -Math.min(500, cap);
    if (cap < 500) notes.push('fast_loss_capped');
  } else if (goal === 'gain') {
    delta = 300;
  } else if (goal === 'muscle') {
    delta = 250;
  }

  const floor = MIN_DAILY_KCAL[input.sex];
  const raw = tdee + delta;
  let target = raw;
  if (delta < 0 && raw < floor) {
    target = floor;
    notes.push('floor_applied');
  }

  const proteinG = Math.min(input.weightKg * PROTEIN_PER_KG[goal], (target * 0.35) / 4);
  const fatG = (target * 0.27) / 9;
  const carbsG = Math.max(0, (target - proteinG * 4 - fatG * 9) / 4);

  return {
    bmr: Math.round(bmr),
    tdee: Math.round(tdee),
    target: Math.round(target),
    goal,
    deltaKcal: Math.round(target - tdee),
    weeklyChangeKg: Math.round((((target - tdee) * 7) / 7700) * 100) / 100,
    bmi: Math.round(bmi * 10) / 10,
    macros: { proteinG: Math.round(proteinG), carbsG: Math.round(carbsG), fatG: Math.round(fatG) },
    notes,
  };
}

// ───────────── Örnek menü ─────────────

export type Allergen = 'gluten' | 'peanut' | 'tree_nut' | 'milk' | 'egg' | 'soy' | 'fish' | 'shellfish' | 'sesame';
export type MealSlot = 'breakfast' | 'lunch' | 'snack' | 'dinner';
export type DietPreference = 'none' | 'vegetarian' | 'vegan';

export const ALLERGEN_LABELS_TR: Record<Allergen, string> = {
  gluten: 'Gluten',
  peanut: 'Yer fıstığı',
  tree_nut: 'Sert kabuklu yemiş',
  milk: 'Süt',
  egg: 'Yumurta',
  soy: 'Soya',
  fish: 'Balık',
  shellfish: 'Kabuklu deniz ürünü',
  sesame: 'Susam',
};

export const ALLERGENS = Object.keys(ALLERGEN_LABELS_TR) as Allergen[];

export const MEAL_SLOT_LABELS_TR: Record<MealSlot, string> = {
  breakfast: 'Kahvaltı',
  lunch: 'Öğle',
  snack: 'Ara öğün',
  dinner: 'Akşam',
};

export const MEAL_SLOTS: readonly MealSlot[] = ['breakfast', 'lunch', 'snack', 'dinner'];

export interface FoodItem {
  id: string;
  name: string;
  // Porsiyon başına değerler (ev ölçüsü)
  portion: string;
  grams: number;
  kcal: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  // Hangi öğünlerde önerilebilir
  slots: MealSlot[];
  // Hangi öğünlerde ana yemek olabilir (boşsa sadece yan yemek)
  mainIn: MealSlot[];
  allergens: Allergen[];
  // false ise alerjen bilgisi eksiktir; alerjisi olan kullanıcıya önerilmez
  allergenInfoComplete: boolean;
  diet: 'vegan' | 'vegetarian' | 'omnivore';
  // Tüm değerler tahminidir; bir diyetisyen düzeltirse doğrulanmış olur
  isEstimate: boolean;
}

export interface MenuItem {
  food: FoodItem;
  servings: number;
}

export interface MenuSlot {
  slot: MealSlot;
  items: MenuItem[];
  kcal: number;
}

export interface SuggestedMenu {
  slots: MenuSlot[];
  totalKcal: number;
  // Filtreler yüzünden öneri çıkaramadığı öğünler
  emptySlots: MealSlot[];
}

export interface MenuOptions {
  targetKcal: number;
  allergens?: Allergen[];
  diet?: DietPreference;
  // "Başka öner" için artırılır
  variant?: number;
}

const SLOT_SHARE: Record<MealSlot, number> = { breakfast: 0.25, lunch: 0.33, snack: 0.12, dinner: 0.3 };

export function isFoodAllowed(food: FoodItem, allergens: Allergen[], diet: DietPreference): boolean {
  if (allergens.length > 0 && !food.allergenInfoComplete) return false;
  if (food.allergens.some((a) => allergens.includes(a))) return false;
  if (diet === 'vegan' && food.diet !== 'vegan') return false;
  if (diet === 'vegetarian' && food.diet === 'omnivore') return false;
  return true;
}

function rotate<T>(list: T[], by: number): T[] {
  if (list.length === 0) return list;
  const n = ((by % list.length) + list.length) % list.length;
  return [...list.slice(n), ...list.slice(0, n)];
}

const SERVING_STEPS = [0.5, 1, 1.5, 2] as const;

function buildSlot(pool: FoodItem[], slot: MealSlot, target: number, variant: number): MenuItem[] {
  if (pool.length === 0) return [];
  const mains = pool.filter((f) => f.mainIn.includes(slot));
  const mainList = mains.length > 0 ? mains : pool;
  const main = rotate(mainList, variant)[0]!;

  const items: MenuItem[] = [{ food: main, servings: 1 }];
  let total = main.kcal;
  const sides = rotate(
    pool.filter((f) => f.id !== main.id),
    variant,
  );
  for (const side of sides) {
    if (items.length >= 5) break;
    const remaining = target - total;
    if (remaining < 45) break;
    if (side.kcal <= remaining * 1.15) {
      items.push({ food: side, servings: 1 });
      total += side.kcal;
    }
  }

  // Ana yemeğin porsiyonunu, öğün hedefine en yakın olacak şekilde ayarla
  const rest = total - main.kcal;
  let best: number = SERVING_STEPS[1];
  let bestDiff = Infinity;
  for (const step of SERVING_STEPS) {
    const diff = Math.abs(rest + main.kcal * step - target);
    if (diff < bestDiff) {
      best = step;
      bestDiff = diff;
    }
  }
  items[0] = { food: main, servings: best };
  return items;
}

export function menuItemKcal(item: MenuItem): number {
  return Math.round(item.food.kcal * item.servings);
}

export function suggestMenu(foods: readonly FoodItem[], options: MenuOptions): SuggestedMenu {
  const allergens = options.allergens ?? [];
  const diet = options.diet ?? 'none';
  const variant = options.variant ?? 0;
  const allowed = foods.filter((f) => isFoodAllowed(f, allergens, diet));

  const slots: MenuSlot[] = [];
  const emptySlots: MealSlot[] = [];
  // Gün içinde aynı yemek tekrar edilmesin; seçenek azsa tekrar kabul edilir
  const used = new Set<string>();
  for (const slot of MEAL_SLOTS) {
    const all = allowed.filter((f) => f.slots.includes(slot));
    const fresh = all.filter((f) => !used.has(f.id));
    const pool = fresh.length >= 3 && fresh.some((f) => f.mainIn.includes(slot)) ? fresh : all;
    const items = buildSlot(pool, slot, options.targetKcal * SLOT_SHARE[slot], variant);
    for (const item of items) used.add(item.food.id);
    if (items.length === 0) emptySlots.push(slot);
    slots.push({ slot, items, kcal: items.reduce((sum, i) => sum + menuItemKcal(i), 0) });
  }
  return { slots, totalKcal: slots.reduce((sum, s) => sum + s.kcal, 0), emptySlots };
}
