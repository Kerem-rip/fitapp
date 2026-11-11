// Antrenman kaydı içeriği ve performans özeti. SAF fonksiyonlar.
// Performans yalnızca girilen değerlerin özetidir (en yüksek yük, toplam tekrar, hacim); yorum ya da öneri içermez.
import { z } from 'zod';

export const workoutEntrySchema = z.object({
  exerciseId: z.string().trim().min(1).max(64).optional(),
  name: z.string().trim().min(1).max(80),
  sets: z
    .array(
      z.object({
        reps: z.number().int().min(0).max(200),
        loadKg: z.number().finite().min(0).max(500).optional(),
      }),
    )
    .min(1)
    .max(15),
});

export const workoutLogSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Tarih YYYY-AA-GG olmalı'),
  dayId: z.string().trim().min(1).max(64).optional(),
  entries: z.array(workoutEntrySchema).min(1, 'En az bir egzersiz gir').max(20),
  rpe: z.number().int().min(1).max(10).optional(),
  pain: z.boolean().default(false),
  painNote: z.string().trim().max(300).optional(),
  note: z.string().trim().max(500).optional(),
});

export type WorkoutEntry = z.infer<typeof workoutEntrySchema>;
export type WorkoutLogInput = z.infer<typeof workoutLogSchema>;

export interface SessionPoint {
  date: string;
  bestLoadKg: number | null;
  totalReps: number;
  // Σ tekrar × yük (yük girilmemiş setler hacme katılmaz)
  volumeKg: number;
}

export interface ExercisePerformance {
  key: string;
  name: string;
  sessions: SessionPoint[];
}

const keyOf = (e: WorkoutEntry) => e.exerciseId ?? e.name.trim().toLocaleLowerCase('tr');

// Egzersiz başına oturum özetleri (tarihe göre eskiden yeniye, son `limit` oturum)
export function performanceByExercise(logs: readonly { date: string; entries: readonly WorkoutEntry[] }[], limit = 8): ExercisePerformance[] {
  const map = new Map<string, ExercisePerformance>();
  const ordered = [...logs].sort((a, b) => a.date.localeCompare(b.date));
  for (const log of ordered) {
    for (const e of log.entries) {
      const key = keyOf(e);
      const loads = e.sets.flatMap((s) => (s.loadKg !== undefined ? [s.loadKg] : []));
      const point: SessionPoint = {
        date: log.date,
        bestLoadKg: loads.length ? Math.max(...loads) : null,
        totalReps: e.sets.reduce((sum, s) => sum + s.reps, 0),
        volumeKg: Math.round(e.sets.reduce((sum, s) => sum + s.reps * (s.loadKg ?? 0), 0) * 10) / 10,
      };
      const current = map.get(key) ?? { key, name: e.name, sessions: [] };
      current.name = e.name;
      current.sessions.push(point);
      map.set(key, current);
    }
  }
  return [...map.values()]
    .map((p) => ({ ...p, sessions: p.sessions.slice(-limit) }))
    .sort((a, b) => a.name.localeCompare(b.name, 'tr'));
}
