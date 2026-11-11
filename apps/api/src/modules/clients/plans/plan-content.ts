// Beslenme planı içeriği: öğünler, her öğün için uzmanın tanımladığı alternatifler, porsiyonlar ve değiştirme kuralı.
// Bu veriyi UZMAN girer; sistem yiyecek, porsiyon veya alerjen bilgisinin tıbbi doğruluğunu iddia etmez.
// Danışan, bir öğünde yalnızca burada tanımlı alternatiflerden (en fazla `pick` tane) seçebilir.
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { badRequest } from '../../../common/app-error.js';
import { ALLERGEN_CHOICES } from '../intake-template.js';

export const ALLERGEN_KEYS = ALLERGEN_CHOICES.map((c) => c.value);
export const allergenLabel = (key: string) => ALLERGEN_CHOICES.find((c) => c.value === key)?.label ?? key;

export interface PlanOption {
  id: string;
  name: string;
  // Ev ölçüsü / porsiyon (ör. "1 dilim, 30 g")
  portion: string;
  kcal?: number;
  // İçerdiği alerjenler. null: uzman belirtmedi (bilinmiyor); danışanın alerjisi varsa bu seçenek onaylanamaz
  allergens: string[] | null;
  note?: string;
}

export interface PlanMeal {
  id: string;
  name: string;
  // "08:00"
  time?: string;
  // Danışan bu öğünde kaç alternatif seçer (1 = tek seçim)
  pick: number;
  // Değiştirme kuralı (serbest metin, ör. "Meyve yerine kuru yemiş seçme")
  rule?: string;
  options: PlanOption[];
}

export interface PlanContent {
  title?: string;
  targetKcal?: number;
  notes?: string;
  meals: PlanMeal[];
}

const optionSchema = z.object({
  id: z.string().trim().min(1).max(64).optional(),
  name: z.string().trim().min(1, 'Seçenek adını yaz').max(80),
  portion: z.string().trim().min(1, 'Porsiyonu yaz').max(60),
  kcal: z.number().finite().min(0).max(5000).optional(),
  allergens: z.array(z.enum(ALLERGEN_KEYS as [string, ...string[]])).max(ALLERGEN_KEYS.length).nullable(),
  note: z.string().trim().max(200).optional(),
});

const mealSchema = z.object({
  id: z.string().trim().min(1).max(64).optional(),
  name: z.string().trim().min(1, 'Öğün adını yaz').max(40),
  time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Saat SS:DD biçiminde olmalı').optional(),
  pick: z.number().int().min(1).max(5),
  rule: z.string().trim().max(300).optional(),
  options: z.array(optionSchema).max(12),
});

export const planContentSchema = z.object({
  title: z.string().trim().max(80).optional(),
  // Hedef kalori uzmanın girdiği bir etikettir; sistem hesaplamaz ve doğrulamaz
  targetKcal: z.number().finite().min(0).max(10000).optional(),
  notes: z.string().trim().max(1000).optional(),
  meals: z.array(mealSchema).max(8),
});

export type PlanContentInput = z.infer<typeof planContentSchema>;

// Eksik kimlikleri üretir; kimliklerin benzersiz olduğunu doğrular (düzenlemelerde kimlikler korunur)
export function normalizePlanContent(input: PlanContentInput): PlanContent {
  const seen = new Set<string>();
  const unique = (id: string | undefined) => {
    const value = id ?? randomUUID();
    if (seen.has(value)) throw badRequest('DUPLICATE_ID', 'Öğün veya seçenek kimlikleri benzersiz olmalı.');
    seen.add(value);
    return value;
  };
  return {
    ...(input.title ? { title: input.title } : {}),
    ...(input.targetKcal !== undefined ? { targetKcal: input.targetKcal } : {}),
    ...(input.notes ? { notes: input.notes } : {}),
    meals: input.meals.map((m) => ({
      id: unique(m.id),
      name: m.name,
      ...(m.time ? { time: m.time } : {}),
      pick: m.pick,
      ...(m.rule ? { rule: m.rule } : {}),
      options: m.options.map((o) => ({
        id: unique(o.id),
        name: o.name,
        portion: o.portion,
        ...(o.kcal !== undefined ? { kcal: o.kcal } : {}),
        allergens: o.allergens === null ? null : [...new Set(o.allergens)],
        ...(o.note ? { note: o.note } : {}),
      })),
    })),
  };
}

export const emptyPlan = (): PlanContent => ({ meals: [] });
