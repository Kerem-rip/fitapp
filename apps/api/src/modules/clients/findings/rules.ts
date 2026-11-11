// Uzman inceleme özeti kuralları. SAF fonksiyonlar: veritabanına dokunmaz, aynı girdiye aynı sonucu verir.
//
// İLKELER
//  - Maddeler otomatik TUTARLILIK kontrolleridir: eksik/eski bilgi, danışanın kendi beyanı, ölçüm tutarsızlığı.
//    Tanı koymaz, tedavi veya diyet kararı vermez. Dil: "doğrula", "sor", "kendi değerlendirmen".
//  - Eksik bilgi varsa kesin sonuç üretilmez; bunun yerine "önce şu bilgiyi doğrula" maddesi çıkar.
//  - Her madde hangi bilgiye dayandığını gösterir (`basis`).
//  - KLİNİK kural (eşik, hastalık-diyet eşleşmesi vb.) şimdilik YOKTUR. Eklenirse `kind: 'CLINICAL'` olur ve
//    bir uzman onaylayana kadar (`reviewed: false`) hiç çalışmaz.
//  - Aşağıdaki gün/yüzde değerleri klinik eşik değil, veri kalitesi ayarıdır; yine de uzman gözden geçirmesi bekler
//    (bkz. apps/api/src/modules/clients/README.md "Doğrulanacaklar").
import type { MeasurementKind, MeasurementMethod, SharedDataType } from '../../../generated/prisma/enums.js';
import {
  describeAnswer,
  standardQuestion,
  STANDARD_QUESTIONS,
  type AnswerValue,
} from '../intake-template.js';
import { MEASUREMENT_SPECS } from '../measurement-rules.js';
import type { PlanContent } from '../plans/plan-content.js';
import { conflictText, findConflicts } from '../plans/plan-rules.js';

export type Level = 'RED' | 'YELLOW' | 'GREEN';

export const RULE_PARAMS = {
  weightStaleDays: 30,
  anamnesisStaleDays: 180,
  weightJumpPercent: 10,
  weightJumpWithinDays: 14,
  mixedMethodWindowDays: 120,
  sharingExpiringDays: 7,
} as const;

export interface BasisRef {
  type: 'ANSWER' | 'MEASUREMENT' | 'MISSING' | 'SHARING' | 'PLAN';
  label: string;
  display: string;
  at: string | null;
}

export interface Candidate {
  ruleCode: string;
  level: Level;
  title: string;
  detail: string;
  categories: SharedDataType[];
  basis: BasisRef[];
  // Parmak izine girer: dayanak değişince yeni madde açılır
  key: string;
}

export interface MeasurementPoint {
  id: string;
  kind: MeasurementKind;
  value: number;
  method: MeasurementMethod;
  takenAt: Date;
}

export interface RuleInput {
  now: Date;
  allowed: ReadonlySet<SharedDataType>;
  sharedUntil: Date | null;
  // Sadece standart sorular; ANAMNESIS paylaşılmıyorsa boş
  answers: ReadonlyMap<string, { value: AnswerValue; answeredAt: Date }>;
  // Sadece geçerli (geçersiz sayılmamış) ve paylaşılan türler; en yeniden eskiye
  measurements: readonly MeasurementPoint[];
  // Danışana yayında olan plan sürümü (varsa)
  plan?: { versionNumber: number; content: PlanContent } | null;
}

export interface RuleDef {
  code: string;
  level: Level;
  kind: 'MECHANICAL' | 'CLINICAL';
  // CLINICAL kurallar uzman onayı olmadan çalışmaz
  reviewed: boolean;
  description: string;
  run(input: RuleInput): Candidate[];
}

// ───────────── Yardımcılar ─────────────

const DAY_MS = 86_400_000;
const daysBetween = (a: Date, b: Date) => Math.floor((a.getTime() - b.getTime()) / DAY_MS);

// "yok", "hayır" gibi anlamsız serbest metinler madde üretmesin
const TRIVIAL = new Set(['yok', 'yoktur', 'hayır', 'hayir', 'kullanmıyorum', 'kullanmiyorum', 'hiçbiri', 'hicbiri', '-', '.']);
const isTrivialText = (value: AnswerValue | undefined) =>
  typeof value !== 'string' || TRIVIAL.has(value.trim().toLocaleLowerCase('tr').replace(/[.!\s]+$/g, ''));

const def = (key: string) => standardQuestion(key)!;

function answerBasis(input: RuleInput, key: string): BasisRef[] {
  const a = input.answers.get(key);
  if (!a) return [];
  const d = def(key);
  return [{ type: 'ANSWER', label: d.text, display: describeAnswer(d, a.value), at: a.answeredAt.toISOString() }];
}

const measurementBasis = (m: MeasurementPoint, label: string): BasisRef => ({
  type: 'MEASUREMENT',
  label,
  display: `${m.value.toLocaleString('tr-TR')} ${MEASUREMENT_SPECS[m.kind].unit} · ${m.takenAt.toISOString().slice(0, 10)}`,
  at: m.takenAt.toISOString(),
});

const KIND_LABEL: Record<MeasurementKind, string> = {
  WEIGHT: 'Kilo',
  HEIGHT: 'Boy',
  WAIST: 'Bel çevresi',
  HIP: 'Kalça çevresi',
  CHEST: 'Göğüs çevresi',
  ARM: 'Kol çevresi',
  THIGH: 'Bacak çevresi',
  BODY_FAT_PERCENT: 'Vücut yağ oranı',
  MUSCLE_MASS: 'Kas kütlesi',
  BODY_WATER_PERCENT: 'Vücut su oranı',
};

const METHOD_LABEL: Record<MeasurementMethod, string> = {
  SCALE: 'Tartı',
  TAPE: 'Mezura',
  CALIPER: 'Kaliper',
  BIA: 'BIA cihazı',
  DEXA: 'DEXA',
  SELF_REPORT: 'Kendi bildirimi',
  OTHER: 'Diğer',
};

const latest = (input: RuleInput, kind: MeasurementKind) => input.measurements.find((m) => m.kind === kind);
const weights = (input: RuleInput) => input.measurements.filter((m) => m.kind === 'WEIGHT');
const categoryOf = (kind: MeasurementKind): SharedDataType => MEASUREMENT_SPECS[kind].category;

const hasAnamnesis = (input: RuleInput) => input.allowed.has('ANAMNESIS');

// ───────────── Kurallar ─────────────

const IMPORTANT_TITLES: Record<string, string> = {
  'std.allergies': 'Alerji bilgisi yok',
  'std.conditions': 'Sağlık durumu bilgisi yok',
  'std.medications': 'İlaç ve takviye bilgisi yok',
  'std.pregnancy': 'Hamilelik veya emzirme bilgisi yok',
  'std.eating_disorder_history': 'Yeme bozukluğu öyküsü sorulmadı',
};

export const RULES: readonly RuleDef[] = [
  // ── KIRMIZI: uzman tarafından incelenmesi gereken olası riskler ──
  {
    code: 'R-EATING-DISORDER',
    level: 'RED',
    kind: 'MECHANICAL',
    reviewed: false,
    description: 'Danışan yeme bozukluğu öyküsü beyan ettiyse uzmanı uyarır (kendi beyanını yansıtır).',
    run(input) {
      const a = input.answers.get('std.eating_disorder_history');
      if (!hasAnamnesis(input) || a?.value !== 'yes') return [];
      return [
        {
          ruleCode: this.code,
          level: 'RED',
          title: 'Yeme bozukluğu öyküsü beyan edildi',
          detail:
            'Danışan geçmişte yeme bozukluğu tanısı veya tedavisi aldığını belirtti. Kalori ya da kilo hedefi içeren bir plan hazırlamadan önce bunu kendi değerlendirmenle ele almanı öneririz.',
          categories: ['ANAMNESIS'],
          basis: answerBasis(input, 'std.eating_disorder_history'),
          key: 'yes',
        },
      ];
    },
  },

  {
    code: 'R-PLAN-ALLERGEN',
    level: 'RED',
    kind: 'MECHANICAL',
    reviewed: false,
    description: 'Yayındaki planda danışanın (sonradan değişmiş olabilecek) alerjisiyle çakışan seçenek varsa uzmanı uyarır.',
    run(input) {
      const a = input.answers.get('std.allergies');
      if (!hasAnamnesis(input) || !input.plan || !a || !Array.isArray(a.value)) return [];
      const allergens = a.value.filter((v) => v !== 'none');
      return findConflicts(input.plan.content, { known: true, allergens }).map<Candidate>((c) => ({
        ruleCode: this.code,
        level: 'RED',
        title: 'Yayındaki planda alerjenle çakışan seçenek var',
        detail: `${conflictText(c)} Bu seçenek danışana şimdilik seçilemez gösteriliyor; planı gözden geçirip yeni bir sürüm yayınla.`,
        categories: ['ANAMNESIS'],
        basis: [
          ...answerBasis(input, 'std.allergies'),
          { type: 'PLAN', label: `Plan sürüm ${input.plan!.versionNumber} › ${c.mealName}`, display: c.optionName, at: null },
        ],
        key: `${input.plan!.versionNumber}:${c.mealId}:${c.optionId}:${c.kind}:${[...c.allergens].sort().join(',')}`,
      }));
    },
  },

  // ── SARI: danışanın beyanları ──
  {
    code: 'Y-CONDITIONS',
    level: 'YELLOW',
    kind: 'MECHANICAL',
    reviewed: false,
    description: 'Danışan bir sağlık durumu beyan ettiyse uzmana bildirir.',
    run(input) {
      const a = input.answers.get('std.conditions');
      if (!hasAnamnesis(input) || !a || !Array.isArray(a.value)) return [];
      const declared = a.value.filter((v) => v !== 'none');
      if (declared.length === 0) return [];
      const text = describeAnswer(def('std.conditions'), declared);
      return [
        {
          ruleCode: this.code,
          level: 'YELLOW',
          title: 'Sağlık durumu beyan edildi',
          detail: `Danışan şunları belirtti: ${text}. Bu durumlarda standart hesapların ve genel önerilerin geçerli olup olmadığına sen karar vermelisin.`,
          categories: ['ANAMNESIS'],
          basis: [...answerBasis(input, 'std.conditions'), ...(isTrivialText(input.answers.get('std.conditions_note')?.value) ? [] : answerBasis(input, 'std.conditions_note'))],
          key: [...declared].sort().join(','),
        },
      ];
    },
  },
  {
    code: 'Y-PREGNANCY',
    level: 'YELLOW',
    kind: 'MECHANICAL',
    reviewed: false,
    description: 'Hamilelik/emzirme beyanında standart hesapların otomatik geçerli sayılmadığını bildirir.',
    run(input) {
      const a = input.answers.get('std.pregnancy');
      if (!hasAnamnesis(input) || (a?.value !== 'pregnant' && a?.value !== 'breastfeeding')) return [];
      return [
        {
          ruleCode: this.code,
          level: 'YELLOW',
          title: a.value === 'pregnant' ? 'Hamilelik beyan edildi' : 'Emzirme beyan edildi',
          detail:
            'Bu durumda standart kalori hesapları otomatik olarak geçerli sayılmaz. Gerekli ek bilgileri ve kendi değerlendirmeni almadan hesaba dayalı bir plan hazırlama.',
          categories: ['ANAMNESIS'],
          basis: answerBasis(input, 'std.pregnancy'),
          key: String(a.value),
        },
      ];
    },
  },
  {
    code: 'Y-MEDICATIONS',
    level: 'YELLOW',
    kind: 'MECHANICAL',
    reviewed: false,
    description: 'Danışan düzenli ilaç/takviye yazdıysa uzmana bildirir.',
    run(input) {
      const a = input.answers.get('std.medications');
      if (!hasAnamnesis(input) || !a || isTrivialText(a.value)) return [];
      return [
        {
          ruleCode: this.code,
          level: 'YELLOW',
          title: 'Düzenli ilaç veya takviye beyan edildi',
          detail: `Danışan şunu yazdı: "${String(a.value)}". Plan hazırlamadan önce bunu kendi değerlendirmene dahil et; gerekirse danışanın doktoruyla görüşmesini iste.`,
          categories: ['ANAMNESIS'],
          basis: answerBasis(input, 'std.medications'),
          key: String(a.value),
        },
      ];
    },
  },
  {
    code: 'Y-ALLERGY-OTHER',
    level: 'YELLOW',
    kind: 'MECHANICAL',
    reviewed: false,
    description: 'Listede olmayan alerji/intolerans notu varsa uzmana bildirir.',
    run(input) {
      const a = input.answers.get('std.allergy_other');
      if (!hasAnamnesis(input) || !a || isTrivialText(a.value)) return [];
      return [
        {
          ruleCode: this.code,
          level: 'YELLOW',
          title: 'Listede olmayan alerji veya intolerans belirtildi',
          detail: `Danışan şunu yazdı: "${String(a.value)}". Bu bilgi sistem filtrelerinde yer almaz; planı hazırlarken elle dikkate al.`,
          categories: ['ANAMNESIS'],
          basis: answerBasis(input, 'std.allergy_other'),
          key: String(a.value),
        },
      ];
    },
  },

  // ── SARI: eksik veya eski bilgi ──
  {
    code: 'Y-ANAMNESIS-MISSING',
    level: 'YELLOW',
    kind: 'MECHANICAL',
    reviewed: false,
    description: 'Önemli anamnez sorularından yanıtsız olanları "danışana sor" maddesi olarak listeler.',
    run(input) {
      if (!hasAnamnesis(input)) return [];
      return STANDARD_QUESTIONS.filter((q) => q.important && !input.answers.has(q.key)).map<Candidate>((q) => ({
        ruleCode: this.code,
        level: 'YELLOW',
        title: IMPORTANT_TITLES[q.key] ?? 'Bilgi eksik',
        detail: `"${q.text}" sorusu yanıtsız. Bu bilgi olmadan kesin bir değerlendirme yapma; önce danışana sor.`,
        categories: ['ANAMNESIS'],
        basis: [{ type: 'MISSING', label: q.text, display: 'Yanıt yok', at: null }],
        key: q.key,
      }));
    },
  },
  {
    code: 'Y-ANAMNESIS-STALE',
    level: 'YELLOW',
    kind: 'MECHANICAL',
    reviewed: false,
    description: 'Sağlık öyküsü uzun süredir güncellenmediyse uyarır.',
    run(input) {
      if (!hasAnamnesis(input) || input.answers.size === 0) return [];
      const newest = [...input.answers.entries()].sort((a, b) => b[1].answeredAt.getTime() - a[1].answeredAt.getTime())[0]!;
      const age = daysBetween(input.now, newest[1].answeredAt);
      if (age <= RULE_PARAMS.anamnesisStaleDays) return [];
      return [
        {
          ruleCode: this.code,
          level: 'YELLOW',
          title: 'Sağlık öyküsü uzun süredir güncellenmedi',
          detail: `En son yanıt ${age} gün önce verildi. Bilgilerin hâlâ geçerli olup olmadığını danışana sor.`,
          categories: ['ANAMNESIS'],
          basis: answerBasis(input, newest[0]),
          key: newest[1].answeredAt.toISOString().slice(0, 10),
        },
      ];
    },
  },
  {
    code: 'Y-NO-WEIGHT',
    level: 'YELLOW',
    kind: 'MECHANICAL',
    reviewed: false,
    description: 'Kilo paylaşılıyor ama hiç ölçüm yoksa bildirir.',
    run(input) {
      if (!input.allowed.has('WEIGHT') || weights(input).length > 0) return [];
      return [
        {
          ruleCode: this.code,
          level: 'YELLOW',
          title: 'Kilo ölçümü yok',
          detail: 'Danışanın kilo ölçümü bulunmuyor. Ölçüm ekle veya danışandan iste.',
          categories: ['WEIGHT'],
          basis: [{ type: 'MISSING', label: 'Kilo', display: 'Ölçüm yok', at: null }],
          key: 'none',
        },
      ];
    },
  },
  {
    code: 'Y-WEIGHT-STALE',
    level: 'YELLOW',
    kind: 'MECHANICAL',
    reviewed: false,
    description: 'Son kilo ölçümü eskiyse uyarır.',
    run(input) {
      const w = weights(input)[0];
      if (!w) return [];
      const age = daysBetween(input.now, w.takenAt);
      if (age <= RULE_PARAMS.weightStaleDays) return [];
      return [
        {
          ruleCode: this.code,
          level: 'YELLOW',
          title: 'Son kilo ölçümü eski',
          detail: `Son kilo ölçümü ${age} gün önce alındı. Güncel bir ölçüm iste.`,
          categories: ['WEIGHT'],
          basis: [measurementBasis(w, 'Son kilo ölçümü')],
          key: w.id,
        },
      ];
    },
  },
  {
    code: 'Y-NO-HEIGHT',
    level: 'YELLOW',
    kind: 'MECHANICAL',
    reviewed: false,
    description: 'Ölçüler paylaşılıyor ama boy yoksa bildirir (kilo/boy gerektiren hesaplar için).',
    run(input) {
      if (!input.allowed.has('MEASUREMENTS') || latest(input, 'HEIGHT')) return [];
      return [
        {
          ruleCode: this.code,
          level: 'YELLOW',
          title: 'Boy ölçümü yok',
          detail: 'Boy bilgisi bulunmuyor; boya ihtiyaç duyan hesaplar yapılamaz. Ölçüm ekle veya danışandan iste.',
          categories: ['MEASUREMENTS'],
          basis: [{ type: 'MISSING', label: 'Boy', display: 'Ölçüm yok', at: null }],
          key: 'none',
        },
      ];
    },
  },
  {
    code: 'Y-WEIGHT-JUMP',
    level: 'YELLOW',
    kind: 'MECHANICAL',
    reviewed: false,
    description: 'Kısa sürede çok büyük kilo farkı varsa olası giriş hatasına karşı uyarır.',
    run(input) {
      const [newer, older] = weights(input);
      if (!newer || !older) return [];
      const gap = daysBetween(newer.takenAt, older.takenAt);
      const change = (Math.abs(newer.value - older.value) / older.value) * 100;
      if (gap < 0 || gap > RULE_PARAMS.weightJumpWithinDays || change <= RULE_PARAMS.weightJumpPercent) return [];
      return [
        {
          ruleCode: this.code,
          level: 'YELLOW',
          title: 'Kilo değerinde ani fark',
          detail: `İki ölçüm arasında ${gap} günde yaklaşık %${Math.round(change)} fark var. Bir giriş hatası olabilir; ölçümü danışanla doğrula.`,
          categories: ['WEIGHT'],
          basis: [measurementBasis(newer, 'Yeni ölçüm'), measurementBasis(older, 'Önceki ölçüm')],
          key: `${newer.id}:${older.id}`,
        },
      ];
    },
  },
  {
    code: 'Y-MIXED-METHODS',
    level: 'YELLOW',
    kind: 'MECHANICAL',
    reviewed: false,
    description: 'Aynı ölçüm türü farklı yöntemlerle alındıysa karşılaştırmanın yanıltıcı olabileceğini bildirir.',
    run(input) {
      const result: Candidate[] = [];
      const since = input.now.getTime() - RULE_PARAMS.mixedMethodWindowDays * DAY_MS;
      const kinds = new Set(input.measurements.map((m) => m.kind));
      for (const kind of kinds) {
        const recent = input.measurements.filter((m) => m.kind === kind && m.takenAt.getTime() >= since);
        const methods = [...new Set(recent.map((m) => m.method))].sort();
        if (recent.length < 2 || methods.length < 2) continue;
        result.push({
          ruleCode: this.code,
          level: 'YELLOW',
          title: `${KIND_LABEL[kind]} farklı yöntemlerle ölçülmüş`,
          detail: `Son ${RULE_PARAMS.mixedMethodWindowDays} günde ${methods.map((m) => METHOD_LABEL[m]).join(' ve ')} yöntemleri kullanılmış. Yöntemler arasında fark olabileceği için değerleri doğrudan karşılaştırırken dikkatli ol.`,
          categories: [categoryOf(kind)],
          basis: recent.slice(0, 4).map((m) => measurementBasis(m, METHOD_LABEL[m.method])),
          key: `${kind}:${methods.join(',')}:${recent[0]!.id}`,
        });
      }
      return result;
    },
  },
  {
    code: 'Y-NOT-SHARED',
    level: 'YELLOW',
    kind: 'MECHANICAL',
    reviewed: false,
    description: 'Danışanın paylaşmadığı kategorilerde değerlendirmenin eksik kalacağını bildirir.',
    run(input) {
      const labels: [SharedDataType, string, string][] = [
        ['ANAMNESIS', 'Sağlık öyküsü paylaşılmıyor', 'alerji, sağlık durumu ve yaşam tarzı'],
        ['WEIGHT', 'Kilo paylaşılmıyor', 'kilo takibi'],
        ['MEASUREMENTS', 'Vücut ölçüleri paylaşılmıyor', 'boy ve çevre ölçüleri'],
      ];
      return labels
        .filter(([category]) => !input.allowed.has(category))
        .map<Candidate>(([category, title, what]) => ({
          ruleCode: this.code,
          level: 'YELLOW',
          title,
          detail: `Danışan ${what} bilgilerini şu an paylaşmıyor; değerlendirme bu bilgiler olmadan eksik kalır. İstersen danışandan paylaşımı açmasını iste.`,
          categories: [],
          basis: [{ type: 'SHARING', label: title, display: 'Paylaşım kapalı', at: null }],
          key: category,
        }));
    },
  },
  {
    code: 'Y-SHARING-EXPIRING',
    level: 'YELLOW',
    kind: 'MECHANICAL',
    reviewed: false,
    description: 'Paylaşım süresi yakında bitecekse bildirir.',
    run(input) {
      if (!input.sharedUntil) return [];
      const left = Math.ceil((input.sharedUntil.getTime() - input.now.getTime()) / DAY_MS);
      if (left < 0 || left > RULE_PARAMS.sharingExpiringDays) return [];
      return [
        {
          ruleCode: this.code,
          level: 'YELLOW',
          title: 'Veri paylaşımı yakında bitiyor',
          detail: `Danışanın paylaşım izni ${left} gün içinde sona erecek. Sonrasında verilerine erişemezsin; devam etmek için danışandan süreyi uzatmasını iste.`,
          categories: [],
          basis: [{ type: 'SHARING', label: 'Paylaşım bitişi', display: input.sharedUntil.toISOString().slice(0, 10), at: input.sharedUntil.toISOString() }],
          key: input.sharedUntil.toISOString().slice(0, 10),
        },
      ];
    },
  },

  // ── YEŞİL: değerlendirilebilecek öneriler ──
  {
    code: 'G-ALLERGY-FILTER',
    level: 'GREEN',
    kind: 'MECHANICAL',
    reviewed: false,
    description: 'Beyan edilen alerjenleri plan hazırlarken dikkate alınacak olarak hatırlatır.',
    run(input) {
      const a = input.answers.get('std.allergies');
      if (!hasAnamnesis(input) || !a || !Array.isArray(a.value)) return [];
      const allergens = a.value.filter((v) => v !== 'none');
      if (allergens.length === 0) return [];
      return [
        {
          ruleCode: this.code,
          level: 'GREEN',
          title: 'Planda dışarıda tutulacak alerjenler',
          detail: `Beyan edilen alerjenler: ${describeAnswer(def('std.allergies'), allergens)}. Menü seçeneklerini hazırlarken bu alerjenleri içeren yiyecekleri çıkarabilirsin.`,
          categories: ['ANAMNESIS'],
          basis: answerBasis(input, 'std.allergies'),
          key: [...allergens].sort().join(','),
        },
      ];
    },
  },
  {
    code: 'G-DIET-PREFERENCE',
    level: 'GREEN',
    kind: 'MECHANICAL',
    reviewed: false,
    description: 'Beslenme tercihini plan için hatırlatır.',
    run(input) {
      const a = input.answers.get('std.diet_preference');
      if (!hasAnamnesis(input) || !a || a.value === 'none') return [];
      return [
        {
          ruleCode: this.code,
          level: 'GREEN',
          title: 'Beslenme tercihi planda dikkate alınabilir',
          detail: `Danışanın beslenme tercihi: ${describeAnswer(def('std.diet_preference'), a.value)}.`,
          categories: ['ANAMNESIS'],
          basis: answerBasis(input, 'std.diet_preference'),
          key: String(a.value),
        },
      ];
    },
  },
  {
    code: 'G-DISLIKES',
    level: 'GREEN',
    kind: 'MECHANICAL',
    reviewed: false,
    description: 'Sevilmeyen yiyecekleri plan için hatırlatır.',
    run(input) {
      const a = input.answers.get('std.dislikes');
      if (!hasAnamnesis(input) || !a || isTrivialText(a.value)) return [];
      return [
        {
          ruleCode: this.code,
          level: 'GREEN',
          title: 'Sevilmeyen yiyecekler',
          detail: `Danışan şunları yemediğini yazdı: "${String(a.value)}". Alternatifleri hazırlarken bunları dışarıda tutabilirsin.`,
          categories: ['ANAMNESIS'],
          basis: answerBasis(input, 'std.dislikes'),
          key: String(a.value),
        },
      ];
    },
  },
  {
    code: 'G-BASICS-READY',
    level: 'GREEN',
    kind: 'MECHANICAL',
    reviewed: false,
    description: 'Gerekli temel bilgiler tamamsa plan taslağına geçilebileceğini söyler.',
    run(input) {
      if (!input.allowed.has('ANAMNESIS') || !input.allowed.has('WEIGHT') || !input.allowed.has('MEASUREMENTS')) return [];
      const important = STANDARD_QUESTIONS.filter((q) => q.important);
      if (!important.every((q) => input.answers.has(q.key))) return [];
      const w = weights(input)[0];
      const h = latest(input, 'HEIGHT');
      if (!w || !h || daysBetween(input.now, w.takenAt) > RULE_PARAMS.weightStaleDays) return [];
      return [
        {
          ruleCode: this.code,
          level: 'GREEN',
          title: 'Temel bilgiler tamam',
          detail: 'Sağlık öyküsünün önemli soruları yanıtlı, güncel kilo ve boy var. Plan taslağı hazırlanabilir; taslak sen onaylamadan danışana gitmez.',
          categories: ['ANAMNESIS', 'WEIGHT', 'MEASUREMENTS'],
          basis: [...important.flatMap((q) => answerBasis(input, q.key)), measurementBasis(w, 'Güncel kilo'), measurementBasis(h, 'Boy')],
          key: `${w.id}:${h.id}`,
        },
      ];
    },
  },
];

const ORDER: Record<Level, number> = { RED: 0, YELLOW: 1, GREEN: 2 };

// Çalışması gereken kurallar: mekanikler her zaman, klinik olanlar yalnızca uzman onaylıysa
export const activeRules = () => RULES.filter((r) => r.kind === 'MECHANICAL' || r.reviewed);

export function evaluate(input: RuleInput): Candidate[] {
  return activeRules()
    .flatMap((rule) => rule.run(input))
    .sort((a, b) => ORDER[a.level] - ORDER[b.level] || a.title.localeCompare(b.title, 'tr'));
}
