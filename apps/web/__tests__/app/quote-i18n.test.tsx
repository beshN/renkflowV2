import { formatCurrency } from '@/lib/utils';
import { renderToString } from 'react-dom/server';
import { Suspense } from 'react';
import { act, fireEvent, render, screen, cleanup, within } from '@testing-library/react';
import Page from '@/app/teklif/[token]/page';
import tr from '@/lib/i18n/locales/tr.json';
import en from '@/lib/i18n/locales/en.json';

jest.mock('@/components/features/product-3d/ProductDialog', () => ({ ProductDialog: ({ label }: { label: string }) => <button>{label}</button> }));
jest.mock('@/components/drawing/ProductDrawing', () => ({ ProductDrawing: () => null }));
jest.mock('@/components/colors/ColorSwatch', () => ({ ColorChip: () => null }));

// API responses exist only inside Jest; nothing is persisted or sent to a server.
const data = {
  firm: 'Özel Firma', quotationNumber: 'TEK-123', revision: 2, customerName: 'Özel Müşteri',
  status: 'sent', decidable: true, decidedAt: null, decidedBy: null, validUntil: '2026-11-06',
  currency: 'EUR', vatPercent: 20, subtotal: 123.45, discountAmount: 4.56, taxAmount: 23.78, totalAmount: 142.67,
  notes: 'Özel teklif notu', terms: 'Özel ödeme koşulu',
  items: [{ productName: 'Özel profil RAL 7016', description: 'Özel açıklama', quantity: 2, unitPrice: 61.72, discountPercent: 5, totalPrice: 123.45 }],
};
const originalFetch = global.fetch;
const routeQuery = () => Promise.resolve(Object.fromEntries(new URLSearchParams(window.location.search)));
const copy = tr.quote;
const english = en.quote;
async function mount(query = '', response?: { ok: boolean; status: number; json: () => Promise<unknown> }) {
  window.history.replaceState(null, '', `/teklif/test${query}`);
  global.fetch = jest.fn().mockResolvedValue(response ?? { ok: true, status: 200, json: async () => ({ data }) });
  await act(async () => { render(<Suspense><Page params={Promise.resolve({ token: 'test' })} searchParams={routeQuery()} /></Suspense>); });
}
beforeEach(() => { Object.defineProperty(navigator, 'language', { configurable: true, value: 'tr-TR' }); });
afterEach(() => { cleanup(); global.fetch = originalFetch; jest.restoreAllMocks(); });

test('English URL translates headings and actions while preserving Turkish declarations and free text', async () => {
  await mount('?lang=en');
  expect(screen.getByRole('heading', { name: english.title })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: english.approve })).toBeInTheDocument();
  expect(screen.getByLabelText(english.name)).toBeInTheDocument();
  expect(screen.getByText(copy.approve)).toBeInTheDocument();
  expect(screen.getByText(copy.declaration).closest('[lang]')).toHaveAttribute('lang', 'tr');
  expect(screen.getByText('The Turkish text is binding.')).toBeInTheDocument();
  expect(screen.getByText(/Özel profil RAL 7016/)).toBeInTheDocument();
  expect(screen.getByText('Özel Firma')).toBeInTheDocument();
  expect(screen.getByText(/Özel Müşteri/)).toBeInTheDocument();
  for (const label of ['Quotation total', 'Subtotal', 'Discount', 'VAT 20%', 'Grand total']) expect(screen.getByText(label)).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Reject' })).toBeInTheDocument();
  expect(screen.getByText('Özel teklif notu')).toBeInTheDocument();
  expect(screen.getByText('Özel ödeme koşulu')).toBeInTheDocument();
  expect(screen.getByText('Özel açıklama')).toBeInTheDocument();
  expect(screen.getByText('Valid until 06/11/2026')).toBeInTheDocument();
  const totals = within(screen.getByRole('region', { name: 'Total' }));
  expect(totals.getByText(formatCurrency(142.67, 'EUR'))).toBeInTheDocument();
});

test('default Turkish retains the original text', async () => {
  await mount();
  expect(screen.getByRole('heading', { name: 'Fiyat teklifi' })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Teklifi onaylıyorum' })).toBeInTheDocument();
  expect(screen.getByText('Ürün kapsamını ve ticari koşulları inceleyerek kararınızı iletebilirsiniz.')).toBeInTheDocument();
  expect(screen.getByLabelText('Adınız soyadınız')).toBeInTheDocument();
  expect(screen.queryByText('The Turkish text is binding.')).not.toBeInTheDocument();
  for (const label of ['Teklif toplamı', 'Ara toplam', 'İndirim', 'KDV %20', 'Genel toplam']) expect(screen.getByText(label)).toBeInTheDocument();
});

test('URL switching and popstate preserve form state and restore document metadata on unmount', async () => {
  document.documentElement.lang = 'original';
  document.title = 'Original title';
  const cookie = document.cookie;
  await mount('?other=keep#details');
  fireEvent.change(screen.getByLabelText(copy.name), { target: { value: 'Özel İsim' } });
  fireEvent.change(screen.getByLabelText(copy.note), { target: { value: 'Özel not' } });
  fireEvent.click(screen.getByRole('button', { name: 'EN' }));
  expect(window.location.search).toBe('?other=keep&lang=en');
  expect(window.location.hash).toBe('#details');
  expect(screen.getByLabelText(english.name)).toHaveValue('Özel İsim');
  expect(screen.getByLabelText(english.note)).toHaveValue('Özel not');
  expect(document.title).toBe(`${english.title} | RenkFlow`);
  expect(document.documentElement.lang).toBe('en');
  window.history.replaceState(null, '', '/teklif/test?lang=tr');
  fireEvent.popState(window);
  expect(screen.getByRole('button', { name: copy.approve })).toBeInTheDocument();
  expect(document.documentElement.lang).toBe('tr');
  expect(document.title).toBe(`${copy.title} | RenkFlow`);
  expect(document.cookie).toBe(cookie);
  cleanup();
  expect(document.documentElement.lang).toBe('original');
  expect(document.title).toBe('Original title');
});

test('navigator English applies only without a valid URL override', async () => {
  Object.defineProperty(navigator, 'language', { configurable: true, value: 'en-US' });
  await mount('?lang=ar');
  expect(screen.getByRole('heading', { name: english.title })).toBeInTheDocument();
  cleanup();
  await mount('?lang=tr');
  expect(screen.getByRole('heading', { name: copy.title })).toBeInTheDocument();
});

test.each([404, 400, 401, 403, 410, 500])('HTTP %i never displays the server error body', async (status) => {
  await mount('?lang=en', { ok: false, status, json: async () => ({ error: 'Gizli sunucu hatası' }) });
  expect(screen.getByRole('alert')).toHaveTextContent(status === 404 ? english.invalidLink : english.loadError);
  expect(screen.queryByText('Gizli sunucu hatası')).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'TR' }));
  expect(screen.getByRole('alert')).toHaveTextContent(status === 404 ? copy.invalidLink : copy.loadError);
});

test('network rejection uses a local error and loading copy follows URL', async () => {
  await mount('?lang=en', { ok: true, status: 200, json: async () => { throw new Error('network'); } });
  expect(screen.getByRole('alert')).toHaveTextContent(english.loadError);
  cleanup();
  window.history.replaceState(null, '', '/teklif/test?lang=en');
  global.fetch = jest.fn().mockReturnValue(new Promise(() => {}));
  await act(async () => { render(<Suspense><Page params={Promise.resolve({ token: 'test' })} searchParams={routeQuery()} /></Suspense>); });
  expect(screen.getByRole('status')).toHaveTextContent(english.loading);
});

test('namespace key sets match exactly', () => {
  expect(Object.keys(english).sort()).toEqual(Object.keys(copy).sort());
});

test.each(['accept', 'reject'] as const)('%s POST body is identical after changing language', async (decision) => {
  await mount();
  fireEvent.change(screen.getByLabelText(copy.name), { target: { value: 'Özel İsim' } });
  fireEvent.change(screen.getByLabelText(copy.note), { target: { value: 'Özel not' } });
  const post = jest.mocked(global.fetch);
  post.mockResolvedValue({ ok: false, status: 500, json: async () => ({ error: 'Sunucu ayrıntısı' }) } as Response);
  await act(async () => { fireEvent.click(screen.getByRole('button', { name: decision === 'accept' ? copy.approve : copy.reject })); });
  const first = post.mock.calls.at(-1)![1]!.body;
  fireEvent.click(screen.getByRole('button', { name: 'EN' }));
  await act(async () => { fireEvent.click(screen.getByRole('button', { name: decision === 'accept' ? english.approve : english.reject })); });
  expect(post.mock.calls.at(-1)![1]!.body).toBe(first);
  expect(JSON.parse(String(first))).toEqual({ decision, name: 'Özel İsim', note: 'Özel not' });
  expect(screen.getByRole('alert')).toHaveTextContent(english.submitError);
  expect(screen.queryByText('Sunucu ayrıntısı')).not.toBeInTheDocument();
});

test.each(['accepted', 'rejected'])('completed %s status and Istanbul time use English', async (status) => {
  await mount('?lang=en', { ok: true, status: 200, json: async () => ({ data: { ...data, status, decidedBy: 'Özel İsim', decidedAt: '2026-11-05T22:30:00Z' } }) });
  expect(screen.getByRole('status')).toHaveTextContent(status === 'accepted' ? 'Approved' : 'Rejected');
  expect(screen.getByText(/Özel İsim/)).toHaveTextContent('06/11/2026');
});

test('English route searchParams render an English heading before effects', () => {
  const fulfilled = <T,>(value: T) => Object.assign(Promise.resolve(value), { status: 'fulfilled', value });
  window.history.replaceState(null, '', '/teklif/test');
  const html = renderToString(<Page params={fulfilled({ token: 'test' })} searchParams={fulfilled({ lang: 'en' })} />);
  expect(html).toContain(`<h1 class="rf-page-title">${english.title}</h1>`);
  expect(html).not.toContain(copy.title);
  expect(global.fetch).toBe(originalFetch);
});

test.each(['tr', 'en'] as const)('GET 429 uses dedicated %s copy without parsing a body', async locale => {
  const messages = locale === 'en' ? english : copy;
  const json = jest.fn().mockRejectedValue(new Error('non-JSON response'));
  await mount(`?lang=${locale}`, { ok: false, status: 429, json });
  expect(screen.getByRole('alert')).toHaveTextContent(messages.rateLimited);
  expect(json).not.toHaveBeenCalled();
});

test.each(['tr', 'en'] as const)('POST error mapping and 409 reload use %s copy', async locale => {
  const messages = locale === 'en' ? english : copy;
  await mount(`?lang=${locale}`);
  fireEvent.change(screen.getByLabelText(messages.name), { target: { value: 'Özel İsim' } });

  const fetch = jest.mocked(global.fetch);
  for (const [status, key] of [[404, 'invalidLink'], [429, 'rateLimited'], [400, 'checkFields'], [422, 'submitError'], [500, 'submitError']] as const) {
    // 422 is not emitted by these services; it must stay a generic failure.
    const json = jest.fn().mockResolvedValue({ error: 'Sunucunun Türkçe ayrıntısı' });
    fetch.mockResolvedValueOnce({ ok: false, status, json } as unknown as Response);
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: messages.approve })); });
    expect(screen.getByRole('alert')).toHaveTextContent(messages[key]);
    expect(screen.queryByText('Sunucunun Türkçe ayrıntısı')).not.toBeInTheDocument();
    expect(json).not.toHaveBeenCalled();
  }
  const before = fetch.mock.calls.length;
  fetch.mockResolvedValueOnce({ ok: false, status: 409 } as Response);
  fetch.mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ data: { ...data, status: 'accepted', decidable: false, decidedBy: 'Özel İmza' } }) } as Response);
  await act(async () => { fireEvent.click(screen.getByRole('button', { name: messages.approve })); });
  expect(fetch).toHaveBeenCalledTimes(before + 2);
  expect(fetch.mock.calls.at(-1)).toEqual(['/api/v1/public/quotes/test', { cache: 'no-store' }]);
  expect(screen.getByText(messages.alreadyDecided)).toBeInTheDocument();
  expect(screen.getByText(/Özel İmza/)).toBeInTheDocument();
  expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: messages.approve })).not.toBeInTheDocument();
});

test('language buttons use the shared selected styles', async () => {
  await mount('?lang=en');
  expect(screen.getByRole('button', { name: 'EN' })).toHaveClass('rf-primary-button');
  expect(screen.getByRole('button', { name: 'TR' })).toHaveClass('rf-secondary-button');
  fireEvent.click(screen.getByRole('button', { name: 'TR' }));
  expect(screen.getByRole('button', { name: 'TR' })).toHaveClass('rf-primary-button');
  expect(screen.getByRole('button', { name: 'EN' })).toHaveClass('rf-secondary-button');
});
