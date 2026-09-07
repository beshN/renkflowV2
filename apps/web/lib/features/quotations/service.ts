import 'server-only';

import { IQuotationService } from './types';
import { PostgresQuotationService } from './postgres.service';

function createQuotationService(): IQuotationService {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is not defined');
  }

  return new PostgresQuotationService();
}

export const quotationService: IQuotationService = createQuotationService();
