/** @jest-environment node */
jest.mock('server-only', () => ({}));
jest.mock('@/lib/features/work-orders/security', () => ({ WorkOrderApiError: class extends Error { constructor(message: string, readonly status: number) { super(message); } } }));
import { readJsonBody, requireJsonBody } from '@/lib/security/request-body.server';

function streamed(parts: Uint8Array[], headers: Record<string, string> = {}, cancel: () => void | PromiseLike<void> = jest.fn()) {
  let index = 0;
  const body = new ReadableStream<Uint8Array>({ pull(controller) { if (index === parts.length) controller.close(); else controller.enqueue(parts[index++]); }, cancel });
  return new Request('https://renkflow.example/test', { method: 'POST', headers: { 'content-type': 'application/json', ...headers }, body, duplex: 'half' } as RequestInit);
}
const bytes = (text: string) => new TextEncoder().encode(text);

it.each<Record<string, string>>([{}, { 'content-length': '1' }])('rejects oversized actual bodies even with an absent or understated length %j', async headers => {
  const cancel = jest.fn();
  await expect(readJsonBody(streamed([bytes('{"a":"'), bytes('123456789'), bytes('"}')], headers, cancel), 10)).rejects.toMatchObject({ status: 413 });
  expect(cancel).toHaveBeenCalledTimes(1);
});
it('counts UTF-8 bytes, accepts the exact limit and joins split characters', async () => {
  const body = bytes('{"ad":"İşçi"}');
  expect(await readJsonBody(streamed([body.subarray(0, 8), body.subarray(8)]), body.length)).toEqual({ ad: 'İşçi' });
  await expect(readJsonBody(streamed([body]), body.length - 1)).rejects.toMatchObject({ status: 413 });
});
it.each(['-1', 'NaN', 'Infinity', '1.2', '9007199254740992'])('rejects invalid declared size %s', length => {
  expect(() => requireJsonBody(new Request('https://renkflow.example', { headers: { 'content-type': 'application/json', 'content-length': length } }))).toThrow('Geçersiz istek boyutu');
});
it.each(['application/jsonp', 'text/plain'])('rejects deceptive media type %s', async type => {
  await expect(readJsonBody(streamed([bytes('{}')], { 'content-type': type }))).rejects.toMatchObject({ status: 415 });
});
it.each(['', '{bad', 'null garbage'])('maps malformed JSON to 400', async body => {
  await expect(readJsonBody(streamed([bytes(body)]))).rejects.toMatchObject({ status: 400 });
});
it('rejects invalid UTF-8 instead of silently substituting replacement characters', async () => {
  await expect(readJsonBody(streamed([new Uint8Array([123, 34, 120, 34, 58, 34, 255, 34, 125])]))).rejects.toMatchObject({ status: 400 });
});
it('normalizes interrupted body reads and releases the reader lock', async () => {
  const request = new Request('https://renkflow.example', { method: 'POST', headers: { 'content-type': 'application/json' }, body: new ReadableStream({ pull() { throw new Error('private transport details'); } }), duplex: 'half' } as RequestInit);
  await expect(readJsonBody(request)).rejects.toMatchObject({ status: 400, message: 'İstek okunamadı. Tekrar deneyin.' });
  expect(request.body?.locked).toBe(false);
});
it('keeps 413 when cancellation itself fails', async () => {
  await expect(readJsonBody(streamed([bytes('123456789')], {}, () => Promise.reject(new Error('cancel failed'))), 2)).rejects.toMatchObject({ status: 413 });
});
