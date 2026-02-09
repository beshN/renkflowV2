import 'server-only';

import { sql } from '@/lib/db';
import { isMissingRelationError, tableExists } from '@/lib/db/schema-guard';

export type PeriodCloseStatus = 'open' | 'soft_closed' | 'hard_closed';

export function normalizeAccountingPeriod(period?: string): string {
  if (period && /^\d{4}-\d{2}$/.test(period)) {
    return period;
  }
  return new Date().toISOString().slice(0, 7);
}

export function periodFromDateInput(value: string | Date): string {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    return normalizeAccountingPeriod();
  }
  return date.toISOString().slice(0, 7);
}

export async function getPeriodCloseStatus(
  tenantId: string,
  period: string
): Promise<PeriodCloseStatus> {
  const closeTableReady = await tableExists('accounting_period_closes');
  if (!closeTableReady) {
    return 'open';
  }

  try {
    const result = await sql`
      SELECT status
      FROM accounting_period_closes
      WHERE tenant_id = ${tenantId}
        AND period = ${normalizeAccountingPeriod(period)}
      LIMIT 1
    `;
    const row = (result as any[])[0];
    const status = row?.status as PeriodCloseStatus | undefined;
    if (!status) {
      return 'open';
    }
    return status;
  } catch (error) {
    if (isMissingRelationError(error, ['accounting_period_closes'])) {
      return 'open';
    }
    throw error;
  }
}

export async function assertPeriodWritable(params: {
  tenantId: string;
  period: string;
  actionLabel: string;
}): Promise<void> {
  const normalizedPeriod = normalizeAccountingPeriod(params.period);
  const status = await getPeriodCloseStatus(params.tenantId, normalizedPeriod);

  if (status === 'hard_closed') {
    throw new Error(
      `${normalizedPeriod} dönemi hard close durumunda. ${params.actionLabel} işlemi için önce dönemi açın.`
    );
  }
}

