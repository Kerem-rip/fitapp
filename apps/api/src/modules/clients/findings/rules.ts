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
  // Hedef başladıktan bu kadar gün sonra hâlâ hedefe doğru değişim yoksa inceleme önerisi çıkar
  progressReviewDays: 21,
  // Hedef başladıktan bu kadar gün içinde hiç ölçüm yoksa uyarır
  goalMeasurementGapDays: 14,
  // Plan uygulama özeti için bakılan gün sayısı
  adherenceWindowDays: 14,
  // Ağrı bildirimlerine bakılan süre
  painLookbackDays: 30,
  // Program yayınlandıktan bu kadar gün sonra kontrol başlar; bu pencerede kayıt yoksa uyarır
  workoutGraceDays: 7,
  workoutWindowDays: 14,
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
  // Uzmanın bu danışanla aktif hedefleri
  goals?: readonly GoalPoint[];
  // Plan seçimlerinin özeti (öğün kayıtları paylaşılıyor ve plan yayındaysa); yoksa null
  adherence?: { daysWithChoices: number; windowDays: number } | null;
  // Antrenman kayıtları "Antrenman kayıtlarım" paylaşılıyorsa; yoksa null
  workouts?: { logs: readonly WorkoutPoint[]; programApprovedAt: Date | null } | null;
  // Maddeleri görecek uzmanın türü; beslenmeye özel kurallar sadece diyetisyene çıkar
  professionalType?: 'DIETITIAN' | 'TRAINER' | 'GYM' | null;
}

export interface WorkoutPoint {
  id: string;
  date: string;
  pain: boolean;
  painNote: string | null;
  rpe: number | null;
}

export interface GoalPoint {
  id: string;
  title: string;
  measurementKind: MeasurementKind | null;
  startValue: number | null;
  targetValue: number | null;
  startDate: Date;
  targetDate: Date | null;
}

export interface RuleDef {
  code: string;
  level: Level;
  kind: 'MECHANICAL' | 'CLINICAL';
  // CLINICAL kurallar uzman onayı olmadan çalışmaz
  reviewed: boolean;
  // Sadece bu türdeki uzmana çıkar (boşsa herkese)
  audience?: 'DIETITIAN';
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
    audience: 'DIETITIAN',
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

  {
    code: 'R-PAIN-REPORTED',
    level: 'RED',
    kind: 'MECHANICAL',
    reviewed: false,
    description: 'Danışan bir antrenman kaydında ağrı/rahatsızlık bildirdiyse antrenörü uyarır (kendi beyanını yansıtır).',
    run(input) {
      if (!input.workouts) return [];
      const since = new Date(input.now.getTime() - RULE_PARAMS.painLookbackDays * DAY_MS).toISOString().slice(0, 10);
      return input.workouts.logs
        .filter((l) => l.pain && l.date >= since)
        .map<Candidate>((l) => ({
          ruleCode: this.code,
          level: 'RED',
          title: 'Antrenmanda ağrı bildirildi',
          detail: `Danışan ${l.date} tarihli antrenmanda ağrı veya rahatsızlık bildirdi${l.painNote ? `: "${l.painNote}"` : ''}. Programı sürdürmeden önce danışanla konuş; gerekirse bir sağlık profesyoneline başvurmasını öner.`,
          categories: ['WORKOUTS'],
          basis: [{ type: 'ANSWER', label: `Antrenman kaydı · ${l.date}`, display: l.painNote ? `Ağrı: ${l.painNote}` : 'Ağrı bildirildi', at: null }],
          key: l.id,
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

  // ── SARI: hedef ve gelişim takibi ──
  {
    code: 'Y-GOAL-NO-PROGRESS',
    level: 'YELLOW',
    kind: 'MECHANICAL',
    reviewed: false,
    description:
      'Hedef başlayalı yeterince zaman geçtiği hâlde son ölçüm hedefe yaklaşmadıysa yeni plan dayatmadan inceleme soruları önerir.',
    run(input) {
      const result: Candidate[] = [];
      for (const g of input.goals ?? []) {
        if (!g.measurementKind || g.startValue === null || g.targetValue === null || g.startValue === g.targetValue) continue;
        if (!input.allowed.has(categoryOf(g.measurementKind))) continue;
        const elapsed = daysBetween(input.now, g.startDate);
        if (elapsed < RULE_PARAMS.progressReviewDays) continue;
        const since = input.measurements.filter((m) => m.kind === g.measurementKind && m.takenAt > g.startDate);
        const last = since[0];
        if (!last) continue;
        // Hedefe olan uzaklık başlangıca göre azalmadıysa
        if (Math.abs(g.targetValue - last.value) < Math.abs(g.targetValue - g.startValue)) continue;
        const unit = MEASUREMENT_SPECS[g.measurementKind].unit;
        const methods = new Set(since.map((m) => m.method));
        const adherence = input.adherence
          ? `Son ${input.adherence.windowDays} günde ${input.adherence.daysWithChoices} gün plan seçimi yapılmış.`
          : 'Plan seçimleri görünmüyor (plan yok veya öğün kayıtları paylaşılmıyor).';
        result.push({
          ruleCode: this.code,
          level: 'YELLOW',
          title: `Hedefe doğru değişim görülmüyor: ${g.title}`,
          detail: [
            `Hedef ${g.startValue} → ${g.targetValue} ${unit}; ${elapsed} gün sonra son ölçüm ${last.value} ${unit}.`,
            'Yeni bir plan yazmadan önce şunları gözden geçir:',
            `• Ölçümler ${methods.size > 1 ? 'farklı yöntemlerle alınmış; karşılaştırma yanıltıcı olabilir' : 'aynı yöntemle mi, aynı koşullarda mı alındı?'}`,
            `• Planın uygulanma durumu: ${adherence}`,
            '• Danışanın geri bildirimi: zorlandığı öğünler, değişen iş/uyku/hareket düzeni',
            '• Hedef ve süre danışan için gerçekçi mi?',
          ].join('\n'),
          categories: [categoryOf(g.measurementKind)],
          basis: [
            { type: 'MEASUREMENT', label: `${g.title} · başlangıç`, display: `${g.startValue} ${unit} · ${g.startDate.toISOString().slice(0, 10)}`, at: g.startDate.toISOString() },
            measurementBasis(last, `${g.title} · son ölçüm`),
            ...(input.adherence
              ? [{ type: 'PLAN' as const, label: 'Plan seçimleri', display: `${input.adherence.daysWithChoices}/${input.adherence.windowDays} gün`, at: null }]
              : []),
          ],
          key: `${g.id}:${last.id}`,
        });
      }
      return result;
    },
  },
  {
    code: 'Y-GOAL-NO-MEASUREMENT',
    level: 'YELLOW',
    kind: 'MECHANICAL',
    reviewed: false,
    description: 'Ölçüme dayalı hedef başladıktan sonra uzun süre ölçüm girilmediyse uyarır.',
    run(input) {
      const result: Candidate[] = [];
      for (const g of input.goals ?? []) {
        if (!g.measurementKind || !input.allowed.has(categoryOf(g.measurementKind))) continue;
        const elapsed = daysBetween(input.now, g.startDate);
        if (elapsed < RULE_PARAMS.goalMeasurementGapDays) continue;
        if (input.measurements.some((m) => m.kind === g.measurementKind && m.takenAt > g.startDate)) continue;
        result.push({
          ruleCode: this.code,
          level: 'YELLOW',
          title: `Hedef başladığından beri ölçüm yok: ${g.title}`,
          detail: `Hedef ${elapsed} gün önce başladı ama ${KIND_LABEL[g.measurementKind].toLocaleLowerCase('tr')} ölçümü girilmedi. Gelişimi değerlendirebilmek için ölçüm iste.`,
          categories: [categoryOf(g.measurementKind)],
          basis: [{ type: 'MISSING', label: `${g.title} · başlangıçtan sonraki ölçüm`, display: 'Ölçüm yok', at: g.startDate.toISOString() }],
          key: g.id,
        });
      }
      return result;
    },
  },
  {
    code: 'Y-GOAL-OVERDUE',
    level: 'YELLOW',
    kind: 'MECHANICAL',
    reviewed: false,
    description: 'Hedef tarihi geçmiş aktif hedefi hatırlatır.',
    run(input) {
      return (input.goals ?? [])
        .filter((g) => g.targetDate && g.targetDate < input.now)
        .map<Candidate>((g) => ({
          ruleCode: this.code,
          level: 'YELLOW',
          title: `Hedef tarihi geçti: ${g.title}`,
          detail: 'Hedefi danışanla birlikte değerlendir: ulaşıldı mı, yeni bir tarih mi gerekiyor, yoksa hedef değişmeli mi?',
          categories: [],
          basis: [{ type: 'PLAN', label: 'Hedef tarihi', display: g.targetDate!.toISOString().slice(0, 10), at: g.targetDate!.toISOString() }],
          key: `${g.id}:${g.targetDate!.toISOString().slice(0, 10)}`,
        }));
    },
  },

  {
    code: 'Y-NO-WORKOUT-LOGS',
    level: 'YELLOW',
    kind: 'MECHANICAL',
    reviewed: false,
    description: 'Program yayında olduğu hâlde son günlerde hiç antrenman kaydı yoksa yeni program dayatmadan sorulacakları önerir.',
    run(input) {
      const w = input.workouts;
      if (!w || !w.programApprovedAt) return [];
      if (daysBetween(input.now, w.programApprovedAt) < RULE_PARAMS.workoutGraceDays) return [];
      const since = new Date(input.now.getTime() - RULE_PARAMS.workoutWindowDays * DAY_MS).toISOString().slice(0, 10);
      if (w.logs.some((l) => l.date >= since)) return [];
      const last = [...w.logs].sort((a, b) => b.date.localeCompare(a.date))[0];
      return [
        {
          ruleCode: this.code,
          level: 'YELLOW',
          title: `Son ${RULE_PARAMS.workoutWindowDays} günde antrenman kaydı yok`,
          detail: [
            `Program yayında ama son ${RULE_PARAMS.workoutWindowDays} günde kayıt girilmemiş${last ? ` (son kayıt ${last.date})` : ''}.`,
            'Programı değiştirmeden önce danışana sor:',
            '• Antrenmanları yapabiliyor mu, kaydetmeyi mi unutuyor?',
            '• Zaman, ekipman ya da yer sorunu var mı?',
            '• Program zorluğu ve sıklığı ona uygun mu?',
          ].join('\n'),
          categories: ['WORKOUTS'],
          basis: [
            { type: 'PLAN', label: 'Program yayın tarihi', display: w.programApprovedAt.toISOString().slice(0, 10), at: w.programApprovedAt.toISOString() },
            last ? { type: 'ANSWER', label: 'Son antrenman kaydı', display: last.date, at: null } : { type: 'MISSING', label: 'Antrenman kaydı', display: 'Hiç kayıt yok', at: null },
          ],
          key: `${w.programApprovedAt.toISOString().slice(0, 10)}:${last?.id ?? 'none'}`,
        },
      ];
    },
  },

  // ── YEŞİL: değerlendirilebilecek öneriler ──
  {
    code: 'G-GOAL-REACHED',
    level: 'GREEN',
    kind: 'MECHANICAL',
    reviewed: false,
    description: 'Son ölçüm hedef değere ulaştıysa hedefi değerlendirmeyi önerir.',
    run(input) {
      const result: Candidate[] = [];
      for (const g of input.goals ?? []) {
        if (!g.measurementKind || g.startValue === null || g.targetValue === null || g.startValue === g.targetValue) continue;
        if (!input.allowed.has(categoryOf(g.measurementKind))) continue;
        const last = input.measurements.find((m) => m.kind === g.measurementKind && m.takenAt > g.startDate);
        if (!last) continue;
        const down = g.targetValue < g.startValue;
        if (down ? last.value > g.targetValue : last.value < g.targetValue) continue;
        result.push({
          ruleCode: this.code,
          level: 'GREEN',
          title: `Hedef değere ulaşıldı: ${g.title}`,
          detail: 'Son ölçüm hedef değere ulaştı. Danışanla değerlendirip hedefi "ulaşıldı" olarak kapatabilir ya da yeni bir hedef belirleyebilirsin.',
          categories: [categoryOf(g.measurementKind)],
          basis: [measurementBasis(last, `${g.title} · son ölçüm`)],
          key: `${g.id}:${last.id}`,
        });
      }
      return result;
    },
  },

  // ── YEŞİL: değerlendirilebilecek öneriler ──
  {
    code: 'G-ALLERGY-FILTER',
    audience: 'DIETITIAN',
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
    audience: 'DIETITIAN',
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
    audience: 'DIETITIAN',
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
    audience: 'DIETITIAN',
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
    .filter((rule) => !rule.audience || !input.professionalType || rule.audience === input.professionalType)
    .flatMap((rule) => rule.run(input))
    .sort((a, b) => ORDER[a.level] - ORDER[b.level] || a.title.localeCompare(b.title, 'tr'));
}
