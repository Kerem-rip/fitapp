// Kayıt ve giriş isteklerinin kuralları.
import { z } from 'zod';
import { DOCUMENT_KINDS } from '../../files/document-checks.js';

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
  'yonetici',
  'moderatör',
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

const nameSchema = z.string().trim().min(1, 'Bu alan boş bırakılamaz').max(50);
const citySchema = z.string().trim().min(2, 'Şehir yaz').max(60);
const specialtiesSchema = z.array(z.string().trim().min(2).max(40)).max(6).default([]);

// Profesyonel hesabın alanına özel bilgileri
export const professionalDetailsSchema = z.discriminatedUnion('field', [
  z.object({ field: z.literal('DIETITIAN'), city: citySchema, specialties: specialtiesSchema }),
  z.object({ field: z.literal('TRAINER'), city: citySchema, specialties: specialtiesSchema }),
  z.object({
    field: z.literal('GYM_OWNER'),
    city: citySchema,
    gymName: z.string().trim().min(2, 'Salon adını yaz').max(80),
    gymAddress: z.string().trim().min(5, 'Salon adresini yaz').max(200),
  }),
]);
export type ProfessionalDetails = z.infer<typeof professionalDetailsSchema>;

export const registerStartSchema = z
  .object({
    accountType: z.enum(['USER', 'PROFESSIONAL']),
    email: emailSchema,
    password: passwordSchema,
    username: usernameSchema,
    firstName: nameSchema,
    lastName: nameSchema.optional(),
    // YYYY-AA-GG
    birthDate: z.iso
      .date('Doğum tarihi YYYY-AA-GG biçiminde olmalı')
      .refine((v) => {
        const date = new Date(v);
        return date.getUTCFullYear() >= 1900 && date <= new Date();
      }, 'Geçerli bir doğum tarihi girin'),
    gender: z.enum(['FEMALE', 'MALE', 'OTHER', 'UNSPECIFIED']).default('UNSPECIFIED'),
    // Kullanım koşulları ve KVKK aydınlatma metni kabul edilmeden kayıt olunamaz
    acceptTerms: z.literal(true, 'Kullanım koşullarını kabul etmelisiniz'),
    // Sağlık verisi için açık rıza (isteğe bağlı; sonradan da verilebilir)
    healthDataConsent: z.boolean().default(false),
    professional: professionalDetailsSchema.optional(),
    deviceName: z.string().trim().max(100).optional(),
  })
  .superRefine((value, ctx) => {
    if (value.accountType === 'PROFESSIONAL') {
      if (!value.professional) {
        ctx.addIssue({ code: 'custom', path: ['professional'], message: 'Alan bilgilerini doldur' });
      }
      if (!value.lastName) {
        ctx.addIssue({ code: 'custom', path: ['lastName'], message: 'Soyadını yaz' });
      }
    } else if (value.professional) {
      ctx.addIssue({ code: 'custom', path: ['professional'], message: 'Standart hesapta alan bilgisi olmaz' });
    }
  });
export type RegisterStartDto = z.infer<typeof registerStartSchema>;

export const registerVerifySchema = z.object({
  registrationId: z.uuid(),
  code: z.string().regex(/^\d{6}$/, 'Kod 6 haneli olmalı'),
});
export type RegisterVerifyDto = z.infer<typeof registerVerifySchema>;

export const registerResendSchema = z.object({ registrationId: z.uuid() });
export type RegisterResendDto = z.infer<typeof registerResendSchema>;

export const documentKindSchema = z.object({ kind: z.enum(DOCUMENT_KINDS) });
export type DocumentKindDto = z.infer<typeof documentKindSchema>;

export const usernameQuerySchema = z.object({ username: z.string().trim().toLowerCase().min(1).max(40) });

export const loginSchema = z.object({
  // E-posta veya kullanıcı adı
  identifier: z.string().trim().toLowerCase().min(1).max(254),
  password: z.string().min(1).max(128),
  deviceName: z.string().trim().max(100).optional(),
});
export type LoginDto = z.infer<typeof loginSchema>;

export const refreshSchema = z.object({
  refreshToken: z.string().min(1).max(200),
});
export type RefreshDto = z.infer<typeof refreshSchema>;
