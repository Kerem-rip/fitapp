// İki plan sürümü arasında "ne değişti" özeti. SAF fonksiyon; Türkçe, okunur satırlar döner.
import { allergenLabel, type PlanContent, type PlanMeal, type PlanOption } from './plan-content.js';

const allergenText = (a: string[] | null) => (a === null ? 'belirtilmedi' : a.length === 0 ? 'yok' : a.map(allergenLabel).join(', '));
const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

function optionChanges(meal: PlanMeal, before: PlanOption, after: PlanOption): string[] {
  const where = `"${meal.name}" › "${after.name}"`;
  const lines: string[] = [];
  if (before.name !== after.name) lines.push(`${where}: ad "${before.name}" → "${after.name}"`);
  if (before.portion !== after.portion) lines.push(`${where}: porsiyon "${before.portion}" → "${after.portion}"`);
  if (before.kcal !== after.kcal) lines.push(`${where}: kalori ${before.kcal ?? '—'} → ${after.kcal ?? '—'}`);
  if (!same(before.allergens, after.allergens)) lines.push(`${where}: alerjen ${allergenText(before.allergens)} → ${allergenText(after.allergens)}`);
  if ((before.note ?? '') !== (after.note ?? '')) lines.push(`${where}: not değişti`);
  return lines;
}

export function diffPlans(before: PlanContent | null, after: PlanContent): string[] {
  if (!before) {
    const options = after.meals.reduce((sum, m) => sum + m.options.length, 0);
    return [`İlk sürüm: ${after.meals.length} öğün, ${options} seçenek`];
  }
  const lines: string[] = [];
  if ((before.title ?? '') !== (after.title ?? '')) lines.push(`Başlık değişti`);
  if (before.targetKcal !== after.targetKcal) lines.push(`Hedef kalori ${before.targetKcal ?? '—'} → ${after.targetKcal ?? '—'}`);
  if ((before.notes ?? '') !== (after.notes ?? '')) lines.push('Genel notlar değişti');

  const beforeMeals = new Map(before.meals.map((m) => [m.id, m]));
  const afterMeals = new Map(after.meals.map((m) => [m.id, m]));
  for (const m of before.meals) if (!afterMeals.has(m.id)) lines.push(`Öğün kaldırıldı: "${m.name}"`);
  for (const m of after.meals) {
    const prev = beforeMeals.get(m.id);
    if (!prev) {
      lines.push(`Öğün eklendi: "${m.name}" (${m.options.length} seçenek)`);
      continue;
    }
    if (prev.name !== m.name) lines.push(`Öğün adı "${prev.name}" → "${m.name}"`);
    if ((prev.time ?? '') !== (m.time ?? '')) lines.push(`"${m.name}": saat ${prev.time ?? '—'} → ${m.time ?? '—'}`);
    if (prev.pick !== m.pick) lines.push(`"${m.name}": seçim sayısı ${prev.pick} → ${m.pick}`);
    if ((prev.rule ?? '') !== (m.rule ?? '')) lines.push(`"${m.name}": değiştirme kuralı değişti`);
    const prevOptions = new Map(prev.options.map((o) => [o.id, o]));
    const nextOptions = new Map(m.options.map((o) => [o.id, o]));
    for (const o of prev.options) if (!nextOptions.has(o.id)) lines.push(`"${m.name}": seçenek kaldırıldı "${o.name}"`);
    for (const o of m.options) {
      const before = prevOptions.get(o.id);
      if (!before) lines.push(`"${m.name}": seçenek eklendi "${o.name}"`);
      else lines.push(...optionChanges(m, before, o));
    }
  }
  return lines.length > 0 ? lines : ['İçerikte değişiklik yok'];
}
