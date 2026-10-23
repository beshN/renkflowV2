import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import NewOrderPage from '@/app/(dashboard)/new-order/page';
import { requestJson } from '@/lib/shared/network';
import { prepareFileUpload } from '@/lib/storage/client';
const push = jest.fn(), replace = jest.fn(), refresh = jest.fn(), showToast = jest.fn();
jest.mock('next/navigation', () => ({ useRouter: () => ({ push, replace, refresh }) }));
jest.mock('@/lib/context/AuthContext', () => { const user = { id: 'user' }; return { useAuth: () => ({ user, isLoading: false }) }; });
jest.mock('@/lib/context/ToastContext', () => ({ useToast: () => ({ showToast }) }));
jest.mock('@/lib/shared/network', () => ({ requestJson: jest.fn() }));
jest.mock('@/lib/storage/client', () => ({ prepareFileUpload: jest.fn() }));
jest.mock('@/components/spells/celebrate', () => ({ celebrate: jest.fn() }));
jest.mock('@/components/forms/NewOrderForm', () => ({ NewOrderForm: () => <div>Manual order</div> }));
beforeEach(() => {
  jest.clearAllMocks();
  jest.mocked(requestJson).mockResolvedValue({ ok: true, status: 200, data: { available: true } } as never);
  jest.mocked(prepareFileUpload).mockResolvedValue({ name: 'liste.pdf', mime: 'application/pdf', blobPath: 'uploads/firm/user/pdf', workOrderId: undefined });
});
it('opens the persisted multi-line review instead of discarding extracted items in a legacy single-product form', async () => {
  render(<NewOrderPage />);
  const upload = screen.getByLabelText('Sipariş belgesi seç');
  await waitFor(() => expect(upload).not.toBeDisabled());
  jest.mocked(requestJson).mockResolvedValueOnce({ ok: true, status: 200, data: { success: true, draftId: 'draft-123' } } as never);
  fireEvent.change(upload, { target: { files: [new File(['%PDF-list'], 'liste.pdf', { type: 'application/pdf' })] } });
  await waitFor(() => expect(push).toHaveBeenCalledWith('/production/intake/draft-123'));
  expect(prepareFileUpload).toHaveBeenCalledWith(expect.objectContaining({ name: 'liste.pdf', mime: 'application/pdf' }));
  expect(requestJson).toHaveBeenLastCalledWith('/api/ai/document-extract', expect.objectContaining({ method: 'POST', signal: expect.any(AbortSignal), body: expect.stringContaining('blobPath') }), expect.objectContaining({ timeoutMs: 270000 }));
});
it('shows capability failure with a working retry instead of permanently disabling document upload without explanation', async () => {
  jest.mocked(requestJson).mockResolvedValueOnce({ ok: false, status: 503 } as never);
  render(<NewOrderPage />);
  fireEvent.click(await screen.findByRole('button', { name: 'Tekrar dene' }));
  await waitFor(() => expect(screen.getByLabelText('Sipariş belgesi seç')).not.toBeDisabled());
  expect(screen.queryByRole('alert')).not.toBeInTheDocument();
});
it('keeps a failed extraction retryable and does not navigate to a nonexistent draft', async () => {
  render(<NewOrderPage />);
  const upload = screen.getByLabelText('Sipariş belgesi seç');
  await waitFor(() => expect(upload).not.toBeDisabled());
  jest.mocked(requestJson).mockResolvedValueOnce({ ok: false, status: 503, error: 'Bağlantı kurulamadı.' } as never);
  fireEvent.change(upload, { target: { files: [new File(['%PDF-list'], 'liste.pdf', { type: 'application/pdf' })] } });
  await waitFor(() => expect(showToast).toHaveBeenCalledWith('Bağlantı kurulamadı.', 'error'));
  expect(upload).not.toBeDisabled(); expect(push).not.toHaveBeenCalled();
});
