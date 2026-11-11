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

export type SharedDataType = 'MEALS' | 'WATER' | 'WEIGHT' | 'MEASUREMENTS' | 'PHOTOS' | 'ANAMNESIS';
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
}

export type TimelineItem =
  | { type: 'MEASUREMENT'; at: string; id: string; kind: MeasurementKind; value: number; unit: 'kg' | 'cm' | '%'; method: MeasurementMethod; source: DataSource; voided: boolean; by: string | null }
  | { type: 'ANSWER'; at: string; id: string; questionKey: string; question: string; display: string; source: DataSource; by: string | null }
  | { type: 'NOTE'; at: string; id: string; text: string };

export interface NoteItem {
  id: string;
  text: string;
  createdAt: string;
}
