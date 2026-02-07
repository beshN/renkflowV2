// ============================================
// 3. FORM VALIDATION ARCHITECTURE
// React Hook Form + Zod Schema Splitting
// ============================================

import { z } from 'zod';

// ============================================
// BASE SCHEMAS - Reusable Field Validators
// ============================================

export const emailSchema = z
  .string()
  .min(1, 'E-posta adresi gerekli')
  .email('Geçerli bir e-posta adresi girin');

export const passwordSchema = z
  .string()
  .min(8, 'Şifre en az 8 karakter olmalı')
  .regex(/[A-Z]/, 'En az bir büyük harf içermeli')
  .regex(/[a-z]/, 'En az bir küçük harf içermeli')
  .regex(/[0-9]/, 'En az bir rakam içermeli')
  .regex(/[^A-Za-z0-9]/, 'En az bir özel karakter içermeli');

export const phoneSchema = z
  .string()
  .regex(/^(\+90|0)?[0-9]{10}$/, 'Geçerli bir telefon numarası girin');

export const tcknSchema = z
  .string()
  .length(11, 'TC Kimlik No 11 haneli olmalı')
  .regex(/^[0-9]+$/, 'Sadece rakam içermeli');

export const dateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Geçerli bir tarih girin (YYYY-MM-DD)');

export const urlSchema = z
  .string()
  .url('Geçerli bir URL girin')
  .optional()
  .or(z.literal(''));

// ============================================
// MULTI-STEP FORM SCHEMAS
// ============================================

// Step 1: Personal Info
export const personalInfoSchema = z.object({
  firstName: z
    .string()
    .min(2, 'İsim en az 2 karakter olmalı')
    .max(50, 'İsim en fazla 50 karakter olabilir'),
  lastName: z
    .string()
    .min(2, 'Soyisim en az 2 karakter olmalı')
    .max(50, 'Soyisim en fazla 50 karakter olabilir'),
  email: emailSchema,
  phone: phoneSchema,
  birthDate: dateSchema,
});

// Step 2: Address Info
export const addressSchema = z.object({
  street: z
    .string()
    .min(5, 'Adres en az 5 karakter olmalı')
    .max(200, 'Adres en fazla 200 karakter olabilir'),
  city: z.string().min(2, 'Şehir seçin'),
  district: z.string().min(2, 'İlçe seçin'),
  postalCode: z
    .string()
    .regex(/^[0-9]{5}$/, 'Posta kodu 5 haneli olmalı'),
  country: z.string().default('TR'),
});

// Step 3: Account Info
export const accountSchema = z.object({
  username: z
    .string()
    .min(3, 'Kullanıcı adı en az 3 karakter olmalı')
    .max(20, 'Kullanıcı adı en fazla 20 karakter olabilir')
    .regex(/^[a-zA-Z0-9_]+$/, 'Sadece harf, rakam ve alt çizgi kullanılabilir'),
  password: passwordSchema,
  confirmPassword: z.string(),
  termsAccepted: z.literal(true, {
    errorMap: () => ({ message: 'Kullanım koşullarını kabul etmelisiniz' }),
  }),
}).refine((data) => data.password === data.confirmPassword, {
  message: 'Şifreler eşleşmiyor',
  path: ['confirmPassword'],
});

// Step 4: Preferences
export const preferencesSchema = z.object({
  newsletter: z.boolean().default(false),
  notifications: z.object({
    email: z.boolean().default(true),
    sms: z.boolean().default(false),
    push: z.boolean().default(true),
  }),
  language: z.enum(['tr', 'en', 'de', 'fr']).default('tr'),
  theme: z.enum(['light', 'dark', 'system']).default('system'),
});

// ============================================
// COMBINED REGISTRATION SCHEMA
// ============================================

export const registrationSchema = personalInfoSchema
  .merge(addressSchema)
  .merge(accountSchema.omit({ confirmPassword: true, termsAccepted: true }))
  .merge(preferencesSchema);

// ============================================
// STEP CONFIGURATION
// ============================================

export const formSteps = [
  {
    id: 'personal',
    title: 'Kişisel Bilgiler',
    description: 'Temel kişisel bilgilerinizi girin',
    schema: personalInfoSchema,
    fields: ['firstName', 'lastName', 'email', 'phone', 'birthDate'],
  },
  {
    id: 'address',
    title: 'Adres Bilgileri',
    description: 'İletişim adresinizi girin',
    schema: addressSchema,
    fields: ['street', 'city', 'district', 'postalCode', 'country'],
  },
  {
    id: 'account',
    title: 'Hesap Bilgileri',
    description: 'Giriş bilgilerinizi oluşturun',
    schema: accountSchema,
    fields: ['username', 'password', 'confirmPassword', 'termsAccepted'],
  },
  {
    id: 'preferences',
    title: 'Tercihler',
    description: 'Bildirim ve görünüm tercihlerinizi ayarlayın',
    schema: preferencesSchema,
    fields: ['newsletter', 'notifications', 'language', 'theme'],
  },
] as const;

// ============================================
// TYPE EXPORTS
// ============================================

export type PersonalInfoData = z.infer<typeof personalInfoSchema>;
export type AddressData = z.infer<typeof addressSchema>;
export type AccountData = z.infer<typeof accountSchema>;
export type PreferencesData = z.infer<typeof preferencesSchema>;
export type RegistrationData = z.infer<typeof registrationSchema>;

export type StepId = typeof formSteps[number]['id'];

// ============================================
// DYNAMIC SCHEMA BUILDER
// ============================================

export function buildSchemaForStep(stepIndex: number) {
  const step = formSteps[stepIndex];
  if (!step) throw new Error(`Invalid step index: ${stepIndex}`);
  return step.schema;
}

export function buildSchemaUpToStep(stepIndex: number) {
  const schemas = formSteps.slice(0, stepIndex + 1).map(s => s.schema);
  return schemas.reduce((acc, schema) => acc.merge(schema as z.ZodObject<z.ZodRawShape>), z.object({}));
}

// ============================================
// CONDITIONAL VALIDATION
// ============================================

export const conditionalSchema = z.object({
  accountType: z.enum(['personal', 'business']),
  companyName: z.string().optional(),
  taxNumber: z.string().optional(),
}).superRefine((data, ctx) => {
  if (data.accountType === 'business') {
    if (!data.companyName || data.companyName.length < 2) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Şirket adı gerekli',
        path: ['companyName'],
      });
    }
    if (!data.taxNumber || !/^[0-9]{10}$/.test(data.taxNumber)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Geçerli bir vergi numarası girin',
        path: ['taxNumber'],
      });
    }
  }
});

// ============================================
// ASYNC VALIDATION
// ============================================

export const asyncValidators = {
  checkEmailAvailable: async (email: string): Promise<boolean> => {
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 500));
    const takenEmails = ['test@test.com', 'admin@example.com'];
    return !takenEmails.includes(email.toLowerCase());
  },
  
  checkUsernameAvailable: async (username: string): Promise<boolean> => {
    await new Promise(resolve => setTimeout(resolve, 500));
    const takenUsernames = ['admin', 'root', 'test'];
    return !takenUsernames.includes(username.toLowerCase());
  },
};

export const emailSchemaAsync = emailSchema.refine(
  async (email) => await asyncValidators.checkEmailAvailable(email),
  { message: 'Bu e-posta adresi zaten kullanılıyor' }
);

export const usernameSchemaAsync = z
  .string()
  .min(3)
  .refine(
    async (username) => await asyncValidators.checkUsernameAvailable(username),
    { message: 'Bu kullanıcı adı zaten alınmış' }
  );

// ============================================
// FILE VALIDATION
// ============================================

export const fileSchema = z.object({
  file: z
    .instanceof(File)
    .refine((file) => file.size <= 5 * 1024 * 1024, 'Dosya boyutu 5MB\'dan küçük olmalı')
    .refine(
      (file) => ['image/jpeg', 'image/png', 'image/webp'].includes(file.type),
      'Sadece JPEG, PNG veya WebP formatları kabul edilir'
    ),
});

export const multipleFilesSchema = z.object({
  files: z
    .array(z.instanceof(File))
    .min(1, 'En az bir dosya seçin')
    .max(5, 'En fazla 5 dosya yükleyebilirsiniz')
    .refine(
      (files) => files.every(f => f.size <= 5 * 1024 * 1024),
      'Her dosya 5MB\'dan küçük olmalı'
    ),
});

// ============================================
// TRANSFORM & PREPROCESS
// ============================================

export const normalizedEmailSchema = z
  .string()
  .transform((val) => val.toLowerCase().trim())
  .pipe(emailSchema);

export const currencySchema = z
  .string()
  .transform((val) => val.replace(/[^0-9.,]/g, '').replace(',', '.'))
  .transform((val) => parseFloat(val))
  .refine((val) => !isNaN(val) && val >= 0, 'Geçerli bir tutar girin');

export const phoneNormalizedSchema = z
  .string()
  .transform((val) => val.replace(/\D/g, ''))
  .transform((val) => val.startsWith('90') ? val : `90${val.replace(/^0/, '')}`)
  .refine((val) => val.length === 12, 'Geçerli bir telefon numarası girin');
