// Kişisel program giriş formu ve güvenlik kapısı. SAF kodlar; tıbbi tanı değildir.
// Güvenlik kapısı TASLAKTIR: sağlık uzmanı incelemesine açıktır. İlke: belirsizse ya da riskliyse program ÜRETİLMEZ,
// kişi uzmana yönlendirilir. Vücut ölçüleri tek başına hareket seçimini ya da güvenliği belirlemez.
import { z } from 'zod';
import { bmiOf } from './energy.js';
import { BODY_AREAS, HOME_EQUIPMENT, SETTINGS, type BodyArea, type Equipment, type Setting } from './plan-types.js';

export const GOALS = ['LOSE_FAT', 'BUILD_MUSCLE', 'ENDURANCE', 'MOBILITY_POSTURE', 'GENERAL_HEALTH', 'SPORT_PERFORMANCE'] as const;
export type PlanGoal = (typeof GOALS)[number];
export const EXPERIENCES = ['NONE', 'BEGINNER', 'INTERMEDIATE', 'ADVANCED'] as const;
export const CAPACITIES = ['LOW', 'MEDIUM', 'HIGH'] as const;
export const DAILY_ACTIVITIES = ['SEDENTARY', 'LIGHT', 'MODERATE', 'ACTIVE'] as const;
export const EXTRAS = ['FACE_CARE'] as const;

// Sağlık taraması: her soru EVET / HAYIR / EMİN DEĞİLİM. Hepsi cevaplanmalı.
export const SCREENING_QUESTIONS = [
  { key: 'HEART_CONDITION', text: 'Doktor kalp rahatsızlığın ya da yüksek tansiyonun nedeniyle egzersizi kısıtladı mı?' },
  { key: 'CHEST_PAIN', text: 'Dinlenirken ya da egzersiz sırasında göğüs ağrısı yaşıyor musun?' },
  { key: 'DIZZINESS', text: 'Baş dönmesi nedeniyle dengeni kaybettiğin ya da bayıldığın oldu mu?' },
  { key: 'PREGNANCY', text: 'Hamile misin ya da son 6 ayda doğum yaptın mı?' },
  { key: 'RECENT_SURGERY', text: 'Son 6 ayda ameliyat geçirdin mi?' },
  { key: 'ACUTE_INJURY', text: 'Şu an tedavi gören ya da iyileşmekte olan bir sakatlığın var mı?' },
  { key: 'PAIN_NOW', text: 'Şu an egzersizi engelleyecek şiddette bir ağrın var mı?' },
  { key: 'CHRONIC_CONDITION', text: 'Egzersizi etkileyebilecek, tedavi gören bir hastalığın (diyabet, astım, böbrek, kalp-damar vb.) var mı?' },
  { key: 'DOCTOR_ADVISED_NO', text: 'Doktorun egzersiz yapmamanı ya da sınırlamanı söyledi mi?' },
] as const;
export type ScreeningKey = (typeof SCREENING_QUESTIONS)[number]['key'];
const answer = z.enum(['YES', 'NO', 'UNSURE']);

export const intakeSchema = z.object({
  goal: z.enum(GOALS),
  experience: z.enum(EXPERIENCES),
  capacity: z.enum(CAPACITIES),
  setting: z.enum(SETTINGS),
  // Sadece "evde ekipmanlı" seçildiğinde anlamlıdır
  equipment: z.array(z.enum(['DUMBBELL', 'BAND', 'STEP'])).max(3).default([]),
  daysPerWeek: z.number().int().min(2).max(6),
  minutesPerSession: z.number().int().min(15).max(90),
  dailyActivity: z.enum(DAILY_ACTIVITIES),
  sex: z.enum(['female', 'male', 'other']).default('other'),
  heightCm: z.number().min(120).max(230),
  weightKg: z.number().min(30).max(300),
  // İsteğe bağlı çevre ölçüleri (cm)
  waistCm: z.number().min(40).max(200).nullable().optional(),
  hipCm: z.number().min(50).max(220).nullable().optional(),
  neckCm: z.number().min(20).max(70).nullable().optional(),
  armCm: z.number().min(15).max(70).nullable().optional(),
  painAreas: z.array(z.enum(BODY_AREAS)).max(7).default([]),
  extras: z.array(z.enum(EXTRAS)).max(1).default([]),
  screening: z.object(Object.fromEntries(SCREENING_QUESTIONS.map((q) => [q.key, answer])) as Record<ScreeningKey, typeof answer>),
});
export type PlanIntake = z.infer<typeof intakeSchema>;

export type ScreeningStatus = 'ELIGIBLE' | 'CAUTION' | 'BLOCKED';
export interface ScreeningResult {
  status: ScreeningStatus;
  // Kullanıcıya gösterilecek açıklamalar
  reasons: string[];
  // Programda kaçınılacak bölgeler (ağrı bildirimi ve yaş/BMI kurallarından)
  restrictedAreas: BodyArea[];
  // Düşük etkili program: zıplamalı hareketler çıkarılır
  lowImpactOnly: boolean;
  // Hacim çarpanı (1 = normal)
  volumeFactor: number;
  referToProfessional: boolean;
}

export const MIN_AGE = 18;
const REFER = 'Sana uygun bir program için önce bir doktora ya da uzmana (diyetisyen / antrenör) danışmanı öneriyoruz.';

export function screen(intake: PlanIntake, ageYears: number): ScreeningResult {
  const reasons: string[] = [];
  let referToProfessional = false;
  if (ageYears < MIN_AGE) {
    return { status: 'BLOCKED', reasons: ['Kişisel program 18 yaş ve üzeri içindir.'], restrictedAreas: [], lowImpactOnly: true, volumeFactor: 1, referToProfessional: false };
  }
  // Evet ya da emin değilim: otomatik program üretilmez
  const flagged = SCREENING_QUESTIONS.filter((q) => intake.screening[q.key] !== 'NO');
  if (flagged.length > 0) {
    reasons.push(...flagged.map((q) => (intake.screening[q.key] === 'UNSURE' ? `Emin olmadığın bir durum var: ${q.text}` : q.text.replace(/\?$/, '') + ' — evet.')));
    referToProfessional = true;
  }
  const bmi = bmiOf(intake.weightKg, intake.heightCm);
  if (bmi < 17) {
    reasons.push('Boy ve kilo bilgine göre vücut kütle indeksin çok düşük görünüyor.');
    referToProfessional = true;
  }
  if (referToProfessional) {
    return { status: 'BLOCKED', reasons: [...reasons, REFER], restrictedAreas: [], lowImpactOnly: true, volumeFactor: 1, referToProfessional: true };
  }

  // Uygun ama dikkatli program: hareket kısıtları ve hafifletilmiş hacim
  const restricted = new Set<BodyArea>(intake.painAreas);
  let lowImpactOnly = restricted.has('KNEE') || restricted.has('ANKLE') || restricted.has('HIP');
  let volumeFactor = 1;
  if (intake.painAreas.length > 0) reasons.push('Ağrı bildirdiğin bölgeleri yükleyen hareketler programa alınmaz.');
  if (bmi >= 35) {
    lowImpactOnly = true;
    volumeFactor = Math.min(volumeFactor, 0.85);
    reasons.push('Eklemlerini korumak için zıplamasız ve daha hafif bir program hazırlanır.');
  }
  if (ageYears >= 55) {
    lowImpactOnly = true;
    volumeFactor = Math.min(volumeFactor, 0.85);
    reasons.push('Yaşın nedeniyle zıplamasız ve daha kontrollü bir program hazırlanır.');
  }
  if (intake.capacity === 'LOW') volumeFactor = Math.min(volumeFactor, 0.85);
  const caution = restricted.size > 0 || bmi >= 35 || ageYears >= 55;
  return { status: caution ? 'CAUTION' : 'ELIGIBLE', reasons, restrictedAreas: [...restricted], lowImpactOnly, volumeFactor, referToProfessional: false };
}

// Seçilen ortamda kullanılabilen ekipmanlar
export function availableEquipment(setting: Setting, owned: readonly Equipment[]): Set<Equipment> {
  if (setting === 'GYM') return new Set<Equipment>(['DUMBBELL', 'BAND', 'STEP', 'MACHINE']);
  if (setting === 'HOME_EQUIP') return new Set(owned.filter((e) => HOME_EQUIPMENT.includes(e)));
  return new Set<Equipment>();
}

// Başlangıç basamağı: en fazla hangi zorluk basamağındaki hareketler seçilir
export function startLevel(intake: PlanIntake, previousBonus = 0): 1 | 2 | 3 {
  const base = { NONE: 1, BEGINNER: 1, INTERMEDIATE: 2, ADVANCED: 3 }[intake.experience];
  const adjusted = intake.capacity === 'LOW' ? base - 1 : base;
  return Math.max(1, Math.min(3, adjusted + previousBonus)) as 1 | 2 | 3;
}
