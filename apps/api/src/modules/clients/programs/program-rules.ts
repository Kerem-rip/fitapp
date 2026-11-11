// Program onay kontrolleri ve sürüm farkı. SAF fonksiyonlar.
//
// KURALLAR (güvenlik bilgisi; sportif/tıbbi eşik değil):
//  - Danışanın sağlık durumu ve hamilelik/emzirme bilgisi bilinmeden (yanıtsız ya da paylaşılmıyorsa) program ONAYLANAMAZ.
//  - Boş program veya egzersizsiz gün onaylanamaz.
// Danışanın beyan ettiği sağlık durumu, ilaç, hamilelik, yeme bozukluğu öyküsü ve ağrı bildirimi onayı engellemez;
// açık madde olarak uyarı olur ve antrenör açıkça onaylamalıdır (sorumluluk uzmandadır).
import type { ProgramContent, ProgramDay, ProgramExercise } from './program-content.js';

export interface HealthInfo {
  // std.conditions ve std.pregnancy yanıtlı ve uzmana görünür mü
  known: boolean;
}

export interface ProgramBlocker {
  code: 'EMPTY_PROGRAM' | 'DAY_WITHOUT_EXERCISES' | 'HEALTH_INFO_MISSING';
  message: string;
  dayId?: string;
}

export function checkProgram(content: ProgramContent, health: HealthInfo): ProgramBlocker[] {
  const blockers: ProgramBlocker[] = [];
  if (content.days.length === 0) blockers.push({ code: 'EMPTY_PROGRAM', message: 'Program boş; en az bir gün ekle.' });
  for (const day of content.days) {
    if (day.exercises.length === 0) blockers.push({ code: 'DAY_WITHOUT_EXERCISES', message: `"${day.name}" gününde egzersiz yok.`, dayId: day.id });
  }
  if (!health.known) {
    blockers.push({
      code: 'HEALTH_INFO_MISSING',
      message: 'Danışanın sağlık durumu ve hamilelik/emzirme bilgisi yok veya paylaşılmıyor. Bu bilgiler olmadan program onaylanamaz.',
    });
  }
  return blockers;
}

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

function exerciseChanges(day: ProgramDay, before: ProgramExercise, after: ProgramExercise): string[] {
  const where = `"${day.name}" › "${after.name}"`;
  const lines: string[] = [];
  if (before.name !== after.name) lines.push(`${where}: ad "${before.name}" → "${after.name}"`);
  if (before.sets !== after.sets || before.reps !== after.reps) lines.push(`${where}: ${before.sets}×${before.reps} → ${after.sets}×${after.reps}`);
  if ((before.load ?? '') !== (after.load ?? '')) lines.push(`${where}: yük ${before.load ?? '—'} → ${after.load ?? '—'}`);
  if (before.restSec !== after.restSec) lines.push(`${where}: dinlenme ${before.restSec ?? '—'} → ${after.restSec ?? '—'} sn`);
  if ((before.notes ?? '') !== (after.notes ?? '')) lines.push(`${where}: not değişti`);
  return lines;
}

export function diffPrograms(before: ProgramContent | null, after: ProgramContent): string[] {
  if (!before) {
    const count = after.days.reduce((sum, d) => sum + d.exercises.length, 0);
    return [`İlk sürüm: ${after.days.length} gün, ${count} egzersiz`];
  }
  const lines: string[] = [];
  if ((before.title ?? '') !== (after.title ?? '')) lines.push('Başlık değişti');
  if ((before.goal ?? '') !== (after.goal ?? '')) lines.push('Program hedefi değişti');
  if (before.weeks !== after.weeks) lines.push(`Süre ${before.weeks ?? '—'} → ${after.weeks ?? '—'} hafta`);
  if ((before.notes ?? '') !== (after.notes ?? '')) lines.push('Genel notlar değişti');
  const beforeDays = new Map(before.days.map((d) => [d.id, d]));
  const afterDays = new Map(after.days.map((d) => [d.id, d]));
  for (const d of before.days) if (!afterDays.has(d.id)) lines.push(`Gün kaldırıldı: "${d.name}"`);
  for (const d of after.days) {
    const prev = beforeDays.get(d.id);
    if (!prev) {
      lines.push(`Gün eklendi: "${d.name}" (${d.exercises.length} egzersiz)`);
      continue;
    }
    if (prev.name !== d.name) lines.push(`Gün adı "${prev.name}" → "${d.name}"`);
    if ((prev.focus ?? '') !== (d.focus ?? '')) lines.push(`"${d.name}": odak değişti`);
    const prevEx = new Map(prev.exercises.map((e) => [e.id, e]));
    const nextEx = new Map(d.exercises.map((e) => [e.id, e]));
    for (const e of prev.exercises) if (!nextEx.has(e.id)) lines.push(`"${d.name}": egzersiz kaldırıldı "${e.name}"`);
    for (const e of d.exercises) {
      const b = prevEx.get(e.id);
      if (!b) lines.push(`"${d.name}": egzersiz eklendi "${e.name}"`);
      else lines.push(...exerciseChanges(d, b, e));
    }
    // Sadece iki sürümde de olan egzersizlerin sırası karşılaştırılır
    if (!same(prev.exercises.map((e) => e.id).filter((id) => nextEx.has(id)), d.exercises.map((e) => e.id).filter((id) => prevEx.has(id)))) {
      lines.push(`"${d.name}": egzersiz sırası değişti`);
    }
  }
  return lines.length > 0 ? lines : ['İçerikte değişiklik yok'];
}
