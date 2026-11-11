import { normalizeProgramContent, programContentSchema, type ProgramContent } from './program-content.js';
import { checkProgram, diffPrograms } from './program-rules.js';
import { performanceByExercise, workoutLogSchema } from './workout-log.js';

const program = (): ProgramContent => ({
  title: 'Başlangıç',
  weeks: 4,
  days: [
    {
      id: 'd1',
      name: 'A günü',
      exercises: [
        { id: 'e1', name: 'Squat', sets: 3, reps: '8-10', load: '20 kg', restSec: 90 },
        { id: 'e2', name: 'Şınav', sets: 3, reps: '10' },
        { id: 'e3', name: 'Plank', sets: 3, reps: '30 sn' },
      ],
    },
    { id: 'd2', name: 'B günü', exercises: [{ id: 'e4', name: 'Kürek çekiş', sets: 3, reps: '10', load: '15 kg' }] },
  ],
});

describe('program içeriği', () => {
  it('kimlikler üretilir, korunur; tekrarlı kimlik reddedilir', () => {
    const out = normalizeProgramContent(programContentSchema.parse({ days: [{ id: 'keep', name: 'A', exercises: [{ name: 'Squat', sets: 3, reps: '8' }] }] }));
    expect(out.days[0]!.id).toBe('keep');
    expect(out.days[0]!.exercises[0]!.id).toMatch(/^[0-9a-f-]{36}$/);
    const dup = { days: [{ id: 'x', name: 'A', exercises: [] }, { id: 'x', name: 'B', exercises: [] }] };
    expect(() => normalizeProgramContent(programContentSchema.parse(dup))).toThrow();
  });

  it('geçersiz içerik reddedilir', () => {
    const ex = { name: 'Squat', sets: 3, reps: '8' };
    expect(programContentSchema.safeParse({ days: [{ name: 'A', exercises: [{ ...ex, sets: 0 }] }] }).success).toBe(false);
    expect(programContentSchema.safeParse({ days: [{ name: 'A', exercises: [{ ...ex, restSec: 9999 }] }] }).success).toBe(false);
    expect(programContentSchema.safeParse({ days: Array.from({ length: 8 }, () => ({ name: 'A', exercises: [] })) }).success).toBe(false);
  });
});

describe('program kontrolleri', () => {
  it('sağlık bilgisi bilinmeden onaylanamaz', () => {
    expect(checkProgram(program(), { known: false }).map((b) => b.code)).toEqual(['HEALTH_INFO_MISSING']);
    expect(checkProgram(program(), { known: true })).toEqual([]);
  });

  it('boş program ve egzersizsiz gün engellenir', () => {
    expect(checkProgram({ days: [] }, { known: true }).map((b) => b.code)).toEqual(['EMPTY_PROGRAM']);
    expect(checkProgram({ days: [{ id: 'd', name: 'A', exercises: [] }] }, { known: true }).map((b) => b.code)).toEqual(['DAY_WITHOUT_EXERCISES']);
  });
});

describe('program sürüm farkı', () => {
  it('ilk sürüm ve değişiklik yok', () => {
    expect(diffPrograms(null, program())).toEqual(['İlk sürüm: 2 gün, 4 egzersiz']);
    expect(diffPrograms(program(), program())).toEqual(['İçerikte değişiklik yok']);
  });

  it('set/tekrar, yük, eklenen ve kaldırılan egzersizleri yazar; kaldırma sıra değişikliği sayılmaz', () => {
    const after = program();
    after.weeks = 6;
    after.days[0]!.exercises[0]!.sets = 4;
    after.days[0]!.exercises[0]!.load = '25 kg';
    after.days[0]!.exercises = after.days[0]!.exercises.filter((e) => e.id !== 'e2');
    after.days[0]!.exercises.push({ id: 'e9', name: 'Lunge', sets: 3, reps: '10' });
    const lines = diffPrograms(program(), after);
    expect(lines).toEqual(
      expect.arrayContaining([
        'Süre 4 → 6 hafta',
        '"A günü" › "Squat": 3×8-10 → 4×8-10',
        '"A günü" › "Squat": yük 20 kg → 25 kg',
        '"A günü": egzersiz kaldırıldı "Şınav"',
        '"A günü": egzersiz eklendi "Lunge"',
      ]),
    );
    expect(lines).not.toContain('"A günü": egzersiz sırası değişti');
  });

  it('sıra değişikliğini fark eder', () => {
    const after = program();
    after.days[0]!.exercises.reverse();
    expect(diffPrograms(program(), after)).toContain('"A günü": egzersiz sırası değişti');
  });
});

describe('antrenman kaydı ve performans', () => {
  it('kayıt doğrulanır', () => {
    const ok = { date: '2026-06-01', entries: [{ name: 'Squat', sets: [{ reps: 10, loadKg: 20 }] }] };
    expect(workoutLogSchema.safeParse(ok).success).toBe(true);
    expect(workoutLogSchema.safeParse({ ...ok, entries: [] }).success).toBe(false);
    expect(workoutLogSchema.safeParse({ ...ok, rpe: 11 }).success).toBe(false);
    expect(workoutLogSchema.safeParse({ ...ok, entries: [{ name: 'Squat', sets: [{ reps: 10, loadKg: 900 }] }] }).success).toBe(false);
  });

  it('egzersiz başına en yüksek yük, toplam tekrar ve hacim; tarih sırasıyla', () => {
    const perf = performanceByExercise([
      { date: '2026-06-03', entries: [{ exerciseId: 'e1', name: 'Squat', sets: [{ reps: 8, loadKg: 25 }, { reps: 8, loadKg: 25 }] }] },
      { date: '2026-06-01', entries: [{ exerciseId: 'e1', name: 'Squat', sets: [{ reps: 10, loadKg: 20 }, { reps: 10, loadKg: 22.5 }] }, { name: 'Plank', sets: [{ reps: 1 }] }] },
    ]);
    const squat = perf.find((p) => p.key === 'e1')!;
    expect(squat.sessions).toEqual([
      { date: '2026-06-01', bestLoadKg: 22.5, totalReps: 20, volumeKg: 425 },
      { date: '2026-06-03', bestLoadKg: 25, totalReps: 16, volumeKg: 400 },
    ]);
    expect(perf.find((p) => p.name === 'Plank')!.sessions[0]).toMatchObject({ bestLoadKg: null, volumeKg: 0 });
  });
});
