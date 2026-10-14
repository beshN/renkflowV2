import 'server-only';

import { tableExists } from '@/lib/db/schema-guard';
import { fetchTcmbBulletin, type TcmbBulletin } from './tcmb';

// Stored TCMB rates and the rate in force on a day. The bulletin dated D is announced at 15:30
// and applies from the next day, so the rate for day X is the last bulletin dated before X.

type Db = any;
/** Weekends plus the longest Turkish holiday run (Kurban Bayramı can close the market ~9 days). */
const LOOKBACK_DAYS = 12;

export type EffectiveRate = { currency: string; rate: number; bulletinDate: string; source: 'TCMB' };

const iso = (d: Date) => d.toISOString().slice(0, 10);
const addDays = (date: string, days: number) => iso(new Date(Date.parse(`${date}T00:00:00Z`) + days * 86_400_000));

export async function storeBulletin(db: Db, bulletin: TcmbBulletin): Promise<number> {
  let stored = 0;
  for (const r of bulletin.rates) {
    await db`
      INSERT INTO exchange_rates (bulletin_date, currency, forex_buying, forex_selling, banknote_buying, banknote_selling, bulletin_no)
      VALUES (${bulletin.date}, ${r.currency}, ${r.forexBuying}, ${r.forexSelling}, ${r.banknoteBuying}, ${r.banknoteSelling}, ${bulletin.bulletin})
      ON CONFLICT (bulletin_date, currency) DO UPDATE SET forex_buying = EXCLUDED.forex_buying, forex_selling = EXCLUDED.forex_selling,
        banknote_buying = EXCLUDED.banknote_buying, banknote_selling = EXCLUDED.banknote_selling, bulletin_no = EXCLUDED.bulletin_no, fetched_at = now()`;
    stored++;
  }
  return stored;
}

/** Daily job: stores the latest bulletin (today.xml). */
export async function syncTcmb(db: Db, fetchImpl?: typeof fetch) {
  if (!(await tableExists('exchange_rates'))) return { skipped: true };
  const bulletin = await fetchTcmbBulletin(undefined, fetchImpl);
  if (!bulletin) return { stored: 0 };
  return { date: bulletin.date, stored: await storeBulletin(db, bulletin) };
}

/**
 * The TCMB forex buying rate in force on `onDate` (YYYY-MM-DD) for 1 unit of `currency`. Uses
 * stored bulletins and fetches missing days from the TCMB archive. null for TRY's own rate or when
 * no bulletin is found in the look-back window.
 */
export async function effectiveRate(db: Db, currency: string, onDate: string, fetchImpl?: typeof fetch): Promise<EffectiveRate | null> {
  const code = currency.toUpperCase();
  if (code === 'TRY' || !/^[A-Z]{3}$/.test(code) || !(await tableExists('exchange_rates'))) return null;
  const earliest = addDays(onDate, -LOOKBACK_DAYS);
  const lookup = async () => {
    const [row] = await db`
      SELECT bulletin_date, forex_buying FROM exchange_rates
      WHERE currency = ${code} AND bulletin_date < ${onDate} AND bulletin_date >= ${earliest} AND forex_buying IS NOT NULL
      ORDER BY bulletin_date DESC LIMIT 1`;
    return row ? { currency: code, rate: Number(row.forex_buying), bulletinDate: iso(new Date(row.bulletin_date)), source: 'TCMB' as const } : null;
  };
  // The previous calendar day must be checked even when an older bulletin is stored (it may be newer).
  const yesterday = addDays(onDate, -1);
  const [haveYesterday] = await db`SELECT 1 FROM exchange_rates WHERE bulletin_date = ${yesterday} LIMIT 1`;
  const found = await lookup();
  if (found && (found.bulletinDate === yesterday || haveYesterday)) return found;
  for (let day = yesterday; day >= earliest; day = addDays(day, -1)) {
    if (found && day <= found.bulletinDate) break;
    const bulletin = await fetchTcmbBulletin(day, fetchImpl);
    if (bulletin) {
      await storeBulletin(db, bulletin);
      break;
    }
  }
  return lookup();
}
