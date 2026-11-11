// Kayıt kuralları. Backend, mobil ve web aynı kuralları kullanır.

export const MIN_AGE = 13;
export const ADULT_AGE = 18;
export const MIN_PASSWORD_LENGTH = 8;
export const MAX_PASSWORD_LENGTH = 128;

export const USERNAME_PATTERN = /^[a-z0-9_.]{3,20}$/;

// Kullanıcı adı olarak alınamayacak kelimeler
export const RESERVED_USERNAMES: readonly string[] = [
  'admin',
  'administrator',
  'fitapp',
  'destek',
  'support',
  'yardim',
  'help',
  'root',
  'system',
  'moderator',
];

export type AgeGroup = 'CHILD' | 'TEEN' | 'ADULT';

export function ageOn(birthDate: Date, now: Date = new Date()): number {
  let age = now.getUTCFullYear() - birthDate.getUTCFullYear();
  const birthdayPassed =
    now.getUTCMonth() > birthDate.getUTCMonth() ||
    (now.getUTCMonth() === birthDate.getUTCMonth() && now.getUTCDate() >= birthDate.getUTCDate());
  if (!birthdayPassed) age -= 1;
  return age;
}

// 13 altı kayıt olamaz, 13–17 genç modu, 18+ tüm özellikler
export function ageGroupOf(birthDate: Date, now: Date = new Date()): AgeGroup {
  const age = ageOn(birthDate, now);
  if (age < MIN_AGE) return 'CHILD';
  if (age < ADULT_AGE) return 'TEEN';
  return 'ADULT';
}

export function validateEmail(email: string): string | null {
  const value = email.trim();
  if (value.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value)) {
    return 'Geçerli bir e-posta adresi girin';
  }
  return null;
}

export function validateUsername(username: string): string | null {
  const value = username.trim().toLowerCase();
  if (!USERNAME_PATTERN.test(value)) {
    return 'Kullanıcı adı 3-20 karakter olmalı; sadece harf, rakam, nokta ve alt çizgi içerebilir';
  }
  if (RESERVED_USERNAMES.includes(value)) return 'Bu kullanıcı adı alınamaz';
  return null;
}

export function validatePassword(password: string): string | null {
  if (password.length < MIN_PASSWORD_LENGTH) return `Şifre en az ${MIN_PASSWORD_LENGTH} karakter olmalı`;
  if (password.length > MAX_PASSWORD_LENGTH) return `Şifre en fazla ${MAX_PASSWORD_LENGTH} karakter olabilir`;
  return null;
}

// "GG.AA.YYYY" biçimindeki tarihi çözer; geçersizse null döner
export function parseTrDate(text: string): Date | null {
  const match = /^(\d{1,2})\.(\d{1,2})\.(\d{4})$/.exec(text.trim());
  if (!match) return null;
  const day = Number(match[1]);
  const month = Number(match[2]);
  const year = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  const valid =
    date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
  if (!valid || year < 1900 || date.getTime() > Date.now()) return null;
  return date;
}
