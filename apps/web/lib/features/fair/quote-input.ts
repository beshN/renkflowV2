import { z } from 'zod';
import { DesignItemsSchema, LocaleSchema, TOKEN_PATTERN } from './design';

/** A quote request as the phone sends it: only name and e-mail are required. */
export const QuoteInput = z
  .object({
    token: z.string().regex(TOKEN_PATTERN),
    /** One per form submission: a retry of the same submission returns the first request. */
    submissionId: z.string().regex(TOKEN_PATTERN),
    /** The design version the phone shows; null when the design is not on the server yet. */
    designVersion: z.number().int().positive().nullish(),
    fairCode: z.string().max(40).nullish(),
    locale: LocaleSchema,
    items: DesignItemsSchema,
    contactName: z.string().trim().min(2).max(200),
    email: z.string().trim().toLowerCase().email().max(200),
    phone: z.string().trim().max(40).nullish().or(z.literal('')),
    companyName: z.string().trim().max(200).nullish(),
    location: z.string().trim().max(200).nullish(),
    note: z.string().trim().max(2000).nullish(),
    privacyAccepted: z.literal(true),
    marketingConsent: z.boolean().default(false),
    /** Honeypot: people never see or fill it. */
    website: z.string().max(200).optional(),
  })
  .strict();

