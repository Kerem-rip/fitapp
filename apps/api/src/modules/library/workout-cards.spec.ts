import { describe, expect, it } from 'vitest';
import { ITEMS, findItem } from './catalog.js';
import { EVIDENCE, SOURCES } from './evidence.js';
import { workText } from './library-rules.js';
import { PLAN_META } from '../personal-plan/plan-meta.js';
import { BODY_AREAS } from '../personal-plan/plan-types.js';
import { FACE_META } from './face-moves.js';
import { PACKS } from './packs.js';
import { CARDS, regionSummaries, resolveCard } from './workout-cards.js';

describe('28 günlük paketler', () => {
  it('her paket 4 hafta, her günü mevcut bir karta bağlı ve adımları var', () => {
    expect(PACKS.length).toBeGreaterThanOrEqual(8);
    for (const p of PACKS) {
      expect(p.weeks, p.id).toBe(4);
      expect(p.days.length, p.id).toBe(4 * p.daysPerWeek);
      expect(p.daysPerWeek, p.id).toBeLessThanOrEqual(7);
      for (const d of p.days) {
        expect(CARDS.some((c) => c.id === d.cardId), `${p.id}:${d.cardId}`).toBe(true);
        expect(d.steps.length, `${p.id}:${d.cardId}`).toBeGreaterThan(0);
      }
    }
  });

  it('başlıklar "28 Günde" ile başlar ve sonuç vaadi içermez (eritir, yakar, yok eder)', () => {
    for (const p of PACKS) {
      expect(p.title.startsWith('28 Günde'), p.id).toBe(true);
      expect(`${p.title} ${p.description}`.toLocaleLowerCase('tr')).not.toMatch(/erit|yağ yak|yok et|garanti ederiz|kesin sonuç/);
    }
    expect(PACKS.find((p) => p.id === 'pack-yuz')!.description).toContain('garanti edilmez');
  });
});

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

  it('kart en az bir ana hareket içerir; "doğrulama sürüyor" hareketi ana bölümde kullanılmaz (yüz hariç: kanıt uyarısı vardır)', () => {
    for (const c of CARDS) {
      const main = c.sections.filter((s) => s.kind === 'MAIN').flatMap((s) => s.items);
      expect(main.length, c.id).toBeGreaterThan(0);
      if (c.category === 'face') continue;
      for (const i of main) expect(EVIDENCE[i.itemId]?.verification, `${c.id}:${i.itemId}`).not.toBe('held');
    }
  });

  it('fitness bölgelerinde her ANA hareket yalnızca tek bir bölgede yer alır (tekrar yok)', () => {
    const regions = ['hip', 'legs', 'chest', 'back', 'shoulder', 'arms', 'core'];
    const owner = new Map<string, string>();
    for (const c of CARDS.filter((x) => regions.includes(x.regionKey))) {
      for (const s of c.sections.filter((x) => x.kind === 'MAIN')) {
        for (const i of s.items) {
          const prev = owner.get(i.itemId);
          expect(prev === undefined || prev === c.regionKey, `${i.itemId}: ${prev} ve ${c.regionKey}`).toBe(true);
          owner.set(i.itemId, c.regionKey);
        }
      }
    }
    expect(owner.size).toBeGreaterThan(60);
  });

  it('bölge özetleri: her bölgede kart ve hareket var; yüz bölgeleri dahil', () => {
    const regions = regionSummaries();
    expect(regions.length).toBeGreaterThanOrEqual(21);
    for (const r of regions) {
      expect(r.cardCount, r.key).toBeGreaterThan(0);
      expect(r.moveCount, r.key).toBeGreaterThan(0);
    }
    expect(regions.some((r) => r.key === 'face-cene')).toBe(true);
  });

  it('yüz egzersizi ve masaj hareketleri çok sayıda (60+) ve hepsinin bölge/tür kaydı var', () => {
    const face = ITEMS.filter((i) => i.kind === 'FACE');
    expect(face.length).toBeGreaterThanOrEqual(60);
    for (const i of face) expect(FACE_META[i.id], i.id).toBeDefined();
    expect(face.filter((i) => FACE_META[i.id]!.type === 'ms').length).toBeGreaterThanOrEqual(25);
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
    for (const k of ['fitness', 'yoga', 'pilates', 'posture', 'cardio', 'mobility', 'sport', 'face']) expect(cats.has(k as never), k).toBe(true);
    expect(CARDS.length).toBeGreaterThanOrEqual(60);
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
