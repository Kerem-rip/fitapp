// Rozet ve görünen ad: sosyal profil, takip listeleri ve gönderilerde ortak kullanılır.
import type { ProfessionalType, RoleType } from '../../generated/prisma/enums.js';

export interface Badge {
  kind: ProfessionalType;
  label: string;
}

const BADGE_LABELS: Record<ProfessionalType, string> = {
  DIETITIAN: 'Diyetisyen',
  TRAINER: 'Antrenör',
  GYM: 'Spor salonu',
};
// Rozetin dayandığı rol (rol, başvuru onaylanınca verilir)
const ROLE_OF: Record<ProfessionalType, RoleType> = { DIETITIAN: 'DIETITIAN', TRAINER: 'TRAINER', GYM: 'GYM_MANAGER' };
export const PROFESSIONAL_ROLES: readonly RoleType[] = ['DIETITIAN', 'TRAINER', 'GYM_MANAGER'];

type BadgeSource = { roles: { role: RoleType }[]; professionalProfile: { type: ProfessionalType; verification: string } | null };

export function badgesOf(row: BadgeSource): Badge[] {
  const p = row.professionalProfile;
  if (!p || p.verification !== 'APPROVED') return [];
  if (!row.roles.some((r) => r.role === ROLE_OF[p.type])) return [];
  return [{ kind: p.type, label: BADGE_LABELS[p.type] }];
}

export const isVerifiedProfessional = (row: BadgeSource) => badgesOf(row).length > 0;

export function displayNameOf(row: { username: string; firstName: string | null; lastName: string | null; profile: { displayName: string | null } | null }) {
  return row.profile?.displayName?.trim() || [row.firstName, row.lastName].filter(Boolean).join(' ') || row.username;
}
