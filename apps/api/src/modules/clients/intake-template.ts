// Standart anamnez (sağlık öyküsü) soruları ve yanıt doğrulaması.
//
// DURUM: TASLAK. Soru seti ve seçenekler bir diyetisyen tarafından gözden geçirilmedi; tıbbi doğruluk iddiası taşımaz.
// Kesinleşmeden önce uzman onayı gerekir (bkz. docs/features/ ... doğrulama listesi). Uzmanlar kendi sorularını ekleyebilir.
// Uygulama bu yanıtlardan otomatik sağlık kararı üretmez; sadece uzmana gösterir.
import type { IntakeQuestionType } from '../../generated/prisma/enums.js';

export const TEMPLATE_STATUS = 'DRAFT' as const;

export const SECTION_LABELS: Record<string, string> = {
  ALLERGY: 'Alerjiler',
  HEALTH: 'Sağlık durumu',
  NUTRITION: 'Beslenme',
  LIFESTYLE: 'Yaşam tarzı',
  GOAL: 'Hedef',
  CUSTOM: 'Uzmanın soruları',
};

export interface Choice {
  value: string;
  label: string;
}

export interface QuestionDef {
  key: string;
  section: string;
  text: string;
  type: IntakeQuestionType;
  options?: readonly Choice[];
  // NUMBER için
  min?: number;
  max?: number;
  unit?: string;
  // Üzerinde durulması gereken (güvenlik açısından önemli) soru; özetlerde öne çıkarılır
  important?: boolean;
}

const choices = (pairs: [string, string][]): Choice[] => pairs.map(([value, label]) => ({ value, label }));

// Sunucunun @fitapp/shared'a bağımlılığı yok; alerjen anahtarları mobil paketteki listeyle aynı tutulmalıdır.
export const ALLERGEN_CHOICES = choices([
  ['gluten', 'Gluten'],
  ['peanut', 'Yer fıstığı'],
  ['tree_nut', 'Sert kabuklu yemiş'],
  ['milk', 'Süt'],
  ['egg', 'Yumurta'],
  ['soy', 'Soya'],
  ['fish', 'Balık'],
  ['shellfish', 'Kabuklu deniz ürünü'],
  ['sesame', 'Susam'],
]);

export const STANDARD_QUESTIONS: readonly QuestionDef[] = [
  {
    key: 'std.allergies',
    section: 'ALLERGY',
    text: 'Hangi yiyeceklere alerjin var?',
    type: 'MULTI_CHOICE',
    options: [{ value: 'none', label: 'Alerjim yok' }, ...ALLERGEN_CHOICES],
    important: true,
  },
  { key: 'std.allergy_other', section: 'ALLERGY', text: 'Listede olmayan bir alerjin veya yiyecek intoleransın (örn. laktoz) var mı?', type: 'TEXT' },
  {
    key: 'std.conditions',
    section: 'HEALTH',
    text: 'Doktor tarafından konmuş bir sağlık durumun var mı?',
    type: 'MULTI_CHOICE',
    options: choices([
      ['none', 'Yok'],
      ['diabetes', 'Diyabet'],
      ['hypertension', 'Yüksek tansiyon'],
      ['thyroid', 'Tiroid hastalığı'],
      ['kidney', 'Böbrek hastalığı'],
      ['celiac', 'Çölyak'],
      ['heart', 'Kalp-damar hastalığı'],
      ['digestive', 'Sindirim sistemi hastalığı'],
      ['other', 'Diğer'],
    ]),
    important: true,
  },
  { key: 'std.conditions_note', section: 'HEALTH', text: 'Sağlık durumun hakkında eklemek istediğin bir şey var mı?', type: 'TEXT' },
  { key: 'std.medications', section: 'HEALTH', text: 'Düzenli kullandığın ilaç veya takviyeler neler?', type: 'TEXT', important: true },
  {
    key: 'std.pregnancy',
    section: 'HEALTH',
    text: 'Hamilelik veya emzirme durumun nedir?',
    type: 'SINGLE_CHOICE',
    options: choices([
      ['no', 'Hayır'],
      ['pregnant', 'Hamileyim'],
      ['breastfeeding', 'Emziriyorum'],
      ['not_applicable', 'Geçerli değil'],
      ['unspecified', 'Belirtmek istemiyorum'],
    ]),
    important: true,
  },
  {
    key: 'std.eating_disorder_history',
    section: 'HEALTH',
    text: 'Geçmişte bir yeme bozukluğu tanısı veya tedavisi aldın mı?',
    type: 'SINGLE_CHOICE',
    options: choices([
      ['no', 'Hayır'],
      ['yes', 'Evet'],
      ['unspecified', 'Belirtmek istemiyorum'],
    ]),
    important: true,
  },
  {
    key: 'std.diet_preference',
    section: 'NUTRITION',
    text: 'Beslenme tercihin nedir?',
    type: 'SINGLE_CHOICE',
    options: choices([
      ['none', 'Özel bir tercihim yok'],
      ['vegetarian', 'Vejetaryen'],
      ['vegan', 'Vegan'],
      ['other', 'Diğer'],
    ]),
  },
  { key: 'std.dislikes', section: 'NUTRITION', text: 'Sevmediğin veya yemediğin yiyecekler neler?', type: 'TEXT' },
  { key: 'std.meals_per_day', section: 'NUTRITION', text: 'Günde kaç öğün yiyorsun?', type: 'NUMBER', min: 1, max: 10, unit: 'öğün' },
  { key: 'std.sleep_hours', section: 'LIFESTYLE', text: 'Ortalama kaç saat uyuyorsun?', type: 'NUMBER', min: 2, max: 14, unit: 'saat' },
  { key: 'std.activity_note', section: 'LIFESTYLE', text: 'Haftalık hareket ve egzersiz alışkanlıkların nasıl?', type: 'TEXT' },
  {
    key: 'std.smoking',
    section: 'LIFESTYLE',
    text: 'Sigara kullanıyor musun?',
    type: 'SINGLE_CHOICE',
    options: choices([
      ['no', 'Hayır'],
      ['yes', 'Evet'],
      ['quit', 'Bıraktım'],
      ['unspecified', 'Belirtmek istemiyorum'],
    ]),
  },
  {
    key: 'std.alcohol',
    section: 'LIFESTYLE',
    text: 'Alkol kullanıyor musun?',
    type: 'SINGLE_CHOICE',
    options: choices([
      ['none', 'Kullanmıyorum'],
      ['occasional', 'Ara sıra'],
      ['regular', 'Düzenli'],
      ['unspecified', 'Belirtmek istemiyorum'],
    ]),
  },
  { key: 'std.goal_text', section: 'GOAL', text: 'Bu danışmanlıktan beklentin veya hedefin nedir?', type: 'TEXT' },
];

const BY_KEY = new Map(STANDARD_QUESTIONS.map((q) => [q.key, q]));

export const standardQuestion = (key: string): QuestionDef | undefined => BY_KEY.get(key);

export const CUSTOM_PREFIX = 'custom.';
export const customKey = (id: string) => `${CUSTOM_PREFIX}${id}`;
export const isCustomKey = (key: string) => key.startsWith(CUSTOM_PREFIX);

export type AnswerValue = string | number | string[];

export class InvalidAnswerError extends Error {}

// Yanıtı soru türüne göre doğrular; geçerliyse temizlenmiş halini döner
export function normalizeAnswer(
  def: { type: IntakeQuestionType; options?: readonly Choice[]; min?: number; max?: number },
  raw: unknown,
): AnswerValue {
  switch (def.type) {
    case 'TEXT': {
      if (typeof raw !== 'string') throw new InvalidAnswerError('Yanıt metin olmalı.');
      const text = raw.trim();
      if (text.length === 0) throw new InvalidAnswerError('Yanıt boş olamaz.');
      if (text.length > 1000) throw new InvalidAnswerError('Yanıt en fazla 1000 karakter olabilir.');
      return text;
    }
    case 'NUMBER': {
      if (typeof raw !== 'number' || !Number.isFinite(raw)) throw new InvalidAnswerError('Yanıt sayı olmalı.');
      const min = def.min ?? 0;
      const max = def.max ?? 100_000;
      if (raw < min || raw > max) throw new InvalidAnswerError(`Değer ${min} ile ${max} arasında olmalı.`);
      return raw;
    }
    case 'SINGLE_CHOICE': {
      if (typeof raw !== 'string' || !(def.options ?? []).some((o) => o.value === raw)) {
        throw new InvalidAnswerError('Seçenek geçerli değil.');
      }
      return raw;
    }
    case 'MULTI_CHOICE': {
      if (!Array.isArray(raw) || raw.length === 0 || !raw.every((v) => typeof v === 'string')) {
        throw new InvalidAnswerError('En az bir seçenek seç.');
      }
      const values = [...new Set(raw as string[])];
      const allowed = new Set((def.options ?? []).map((o) => o.value));
      if (!values.every((v) => allowed.has(v))) throw new InvalidAnswerError('Seçenek geçerli değil.');
      // "Yok / alerjim yok" seçilince başka seçenek olamaz
      if (values.includes('none') && values.length > 1) throw new InvalidAnswerError('"Yok" ile başka seçenek birlikte seçilemez.');
      return values;
    }
  }
}
