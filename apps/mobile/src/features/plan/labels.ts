// Kişisel program ekranlarında ortak yazılar.
import type { PlanBodyArea } from '@fitapp/api-client';

export const GOAL_LABELS: Record<string, string> = {
  LOSE_FAT: 'Yağ yakmak / kilo vermek',
  BUILD_MUSCLE: 'Kas ve güç kazanmak',
  ENDURANCE: 'Dayanıklılığı artırmak',
  MOBILITY_POSTURE: 'Esneklik ve duruş',
  GENERAL_HEALTH: 'Genel sağlık ve zindelik',
  SPORT_PERFORMANCE: 'Spor performansı',
};
export const EXPERIENCE_LABELS: Record<string, string> = { NONE: 'Hiç yapmadım', BEGINNER: 'Başlangıç', INTERMEDIATE: 'Orta', ADVANCED: 'İleri' };
export const CAPACITY_LABELS: Record<string, string> = { LOW: 'Çabuk yorulurum', MEDIUM: 'Orta', HIGH: 'İyi' };
export const SETTING_LABELS: Record<string, string> = { HOME_NONE: 'Evde, ekipmansız', HOME_EQUIP: 'Evde, ekipmanlı', GYM: 'Spor salonu' };
export const EQUIPMENT_LABELS: Record<string, string> = { DUMBBELL: 'Dambıl', BAND: 'Direnç bandı', STEP: 'Basamak / sandalye' };
export const ACTIVITY_LABELS: Record<string, string> = { SEDENTARY: 'Çoğunlukla oturarak', LIGHT: 'Hafif hareketli', MODERATE: 'Orta hareketli', ACTIVE: 'Çok hareketli' };
export const SEX_LABELS: Record<string, string> = { female: 'Kadın', male: 'Erkek', other: 'Belirtmek istemiyorum' };
export const AREA_LABELS: Record<PlanBodyArea, string> = { NECK: 'Boyun', SHOULDER: 'Omuz', WRIST: 'Bilek', LOW_BACK: 'Bel', HIP: 'Kalça', KNEE: 'Diz', ANKLE: 'Ayak bileği' };
export const SECTION_LABELS: Record<string, string> = { WARMUP: 'Isınma', MAIN: 'Ana çalışma', COOLDOWN: 'Soğuma', RECOVERY: 'Toparlanma' };
export const ANSWER_LABELS = { YES: 'Evet', NO: 'Hayır', UNSURE: 'Emin değilim' } as const;

export const PHASE_LABELS: Record<string, string> = {
  AWAITING_START: 'Başlangıç bekleniyor',
  START_WINDOW_MISSED: 'Başlangıç süresi geçti',
  ACTIVE: 'Aktif',
  COMPLETED: 'Tamamlandı',
  EXPIRED: 'Süresi doldu',
};

export const SOURCE_TAG = 'SocialFit programı';
