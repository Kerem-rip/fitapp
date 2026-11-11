// Başvuru belgelerinin kontrolleri. Otomatik işaretler SADECE "şüpheli" etiketi koyar;
// karar her zaman insan (moderatör/yönetici) tarafından verilir.
import { createHash } from 'node:crypto';

export const DOCUMENT_KINDS = ['diploma', 'certificate', 'business_license'] as const;
export type DocumentKind = (typeof DOCUMENT_KINDS)[number];

export type ProfessionalFieldKey = 'DIETITIAN' | 'TRAINER' | 'GYM_OWNER';

// Alanına göre en az hangi belge türü gerekir (TRAINER için ikisinden biri yeter)
const REQUIRED: Record<ProfessionalFieldKey, readonly DocumentKind[]> = {
  DIETITIAN: ['diploma'],
  TRAINER: ['diploma', 'certificate'],
  GYM_OWNER: ['business_license'],
};

export function documentsSatisfy(field: ProfessionalFieldKey, kinds: readonly string[]): boolean {
  return kinds.some((k) => (REQUIRED[field] as readonly string[]).includes(k));
}

export function allowedKindsFor(field: ProfessionalFieldKey): readonly DocumentKind[] {
  return REQUIRED[field];
}

export interface DetectedType {
  mime: 'application/pdf' | 'image/jpeg' | 'image/png';
}

// Dosya türü uzantıya ya da istemcinin söylediğine göre değil, dosyanın ilk baytlarına göre belirlenir
export function detectFileType(buffer: Buffer): DetectedType | null {
  if (buffer.length >= 5 && buffer.subarray(0, 5).toString('latin1') === '%PDF-') return { mime: 'application/pdf' };
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return { mime: 'image/jpeg' };
  if (buffer.length >= 8 && buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) {
    return { mime: 'image/png' };
  }
  return null;
}

export function sha256(buffer: Buffer): string {
  return createHash('sha256').update(buffer).digest('hex');
}

export const FLAG_DUPLICATE = 'DUPLICATE_DOCUMENT';
export const FLAG_EDITING_TRACE = 'EDITING_SOFTWARE_TRACE';
export const FLAG_TINY_FILE = 'VERY_SMALL_FILE';

export const FLAG_LABELS_TR: Record<string, string> = {
  [FLAG_DUPLICATE]: 'Aynı dosya başka bir başvuruda da kullanılmış',
  [FLAG_EDITING_TRACE]: 'Dosyada görsel düzenleme programı izi var',
  [FLAG_TINY_FILE]: 'Dosya çok küçük (düşük kalite)',
};

const EDITING_SOFTWARE = /photoshop|gimp|canva|illustrator|pixlr|paint\.net|affinity|snapseed|picsart|fotor/i;

// Dosyanın başındaki ve sonundaki üst bilgilerde (PDF/EXIF) düzenleme programı adı arar
export function analyzeDocument(buffer: Buffer): string[] {
  const flags: string[] = [];
  const head = buffer.subarray(0, 256 * 1024).toString('latin1');
  const tail = buffer.length > 256 * 1024 ? buffer.subarray(buffer.length - 128 * 1024).toString('latin1') : '';
  if (EDITING_SOFTWARE.test(head) || EDITING_SOFTWARE.test(tail)) flags.push(FLAG_EDITING_TRACE);
  if (buffer.length < 15 * 1024) flags.push(FLAG_TINY_FILE);
  return flags;
}
