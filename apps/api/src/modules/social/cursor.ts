// Sayfalama imleci: "zaman|kimlik" (aynı anda oluşan kayıtlar atlanmasın diye kimlikle birlikte).
import { badRequest } from '../../common/app-error.js';

export const encodeCursor = (at: Date, id: string) => Buffer.from(`${at.toISOString()}|${id}`).toString('base64url');

export function decodeCursor(cursor?: string): { at: Date; id: string } | null {
  if (!cursor) return null;
  const [iso, id] = Buffer.from(cursor, 'base64url').toString().split('|');
  const at = new Date(iso ?? '');
  if (!id || Number.isNaN(at.getTime())) throw badRequest('INVALID_CURSOR', 'Sayfa bilgisi geçersiz.');
  return { at, id };
}
