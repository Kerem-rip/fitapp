// Kayıt ve giriş isteklerinin kuralları.
import { z } from 'zod';

// Kullanıcı adı olarak alınamayacak kelimeler
const RESERVED_USERNAMES = new Set([
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
]);

export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .pipe(z.email('Geçerli bir e-posta adresi girin').max(254));

export const passwordSchema = z
  .string()
  .min(8, 'Şifre en az 8 karakter olmalı')
  .max(128, 'Şifre en fazla 128 karakter olabilir');

export const usernameSchema = z
  .string()
  .trim()
  .toLowerCase()
  .pipe(
    z
      .string()
      .regex(
        /^[a-z0-9_.]{3,20}$/,
        'Kullanıcı adı 3-20 karakter olmalı; sadece harf, rakam, nokta ve alt çizgi içerebilir',
      )
      .refine((v) => !RESERVED_USERNAMES.has(v), 'Bu kullanıcı adı alınamaz'),
  );

const nameSchema = z.string().trim().min(1).max(50);

export const registerSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
  username: usernameSchema,
  // YYYY-AA-GG
  birthDate: z.iso
    .date('Doğum tarihi YYYY-AA-GG biçiminde olmalı')
    .refine((v) => {
      const date = new Date(v);
      return date.getUTCFullYear() >= 1900 && date <= new Date();
    }, 'Geçerli bir doğum tarihi girin'),
  firstName: nameSchema.optional(),
  lastName: nameSchema.optional(),
  // Kullanım koşulları ve KVKK aydınlatma metni kabul edilmeden kayıt olunamaz
  acceptTerms: z.literal(true, 'Kullanım koşullarını kabul etmelisiniz'),
  // Sağlık verisi için açık rıza (isteğe bağlı; sonradan da verilebilir)
  healthDataConsent: z.boolean().default(false),
  deviceName: z.string().trim().max(100).optional(),
});
export type RegisterDto = z.infer<typeof registerSchema>;

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1).max(128),
  deviceName: z.string().trim().max(100).optional(),
});
export type LoginDto = z.infer<typeof loginSchema>;

export const refreshSchema = z.object({
  refreshToken: z.string().min(1).max(200),
});
export type RefreshDto = z.infer<typeof refreshSchema>;
