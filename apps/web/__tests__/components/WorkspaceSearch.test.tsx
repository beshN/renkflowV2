import { fireEvent, render, screen, within } from '@testing-library/react';
import { WorkspaceSearch } from '@/components/features/search/WorkspaceSearch';

let urlQuery: string | null = null;
jest.mock('next/navigation', () => ({
  usePathname: () => '/search',
  useRouter: () => ({ push: jest.fn(), replace: jest.fn() }),
  useSearchParams: () => (urlQuery === null ? null : new URLSearchParams({ q: urlQuery })),
}));
beforeEach(() => { urlQuery = null; });
jest.mock('@/components/layout/AppleNavbar', () => ({ AppleNavbar: () => null }));

const hit = (id: string, title: string, extra: Record<string, unknown> = {}) => ({ id, title, subtitle: '', meta: '', href: '/x/' + id, ...extra });
const ok = (body: unknown) => Promise.resolve({ ok: true, status: 200, json: async () => body } as Response);

it('shows each searched section with links and hides the ones the role cannot open', async () => {
  global.fetch = jest.fn(() => ok({
    query: 'RF', ordersLimitedToAssigned: false,
    orders: [hit('o1', 'RF-MUX4-9BEE', { subtitle: 'Pergola', status: 'pending', href: '/orders/o1' })],
    customers: [], quotations: null, stock: [hit('i1', 'RF profil', { href: '/inventory/i1' })],
  })) as unknown as typeof fetch;
  render(<WorkspaceSearch initialQuery="RF" />);
  expect(await screen.findByText('2 sonuç')).toHaveAttribute('role', 'status');
  expect(within(screen.getByRole('region', { name: 'Siparişler' })).getByRole('link', { name: /RF-MUX4-9BEE/ })).toHaveAttribute('href', '/orders/o1');
  expect(within(screen.getByRole('region', { name: 'Müşteriler' })).getByText('Bu bölümde sonuç yok.')).toBeInTheDocument();
  expect(screen.queryByRole('region', { name: 'Teklifler' })).not.toBeInTheDocument();
  expect(screen.getByRole('link', { name: /RF profil/ })).toHaveAttribute('href', '/inventory/i1');
  expect((global.fetch as jest.Mock).mock.calls[0][0]).toBe('/api/v1/search/all?q=RF');
});

it('explains why a worker sees only assigned orders instead of a bare zero', async () => {
  global.fetch = jest.fn(() => ok({ query: 'RF', ordersLimitedToAssigned: true, orders: [], customers: null, quotations: null, stock: [] })) as unknown as typeof fetch;
  render(<WorkspaceSearch initialQuery="RF" />);
  expect(await screen.findByText(/Yalnız size atanmış iş emirlerine bağlı siparişlerde/)).toBeInTheDocument();
  expect(screen.getByRole('status')).toHaveTextContent('“RF” için sonuç yok.');
  expect(screen.queryByRole('region', { name: 'Müşteriler' })).not.toBeInTheDocument();
});

it('reports a failed search as an error with retry, never as zero results', async () => {
  global.fetch = jest.fn()
    .mockImplementationOnce(() => Promise.resolve({ ok: false, status: 500, json: async () => ({}) }))
    .mockImplementationOnce(() => ok({ query: 'RF', ordersLimitedToAssigned: false, orders: [hit('o1', 'RF-1', { href: '/orders/o1' })], customers: null, quotations: null, stock: null })) as unknown as typeof fetch;
  render(<WorkspaceSearch initialQuery="RF" />);
  expect(await screen.findByRole('alert')).toHaveTextContent('Arama yapılamadı');
  expect(screen.queryByText(/sonuç yok/)).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Tekrar dene' }));
  expect(await screen.findByRole('link', { name: /RF-1/ })).toBeInTheDocument();
});

it('asks for two characters before searching', () => {
  global.fetch = jest.fn() as unknown as typeof fetch;
  render(<WorkspaceSearch initialQuery="R" />);
  expect(screen.getByRole('status')).toHaveTextContent('en az 2 karakter');
  expect(global.fetch).not.toHaveBeenCalled();
});

it('follows a new ?q= from the command palette even after the box was edited', async () => {
  global.fetch = jest.fn((url: string) => ok({ query: decodeURIComponent(url.split('q=')[1]), ordersLimitedToAssigned: false, orders: [], customers: null, quotations: null, stock: null })) as unknown as typeof fetch;
  urlQuery = 'foo';
  const view = render(<WorkspaceSearch initialQuery="foo" />);
  fireEvent.change(screen.getByRole('searchbox', { name: 'Ara' }), { target: { value: 'bar' } });
  urlQuery = 'bar';
  view.rerender(<WorkspaceSearch initialQuery="foo" />);
  expect(screen.getByRole('searchbox', { name: 'Ara' })).toHaveValue('bar');
  urlQuery = 'foo';
  view.rerender(<WorkspaceSearch initialQuery="foo" />);
  expect(screen.getByRole('searchbox', { name: 'Ara' })).toHaveValue('foo');
  expect(await screen.findByText('“foo” için sonuç yok.')).toBeInTheDocument();
});

it('does not search again when only spaces change', async () => {
  global.fetch = jest.fn(() => ok({ query: 'ali', ordersLimitedToAssigned: false, orders: [], customers: null, quotations: null, stock: null })) as unknown as typeof fetch;
  render(<WorkspaceSearch initialQuery="ali" />);
  await screen.findByText('“ali” için sonuç yok.');
  fireEvent.change(screen.getByRole('searchbox', { name: 'Ara' }), { target: { value: 'ali ' } });
  expect(screen.getByText('“ali” için sonuç yok.')).toBeInTheDocument();
  expect(global.fetch).toHaveBeenCalledTimes(1);
});
