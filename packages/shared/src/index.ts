// Ortak tipler ve kurallar buradan dışarı açılır.

export const ROLE_TYPES = ["USER", "DIETITIAN", "TRAINER", "GYM_MANAGER", "ADMIN"] as const;
export type RoleType = (typeof ROLE_TYPES)[number];

export * from './nutrition';
export * from './seed/foods';
export * from './validation';
