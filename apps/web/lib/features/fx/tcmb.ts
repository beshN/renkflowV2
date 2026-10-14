// TCMB (Central Bank of the Republic of Türkiye) indicative exchange rates.
//   today:   https://www.tcmb.gov.tr/kurlar/today.xml
//   a day:   https://www.tcmb.gov.tr/kurlar/YYYYMM/DDMMYYYY.xml  (404 on weekends and holidays)
// Rates are per `Unit` foreign units (JPY is per 100); everything here is normalised to 1 unit.
// The Turkish VAT and invoicing practice uses the TCMB forex buying rate (döviz alış) of the day.

export type TcmbRate = {
  currency: string;
  forexBuying: number | null;
  forexSelling: number | null;
  banknoteBuying: number | null;
  banknoteSelling: number | null;
};

export type TcmbBulletin = { date: string; bulletin: string | null; rates: TcmbRate[] };

const BASE = 'https://www.tcmb.gov.tr/kurlar';

function tag(block: string, name: string): string | null {
  const match = new RegExp(`<${name}>([^<]*)</${name}>`).exec(block);
  return match ? match[1].trim() : null;
}

function perUnit(value: string | null, unit: number): number | null {
  if (!value) return null;
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? Number((n / unit).toFixed(6)) : null;
}

/** Parses a TCMB bulletin. Throws on anything that is not one (an HTML error page, a cut-off body). */
export function parseTcmbXml(xml: string): TcmbBulletin {
  const header = /<Tarih_Date\b([^>]*)>/.exec(xml);
  const day = header && /\bTarih="(\d{2})\.(\d{2})\.(\d{4})"/.exec(header[1]);
  if (!header || !day) throw new Error('TCMB yanıtı kur bülteni değil');
  const date = `${day[3]}-${day[2]}-${day[1]}`;
  const bulletin = /\bBulten_No="([^"]*)"/.exec(header[1])?.[1] ?? null;
  const rates: TcmbRate[] = [];
  for (const match of xml.matchAll(/<Currency\b[^>]*\bCurrencyCode="([A-Z]{3})"[^>]*>([\s\S]*?)<\/Currency>/g)) {
    const block = match[2];
    const unit = Number(tag(block, 'Unit') || '1') || 1;
    rates.push({
      currency: match[1],
      forexBuying: perUnit(tag(block, 'ForexBuying'), unit),
      forexSelling: perUnit(tag(block, 'ForexSelling'), unit),
      banknoteBuying: perUnit(tag(block, 'BanknoteBuying'), unit),
      banknoteSelling: perUnit(tag(block, 'BanknoteSelling'), unit),
    });
  }
  if (!rates.length) throw new Error('TCMB bülteninde kur yok');
  return { date, bulletin, rates };
}

export function tcmbUrl(date?: string): string {
  if (!date) return `${BASE}/today.xml`;
  const [y, m, d] = date.split('-');
  return `${BASE}/${y}${m}/${d}${m}${y}.xml`;
}

/** The bulletin of a day, or null when none was published (weekend, holiday, not yet out). */
export async function fetchTcmbBulletin(date?: string, fetchImpl: typeof fetch = fetch): Promise<TcmbBulletin | null> {
  const response = await fetchImpl(tcmbUrl(date), { headers: { Accept: 'application/xml' }, signal: AbortSignal.timeout(15_000), cache: 'no-store' });
  if (response.status === 404) return null;
  if (!response.ok) throw new Error(`TCMB ${response.status}`);
  return parseTcmbXml(await response.text());
}
