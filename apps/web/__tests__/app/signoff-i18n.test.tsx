import { renderToString } from 'react-dom/server';
import { Suspense } from 'react';
import { act, fireEvent, render, screen, cleanup } from '@testing-library/react';
import Page from '@/app/teslim/[token]/page';
import tr from '@/lib/i18n/locales/tr.json';
import en from '@/lib/i18n/locales/en.json';

jest.mock('@/components/features/product-3d/ProductDialog', () => ({ ProductDialog: ({ label }: { label: string }) => <button>{label}</button> }));
jest.mock('@/components/drawing/ProductDrawing', () => ({ ProductDrawing: () => null }));
jest.mock('@/components/colors/ColorSwatch', () => ({ ColorChip: () => null }));

// API responses exist only inside Jest; nothing is persisted or sent to a server.
const data = {
  firm: 'Özel Firma', number: 'MON-123', orderNumber: 'SIP-123', customerName: 'Özel Müşteri', date: '2026-11-06', status: 'completed',
  items: [{ productName: 'Özel profil RAL 7016', quantity: 2, color: 'Özel renk' }],
  checklist: [{ title: 'Özel kontrol', done: true }, { title: 'Diğer kontrol', done: false }],
  issues: [{ kind: 'missing', text: 'Özel eksik notu' }, { kind: 'damage', text: 'Özel hasar notu' }], signed: null,
};
const originalFetch = global.fetch;
const routeQuery = () => Promise.resolve(Object.fromEntries(new URLSearchParams(window.location.search)));
const copy = tr.signoff;
const english = en.signoff;
async function mount(query = '', response?: { ok: boolean; status: number; json: () => Promise<unknown> }) {
  window.history.replaceState(null, '', `/teslim/test${query}`);
  global.fetch = jest.fn().mockResolvedValue(response ?? { ok: true, status: 200, json: async () => data });
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
  for (const label of ['Installed products', 'Checklist', 'Recorded missing items / damage', 'Özel kontrol', 'Diğer kontrol']) expect(screen.getByText(label)).toBeInTheDocument();
  expect(screen.getByText('Missing: Özel eksik notu')).toBeInTheDocument();
  expect(screen.getByText('Damage: Özel hasar notu')).toBeInTheDocument();
  expect(screen.getByText(/order SIP-123 · installation MON-123 · 06\/11\/2026/)).toBeInTheDocument();
});

test('default Turkish retains the original text', async () => {
  await mount();
  expect(screen.getByRole('heading', { name: 'Montaj teslim onayı' })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Teslimi onayla' })).toBeInTheDocument();
  expect(screen.getByText('Yukarıdaki montajı teslim aldım; not edilen eksikler dışında iş tamamdır.')).toBeInTheDocument();
  expect(screen.getByLabelText('Adınız soyadınız')).toBeInTheDocument();
  expect(screen.queryByText('The Turkish text is binding.')).not.toBeInTheDocument();
  for (const label of ['Monte edilen ürünler', 'Kontrol listesi', 'Not edilen eksik / hasar']) expect(screen.getByText(label)).toBeInTheDocument();
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
  window.history.replaceState(null, '', '/teslim/test?lang=tr');
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
  window.history.replaceState(null, '', '/teslim/test?lang=en');
  global.fetch = jest.fn().mockReturnValue(new Promise(() => {}));
  await act(async () => { render(<Suspense><Page params={Promise.resolve({ token: 'test' })} searchParams={routeQuery()} /></Suspense>); });
  expect(screen.getByRole('status')).toHaveTextContent(english.loading);
});

test('namespace key sets match exactly', () => {
  expect(Object.keys(english).sort()).toEqual(Object.keys(copy).sort());
});

test('POST body is identical after changing language', async () => {
  await mount();
  fireEvent.change(screen.getByLabelText(copy.name), { target: { value: 'Özel İsim' } });
  fireEvent.change(screen.getByLabelText(copy.note), { target: { value: 'Özel not' } });
  fireEvent.click(screen.getByRole('checkbox'));
  const post = jest.mocked(global.fetch);
  post.mockResolvedValue({ ok: false, status: 500, json: async () => ({ error: 'Sunucu ayrıntısı' }) } as Response);
  await act(async () => { fireEvent.click(screen.getByRole('button', { name: copy.approve })); });
  const first = post.mock.calls.at(-1)![1]!.body;
  fireEvent.click(screen.getByRole('button', { name: 'EN' }));
  expect(screen.getByRole('checkbox')).toBeChecked();
  await act(async () => { fireEvent.click(screen.getByRole('button', { name: english.approve })); });
  expect(post.mock.calls.at(-1)![1]!.body).toBe(first);
  expect(JSON.parse(String(first))).toEqual({ name: 'Özel İsim', accept: true, note: 'Özel not' });
  expect(screen.getByRole('alert')).toHaveTextContent(english.submitError);
});

test('signed delivery uses English and Istanbul timestamp without translating the name', async () => {
  await mount('?lang=en', { ok: true, status: 200, json: async () => ({ ...data, signed: { name: 'Özel İsim', at: '2026-11-05T22:30:00Z' } }) });
  expect(screen.getByRole('status')).toHaveTextContent('Received by Özel İsim on 6 Nov 2026, 01:30.');
});

test('English route searchParams render an English heading before effects', () => {
  const fulfilled = <T,>(value: T) => Object.assign(Promise.resolve(value), { status: 'fulfilled', value });
  window.history.replaceState(null, '', '/teslim/test');
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
  fireEvent.click(screen.getByRole('checkbox'));
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
  fetch.mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ ...data, signed: { name: 'Özel İmza', at: '2026-11-05T22:30:00Z' } }) } as Response);
  await act(async () => { fireEvent.click(screen.getByRole('button', { name: messages.approve })); });
  expect(fetch).toHaveBeenCalledTimes(before + 2);
  expect(fetch.mock.calls.at(-1)).toEqual(['/api/v1/public/signoff/test', { cache: 'no-store' }]);
  expect(screen.getByText(messages.alreadySigned)).toBeInTheDocument();
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
