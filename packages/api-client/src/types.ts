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
