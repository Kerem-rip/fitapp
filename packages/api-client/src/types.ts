// Sunucunun döndürdüğü verilerin tipleri (apps/api ile aynı biçim).

export type RoleType = 'USER' | 'DIETITIAN' | 'TRAINER' | 'GYM_MANAGER' | 'GYM_STAFF' | 'MODERATOR' | 'ADMIN';
export type AgeGroup = 'CHILD' | 'TEEN' | 'ADULT';
export type ProfessionalField = 'DIETITIAN' | 'TRAINER' | 'GYM_OWNER';
export type ApplicationStatus = 'PENDING' | 'APPROVED' | 'REJECTED';
export type DocumentKind = 'diploma' | 'certificate' | 'business_license';
export type Gender = 'FEMALE' | 'MALE' | 'OTHER' | 'UNSPECIFIED';

export interface ApplicationSummary {
  id: string;
  field: ProfessionalField;
  status: ApplicationStatus;
  rejectionReason: string | null;
  submittedAt: string;
  attemptNumber: number;
  canResubmit: boolean;
}

export interface Me {
  id: string;
  email: string;
  username: string;
  firstName: string | null;
  lastName: string | null;
  birthDate: string;
  ageGroup: AgeGroup;
  gender: Gender;
  roles: RoleType[];
  // Son profesyonel başvurusu (yoksa null)
  application: ApplicationSummary | null;
  bio: string | null;
  isPrivate: boolean;
  createdAt: string;
}

export interface Tokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export interface AuthResult extends Tokens {
  user: Me;
  // Giriş, bekleyen hesap silme talebini iptal ettiyse true
  deletionCancelled?: boolean;
}

export interface ProfessionalDetails {
  field: ProfessionalField;
  city: string;
  specialties?: string[];
  gymName?: string;
  gymAddress?: string;
}

export interface RegisterStartInput {
  accountType: 'USER' | 'PROFESSIONAL';
  email: string;
  password: string;
  username: string;
  firstName: string;
  lastName?: string;
  // YYYY-AA-GG
  birthDate: string;
  gender: Gender;
  acceptTerms: true;
  healthDataConsent: boolean;
  professional?: ProfessionalDetails;
  deviceName?: string;
}

export interface RegisterStartResult {
  registrationId: string;
  codeExpiresAt: string;
  // Sadece sunucu test modundayken gelir
  devCode?: string;
  requiredDocuments: DocumentKind[];
}

// Yüklenecek dosya. Telefonda `uri` kullanılır; tarayıcıda `file` (Blob) verilir.
export interface UploadFile {
  uri: string;
  name: string;
  mimeType: string;
  file?: Blob;
}

export interface AdminApplicationItem {
  id: string;
  field: ProfessionalField;
  status: ApplicationStatus;
  submittedAt: string;
  attemptNumber: number;
  documentCount: number;
  flagged: boolean;
  user: { firstName: string | null; lastName: string | null; email: string; username: string };
}

export interface AdminDocument {
  id: string;
  kind: DocumentKind;
  originalName: string;
  mimeType: string;
  sizeBytes: number;
  flags: { code: string; label: string }[];
}

export interface AdminApplicationDetail {
  id: string;
  field: ProfessionalField;
  status: ApplicationStatus;
  details: ProfessionalDetails;
  rejectionReason: string | null;
  reviewedAt: string | null;
  submittedAt: string;
  attemptNumber: number;
  user: { id: string; firstName: string | null; lastName: string | null; email: string; username: string; birthDate: string };
  documents: AdminDocument[];
  previousAttempts: { id: string; status: ApplicationStatus; rejectionReason: string | null; submittedAt: string; attemptNumber: number }[];
  checklist: string[];
}

// ───────────── Danışanlık ve paylaşım ─────────────

export type SharedDataType = 'MEALS' | 'WATER' | 'WEIGHT' | 'MEASUREMENTS' | 'PHOTOS' | 'ANAMNESIS' | 'WORKOUTS';
export type RelationshipStatus = 'OFFERED' | 'ACTIVE' | 'ENDED';

export interface RelationshipBase {
  id: string;
  status: RelationshipStatus;
  sharedData: SharedDataType[];
  // Boşsa danışanlık bitene kadar paylaşılır
  sharedUntil: string | null;
  // Süre dolduysa danışanlık sürer ama profesyonel hiçbir veriyi göremez
  sharingExpired: boolean;
  offeredAt: string;
  acceptedAt: string | null;
}

// Danışanın gördüğü: bana teklif gönderen / benimle çalışan profesyonel
export interface ClientRelationshipItem extends RelationshipBase {
  professional: {
    type: 'DIETITIAN' | 'TRAINER' | 'GYM';
    title: string | null;
    city: string | null;
    firstName: string | null;
    lastName: string | null;
    username: string;
  };
}

// Profesyonelin gördüğü: danışanın sadece adı; sağlık verisi bu listede gelmez
export interface ProfessionalRelationshipItem extends RelationshipBase {
  client: { id: string; firstName: string | null; lastName: string | null; username: string };
}

export type AuditAction =
  | 'OFFER_SENT'
  | 'OFFER_ACCEPTED'
  | 'OFFER_DECLINED'
  | 'SHARING_CHANGED'
  | 'RELATIONSHIP_ENDED'
  | 'DATA_VIEWED'
  | 'DATA_CHANGED'
  | 'ACCESS_DENIED';

export interface AuditEntry {
  id: string;
  action: AuditAction;
  category: SharedDataType | null;
  relationshipId: string | null;
  meta: Record<string, unknown> | null;
  createdAt: string;
  // Hesabı silinmiş kişi için null
  actor: { firstName: string | null; lastName: string | null; username: string } | null;
}

// ───────────── Danışan dosyası: ölçümler, anamnez, notlar ─────────────

export type DataSource = 'SELF' | 'PROFESSIONAL' | 'DEVICE';
export type MeasurementKind =
  | 'WEIGHT'
  | 'HEIGHT'
  | 'WAIST'
  | 'HIP'
  | 'CHEST'
  | 'ARM'
  | 'THIGH'
  | 'BODY_FAT_PERCENT'
  | 'MUSCLE_MASS'
  | 'BODY_WATER_PERCENT';
export type MeasurementMethod = 'SCALE' | 'TAPE' | 'CALIPER' | 'BIA' | 'DEXA' | 'SELF_REPORT' | 'OTHER';

export interface PersonName {
  firstName: string | null;
  lastName: string | null;
  username: string;
}

export interface MeasurementItem {
  id: string;
  kind: MeasurementKind;
  value: number;
  unit: 'kg' | 'cm' | '%';
  method: MeasurementMethod;
  deviceName: string | null;
  source: DataSource;
  takenAt: string;
  note: string | null;
  // Yanlış girişler silinmez, geçersiz işaretlenir
  voided: boolean;
  voidedAt: string | null;
  voidReason: string | null;
  createdAt: string;
  enteredBy: PersonName | null;
}

export interface MeasurementInput {
  kind: MeasurementKind;
  value: number;
  method: MeasurementMethod;
  deviceName?: string;
  // ISO tarih-saat; boşsa şimdi
  takenAt?: string;
  note?: string;
}

export type IntakeQuestionType = 'TEXT' | 'NUMBER' | 'SINGLE_CHOICE' | 'MULTI_CHOICE';
export type AnswerValue = string | number | string[];

export interface IntakeChoice {
  value: string;
  label: string;
}

export interface IntakeQuestionView {
  // "std.xxx" standart soru, "custom.<id>" uzmanın sorusu
  key: string;
  section: string;
  sectionLabel: string;
  text: string;
  type: IntakeQuestionType;
  options: IntakeChoice[] | null;
  min: number | null;
  max: number | null;
  unit: string | null;
  important: boolean;
  // Uzmanın sorusuysa uzmanın adı
  askedBy: string | null;
  answer: { value: AnswerValue; source: DataSource; answeredAt: string; answeredBy: string | null } | null;
}

export interface AnamnesisResponse {
  // Soru seti henüz uzman tarafından onaylanmadı
  templateStatus: 'DRAFT';
  questions: IntakeQuestionView[];
}

export interface ClientFileSummary {
  client: { name: string; username: string };
  sharing: { sharedData: SharedDataType[]; sharedUntil: string | null; visible: SharedDataType[] };
  profile: { ageYears: number; gender: Gender } | null;
  measurements: MeasurementItem[];
  anamnesis: {
    total: number;
    answered: number;
    missing: { key: string; text: string; important: boolean }[];
    highlights: {
      key: string;
      text: string;
      value: AnswerValue | null;
      options: IntakeChoice[] | null;
      source: DataSource | null;
      answeredAt: string | null;
    }[];
  } | null;
  notesCount: number;
  // Açık inceleme maddesi sayıları (içerik İnceleme sekmesindedir)
  findings: FindingCounts;
}

export type TimelineItem =
  | { type: 'MEASUREMENT'; at: string; id: string; kind: MeasurementKind; value: number; unit: 'kg' | 'cm' | '%'; method: MeasurementMethod; source: DataSource; voided: boolean; by: string | null }
  | { type: 'ANSWER'; at: string; id: string; questionKey: string; question: string; display: string; source: DataSource; by: string | null }
  | { type: 'NOTE'; at: string; id: string; text: string }
  | { type: 'APPOINTMENT'; at: string; id: string; status: AppointmentStatus; mode: AppointmentMode; title: string | null; outcome: string | null };

export interface NoteItem {
  id: string;
  text: string;
  createdAt: string;
}

// ───────────── Uzman inceleme özeti ─────────────

export type FindingLevel = 'RED' | 'YELLOW' | 'GREEN';
export type FindingStatus = 'OPEN' | 'FOLLOW_UP' | 'CLOSED' | 'SUPERSEDED';
export type FindingDecision = 'EVALUATED' | 'NOT_APPLICABLE' | 'CLIENT_INFORMED' | 'OTHER';

// Maddenin hangi bilgiye dayandığı
export interface FindingBasis {
  type: 'ANSWER' | 'MEASUREMENT' | 'MISSING' | 'SHARING' | 'PLAN';
  label: string;
  display: string;
  at: string | null;
}

export interface FindingEvent {
  id: string;
  kind: 'NOTE' | 'CLOSED' | 'REOPENED' | 'TASK_CREATED' | 'TASK_DONE' | 'SUPERSEDED';
  text: string | null;
  createdAt: string;
}

export interface TaskItem {
  id: string;
  title: string;
  dueAt: string | null;
  status: 'OPEN' | 'DONE';
  doneAt: string | null;
}

export interface FindingItem {
  id: string;
  ruleCode: string;
  level: FindingLevel;
  title: string;
  detail: string;
  basis: FindingBasis[];
  status: FindingStatus;
  decision: FindingDecision | null;
  closedReason: string | null;
  closedAt: string | null;
  firstSeenAt: string;
  events: FindingEvent[];
  tasks: TaskItem[];
}

export interface FindingCounts {
  red: number;
  yellow: number;
  green: number;
  followUp: number;
}

export interface FindingsResponse {
  // Kural seti henüz uzman tarafından gözden geçirilmedi
  rulesStatus: 'UNREVIEWED';
  counts: FindingCounts;
  items: FindingItem[];
}

export interface ReviewOverviewItem extends FindingCounts {
  client: { id: string; firstName: string | null; lastName: string | null; username: string };
  openTasks: number;
}

export interface ReviewTask extends TaskItem {
  createdAt: string;
  findingId: string | null;
  client: { id: string; name: string; username: string };
}

// ───────────── Beslenme planı ─────────────

export interface PlanOption {
  id?: string;
  name: string;
  // Ev ölçüsü / porsiyon
  portion: string;
  kcal?: number;
  // null: uzman alerjen bilgisini belirtmedi
  allergens: string[] | null;
  note?: string;
}

export interface PlanMeal {
  id?: string;
  name: string;
  // "08:00"
  time?: string;
  // Danışan bu öğünde kaç alternatif seçer
  pick: number;
  rule?: string;
  options: PlanOption[];
}

export interface PlanContent {
  title?: string;
  targetKcal?: number;
  notes?: string;
  meals: PlanMeal[];
}

export type PlanVersionStatus = 'DRAFT' | 'APPROVED' | 'SUPERSEDED';

export interface PlanVersionInfo {
  number: number;
  status: PlanVersionStatus;
  approvedAt: string | null;
  approvedBy: string | null;
  changeNote: string | null;
  basedOnNumber: number | null;
  // Bir önceki sürüme göre ne değişti
  summary: string[];
}

export interface PlanOverview {
  planId: string | null;
  published: { number: number; approvedAt: string | null; approvedBy: string | null; changeNote: string | null; content: PlanContent } | null;
  draft: { content: PlanContent; changeNote: string | null; basedOnNumber: number | null; updatedAt: string } | null;
  versions: PlanVersionInfo[];
  // Yayındaki planda alerjenle çakışan, henüz ele alınmamış madde sayısı
  openPlanFindings: number;
}

export interface PlanBlocker {
  code: 'EMPTY_PLAN' | 'MEAL_WITHOUT_OPTIONS' | 'PICK_TOO_HIGH' | 'ALLERGY_INFO_MISSING' | 'ALLERGEN_CONFLICT' | 'ALLERGEN_UNKNOWN';
  message: string;
  mealId?: string;
  optionId?: string;
}

export interface PlanCheck {
  canApprove: boolean;
  // Çözülmeden plan onaylanamaz
  blockers: PlanBlocker[];
  // Uzmanın bilerek geçmesi gereken açık inceleme maddeleri
  warnings: { ruleCode: string; level: FindingLevel; title: string }[];
}

export interface MyPlanListItem {
  planId: string;
  professional: { name: string; title: string | null };
  number: number;
  approvedAt: string | null;
  title: string | null;
  mealCount: number;
}

export interface MyPlanView {
  planId: string;
  professional: { name: string; title: string | null };
  version: { number: number; approvedAt: string | null };
  date: string;
  title: string | null;
  targetKcal: number | null;
  notes: string | null;
  anyBlocked: boolean;
  meals: {
    id: string;
    name: string;
    time: string | null;
    pick: number;
    rule: string | null;
    options: { id: string; name: string; portion: string; kcal: number | null; allergens: string[] | null; note: string | null; blockedReason: string | null }[];
    chosen: string[];
  }[];
}

export interface ClientPlanChoice {
  date: string;
  mealId: string;
  mealName: string;
  versionNumber: number | null;
  options: { id: string; name: string }[];
}

// ───────────── Randevu, hedef, hatırlatma, bildirim ─────────────

export type AppointmentStatus = 'SCHEDULED' | 'COMPLETED' | 'CANCELLED' | 'NO_SHOW';
export type AppointmentMode = 'ONLINE' | 'IN_PERSON';

// Uzmanın gördüğü randevu (hazırlık notu ve görüşme özeti dahil)
export interface ProAppointment {
  id: string;
  clientId: string;
  startsAt: string;
  durationMin: number;
  mode: AppointmentMode;
  status: AppointmentStatus;
  title: string | null;
  location: string | null;
  notes: string | null;
  outcome: string | null;
  cancelReason: string | null;
  client: { id: string; name: string; username: string };
}

// Danışanın gördüğü randevu (uzmanın notları yok)
export interface MyAppointment {
  id: string;
  startsAt: string;
  durationMin: number;
  mode: AppointmentMode;
  status: AppointmentStatus;
  title: string | null;
  location: string | null;
  cancelReason: string | null;
  professional: { name: string; title: string | null };
}

export interface AppointmentInput {
  startsAt: string;
  durationMin?: number;
  mode: AppointmentMode;
  title?: string;
  location?: string;
  notes?: string;
}

export interface AgendaResponse {
  appointments: ProAppointment[];
  tasks: ReviewTask[];
}

export type GoalStatus = 'ACTIVE' | 'ACHIEVED' | 'DROPPED';

export interface GoalItem {
  id: string;
  title: string;
  measurementKind: MeasurementKind | null;
  startValue: number | null;
  targetValue: number | null;
  startDate: string;
  targetDate: string | null;
  status: GoalStatus;
  note: string | null;
  closedAt: string | null;
  // Sadece ilgili ölçüm kategorisi paylaşılıyorsa dolu
  progress: { unit: string; latestValue: number | null; latestAt: string | null; measurementsSinceStart: number; remaining: number | null } | null;
  progressHidden: boolean;
}

export interface MyGoal {
  id: string;
  title: string;
  measurementKind: MeasurementKind | null;
  startValue: number | null;
  targetValue: number | null;
  startDate: string;
  targetDate: string | null;
  unit: string | null;
  professional: string;
}

export interface ReminderItem {
  id: string;
  text: string;
  remindAt: string;
  sentAt: string | null;
  cancelledAt: string | null;
}

export interface AppNotificationItem {
  id: string;
  type: string;
  title: string;
  text: string;
  read: boolean;
  createdAt: string;
}

// ───────────── Egzersiz programı ve antrenman kayıtları ─────────────

export interface ProgramExercise {
  id?: string;
  name: string;
  sets: number;
  // "8-10", "30 sn"
  reps: string;
  // "20 kg", "vücut ağırlığı"
  load?: string;
  restSec?: number;
  notes?: string;
  catalogId?: string;
}

export interface ProgramDay {
  id?: string;
  name: string;
  focus?: string;
  exercises: ProgramExercise[];
}

export interface ProgramContent {
  title?: string;
  goal?: string;
  notes?: string;
  weeks?: number;
  days: ProgramDay[];
}

export interface ProgramOverview {
  programId: string | null;
  published: { number: number; approvedAt: string | null; approvedBy: string | null; changeNote: string | null; content: ProgramContent } | null;
  draft: { content: ProgramContent; changeNote: string | null; basedOnNumber: number | null; updatedAt: string } | null;
  versions: PlanVersionInfo[];
}

export interface ProgramCheck {
  canApprove: boolean;
  blockers: { code: 'EMPTY_PROGRAM' | 'DAY_WITHOUT_EXERCISES' | 'HEALTH_INFO_MISSING'; message: string; dayId?: string }[];
  warnings: { ruleCode: string; level: FindingLevel; title: string }[];
}

export interface MyProgramListItem {
  programId: string;
  professional: { name: string; title: string | null };
  number: number;
  approvedAt: string | null;
  title: string | null;
  dayCount: number;
}

export interface MyProgramView extends ProgramContent {
  programId: string;
  professional: { name: string; title: string | null };
  version: { number: number; approvedAt: string | null };
}

export interface WorkoutSet {
  reps: number;
  loadKg?: number;
}

export interface WorkoutEntry {
  exerciseId?: string;
  name: string;
  sets: WorkoutSet[];
}

export interface WorkoutLogInput {
  // YYYY-AA-GG
  date: string;
  dayId?: string;
  entries: WorkoutEntry[];
  // Algılanan efor 1–10
  rpe?: number;
  pain?: boolean;
  painNote?: string;
  note?: string;
}

export interface WorkoutLogItem {
  id: string;
  programId: string | null;
  dayId: string | null;
  date: string;
  entries: WorkoutEntry[];
  rpe: number | null;
  pain: boolean;
  painNote: string | null;
  note: string | null;
  source: DataSource;
  createdAt: string;
}

export interface ExercisePerformance {
  key: string;
  name: string;
  sessions: { date: string; bestLoadKg: number | null; totalReps: number; volumeKg: number }[];
}