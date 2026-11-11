// Demo verisinin tipleri. Gerçek sunucu bağlanınca bu tipler api-client'tan gelecek.
import type { ActivityLevel, Allergen, DietPreference, Goal, MealSlot, Sex } from '@fitapp/shared';

export type RoleKey = 'user' | 'teen' | 'dietitian' | 'trainer' | 'gymManager' | 'gymStaff';

export interface DemoAccount {
  id: string;
  roleKey: RoleKey;
  email: string;
  username: string;
  password: string;
  firstName: string;
  lastName: string;
  // YYYY-AA-GG
  birthDate: string;
  sex: Sex;
  city?: string;
  title?: string;
  bio: string;
  gymId?: string;
  // Demo için hazır gelen hesap mı, kayıtla sonradan mı açıldı
  isSeed: boolean;
}

export interface MealEntry {
  id: string;
  slot: MealSlot;
  foodId: string;
  servings: number;
}

export interface Sharing {
  meals: boolean;
  weight: boolean;
  measurements: boolean;
  photos: boolean;
}

export interface UserData {
  isPrivate: boolean;
  goal: Goal;
  heightCm: number;
  weightKg: number;
  activity: ActivityLevel;
  allergens: Allergen[];
  diet: DietPreference;
  targetKcal: number | null;
  // YYYY-AA-GG → o günün kayıtları
  meals: Record<string, MealEntry[]>;
  waterMl: Record<string, number>;
  weights: { date: string; kg: number }[];
  enrollments: Record<string, { startedAt: string; completedDays: number[] }>;
  consents: { health_data: boolean; marketing: boolean };
  sharing: Sharing;
  parentalApproval: 'none' | 'requested' | 'approved';
  following: string[];
  likes: string[];
  saves: string[];
  deletionRequestedAt: string | null;
}

// ───────────── Uzmanlar, danışanlar, yorumlar ─────────────

export type ProKind = 'dietitian' | 'trainer' | 'gym';

export interface ProProfile {
  id: string;
  kind: ProKind;
  accountId?: string;
  name: string;
  title: string;
  city: string;
  mode: 'online' | 'in_person' | 'both';
  specialties: string[];
  rating: number;
  clientCount: number;
  followers: number;
  bio: string;
  priceRange: string;
}

export interface Review {
  id: string;
  proId: string;
  authorName: string;
  authorAccountId?: string;
  rating: number;
  text: string;
  // "3 ay" gibi; danışanlık süresi
  clientFor: string;
  createdAt: string;
  reply?: string;
}

export interface ClientRecord {
  id: string;
  // Gerçek bir demo hesabına bağlıysa o hesabın verisi esas alınır
  accountId?: string;
  name: string;
  ageYears: number;
  sex: Sex;
  heightCm: number;
  weightKg: number;
  targetWeightKg: number;
  goal: Goal;
  activity: ActivityLevel;
  // null: alerji bilgisi henüz girilmemiş
  allergens: Allergen[] | null;
  diet: DietPreference;
  weights: { date: string; kg: number }[];
  lastEntryDaysAgo: number;
  sharing: Sharing;
  mealsToday: { slot: MealSlot; name: string; kcal: number }[];
  note: string;
}

export interface ClientLink {
  id: string;
  proId: string;
  clientId: string;
  status: 'active' | 'ended';
  startedAt: string;
  endedAt?: string;
}

export interface PlanMenuItem {
  foodId: string;
  servings: number;
}

export interface Plan {
  id: string;
  clientId: string;
  proId: string;
  createdAt: string;
  targetKcal: number;
  menu: { slot: MealSlot; items: PlanMenuItem[] }[];
  note: string;
}

// ───────────── Programlar ─────────────

export type ExerciseCategory = 'fitness' | 'home' | 'posture' | 'face';
export type Level = 'beginner' | 'intermediate' | 'advanced';

export interface Exercise {
  id: string;
  name: string;
  category: ExerciseCategory;
  level: Level;
  equipment: string;
  primary: string[];
  secondary: string[];
  steps: string[];
  mistakes: string[];
  warnings: string[];
  duration: string;
}

export interface ProgramDay {
  title: string;
  exerciseIds: string[];
}

export type PublishStatus = 'draft' | 'pending' | 'published';

export interface Program {
  id: string;
  title: string;
  description: string;
  level: Level;
  weeks: number;
  daysPerWeek: number;
  category: ExerciseCategory;
  authorId: string | null;
  authorName: string;
  status: PublishStatus;
  days: ProgramDay[];
}

export interface ProgramAssignment {
  id: string;
  programId: string;
  clientId: string;
  trainerId: string;
  at: string;
}

// ───────────── Takvim, mesaj, bildirim ─────────────

export interface Appointment {
  id: string;
  ownerId: string;
  title: string;
  clientName: string;
  date: string;
  time: string;
  kind: 'online' | 'in_person';
}

export interface Party {
  id: string;
  name: string;
}

export interface Message {
  id: string;
  fromId: string;
  text: string;
  at: string;
}

export interface Conversation {
  id: string;
  a: Party;
  b: Party;
  messages: Message[];
  reads: Record<string, string>;
}

export interface AppNotification {
  id: string;
  toAccountId: string;
  title: string;
  text: string;
  at: string;
  read: boolean;
}

// ───────────── Spor salonu ─────────────

export interface Gym {
  id: string;
  name: string;
  district: string;
  hoursWeekday: string;
  hoursWeekend: string;
}

export interface GymStaff {
  id: string;
  gymId: string;
  accountId?: string;
  name: string;
  role: 'trainer' | 'reception';
  // Haftanın günleri (0 = Pazartesi) → "08:00–16:00" ya da "İzinli"
  shifts: string[];
  invited: boolean;
}

export interface GymTask {
  id: string;
  gymId: string;
  title: string;
  assigneeId: string;
  due: string;
  done: boolean;
  createdAt: string;
}

export interface GymMember {
  id: string;
  gymId: string;
  name: string;
  membership: 'active' | 'expiring';
  daysLeft: number;
  privateLessonsLeft: number;
  trainerId?: string;
}

export interface GymLesson {
  id: string;
  gymId: string;
  title: string;
  date: string;
  time: string;
  trainerId: string;
  kind: 'group' | 'private';
  memberName?: string;
}

// ───────────── Genel durum ─────────────

export interface SharedState {
  clients: Record<string, ClientRecord>;
  clientLinks: ClientLink[];
  plans: Plan[];
  reviews: Review[];
  programs: Program[];
  assignments: ProgramAssignment[];
  appointments: Appointment[];
  conversations: Conversation[];
  notifications: AppNotification[];
  gyms: Gym[];
  gymStaff: GymStaff[];
  gymTasks: GymTask[];
  gymMembers: GymMember[];
  gymLessons: GymLesson[];
}

export type OnboardingGoal = 'lose' | 'muscle' | 'gain' | 'maintain' | 'posture' | 'eating' | 'face';

export interface OnboardingAnswers {
  goals: OnboardingGoal[];
  place: 'home' | 'gym' | 'both' | 'none';
  level: Level;
  support: 'dietitian' | 'trainer' | 'self';
}

export interface DemoState {
  version: number;
  session: { accountId: string } | null;
  accounts: DemoAccount[];
  userData: Record<string, UserData>;
  shared: SharedState;
  ui: {
    themePref: 'system' | 'light' | 'dark';
    onboarding: OnboardingAnswers | null;
  };
}
