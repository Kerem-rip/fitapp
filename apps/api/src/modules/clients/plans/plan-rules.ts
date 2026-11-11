// Plan güvenlik kontrolleri. SAF fonksiyonlar.
//
// KURALLAR (alerji güvenliği; tıbbi eşik değil):
//  - Danışanın alerji bilgisi bilinmeden plan ONAYLANAMAZ.
//  - Danışan alerji beyan ettiyse, o alerjeni içeren seçenek ONAYLANAMAZ ve danışana seçilebilir gösterilmez.
//  - Danışan alerji beyan ettiyse, alerjen bilgisi girilmemiş (null) seçenek de ONAYLANAMAZ / gösterilmez.
//  - Alerji beyan edilmemişse (Alerjim yok) alerjen bilgisi girilmemiş seçenek sorun değildir.
import { allergenLabel, type PlanContent } from './plan-content.js';

export interface AllergyInfo {
  // Alerji sorusu yanıtlı ve uzmana görünür mü
  known: boolean;
  // Beyan edilen alerjenler ("Alerjim yok" dışarıda)
  allergens: readonly string[];
}

export interface Conflict {
  mealId: string;
  mealName: string;
  optionId: string;
  optionName: string;
  // ALLERGEN: danışanın alerjenini içeriyor · UNKNOWN: alerjen bilgisi girilmemiş
  kind: 'ALLERGEN' | 'UNKNOWN';
  allergens: string[];
}

export interface Blocker {
  code: 'EMPTY_PLAN' | 'MEAL_WITHOUT_OPTIONS' | 'PICK_TOO_HIGH' | 'ALLERGY_INFO_MISSING' | 'ALLERGEN_CONFLICT' | 'ALLERGEN_UNKNOWN';
  message: string;
  mealId?: string;
  optionId?: string;
}

export function findConflicts(content: PlanContent, allergy: AllergyInfo): Conflict[] {
  if (!allergy.known || allergy.allergens.length === 0) return [];
  const result: Conflict[] = [];
  for (const meal of content.meals) {
    for (const option of meal.options) {
      const base = { mealId: meal.id, mealName: meal.name, optionId: option.id, optionName: option.name };
      if (option.allergens === null) {
        result.push({ ...base, kind: 'UNKNOWN', allergens: [] });
        continue;
      }
      const hit = option.allergens.filter((a) => allergy.allergens.includes(a));
      if (hit.length > 0) result.push({ ...base, kind: 'ALLERGEN', allergens: hit });
    }
  }
  return result;
}

export const conflictText = (c: Conflict) =>
  c.kind === 'ALLERGEN'
    ? `"${c.mealName}" › "${c.optionName}" danışanın alerjenini içeriyor: ${c.allergens.map(allergenLabel).join(', ')}.`
    : `"${c.mealName}" › "${c.optionName}" için alerjen bilgisi girilmemiş; danışanın alerjisi olduğundan bu seçenek kullanılamaz.`;

// Onayı engelleyen sorunlar (hepsi çözülmeden plan yayınlanmaz)
export function checkPlan(content: PlanContent, allergy: AllergyInfo): Blocker[] {
  const blockers: Blocker[] = [];
  if (content.meals.length === 0) blockers.push({ code: 'EMPTY_PLAN', message: 'Plan boş; en az bir öğün ekle.' });

  for (const meal of content.meals) {
    if (meal.options.length === 0) {
      blockers.push({ code: 'MEAL_WITHOUT_OPTIONS', message: `"${meal.name}" öğününde hiç seçenek yok.`, mealId: meal.id });
    } else if (meal.pick > meal.options.length) {
      blockers.push({
        code: 'PICK_TOO_HIGH',
        message: `"${meal.name}" öğününde ${meal.pick} seçim isteniyor ama ${meal.options.length} seçenek var.`,
        mealId: meal.id,
      });
    }
  }

  if (!allergy.known) {
    blockers.push({
      code: 'ALLERGY_INFO_MISSING',
      message: 'Danışanın alerji bilgisi yok veya paylaşılmıyor. Güvenlik için alerji bilgisi olmadan plan onaylanamaz.',
    });
  }
  for (const c of findConflicts(content, allergy)) {
    blockers.push({
      code: c.kind === 'ALLERGEN' ? 'ALLERGEN_CONFLICT' : 'ALLERGEN_UNKNOWN',
      message: conflictText(c),
      mealId: c.mealId,
      optionId: c.optionId,
    });
  }
  return blockers;
}
