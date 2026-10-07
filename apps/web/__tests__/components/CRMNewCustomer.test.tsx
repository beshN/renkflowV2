import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import CRMPage from '@/app/(dashboard)/crm/page';

let role = 'office';
const showToast = jest.fn();
const push = jest.fn();
jest.mock('next/navigation', () => ({ usePathname: () => '/crm', useRouter: () => ({ push, replace: jest.fn() }) }));
jest.mock('@/lib/context/AuthContext', () => ({ useAuth: () => ({ user: { role }, isLoading: false }) }));
jest.mock('@/lib/context/ToastContext', () => ({ useToast: () => ({ showToast }) }));
jest.mock('@/components/layout/AppleNavbar', () => ({ AppleNavbar: () => null }));

type Call = { url: string; init?: RequestInit };
const calls: Call[] = [];
const json = (status: number, body: unknown) => Promise.resolve({ ok: status < 400, status, json: async () => body } as Response);

function mockApi(onPost: (body: Record<string, unknown>) => Promise<Response>, similar: unknown[] = []) {
  calls.length = 0;
  global.fetch = jest.fn((url: string, init?: RequestInit) => {
    calls.push({ url, init });
    if (init?.method === 'POST') return onPost(JSON.parse(String(init.body)));
    if (url.includes('suggest=1')) return json(200, { customers: similar });
    return json(200, { customers: [], total: 0 });
  }) as unknown as typeof fetch;
}

beforeEach(() => { role = 'office'; showToast.mockClear(); push.mockClear(); });

it('opens the new customer form, sends only the filled fields and opens the new card', async () => {
  mockApi(async () => json(201, { customer: { id: 'c-1', full_name: 'Örnek Yapı' } }));
  render(<CRMPage />);
  fireEvent.click(await screen.findByRole('button', { name: /Yeni Müşteri/ }));
  const dialog = await screen.findByRole('dialog');
  fireEvent.change(within(dialog).getByLabelText('Müşteri adı *'), { target: { value: 'Örnek Yapı' } });
  fireEvent.change(within(dialog).getByLabelText('Telefon'), { target: { value: '0532 000 00 00' } });
  fireEvent.click(within(dialog).getByRole('button', { name: 'Müşteriyi kaydet' }));
  await waitFor(() => expect(showToast).toHaveBeenCalledWith('Örnek Yapı kaydedildi.', 'success'));
  const post = calls.find((c) => c.init?.method === 'POST')!;
  expect(post.url).toBe('/api/v1/customers');
  expect(JSON.parse(String(post.init!.body))).toEqual({ fullName: 'Örnek Yapı', phone: '0532 000 00 00' });
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  expect(push).toHaveBeenCalledWith('/crm/c-1');
});

it('keeps the form open with the server message when saving fails', async () => {
  mockApi(async () => json(400, { error: 'Geçerli bir e-posta girin.' }));
  render(<CRMPage />);
  fireEvent.click(await screen.findByRole('button', { name: /Yeni Müşteri/ }));
  const dialog = await screen.findByRole('dialog');
  fireEvent.change(within(dialog).getByLabelText('Müşteri adı *'), { target: { value: 'Ahmet Usta' } });
  fireEvent.click(within(dialog).getByRole('button', { name: 'Müşteriyi kaydet' }));
  expect(await within(dialog).findByRole('alert')).toHaveTextContent('Geçerli bir e-posta girin.');
  expect(within(dialog).getByLabelText('Müşteri adı *')).toHaveValue('Ahmet Usta');
  expect(showToast).not.toHaveBeenCalled();
});

it('lists similar existing cards while the name is typed', async () => {
  mockApi(async () => json(201, {}), [{ id: 'old', full_name: 'Ahmet Usta', company_name: 'Usta Yapı', phone: null }]);
  render(<CRMPage />);
  fireEvent.click(await screen.findByRole('button', { name: /Yeni Müşteri/ }));
  const dialog = await screen.findByRole('dialog');
  fireEvent.change(within(dialog).getByLabelText('Müşteri adı *'), { target: { value: 'Ahmet' } });
  expect(await within(dialog).findByRole('link', { name: 'Ahmet Usta' })).toHaveAttribute('href', '/crm/old');
});

it('hides customer creation from roles that can only view customers', async () => {
  role = 'accountant';
  mockApi(async () => json(201, {}));
  render(<CRMPage />);
  await screen.findByText('Henüz müşteri yok');
  expect(screen.queryByRole('button', { name: /Yeni Müşteri|Müşteri Ekle/ })).not.toBeInTheDocument();
});

it('treats a saved customer with an unreadable response as saved, not as a failure to retry', async () => {
  mockApi(async () => ({ ok: true, status: 201, json: async () => { throw new SyntaxError('html'); } } as unknown as Response));
  render(<CRMPage />);
  fireEvent.click(await screen.findByRole('button', { name: /Yeni Müşteri/ }));
  const dialog = await screen.findByRole('dialog');
  fireEvent.change(within(dialog).getByLabelText('Müşteri adı *'), { target: { value: 'Ahmet Usta' } });
  fireEvent.click(within(dialog).getByRole('button', { name: 'Müşteriyi kaydet' }));
  await waitFor(() => expect(showToast).toHaveBeenCalledWith('Müşteri kaydedildi.', 'success'));
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
});

it('keeps the last list with one retryable error when a reload fails', async () => {
  let fail = false;
  calls.length = 0;
  global.fetch = jest.fn(async (url: string) => {
    calls.push({ url });
    if (fail) return json(500, { error: 'db' });
    return json(200, { customers: [{ id: 'c1', full_name: 'Örnek Yapı', company_name: null, email: null, phone: null, is_active: true, order_count: '1', total_revenue: '0', last_order_at: null, created_at: '' }], total: 1 });
  }) as unknown as typeof fetch;
  render(<CRMPage />);
  await screen.findByText('Örnek Yapı');
  fail = true;
  fireEvent.change(screen.getByPlaceholderText(/Ara/i), { target: { value: 'x' } });
  expect(await screen.findByRole('alert')).toHaveTextContent('Müşteri listesi yüklenemedi.');
  expect(screen.getAllByRole('alert')).toHaveLength(1);
  expect(screen.getByText('Örnek Yapı')).toBeInTheDocument();
  fail = false;
  fireEvent.click(screen.getByRole('button', { name: 'Tekrar dene' }));
  await waitFor(() => expect(screen.queryByRole('alert')).not.toBeInTheDocument());
});
