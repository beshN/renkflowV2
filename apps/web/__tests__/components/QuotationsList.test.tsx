import { fireEvent, render, screen, within } from '@testing-library/react';
import QuotationsPage from '@/app/(dashboard)/quotations/page';
import { requestJson } from '@/lib/shared/network';

jest.mock('next/navigation', () => ({ usePathname: () => '/quotations', useRouter: () => ({ push: jest.fn(), replace: jest.fn() }) }));
jest.mock('@/lib/context/AuthContext', () => ({ useAuth: () => ({ user: { role: 'admin' }, isLoading: false }) }));
jest.mock('@/components/layout/Navbar', () => ({ Navbar: () => null }));
jest.mock('@/lib/shared/network', () => ({ requestJson: jest.fn() }));

const quotation = (overrides: Record<string, unknown>) => ({
  id: 'q-1', quotationNumber: 'TEK-100', customerName: 'Örnek Yapı', status: 'draft',
  totalAmount: 1500, currency: 'TRY', validUntil: null, ...overrides,
});

it('renders quotations without a validity date instead of crashing the list', async () => {
  (requestJson as jest.Mock).mockResolvedValue({ ok: true, status: 200, data: { success: true, data: [
    quotation({}),
    quotation({ id: 'q-2', quotationNumber: 'TEK-101', status: 'sent', totalAmount: 2500, validUntil: '2026-11-01T00:00:00Z' }),
  ] } });
  render(<QuotationsPage />);
  await screen.findByText('TEK-100');
  expect(within(screen.getByRole('table')).getByText('Taslak')).toBeInTheDocument();
  expect(within(screen.getByRole('table')).getByText('Gönderildi')).toBeInTheDocument();
  expect(screen.getByText('01.11.2026')).toBeInTheDocument();
  expect(screen.getByText(/2\.500,00/)).toBeInTheDocument();
});

it('shows a failed request as an error without server detail, and retry reloads the list', async () => {
  (requestJson as jest.Mock)
    .mockResolvedValueOnce({ ok: false, status: 500, data: null, error: 'database detail' })
    .mockResolvedValueOnce({ ok: true, status: 200, data: { success: true, data: [quotation({})] } });
  render(<QuotationsPage />);
  expect(await screen.findByRole('alert')).toHaveTextContent('Teklifler alınamadı.');
  expect(screen.queryByText(/database detail/)).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Tekrar dene' }));
  await screen.findByText('TEK-100');
  expect(screen.queryByRole('alert')).not.toBeInTheDocument();
});

it('treats a success response without a quotation array as a failed load', async () => {
  (requestJson as jest.Mock).mockResolvedValue({ ok: true, status: 200, data: { success: true, data: null } });
  render(<QuotationsPage />);
  expect(await screen.findByRole('alert')).toHaveTextContent('Teklifler alınamadı.');
});
