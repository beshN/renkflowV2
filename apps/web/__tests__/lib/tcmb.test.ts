/**
 * @jest-environment node
 *
 * TCMB bulletin parsing against a real bulletin (13.10.2026, saved from tcmb.gov.tr).
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { fetchTcmbBulletin, parseTcmbXml, tcmbUrl } from '@/lib/features/fx/tcmb';

const xml = readFileSync(join(__dirname, '..', 'fixtures', 'tcmb-13102026.xml'), 'utf8');

describe('TCMB bulletin', () => {
  it('reads the date, bulletin number and every currency', () => {
    const b = parseTcmbXml(xml);
    expect(b.date).toBe('2026-10-13');
    expect(b.bulletin).toBe('2026/193');
    expect(b.rates.length).toBeGreaterThanOrEqual(15);
    expect(new Set(b.rates.map((r) => r.currency)).size).toBe(b.rates.length);
  });

  it('gives per-unit buying and selling rates', () => {
    const b = parseTcmbXml(xml);
    const usd = b.rates.find((r) => r.currency === 'USD')!;
    expect(usd).toMatchObject({ forexBuying: 49.2794, forexSelling: 49.3681, banknoteBuying: 49.2449, banknoteSelling: 49.4422 });
    expect(b.rates.find((r) => r.currency === 'EUR')!.forexBuying).toBe(55.1128);
  });

  it('normalises currencies quoted per 100 units (JPY) to one unit', () => {
    const jpy = parseTcmbXml(xml).rates.find((r) => r.currency === 'JPY')!;
    const raw = Number(/Kod="JPY"[\s\S]*?<ForexBuying>([^<]+)</.exec(xml)![1]);
    expect(jpy.forexBuying).toBeCloseTo(raw / 100, 6);
  });

  it('keeps a currency with no forex quote (SDR-like rows) without inventing one', () => {
    const odd = parseTcmbXml(xml.replace(/(<Currency[^>]*CurrencyCode="DKK"[^>]*>[\s\S]*?)<ForexBuying>[^<]*<\/ForexBuying>/, '$1<ForexBuying></ForexBuying>'));
    expect(odd.rates.find((r) => r.currency === 'DKK')!.forexBuying).toBeNull();
  });

  it('refuses something that is not a bulletin', () => {
    expect(() => parseTcmbXml('<html><body>Bakım</body></html>')).toThrow('kur bülteni değil');
  });

  it('builds the archive URL', () => {
    expect(tcmbUrl('2026-10-13')).toBe('https://www.tcmb.gov.tr/kurlar/202610/13102026.xml');
    expect(tcmbUrl()).toBe('https://www.tcmb.gov.tr/kurlar/today.xml');
  });

  it('treats 404 as "no bulletin that day" and other failures as errors', async () => {
    const reply = (status: number, body = '') => jest.fn(async () => new Response(body, { status })) as unknown as typeof fetch;
    await expect(fetchTcmbBulletin('2026-10-10', reply(404))).resolves.toBeNull();
    await expect(fetchTcmbBulletin('2026-10-13', reply(503))).rejects.toThrow('TCMB 503');
    await expect(fetchTcmbBulletin('2026-10-13', reply(200, xml))).resolves.toMatchObject({ date: '2026-10-13' });
  });
});
