import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { SuggestionsPanel } from '@/components/features/ai/SuggestionsPanel';

const showToast = jest.fn();
jest.mock('@/lib/context/ToastContext', () => ({ useToast: () => ({ showToast }) }));

const suggestion = {
  id: 's1', kind: 'cutting_plan', kindLabel: 'Kesim planı', title: '3 iş emri için kesim planı', rationale: 'Aynı profil ve renk.',
  payload: { kerfMm: 3 }, affected: [{ entityType: 'work_order', entityId: 'w1', label: 'İE-12', href: '/work-orders/w1' }],
  uncertain: true, uncertaintyNote: 'Testere kalınlığı varsayılan.', source: 'system', model: null, edited: false, version: 1,
  editableFields: [{ key: 'kerfMm', label: 'Testere payı', type: 'number', min: 0, unit: 'mm' }],
};
const json = (status: number, body: unknown) => Promise.resolve({ ok: status < 400, status, json: async () => body } as Response);
let posts: Array<{ url: string; body: any }> = [];

function mockApi(decision: (body: any) => Promise<Response>, list: unknown = { available: true, items: [suggestion] }) {
  posts = [];
  global.fetch = jest.fn((url: string, init?: RequestInit) => {
    if (init?.method === 'POST') { const body = JSON.parse(String(init.body)); posts.push({ url, body }); return decision(body); }
    return json(200, list);
  }) as unknown as typeof fetch;
}

beforeEach(() => showToast.mockClear());

it('renders nothing when the queue is not installed or empty', async () => {
  mockApi(async () => json(200, {}), { available: false, items: [] });
  const { container } = render(<SuggestionsPanel />);
  await waitFor(() => expect(global.fetch).toHaveBeenCalled());
  expect(container).toBeEmptyDOMElement();
});

it('shows the suggestion with its reason, uncertainty and affected records, and approves it in one click', async () => {
  mockApi(async () => json(200, { status: 'approved', result: {} }));
  render(<SuggestionsPanel />);
  const region = await screen.findByRole('region', { name: 'Önerilenler' });
  // Reasons sit behind the (i) tip, not as paragraphs on the card.
  expect(within(region).queryByText(/Aynı profil ve renk\./)).not.toBeInTheDocument();
  fireEvent.click(within(region).getByRole('button', { name: 'Gerekçe' }));
  expect(await screen.findByText(/Aynı profil ve renk\./)).toBeInTheDocument();
  expect(within(region).getByRole('note')).toHaveTextContent('Emin değil');
  fireEvent.click(within(region).getByRole('button', { name: 'Neden emin değil' }));
  expect(await screen.findByText('Testere kalınlığı varsayılan.')).toBeInTheDocument();
  expect(within(region).getByRole('link', { name: 'İE-12' })).toHaveAttribute('href', '/work-orders/w1');
  fireEvent.click(within(region).getByRole('button', { name: /Onayla/ }));
  await waitFor(() => expect(screen.queryByRole('region', { name: 'Önerilenler' })).not.toBeInTheDocument());
  expect(posts[0]).toEqual({ url: '/api/v1/ai/suggestions/s1', body: { expectedVersion: 1, action: 'approve' } });
});

it('keeps the suggestion with the server reason when approval is refused', async () => {
  mockApi(async () => json(409, { error: 'Stok değişti; öneri artık geçerli değil.' }));
  render(<SuggestionsPanel />);
  fireEvent.click(await screen.findByRole('button', { name: /Onayla/ }));
  expect(await screen.findByRole('alert')).toHaveTextContent('Stok değişti');
  expect(screen.getByRole('region', { name: 'Önerilenler' })).toBeInTheDocument();
});

it('edits only the declared fields and keeps the suggestion pending for approval', async () => {
  mockApi(async (body) => json(200, { status: 'pending', version: 2, payload: { kerfMm: body.payload.kerfMm } }));
  render(<SuggestionsPanel />);
  fireEvent.click(await screen.findByRole('button', { name: /Düzenle/ }));
  fireEvent.change(screen.getByLabelText('Testere payı (mm)'), { target: { value: '4' } });
  fireEvent.click(screen.getByRole('button', { name: 'Düzeltmeyi kaydet' }));
  await waitFor(() => expect(showToast).toHaveBeenCalledWith('Düzeltme kaydedildi. Öneri onayınızı bekliyor.', 'success'));
  expect(posts[0].body).toMatchObject({ action: 'edit', expectedVersion: 1, payload: { kerfMm: 4 } });
  expect(screen.getByText(/düzenlendi/)).toBeInTheDocument();
});
