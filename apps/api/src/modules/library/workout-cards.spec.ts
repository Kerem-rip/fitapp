import { describe, expect, it } from 'vitest';
import { ITEMS, findItem } from './catalog.js';
import { EVIDENCE, SOURCES } from './evidence.js';
import { workText } from './library-rules.js';
import { PLAN_META } from '../personal-plan/plan-meta.js';
import { BODY_AREAS } from '../personal-plan/plan-types.js';
import { CARDS, resolveCard } from './workout-cards.js';

describe('kanıt katmanı', () => {
  it('her kanıt kaydı mevcut bir harekete bağlı ve kaynakları tanımlı', () => {
    for (const [id, ev] of Object.entries(EVIDENCE)) {
      expect(findItem(id), id).toBeTruthy();
      for (const s of ev.sources) expect(SOURCES[s], `${id}:${s}`).toBeTruthy();
      for (const a of ev.alternatives) expect(findItem(a.id), `${id}->${a.id}`).toBeTruthy();
      if (ev.variationOf) expect(findItem(ev.variationOf), `${id} varyasyon`).toBeTruthy();
    }
  });

  it('"doğrulandı" demek için en az iki kaynak gerekir, "kısmen" için en az bir', () => {
    for (const [id, ev] of Object.entries(EVIDENCE)) {
      if (ev.verification === 'ok') expect(ev.sources.length, id).toBeGreaterThanOrEqual(2);
      if (ev.verification === 'partial') expect(ev.sources.length, id).toBeGreaterThanOrEqual(1);
    }
  });

  it('hareket kimlikleri tekrar etmez', () => {
    const ids = ITEMS.map((i) => i.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('bir hareketin alternatifi kendisi değildir (EASIER/HARDER)', () => {
    for (const [id, ev] of Object.entries(EVIDENCE)) for (const a of ev.alternatives) if (a.type !== 'EQUIVALENT') expect(a.id, id).not.toBe(id);
  });

  it('yüz egzersizleri "doğrulandı" olarak etiketlenmez', () => {
    for (const id of ['face-temple', 'face-brow', 'face-cheek']) expect(EVIDENCE[id]!.verification).toBe('held');
  });
});

describe('antrenman kartları', () => {
  it('kart kimlikleri benzersiz; her hareket katalogda ve yapılışı tanımlı', () => {
    expect(new Set(CARDS.map((c) => c.id)).size).toBe(CARDS.length);
    for (const c of CARDS) {
      for (const s of c.sections) for (const i of s.items) expect(findItem(i.itemId)?.work, `${c.id}:${i.itemId}`).toBeTruthy();
    }
  });

  it('kart en az bir ana hareket içerir; "doğrulama sürüyor" hareketi ana bölümde kullanılmaz', () => {
    for (const c of CARDS) {
      const main = c.sections.filter((s) => s.kind === 'MAIN').flatMap((s) => s.items);
      expect(main.length, c.id).toBeGreaterThan(0);
      for (const i of main) expect(EVIDENCE[i.itemId]?.verification, `${c.id}:${i.itemId}`).not.toBe('held');
    }
  });

  it('her kartta hareket sırası ve dinlenme açık: dinlenme 0 ya da pozitif, son hareketten sonra dinlenme yok', () => {
    for (const c of CARDS) {
      const r = resolveCard(c, [], workText);
      const flat = r.sections.flatMap((s) => s.items);
      expect(flat.map((i) => i.order), c.id).toEqual(flat.map((_, i) => i + 1));
      for (const i of flat) expect(i.restAfterSec, `${c.id}:${i.itemId}`).toBeGreaterThanOrEqual(0);
      expect(flat.at(-1)!.restAfterSec, c.id).toBe(0);
      expect(r.sections.some((s) => s.kind === 'MAIN'), c.id).toBe(true);
    }
  });

  it('ekipman ve ortam hareketlerden çıkar: salon hareketi olan kart "gym"', () => {
    expect(CARDS.find((c) => c.id === 'legs-gym')!.setting).toBe('gym');
    expect(CARDS.find((c) => c.id === 'fullbody-home')!.setting).toBe('home');
    expect(CARDS.find((c) => c.id === 'fullbody-home')!.equipment).toEqual([]);
  });

  it('her kategoride en az bir kart var; kart sayısı yeterli', () => {
    const cats = new Set(CARDS.map((c) => c.category));
    for (const k of ['fitness', 'yoga', 'pilates', 'posture', 'cardio', 'mobility', 'sport']) expect(cats.has(k as never), k).toBe(true);
    expect(CARDS.length).toBeGreaterThanOrEqual(35);
  });

  it('her kartın dayanağı yazılı', () => {
    for (const c of CARDS) expect(c.basis.length, c.id).toBeGreaterThan(0);
  });

  it('kısıt yokken kart değişmez; süre ve hareket sayısı hesaplanır', () => {
    const r = resolveCard(CARDS.find((c) => c.id === 'chair-start')!, [], workText);
    expect(r.swapped).toEqual([]);
    expect(r.moveCount).toBe(7);
    expect(r.sections[0]!.items[0]!.order).toBe(1);
    expect(r.estimatedMinutes).toBeGreaterThan(5);
  });

  it('kısıt seçilen bölgeyi yükleyen hiçbir hareket kartta kalmaz', () => {
    for (const area of BODY_AREAS) {
      for (const c of CARDS) {
        const r = resolveCard(c, [area], workText);
        for (const i of r.sections.flatMap((s) => s.items)) {
          expect(PLAN_META[i.itemId]?.stress ?? [], `${c.id}/${area}/${i.itemId}`).not.toContain(area);
        }
      }
    }
  });

  it('diz kısıtında yüksek etkili hareket çıkarılır ya da değiştirilir', () => {
    const r = resolveCard(CARDS.find((c) => c.id === 'cardio-agility')!, ['KNEE'], workText);
    for (const i of r.sections.flatMap((s) => s.items)) expect(PLAN_META[i.itemId]?.highImpact ?? false, i.itemId).toBe(false);
    expect(r.swapped.length).toBeGreaterThan(0);
  });

  it('yoga kartı güç sırasını kullanmaz: ana bölüm başlığı "Ana duruşlar"', () => {
    const r = resolveCard(CARDS.find((c) => c.id === 'yoga-calm')!, [], workText);
    expect(r.sections.map((s) => s.title)).toContain('Ana duruşlar');
  });
});
