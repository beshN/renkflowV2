import 'server-only';

import { IQuotationService } from './types';
import { PostgresQuotationService } from './postgres.service';

function createQuotationService(): IQuotationService {
  return new PostgresQuotationService();
}

export const quotationService: IQuotationService = createQuotationService();
