import { z } from 'zod';
import { usernameSchema } from '../../auth/dto/auth.schemas.js';

const nameSchema = z.string().trim().min(1).max(50);

export const updateMeSchema = z.object({
  username: usernameSchema.optional(),
  firstName: nameSchema.nullable().optional(),
  lastName: nameSchema.nullable().optional(),
  bio: z.string().trim().max(300).nullable().optional(),
  isPrivate: z.boolean().optional(),
  // Sosyal profil
  displayName: z.string().trim().max(50).nullable().optional(),
  city: z.string().trim().max(60).nullable().optional(),
  goals: z.string().trim().max(200).nullable().optional(),
  links: z
    .array(
      z.object({
        label: z.string().trim().min(1).max(30),
        url: z.string().trim().max(200).regex(/^https?:\/\/[^\s]+$/i, 'Bağlantı http:// ya da https:// ile başlamalı'),
      }),
    )
    .max(3)
    .optional(),
  sports: z.array(z.string().trim().min(1).max(30)).max(10).optional(),
  // Mesaj gizliliği ve etkinlik durumu
  dmPolicy: z.enum(['EVERYONE', 'FOLLOWING']).optional(),
  showActivity: z.boolean().optional(),
});
export type UpdateMeDto = z.infer<typeof updateMeSchema>;

// Hesap silme, şifre tekrar girilerek onaylanır
export const deleteAccountSchema = z.object({
  password: z.string().min(1).max(128),
});
export type DeleteAccountDto = z.infer<typeof deleteAccountSchema>;
