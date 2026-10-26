import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { SetupChecklist } from '@/components/features/onboarding/SetupChecklist';
import { buildChecklist, dismissKey } from '@/lib/features/onboarding/checklist';

let user: { id: string; tenantId: string; role: string } | null = { id: 'u1', tenantId: 't1', role: 'owner' };
jest.mock('@/lib/context/AuthContext', () => ({ useAuth: () => ({ user }) }));

const json = (status: number, body: unknown) => Promise.resolve({ ok: status < 400, status, json: async () => body } as Response);
const partial = buildChecklist({ tenant_profile: true, workstation_setup: false, first_order_created: true, first_operator_invited: false, first_work_order_assigned: false });

// The global setup stubs localStorage with no-op mocks; this suite needs a working store.
const store = new Map<string, string>();
Object.defineProperty(window, 'localStorage', { configurable: true, value: {
  getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => void store.set(k, String(v)),
  removeItem: (k: string) => void store.delete(k), clear: () => store.clear(),
} });

beforeEach(() => {
  user = { id: 'u1', tenantId: 't1', role: 'owner' };
  store.clear();
  global.fetch = jest.fn(() => json(200, { data: partial })) as unknown as typeof fetch;
});

it('shows progress and a link to the page that completes each step', async () => {
  render(<SetupChecklist />);
  expect(await screen.findByRole('heading', { name: 'Kurulum' })).toBeInTheDocument();
  expect(screen.getByText('2/5')).toBeInTheDocument();
  expect(screen.getByRole('link', { name: /İlk işi bir çalışana atayın/ })).toHaveAttribute('href', '/work-orders');
  expect(screen.getByRole('link', { name: /Firma bilgilerini girin.*tamamlandı/ })).toBeInTheDocument();
});

it('hides for good once dismissed', async () => {
  const { container, unmount } = render(<SetupChecklist />);
  fireEvent.click(await screen.findByRole('button', { name: 'Kurulum kartını kapat' }));
  expect(container).toBeEmptyDOMElement();
  expect(localStorage.getItem(dismissKey('u1', 't1'))).toBe('dismissed');
  unmount();
  (global.fetch as jest.Mock).mockClear();
  const again = render(<SetupChecklist />);
  await waitFor(() => expect(again.container).toBeEmptyDOMElement());
  expect(global.fetch).not.toHaveBeenCalled();
});

it('renders nothing for other roles, on API errors and when every step is done', async () => {
  user = { id: 'u1', tenantId: 't1', role: 'worker' };
  const worker = render(<SetupChecklist />);
  expect(worker.container).toBeEmptyDOMElement();
  expect(global.fetch).not.toHaveBeenCalled();
  worker.unmount();

  user = { id: 'u1', tenantId: 't1', role: 'admin' };
  global.fetch = jest.fn(() => json(500, { data: null })) as unknown as typeof fetch;
  const failed = render(<SetupChecklist />);
  await waitFor(() => expect(failed.container).toBeEmptyDOMElement());
  failed.unmount();

  global.fetch = jest.fn(() => Promise.reject(new Error('offline'))) as unknown as typeof fetch;
  const offline = render(<SetupChecklist />);
  await waitFor(() => expect(offline.container).toBeEmptyDOMElement());
  offline.unmount();

  const done = buildChecklist({ tenant_profile: true, workstation_setup: true, first_order_created: true, first_operator_invited: true, first_work_order_assigned: true });
  global.fetch = jest.fn(() => json(200, { data: done })) as unknown as typeof fetch;
  const finished = render(<SetupChecklist />);
  await waitFor(() => expect(localStorage.getItem(dismissKey('u1', 't1'))).toBe('done'));
  expect(finished.container).toBeEmptyDOMElement();
});
