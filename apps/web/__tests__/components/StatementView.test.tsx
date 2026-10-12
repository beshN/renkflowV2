import { fireEvent, render, screen } from '@testing-library/react';
import { StatementView } from '@/components/finance/InvoiceScreens';
import { requestJson } from '@/lib/shared/network';

const replace = jest.fn();
jest.mock('next/navigation', () => ({ useRouter: () => ({ replace }), useSearchParams: () => new URLSearchParams() }));
jest.mock('@/lib/shared/network', () => ({ requestJson: jest.fn() }));

it('offers historical customers and navigates using their encoded statement key', async () => {
  (requestJson as jest.Mock).mockResolvedValue({ ok: true, data: { customers: [{ key: 'name:Geçmiş Müşteri', name: 'Geçmiş Müşteri' }] } });
  render(<StatementView />);
  await screen.findByRole('option', { name: 'Geçmiş Müşteri' });
  expect(requestJson).toHaveBeenCalledWith('/api/v1/finance/statement/customers', { cache: 'no-store' });
  fireEvent.change(screen.getByRole('combobox'), { target: { value: 'name:Geçmiş Müşteri' } });
  expect(replace).toHaveBeenCalledWith(expect.stringContaining('customer=name%3AGe%C3%A7mi%C5%9F%20M%C3%BC%C5%9Fteri'));
  expect(screen.getByRole('button', { name: /Yazdır/ })).toBeDisabled();
});

it('reports a failed customer request instead of pretending the firm has no history', async () => {
  (requestJson as jest.Mock).mockResolvedValue({ ok: false, error: 'Yetki doğrulanamadı.' });
  render(<StatementView />);
  expect(await screen.findByRole('alert')).toHaveTextContent('Yetki doğrulanamadı.');
  expect(screen.getByRole('combobox')).toBeDisabled();
});
