// Haftalık uyarlama (TASLAK KURALLAR: antrenör incelemesine açık). Her hafta daha zor olmak ZORUNDA DEĞİLDİR.
//
//   Güvenlik önceliklidir:
//     G1  Bir harekette ağrı bildirilirse o hareket ve aynı bölgeyi yükleyen hareketler sonraki haftalarda çıkarılır,
//         yerine uygun alternatif konur; o hafta hiçbir harekette artış yapılmaz.
//     G2  Şiddetli ağrı, ya da bir haftada 3 ağrı bildirimi → "uzmana danış" işareti: hacim %30 azalır, artış yapılmaz.
//
//   Performans kuralları (ana hareketlerin tamamlanma oranı ve ortalama zorlanma, RPE 1-10):
//     P1  Tamamlanma < %50                → GERİLE: bir set ya da %15 tekrar azalt; zaten en düşükteyse bir alt basamak hareket
//     P2  Tamamlanma %50-%80              → AYNI TUT
//     P3  Tamamlanma ≥ %80 ve RPE ≥ 9     → AYNI TUT (çok zorlandı)
//     P4  Tamamlanma ≥ %80 ve RPE ≤ 5     → İLERLE (2 adım)
//     P5  Tamamlanma ≥ %80, RPE 6-8 ya da bildirilmemiş → İLERLE (1 adım)
//     Hafta 2 en fazla 1 adım (kontrollü ilerleme). Hafta 4 değerlendirmedir: hacim artmaz.
//
//   Bir ilerleme adımı: tekrar +2 (üst sınır başlangıcın 1,5 katı) / süre +5 sn (üst sınır 1,75 katı) → sonra set +1 (en fazla 4)
//   → tavana ulaşıldıysa bir üst basamak hareket (progressTo), baştan başlanır.
import { PLAN_META } from '../plan-meta.js';
import type { BodyArea } from '../plan-types.js';
import { AREA_TITLES } from '../plan-types.js';
import { dayEstimates, isEligible, itemOf, prescribe, replacementFor, type DaySpec, type EntrySpec, type PlanParams } from './base.js';

export interface EntryLog {
  dayNumber: number;
  entryIndex: number;
  status: 'DONE' | 'SKIPPED';
  rpe: number | null;
  painArea: BodyArea | null;
  painSharp: boolean;
  // Kullanıcı "ağrı var" dedi mi (bölge belirtmese de)
  pain: boolean;
}

export type Action = 'REGRESS' | 'HOLD' | 'PROGRESS';
export interface Decision {
  action: Action;
  steps: 0 | 1 | 2;
  reasons: string[];
}

export interface WeekStats {
  planned: number;
  done: number;
  avgRpe: number | null;
  painCount: number;
  sharpPain: boolean;
}

export function weekStats(days: DaySpec[], logs: EntryLog[]): WeekStats {
  let planned = 0;
  let done = 0;
  const rpes: number[] = [];
  for (const d of days) {
    if (d.kind !== 'TRAINING') continue;
    for (const e of d.entries) {
      if (e.section !== 'MAIN' || e.optional) continue;
      planned += 1;
      const log = logs.find((l) => l.dayNumber === d.dayNumber && l.entryIndex === e.index);
      if (log?.status === 'DONE') {
        done += 1;
        if (log.rpe !== null) rpes.push(log.rpe);
      }
    }
  }
  const pains = logs.filter((l) => l.pain || l.painArea !== null || l.painSharp);
  return {
    planned,
    done,
    avgRpe: rpes.length ? rpes.reduce((a, b) => a + b, 0) / rpes.length : null,
    painCount: pains.length,
    sharpPain: pains.some((l) => l.painSharp),
  };
}

export function decideWeek(stats: WeekStats, justFinishedWeek: number): Decision & { needsProfessional: boolean } {
  const reasons: string[] = [];
  const needsProfessional = stats.sharpPain || stats.painCount >= 3;
  if (needsProfessional) reasons.push('Ağrı bildirimlerin nedeniyle bu hafta artış yapılmadı; bir uzmana danışmanı öneririz.');
  if (stats.planned === 0) return { action: 'HOLD', steps: 0, reasons: [...reasons, 'Bu haftada değerlendirilecek antrenman yoktu; plan aynı kaldı.'], needsProfessional };
  const rate = stats.done / stats.planned;
  const pct = Math.round(rate * 100);
  let decision: Decision;
  if (rate < 0.5) decision = { action: 'REGRESS', steps: 1, reasons: [`Tamamlama oranın %${pct}: hacim hafifletildi.`] };
  else if (rate < 0.8) decision = { action: 'HOLD', steps: 0, reasons: [`Tamamlama oranın %${pct}: plan aynı bırakıldı.`] };
  else if (stats.avgRpe !== null && stats.avgRpe >= 9) decision = { action: 'HOLD', steps: 0, reasons: [`Tamamlama %${pct} ama zorlanman çok yüksekti: plan aynı bırakıldı.`] };
  else if (stats.avgRpe !== null && stats.avgRpe <= 5) decision = { action: 'PROGRESS', steps: 2, reasons: [`Tamamlama %${pct}, zorlanman düşüktü: ilerleme sağlandı.`] };
  else decision = { action: 'PROGRESS', steps: 1, reasons: [`Tamamlama %${pct}: kontrollü ilerleme sağlandı.`] };
  // Hafta 2: kontrollü ilerleme (en fazla 1 adım); hafta 4: değerlendirme (artış yok)
  if (decision.action === 'PROGRESS' && justFinishedWeek <= 1) decision = { ...decision, steps: 1 };
  if (decision.action === 'PROGRESS' && (needsProfessional || stats.painCount > 0)) decision = { action: 'HOLD', steps: 0, reasons: [...decision.reasons.slice(0, 0), 'Ağrı bildirimin olduğu için artış yapılmadı.'] };
  if (justFinishedWeek >= 3 && decision.action === 'PROGRESS') decision = { action: 'HOLD', steps: 0, reasons: ['Değerlendirme haftası: yük artırılmadı, mevcut seviyen ölçülür.'] };
  return { ...decision, reasons: [...reasons, ...decision.reasons], needsProfessional };
}

type Rx = Pick<EntrySpec, 'sets' | 'reps' | 'seconds' | 'perSide' | 'restSec'>;

// Bir ilerleme adımı. Tavana ulaşıldıysa atCeiling döner.
export function stepUp(id: string, rx: Rx): { rx: Rx; atCeiling: boolean } {
  const base = itemOf(id).work!;
  const next: Rx = { ...rx };
  if (rx.reps !== undefined && base.reps !== undefined) {
    if (rx.reps < Math.round(base.reps * 1.5)) {
      next.reps = Math.min(Math.round(base.reps * 1.5), rx.reps + 2);
      return { rx: next, atCeiling: false };
    }
  } else if (rx.seconds !== undefined && base.seconds !== undefined) {
    if (rx.seconds < Math.round(base.seconds * 1.75)) {
      next.seconds = Math.min(Math.round(base.seconds * 1.75), rx.seconds + 5);
      return { rx: next, atCeiling: false };
    }
  }
  if (rx.sets < 4) return { rx: { ...rx, sets: rx.sets + 1 }, atCeiling: false };
  return { rx, atCeiling: true };
}

export function stepDown(id: string, rx: Rx): { rx: Rx; atFloor: boolean } {
  if (rx.sets > 2) return { rx: { ...rx, sets: rx.sets - 1 }, atFloor: false };
  if (rx.reps !== undefined && rx.reps > 6) return { rx: { ...rx, reps: Math.max(6, Math.round(rx.reps * 0.85)) }, atFloor: false };
  if (rx.seconds !== undefined && rx.seconds > 15) return { rx: { ...rx, seconds: Math.max(15, Math.round((rx.seconds * 0.85) / 5) * 5) }, atFloor: false };
  return { rx, atFloor: true };
}

export interface DerivedWeek {
  days: DaySpec[];
  restrictedAreas: BodyArea[];
  needsProfessional: boolean;
  // Açıklama kaydı (kullanıcıya ve uzmana gösterilebilir)
  log: string[];
}

// Önceki haftadan sonraki haftayı türetir
export function deriveWeek(prev: DaySpec[], logs: EntryLog[], p: PlanParams, nextWeek: number): DerivedWeek {
  const stats = weekStats(prev, logs);
  const decision = decideWeek(stats, nextWeek - 1);
  const log: string[] = [...decision.reasons];

  // G1: ağrı bildirilen hareketlerin bölgeleri kısıta eklenir
  const restricted = new Set<BodyArea>(p.restrictedAreas);
  const painful = new Set<string>();
  for (const l of logs) {
    if (!(l.pain || l.painArea || l.painSharp)) continue;
    const day = prev.find((d) => d.dayNumber === l.dayNumber);
    const entry = day?.entries.find((e) => e.index === l.entryIndex);
    if (!entry) continue;
    painful.add(entry.itemId);
    const areas = l.painArea ? [l.painArea] : (PLAN_META[entry.itemId]?.stress ?? []);
    for (const a of areas) restricted.add(a);
    if (l.painArea) log.push(`${AREA_TITLES[l.painArea]} ağrın nedeniyle bu bölgeyi yükleyen hareketler çıkarıldı.`);
  }
  const params: PlanParams = { ...p, restrictedAreas: [...restricted], needsProfessional: p.needsProfessional || decision.needsProfessional };
  const maxLevel = Math.min(3, p.level + (nextWeek >= 3 ? 1 : 0));

  const days: DaySpec[] = prev.map((d) => {
    const dayNumber = d.dayNumber + 7;
    if (d.kind === 'REST') {
      return { ...d, dayNumber, weekNumber: nextWeek, entries: d.entries.map((e) => ({ ...e })) };
    }
    const taken = new Set(d.entries.map((e) => e.itemId));
    const entries: EntrySpec[] = [];
    for (const e of d.entries) {
      let cur: EntrySpec = { ...e };
      delete cur.originalItemId;
      const meta = PLAN_META[e.itemId];
      const mustChange = painful.has(e.itemId) || !isEligible(e.itemId, params, maxLevel);
      if (mustChange) {
        const alt = replacementFor(e.itemId, params, taken, maxLevel);
        if (!alt) {
          log.push(`${itemOf(e.itemId).title} güvenli bir alternatif bulunamadığı için çıkarıldı.`);
          continue;
        }
        taken.add(alt);
        cur = { ...cur, itemId: alt, ...prescribe(alt, params, e.section === 'MAIN' ? 'MAIN' : e.section === 'RECOVERY' ? 'COOLDOWN' : e.section), originalItemId: e.itemId, rationale: `${itemOf(e.itemId).title} yerine, ağrı/kısıt nedeniyle uygun alternatif seçildi.` };
        log.push(`${itemOf(e.itemId).title} → ${itemOf(alt).title} (güvenlik).`);
        entries.push(cur);
        continue;
      }
      if (e.section === 'MAIN' && !e.optional && meta) {
        const forced = decision.needsProfessional ? ({ action: 'REGRESS', steps: 1 } as const) : decision;
        if (forced.action === 'PROGRESS') {
          let rx: Rx = { sets: cur.sets, reps: cur.reps, seconds: cur.seconds, perSide: cur.perSide, restSec: cur.restSec };
          let ceiling = false;
          for (let i = 0; i < forced.steps; i++) {
            const r = stepUp(cur.itemId, rx);
            rx = r.rx;
            ceiling = r.atCeiling;
            if (ceiling) break;
          }
          if (ceiling && meta.progressTo && isEligible(meta.progressTo, params, maxLevel) && !taken.has(meta.progressTo)) {
            taken.add(meta.progressTo);
            cur = { ...cur, itemId: meta.progressTo, ...prescribe(meta.progressTo, params, 'MAIN'), originalItemId: e.itemId, rationale: `${itemOf(e.itemId).title} hareketinde tavana ulaştın; bir üst basamağa geçildi.` };
            log.push(`${itemOf(e.itemId).title} → ${itemOf(meta.progressTo).title} (ilerleme).`);
          } else {
            cur = { ...cur, ...rx, rationale: `${cur.rationale.split(' | ')[0]} | Geçen hafta performansına göre ilerletildi.` };
          }
        } else if (forced.action === 'REGRESS') {
          const r = stepDown(cur.itemId, { sets: cur.sets, reps: cur.reps, seconds: cur.seconds, perSide: cur.perSide, restSec: cur.restSec });
          if (r.atFloor && meta.regressTo && isEligible(meta.regressTo, params, maxLevel) && !taken.has(meta.regressTo)) {
            taken.add(meta.regressTo);
            cur = { ...cur, itemId: meta.regressTo, ...prescribe(meta.regressTo, params, 'MAIN'), originalItemId: e.itemId, rationale: `${itemOf(e.itemId).title} yerine bir alt basamak hareket seçildi.` };
            log.push(`${itemOf(e.itemId).title} → ${itemOf(meta.regressTo).title} (hafifletme).`);
          } else {
            cur = { ...cur, ...r.rx, rationale: `${cur.rationale.split(' | ')[0]} | Geçen hafta yük hafifletildi.` };
          }
        }
        // HOLD: aynı bırakılır
      }
      entries.push(cur);
    }
    const reindexed = entries.map((e, index) => ({ ...e, index }));
    return { ...d, dayNumber, weekNumber: nextWeek, entries: reindexed, ...dayEstimates(reindexed, p.intake.weightKg) };
  });

  if (nextWeek === 4) log.unshift('4. hafta değerlendirme haftasıdır: yük artırılmaz, son antrenmanlar uygulanır.');
  return { days, restrictedAreas: [...restricted], needsProfessional: params.needsProfessional, log };
}
