// Kişisel program: ortak tür ve sabitler. 7 ana kategori ve alt kategoriler burada tanımlıdır;
// hareket içeriği zamanla genişler, başlıklar ve altyapı hazırdır.

export const PLAN_CATEGORIES = ['STRENGTH', 'YOGA_PILATES', 'POSTURE', 'FACE_CARE', 'CARDIO_FAT_BURN', 'SPORT_PERFORMANCE', 'WELLNESS_DAILY'] as const;
export type PlanCategory = (typeof PLAN_CATEGORIES)[number];

export const CATEGORY_TITLES: Record<PlanCategory, string> = {
  STRENGTH: 'Fitness ve Güç',
  YOGA_PILATES: 'Yoga ve Pilates',
  POSTURE: 'Postür ve Duruş',
  FACE_CARE: 'Yüz ve Kişisel Bakım',
  CARDIO_FAT_BURN: 'Kardiyo ve Yağ Yakımına Yönelik Antrenman',
  SPORT_PERFORMANCE: 'Spor Branşları ve Performans',
  WELLNESS_DAILY: 'Sağlıklı Yaşam ve Günlük Hareket',
};

export const SUBCATEGORIES: Record<PlanCategory, { id: string; title: string }[]> = {
  STRENGTH: [
    { id: 'lower_body', title: 'Alt vücut' },
    { id: 'upper_push', title: 'Üst vücut itiş' },
    { id: 'upper_pull', title: 'Üst vücut çekiş' },
    { id: 'core', title: 'Karın ve gövde' },
  ],
  YOGA_PILATES: [
    { id: 'yoga_flow', title: 'Yoga akışları' },
    { id: 'pilates_core', title: 'Pilates ve gövde' },
    { id: 'stretching', title: 'Esneme' },
  ],
  POSTURE: [
    { id: 'neck_shoulder', title: 'Boyun ve omuz' },
    { id: 'upper_back', title: 'Üst sırt' },
    { id: 'hip_pelvis', title: 'Kalça ve leğen' },
  ],
  FACE_CARE: [
    { id: 'face_massage', title: 'Yüz masajı' },
    { id: 'face_exercise', title: 'Yüz egzersizi' },
  ],
  CARDIO_FAT_BURN: [
    { id: 'low_impact', title: 'Düşük etkili kardiyo' },
    { id: 'high_intensity', title: 'Yüksek tempolu aralıklar' },
    { id: 'steady_state', title: 'Sabit tempolu kardiyo' },
  ],
  SPORT_PERFORMANCE: [
    { id: 'agility', title: 'Çeviklik' },
    { id: 'power', title: 'Güç ve patlayıcılık' },
    { id: 'sport_specific', title: 'Branşa özel' },
  ],
  WELLNESS_DAILY: [
    { id: 'daily_movement', title: 'Günlük hareket' },
    { id: 'breathing_relax', title: 'Nefes ve gevşeme' },
    { id: 'mobility', title: 'Mobilite' },
  ],
};

// Antrenman ortamı: ayrı bir ekipman filtresi ekranı yok; ortam seçimi yeter, evde ekipmanlıda sahip olunanlar işaretlenir
export const SETTINGS = ['HOME_NONE', 'HOME_EQUIP', 'GYM'] as const;
export type Setting = (typeof SETTINGS)[number];

export const EQUIPMENT = ['DUMBBELL', 'BAND', 'STEP', 'MACHINE'] as const;
export type Equipment = (typeof EQUIPMENT)[number];
// Evde ekipmanlıda kullanıcının işaretleyebildikleri (makine sadece salonda)
export const HOME_EQUIPMENT: readonly Equipment[] = ['DUMBBELL', 'BAND', 'STEP'];

// Vücut bölgeleri: ağrı/sakatlık bildirimi ve hareketin yüklendiği bölge aynı listeyi kullanır
export const BODY_AREAS = ['NECK', 'SHOULDER', 'WRIST', 'LOW_BACK', 'HIP', 'KNEE', 'ANKLE'] as const;
export type BodyArea = (typeof BODY_AREAS)[number];

export const AREA_TITLES: Record<BodyArea, string> = {
  NECK: 'Boyun',
  SHOULDER: 'Omuz',
  WRIST: 'Bilek',
  LOW_BACK: 'Bel',
  HIP: 'Kalça',
  KNEE: 'Diz',
  ANKLE: 'Ayak bileği',
};

export const PATTERNS = ['SQUAT', 'HINGE', 'LUNGE', 'PUSH', 'PULL', 'CORE', 'CARDIO', 'MOBILITY', 'BREATH'] as const;
export type Pattern = (typeof PATTERNS)[number];

export type Role = 'WARMUP' | 'MAIN' | 'COOLDOWN';
export type Section = Role | 'RECOVERY';

export const ENGINE_VERSION = 'rules-1.0';
