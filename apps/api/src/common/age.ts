// Yaş kuralları — docs/features/accounts-and-profiles.md
// 13 altı kayıt olamaz, 13–17 genç modu, 18+ tüm özellikler.

export const MIN_AGE = 13;
export const ADULT_AGE = 18;

export type AgeGroup = 'CHILD' | 'TEEN' | 'ADULT';

export function ageOn(birthDate: Date, now: Date = new Date()): number {
  let age = now.getUTCFullYear() - birthDate.getUTCFullYear();
  const birthdayPassed =
    now.getUTCMonth() > birthDate.getUTCMonth() ||
    (now.getUTCMonth() === birthDate.getUTCMonth() &&
      now.getUTCDate() >= birthDate.getUTCDate());
  if (!birthdayPassed) age -= 1;
  return age;
}

export function ageGroupOf(birthDate: Date, now: Date = new Date()): AgeGroup {
  const age = ageOn(birthDate, now);
  if (age < MIN_AGE) return 'CHILD';
  if (age < ADULT_AGE) return 'TEEN';
  return 'ADULT';
}
