/** @jest-environment node */
jest.mock('server-only', () => ({}));
jest.mock('@/lib/features/work-orders/security', () => ({ WorkOrderApiError: class extends Error { constructor(message: string, readonly status: number) { super(message); } } }));
import { NextRequest } from 'next/server';
import { requireSameOrigin, requireSameOriginJson } from '@/lib/features/manufacturing/http-security';

function request(headers: Record<string, string>) {
  return new NextRequest('https://firm.renkflow.com/api/v1/office', { method: 'POST', headers: { host: 'firm.renkflow.com', 'content-type': 'application/json', ...headers } });
}
it.each(['http://firm.renkflow.com', 'https://other.renkflow.com', 'https://attacker.invalid', 'null', 'https://user@firm.renkflow.com', 'https://firm.renkflow.com/path'])('rejects foreign or invalid origin %s', origin => {
  expect(() => requireSameOrigin(request({ origin }))).toThrow();
});
it('preserves exact-origin writes and non-browser clients without Origin', () => {
  expect(() => requireSameOriginJson(request({ origin: 'https://firm.renkflow.com' }))).not.toThrow();
  expect(() => requireSameOriginJson(request({ 'content-type': 'application/json; charset=utf-8' }))).not.toThrow();
});
it('does not trust a forwarded host or an alleged same-origin fetch instead of the actual Origin', () => {
  expect(() => requireSameOrigin(request({ origin: 'https://other.renkflow.com', 'x-forwarded-host': 'other.renkflow.com', 'sec-fetch-site': 'same-origin' }))).toThrow();
  expect(() => requireSameOrigin(request({ 'sec-fetch-site': 'cross-site' }))).toThrow();
});
it.each(['application/jsonp', 'application/json-evil', 'text/plain'])('rejects non-JSON content type %s', contentType => {
  expect(() => requireSameOriginJson(request({ 'content-type': contentType }))).toThrow();
});
