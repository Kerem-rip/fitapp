// Egzersiz programı içeriği: günler ve her günün egzersizleri (set, tekrar, yük, dinlenme, not).
// Bu veriyi ANTRENÖR girer; sistem egzersiz seçimi, yük ya da hacmin uygunluğunu değerlendirmez.
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { badRequest } from '../../../common/app-error.js';

export interface ProgramExercise {
  id: string;
  name: string;
  sets: number;
  // "8-10", "30 sn", "en fazla"
  reps: string;
  // "20 kg", "vücut ağırlığı", "hafif bant"
  load?: string;
  restSec?: number;
  notes?: string;
  // Örnek egzersiz kataloğundaki karşılığı (talimat göstermek için)
  catalogId?: string;
}

export interface ProgramDay {
  id: string;
  name: string;
  focus?: string;
  exercises: ProgramExercise[];
}

export interface ProgramContent {
  title?: string;
  goal?: string;
  notes?: string;
  weeks?: number;
  days: ProgramDay[];
}

const exerciseSchema = z.object({
  id: z.string().trim().min(1).max(64).optional(),
  name: z.string().trim().min(1, 'Egzersiz adını yaz').max(80),
  sets: z.number().int().min(1).max(10),
  reps: z.string().trim().min(1, 'Tekrarı yaz').max(20),
  load: z.string().trim().max(30).optional(),
  restSec: z.number().int().min(0).max(600).optional(),
  notes: z.string().trim().max(200).optional(),
  catalogId: z.string().trim().max(64).optional(),
});

const daySchema = z.object({
  id: z.string().trim().min(1).max(64).optional(),
  name: z.string().trim().min(1, 'Gün adını yaz').max(40),
  focus: z.string().trim().max(60).optional(),
  exercises: z.array(exerciseSchema).max(15),
});

export const programContentSchema = z.object({
  title: z.string().trim().max(80).optional(),
  goal: z.string().trim().max(120).optional(),
  notes: z.string().trim().max(1000).optional(),
  weeks: z.number().int().min(1).max(52).optional(),
  days: z.array(daySchema).max(7),
});

export type ProgramContentInput = z.infer<typeof programContentSchema>;

export function normalizeProgramContent(input: ProgramContentInput): ProgramContent {
  const seen = new Set<string>();
  const unique = (id: string | undefined) => {
    const value = id ?? randomUUID();
    if (seen.has(value)) throw badRequest('DUPLICATE_ID', 'Gün veya egzersiz kimlikleri benzersiz olmalı.');
    seen.add(value);
    return value;
  };
  return {
    ...(input.title ? { title: input.title } : {}),
    ...(input.goal ? { goal: input.goal } : {}),
    ...(input.notes ? { notes: input.notes } : {}),
    ...(input.weeks !== undefined ? { weeks: input.weeks } : {}),
    days: input.days.map((d) => ({
      id: unique(d.id),
      name: d.name,
      ...(d.focus ? { focus: d.focus } : {}),
      exercises: d.exercises.map((e) => ({
        id: unique(e.id),
        name: e.name,
        sets: e.sets,
        reps: e.reps,
        ...(e.load ? { load: e.load } : {}),
        ...(e.restSec !== undefined ? { restSec: e.restSec } : {}),
        ...(e.notes ? { notes: e.notes } : {}),
        ...(e.catalogId ? { catalogId: e.catalogId } : {}),
      })),
    })),
  };
}

export const emptyProgram = (): ProgramContent => ({ days: [] });
