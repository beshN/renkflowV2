import { render, screen, waitFor } from '@testing-library/react';
import OrderDetailPage from '@/app/(dashboard)/orders/[id]/page';
import { createOrder } from '../helpers/factories';

jest.mock('next/navigation', () => ({ useParams: () => ({ id: 'test-order' }), usePathname: () => '/orders/test-order', useRouter: () => ({ push: jest.fn() }) }));
jest.mock('@/lib/context/AuthContext', () => ({ useAuth: () => ({ user: { role: 'admin' } }) }));
jest.mock('@/lib/context/ToastContext', () => ({ useToast: () => ({ showToast: jest.fn() }) }));
jest.mock('@/components/shared/ui/Chatter', () => ({ Chatter: () => null }));
jest.mock('next/dynamic', () => () => () => null);

function respond(status: number, body: unknown) {
  (global.fetch as jest.Mock).mockResolvedValue({ ok: status === 200, status, text: async () => JSON.stringify(body) });
}

it('loads a listed order from the versioned API response rather than showing a false missing-order screen', async () => {
  respond(200, { success: true, data: createOrder({ orderNumber: 'RF-123', customerName: 'Örnek Yapı' }) });
  render(<OrderDetailPage />);
  await screen.findByRole('heading', { name: 'Sipariş #RF-123' });
  expect(global.fetch).toHaveBeenCalledWith('/api/v1/orders/test-order', expect.anything());
  expect(screen.getByRole('link', { name: 'Sipariş dökümünü yazdır' })).toHaveAttribute('href', '/orders/test-order/invoice');
});

it('offers retry for a failed server request without incorrectly saying the order does not exist', async () => {
  respond(500, { error: 'Bağlantı kurulamadı.' });
  render(<OrderDetailPage />);
  await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('Bağlantı kurulamadı.'));
  expect(screen.getByRole('button', { name: 'Tekrar dene' })).toBeInTheDocument();
  expect(screen.queryByRole('heading', { name: 'Sipariş bulunamadı' })).not.toBeInTheDocument();
});
