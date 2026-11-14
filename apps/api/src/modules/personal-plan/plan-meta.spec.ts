import { findItem, ITEMS } from '../library/catalog.js';
import { META_IDS, PLAN_META, planItems } from './plan-meta.js';
import { PLAN_CATEGORIES, SUBCATEGORIES } from './plan-types.js';

describe('program hareket meta verisi', () => {
  it('her meta kaydı kütüphanede var olan, set/tekrar bilgisi olan bir harekete bağlıdır', () => {
    for (const id of META_IDS) {
      const item = findItem(id);
      expect(item, id).toBeDefined();
      expect(item!.work, id).toBeDefined();
      expect(item!.steps.length, id).toBeGreaterThan(0);
    }
  });

  it('alternatifler, bir üst/alt basamaklar ve alt kategoriler geçerli kayıtlara işaret eder', () => {
    for (const [id, m] of Object.entries(PLAN_META)) {
      for (const alt of m.alternatives) expect(PLAN_META[alt], `${id} → ${alt}`).toBeDefined();
      if (m.progressTo) expect(PLAN_META[m.progressTo], `${id} ↑`).toBeDefined();
      if (m.regressTo) expect(PLAN_META[m.regressTo], `${id} ↓`).toBeDefined();
      expect(m.alternatives, id).not.toContain(id);
      for (const c of m.categories) expect(SUBCATEGORIES[c.category].some((s) => s.id === c.subcategory), `${id} ${c.subcategory}`).toBe(true);
      // Basamaklar: üst basamak daha zor ya da eşit, alt basamak daha kolay ya da eşit olmalı
      if (m.progressTo) expect(PLAN_META[m.progressTo]!.level).toBeGreaterThanOrEqual(m.level);
      if (m.regressTo) expect(PLAN_META[m.regressTo]!.level).toBeLessThanOrEqual(m.level);
    }
  });

  it('7 ana kategori ve alt kategorileri tanımlı; kütüphane kimlikleri benzersiz', () => {
    expect(PLAN_CATEGORIES).toHaveLength(7);
    for (const c of PLAN_CATEGORIES) expect(SUBCATEGORIES[c].length).toBeGreaterThan(0);
    expect(new Set(ITEMS.map((i) => i.id)).size).toBe(ITEMS.length);
    expect(planItems().length).toBe(META_IDS.length);
  });

  it('yüksek etkili hareketler diz/ayak bileği yükler', () => {
    for (const [id, m] of Object.entries(PLAN_META)) {
      if (m.highImpact) expect(m.stress.some((a) => a === 'KNEE' || a === 'ANKLE'), id).toBe(true);
    }
  });
});
