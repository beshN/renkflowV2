import { Suspense } from 'react';
import { renderToString } from 'react-dom/server';
import { act, fireEvent, render, screen, cleanup } from '@testing-library/react';
import Tracking from '@/app/track/[token]/page';
import tr from '@/lib/i18n/locales/tr.json';
import en from '@/lib/i18n/locales/en.json';

jest.mock('@/components/features/product-3d/ProductDialog', () => ({ ProductDialog: () => null }));
jest.mock('@/components/drawing/ProductDrawing', () => ({ ProductDrawing: () => null }));
jest.mock('@/components/colors/ColorSwatch', () => ({ ColorChip: () => null }));

// Isolated API fixture: never persisted or sent to a server.
const order = {
  orderNumber: 'TEST-ORDER', status: 'in_production', deliveryDate: '2026-11-06',
  items: [{ id: 'item', product_name: 'Özel profil RAL 7016', quantity: 2 }], jobs: [],
  shipments: [{ quantity: 2, status: 'delivered', created_at: '2026-11-05T22:30:00Z', carrier: 'Özel taşıyıcı', tracking_number: 'TR-123' }],
};
const originalFetch = global.fetch;
const query = (url: string) => Promise.resolve(Object.fromEntries(new URL(url, 'https://example.test').searchParams));
async function mount(url = '/track/test', response: { ok: boolean; status: number; json: () => Promise<unknown> } = { ok: true, status: 200, json: async () => ({ data: order }) }) {
  window.history.replaceState(null, '', url);
  global.fetch = jest.fn().mockResolvedValue(response);
  const params = Promise.resolve({ token: 'test' });
  await act(async () => { render(<Suspense><Tracking params={params} searchParams={query(url)} /></Suspense>); });
}
beforeEach(() => { Object.defineProperty(navigator, 'language', { configurable: true, value: 'tr-TR' }); });
afterEach(() => { cleanup(); global.fetch = originalFetch; jest.restoreAllMocks(); jest.useRealTimers(); });

test('English URL selects customer copy, headings, free text and Istanbul dates', async () => {
  await mount('/track/test?lang=en');
  expect(screen.getByText('Your profiles are being cut and processed.')).toBeInTheDocument();
  expect(screen.getByText(en.track.eyebrow)).toBeInTheDocument();
  expect(screen.getByText('Shipments')).toBeInTheDocument();
  expect(screen.getByText('Estimated delivery')).toBeInTheDocument();
  expect(screen.getByText('Özel profil RAL 7016')).toBeInTheDocument();
  expect(screen.getByText(/Özel taşıyıcı TR-123/)).toBeInTheDocument();
  expect(screen.getByText(/06\/11\/2026/)).toBeInTheDocument();
  expect(document.documentElement.lang).toBe('en');
  const open = jest.spyOn(window, 'open').mockImplementation(() => null);
  fireEvent.click(screen.getByRole('button', { name: 'Share on WhatsApp' }));
  expect(decodeURIComponent(String(open.mock.calls[0][0]))).toContain('My order TEST-ORDER: Your profiles are being cut and processed.');
});

test('default Turkish preserves the existing copy', async () => {
  await mount();
  expect(screen.getByText('Profilleriniz kesiliyor ve işleniyor.')).toBeInTheDocument();
  expect(screen.getByText('RENK ALÜMİNYUM · SİPARİŞ TAKİBİ')).toBeInTheDocument();
  expect(screen.getByText('Sevkiyat')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: "WhatsApp'ta paylaş" })).toBeInTheDocument();
});

test('TR / EN changes the URL, preserves other URL parts and updates html lang without cookies', async () => {
  await mount('/track/test?other=keep#details');
  const cookie = document.cookie;
  fireEvent.click(screen.getByRole('button', { name: 'EN' }));
  expect(window.location.search).toBe('?other=keep&lang=en');
  expect(window.location.hash).toBe('#details');
  expect(document.documentElement.lang).toBe('en');
  fireEvent.click(screen.getByRole('button', { name: 'TR' }));
  expect(window.location.search).toBe('?other=keep&lang=tr');
  expect(document.documentElement.lang).toBe('tr');
  expect(document.cookie).toBe(cookie);
});

test('navigator English is used only without a valid URL override', async () => {
  Object.defineProperty(navigator, 'language', { configurable: true, value: 'en-US' });
  await mount('/track/test?lang=ar');
  expect(screen.getByText(en.track.eyebrow)).toBeInTheDocument();
  cleanup();
  await mount('/track/test?lang=tr');
  expect(screen.getByText(tr.track.eyebrow)).toBeInTheDocument();
});

test.each(['en', 'tr'] as const)('invalid-link error uses %s copy', async (locale) => {
  await mount(`/track/test?lang=${locale}`, { ok: false, status: 404, json: async () => ({ error: tr.track.invalidLink }) });
  expect(screen.getByRole('alert')).toHaveTextContent((locale === 'en' ? en : tr).track.invalidLink);
});

test('network error is translated and stays translated when switching', async () => {
  window.history.replaceState(null, '', '/track/test?lang=en');
  global.fetch = jest.fn().mockRejectedValue(new Error('network'));
  await act(async () => { render(<Suspense><Tracking params={Promise.resolve({ token: 'test' })} searchParams={query(window.location.href)} /></Suspense>); });
  expect(screen.getByRole('alert')).toHaveTextContent(en.track.loadError);
  fireEvent.click(screen.getByRole('button', { name: 'TR' }));
  expect(screen.getByRole('alert')).toHaveTextContent('Takip bilgisi alınamadı');
});

test('track locale keys match recursively', () => {
  const keys = (value: object, prefix = ''): string[] => Object.entries(value).flatMap(([key, entry]) => typeof entry === 'object' ? keys(entry, `${prefix}${key}.`) : [`${prefix}${key}`]).sort();
  expect(keys(en.track)).toEqual(keys(tr.track));
});


test.each(['en', 'tr'] as const)('loading text uses %s and popstate resynchronizes language', async (locale) => {
  window.history.replaceState(null, '', `/track/test?lang=${locale}`);
  global.fetch = jest.fn().mockReturnValue(new Promise(() => {}));
  await act(async () => { render(<Suspense><Tracking params={Promise.resolve({ token: 'test' })} searchParams={query(window.location.href)} /></Suspense>); });
  expect(screen.getByRole('status')).toHaveTextContent((locale === 'en' ? en : tr).track.loading);
  window.history.replaceState(null, '', '/track/test?lang=tr');
  fireEvent.popState(window);
  expect(document.documentElement.lang).toBe('tr');
});


test('English route searchParams render English before effects run', () => {
  // Fulfilled thenables let use() read route props synchronously during SSR.
  const fulfilled = <T,>(value: T) => Object.assign(Promise.resolve(value), { status: 'fulfilled', value });
  window.history.replaceState(null, '', '/track/test');
  const html = renderToString(<Tracking params={fulfilled({ token: 'test' })} searchParams={fulfilled({ lang: 'en' })} />);
  expect(html).toContain(en.track.eyebrow);
  expect(html).toContain(en.track.loading);
  expect(html).not.toContain(tr.track.eyebrow);
  expect(global.fetch).toBe(originalFetch);
});

test('language buttons expose and visually distinguish the selected language', async () => {
  await mount('/track/test?lang=en');
  const english = screen.getByRole('button', { name: 'EN' });
  const turkish = screen.getByRole('button', { name: 'TR' });
  expect(english).toHaveAttribute('aria-pressed', 'true');
  expect(english).toHaveClass('rf-primary-button');
  expect(turkish).toHaveAttribute('aria-pressed', 'false');
  expect(turkish).toHaveClass('rf-secondary-button');
  fireEvent.click(turkish);
  expect(turkish).toHaveAttribute('aria-pressed', 'true');
  expect(turkish).toHaveClass('rf-primary-button');
  expect(english).toHaveAttribute('aria-pressed', 'false');
  expect(english).toHaveClass('rf-secondary-button');
});

const rateLimited = { ok: false, status: 429, json: async () => { throw new Error('non-JSON rate limit response'); } };
test.each(['en', 'tr'] as const)('429 shows dedicated %s copy and polling recovers', async locale => {
  jest.useFakeTimers();
  await mount(`/track/test?lang=${locale}`, rateLimited);
  expect(screen.getByRole('alert')).toHaveTextContent(locale === 'en'
    ? 'Too many attempts. Please try again shortly.' : 'Çok sık denendi, biraz sonra tekrar deneyin.');
  expect(screen.queryByRole('heading', { name: order.orderNumber })).not.toBeInTheDocument();
  (global.fetch as jest.Mock).mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ data: order }) });
  await act(async () => { jest.advanceTimersByTime(20000); });
  expect(global.fetch).toHaveBeenCalledTimes(2);
  expect(screen.getByRole('heading', { name: order.orderNumber })).toBeInTheDocument();
  expect(screen.queryByRole('alert')).not.toBeInTheDocument();
});

test('429 keeps existing data below its warning and continues polling', async () => {
  jest.useFakeTimers();
  await mount('/track/test?lang=en');
  (global.fetch as jest.Mock).mockResolvedValueOnce(rateLimited);
  await act(async () => { jest.advanceTimersByTime(20000); });
  const warning = screen.getByRole('alert');
  const heading = screen.getByRole('heading', { name: order.orderNumber });
  expect(warning).toHaveTextContent('Too many attempts. Please try again shortly.');
  expect(warning.compareDocumentPosition(heading) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  expect(screen.getByText('Özel profil RAL 7016')).toBeInTheDocument();
  await act(async () => { jest.advanceTimersByTime(20000); });
  expect(global.fetch).toHaveBeenCalledTimes(3);
  expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  expect(heading).toBeInTheDocument();
});


test.each(['tr', 'en'] as const)('404 hides previously loaded data and polling can recover in %s', async locale => {
  jest.useFakeTimers();
  await mount(`/track/test?lang=${locale}`);
  const json = jest.fn().mockRejectedValue(new Error('non-JSON response'));
  (global.fetch as jest.Mock).mockResolvedValueOnce({ ok: false, status: 404, json });
  await act(async () => { jest.advanceTimersByTime(20000); });
  expect(screen.getByRole('alert')).toHaveTextContent((locale === 'en' ? en : tr).track.invalidLink);
  expect(screen.queryByRole('heading', { name: order.orderNumber })).not.toBeInTheDocument();
  expect(screen.queryByText('Özel profil RAL 7016')).not.toBeInTheDocument();
  expect(json).not.toHaveBeenCalled();
  await act(async () => { jest.advanceTimersByTime(20000); });
  expect(screen.getByRole('heading', { name: order.orderNumber })).toBeInTheDocument();
});

test.each([500, 403])('%i preserves data below the generic warning', async status => {
  jest.useFakeTimers();
  await mount('/track/test?lang=en');
  (global.fetch as jest.Mock).mockResolvedValueOnce({ ok: false, status });
  await act(async () => { jest.advanceTimersByTime(20000); });
  expect(screen.getByRole('alert')).toHaveTextContent(en.track.loadError);
  expect(screen.getByRole('heading', { name: order.orderNumber })).toBeInTheDocument();
});
