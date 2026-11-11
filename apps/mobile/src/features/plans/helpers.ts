// Plan editörü yardımcıları: yerel kimlik, alerjen metni ve örnek menüden başlangıç taslağı.
// Örnek yiyecekler (SEED_FOODS) tahmini değerlerdir; tıbbi doğruluk taşımaz. Uzman her seçeneği kontrol edip düzeltir.
import type { PlanContent, PlanMeal, PlanOption } from '@fitapp/api-client';
import { ALLERGEN_LABELS_TR, isFoodAllowed, MEAL_SLOT_LABELS_TR, MEAL_SLOTS, SEED_FOODS, type Allergen, type DietPreference, type FoodItem } from '@fitapp/shared';

let counter = 0;
export const localId = () => `n${Date.now().toString(36)}${(counter++).toString(36)}`;

export const allergenText = (allergens: string[] | null) =>
  allergens === null ? 'Alerjen belirtilmedi' : allergens.length === 0 ? 'Alerjen yok' : allergens.map((a) => ALLERGEN_LABELS_TR[a as Allergen] ?? a).join(', ');

export const optionFromFood = (food: FoodItem): PlanOption => ({
  id: localId(),
  name: food.name,
  portion: food.portion,
  kcal: food.kcal,
  // Örnek veride alerjen bilgisi eksikse "belirtilmedi" kalır; uzman doldurmalı
  allergens: food.allergenInfoComplete ? [...food.allergens] : null,
});

const SLOT_TIMES: Record<string, string> = { breakfast: '08:00', lunch: '13:00', snack: '16:00', dinner: '19:00' };

// Danışanın beyan ettiği alerjen ve beslenme tercihine göre filtrelenmiş örnek menü: her öğünde 3 alternatif
export function sampleStarter(allergens: string[], diet: DietPreference): PlanContent {
  const allowed = SEED_FOODS.filter((f) => isFoodAllowed(f, allergens as Allergen[], diet));
  const used = new Set<string>();
  const meals: PlanMeal[] = MEAL_SLOTS.map((slot) => {
    const pool = allowed.filter((f) => f.slots.includes(slot));
    const mains = pool.filter((f) => f.mainIn.includes(slot) && !used.has(f.id));
    const picked = (mains.length >= 3 ? mains : pool.filter((f) => !used.has(f.id))).slice(0, 3);
    for (const f of picked) used.add(f.id);
    return { id: localId(), name: MEAL_SLOT_LABELS_TR[slot], time: SLOT_TIMES[slot], pick: 1, options: picked.map(optionFromFood) };
  });
  return { title: 'Beslenme planı', meals };
}

// Sunucuya gidecek içerik: boş alanlar atılır
export function cleanContent(content: PlanContent): PlanContent {
  return {
    ...(content.title?.trim() ? { title: content.title.trim() } : {}),
    ...(content.targetKcal !== undefined && !Number.isNaN(content.targetKcal) ? { targetKcal: content.targetKcal } : {}),
    ...(content.notes?.trim() ? { notes: content.notes.trim() } : {}),
    meals: content.meals.map((m) => ({
      id: m.id,
      name: m.name.trim(),
      ...(m.time?.trim() ? { time: m.time.trim() } : {}),
      pick: m.pick,
      ...(m.rule?.trim() ? { rule: m.rule.trim() } : {}),
      options: m.options.map((o) => ({
        id: o.id,
        name: o.name.trim(),
        portion: o.portion.trim(),
        ...(o.kcal !== undefined && !Number.isNaN(o.kcal) ? { kcal: o.kcal } : {}),
        allergens: o.allergens,
        ...(o.note?.trim() ? { note: o.note.trim() } : {}),
      })),
    })),
  };
}

export { SEED_FOODS };
