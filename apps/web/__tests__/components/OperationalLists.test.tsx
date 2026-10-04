import { render, screen } from '@testing-library/react';
import ShipmentsPage from '@/app/(dashboard)/shipments/page';
import { requestJson } from '@/lib/shared/network';

jest.mock('@/lib/shared/network', () => ({ requestJson: jest.fn() }));

it('shows an unavailable module as a failed request with retry, instead of an empty shipment list', async () => {
  (requestJson as jest.Mock).mockResolvedValue({ ok: false, status: 500, data: null, error: 'internal database detail' });
  render(<ShipmentsPage />);
  await screen.findByText('Kayıtlar yüklenemedi');
  expect(screen.getByRole('alert')).toHaveTextContent('Sevkiyat kayıtları alınamadı.');
  expect(screen.getByRole('button', { name: 'Tekrar dene' })).toBeInTheDocument();
  expect(screen.queryByText('internal database detail')).not.toBeInTheDocument();
});

it('loads shipment records from the live API response', async () => {
  (requestJson as jest.Mock).mockResolvedValue({ ok: true, status: 200, data: { success: true, data: [{ id: 'shipment-1', shipment_number: 'SH-100', customer_name: 'Örnek Cephe', status: 'ready', created_at: '2026-10-03T09:00:00Z' }] } });
  render(<ShipmentsPage />);
  await screen.findByText('SH-100');
  expect(screen.getByText('Örnek Cephe')).toBeInTheDocument();
  expect(screen.queryByRole('alert')).not.toBeInTheDocument();
});
