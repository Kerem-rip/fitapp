// Ekranlarda görünen Türkçe etiketler.
import type { ActivityLevel, DietPreference, Goal } from '@fitapp/shared';
import type { OnboardingGoal, RoleKey } from './types';

export const ROLE_LABELS: Record<RoleKey, string> = {
  user: 'Bireysel kullanıcı',
  teen: 'Genç kullanıcı',
  dietitian: 'Diyetisyen',
  trainer: 'Bağımsız eğitmen',
  gymManager: 'Salon yöneticisi',
  gymStaff: 'Salon eğitmeni',
};

export const GOAL_LABELS: Record<Goal, string> = {
  lose: 'Kilo vermek',
  gain: 'Kilo almak',
  muscle: 'Kas yapmak',
  maintain: 'Formda kalmak',
};

export const ONBOARDING_GOAL_LABELS: Record<OnboardingGoal, string> = {
  lose: 'Kilo vermek',
  muscle: 'Kas yapmak',
  gain: 'Kilo almak',
  maintain: 'Formda kalmak',
  posture: 'Duruşumu düzeltmek',
  eating: 'Sağlıklı beslenmek',
  face: 'Yüz bakımı ve rahatlama',
};

export const ACTIVITY_LABELS: Record<ActivityLevel, string> = {
  sedentary: 'Hareketsiz',
  light: 'Hafif',
  moderate: 'Orta',
  active: 'Aktif',
  very_active: 'Çok aktif',
};

export const DIET_LABELS: Record<DietPreference, string> = {
  none: 'Fark etmez',
  vegetarian: 'Vejetaryen',
  vegan: 'Vegan',
};

export const MODE_LABELS = { online: 'Online', in_person: 'Yüz yüze', both: 'Online ve yüz yüze' } as const;

export const SEX_LABELS = { female: 'Kadın', male: 'Erkek', other: 'Belirtmek istemiyorum' } as const;

export const WEEKDAY_FULL = ['Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi', 'Pazar'] as const;

// Onboarding hedefini hesaplamadaki hedefe çevirir
export function toGoal(goal: OnboardingGoal | undefined): Goal {
  if (goal === 'lose' || goal === 'gain' || goal === 'muscle') return goal;
  return 'maintain';
}
