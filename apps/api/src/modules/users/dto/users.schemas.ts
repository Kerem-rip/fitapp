import { z } from 'zod';
import { usernameSchema } from '../../auth/dto/auth.schemas.js';

const nameSchema = z.string().trim().min(1).max(50);

export const updateMeSchema = z.object({
  username: usernameSchema.optional(),
  firstName: nameSchema.nullable().optional(),
  lastName: nameSchema.nullable().optional(),
  bio: z.string().trim().max(300).nullable().optional(),
  isPrivate: z.boolean().optional(),
});
export type UpdateMeDto = z.infer<typeof updateMeSchema>;

// Hesap silme, şifre tekrar girilerek onaylanır
export const deleteAccountSchema = z.object({
  password: z.string().min(1).max(128),
});
export type DeleteAccountDto = z.infer<typeof deleteAccountSchema>;
