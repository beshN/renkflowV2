import { Suspense } from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import Page from '@/app/(dashboard)/shipments/[id]/load-list/page';
import { requestJson } from '@/lib/shared/network';
jest.mock('@/lib/shared/network', () => ({ requestJson: jest.fn() }));

it('shows mixed units separately and prints only after loading', async () => {
  jest.mocked(requestJson).mockResolvedValue({ ok: true, status: 200, data: { success: true, data: {
    shipment_number: 'S-SYNTHETIC', customer_name: 'Sentetik müşteri', carrier: '', tracking_number: '',
    items: [
      { id: 'a', product_name: 'Sentetik profil', quantity: '2.5', uom: 'm', order_number: 'O-A', order_item_id: 'i-a' },
      { id: 'b', product_name: 'Sentetik paket', quantity: '1', uom: 'adet', order_number: 'O-A', order_item_id: 'i-b' },
    ],
  } } } as never);
  const print = jest.spyOn(window, 'print').mockImplementation(() => {});
  await act(async () => { render(<Suspense fallback={<p>Bekleniyor</p>}><Page params={Promise.resolve({ id: 'synthetic' })} /></Suspense>); });
  await screen.findByRole('heading', { name: 'Yükleme listesi · S-SYNTHETIC' });
  expect(screen.getByText('2.5 m')).toBeInTheDocument();
  expect(screen.getByText('1 adet')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Yazdır / PDF kaydet' }));
  expect(print).toHaveBeenCalledTimes(1);
  print.mockRestore();
});

it('shows denied loads as errors and disables printing', async () => {
  jest.mocked(requestJson).mockResolvedValue({ ok: false, status: 404 } as never);
  await act(async () => { render(<Suspense fallback={<p>Bekleniyor</p>}><Page params={Promise.resolve({ id: 'denied' })} /></Suspense>); });
  expect(await screen.findByRole('alert')).toHaveTextContent('Yükleme listesi alınamadı');
  expect(screen.getByRole('button', { name: 'Yazdır / PDF kaydet' })).toBeDisabled();
});
