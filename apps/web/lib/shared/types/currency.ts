import { z } from 'zod';
import { normalizeCurrencyInput, type CurrencyCode } from '@/lib/utils/currency';

export const CurrencyCodeSchema = z.enum(['TRY', 'USD', 'EUR', 'GBP']);
export type { CurrencyCode };

export const CurrencySchema = z.preprocess((val) => normalizeCurrencyInput(val), CurrencyCodeSchema).catch('TRY');
