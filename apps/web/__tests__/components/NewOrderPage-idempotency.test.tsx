import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import NewOrderPage from '@/app/(dashboard)/new-order/page';
import { requestJson } from '@/lib/shared/network';

jest.mock('next/navigation', () => ({ useRouter: () => ({ push: jest.fn(), replace: jest.fn(), refresh: jest.fn() }) }));
jest.mock('@/lib/context/AuthContext', () => ({ useAuth: () => ({ user: { id: 'user' }, isLoading: false }) }));
jest.mock('@/lib/context/ToastContext', () => ({ useToast: () => ({ showToast: jest.fn() }) }));
jest.mock('@/lib/features/settings/useFunFeatures', () => ({ useFunFeatures: () => false }));
jest.mock('@/components/spells/celebrate', () => ({ celebrate: jest.fn() }));
jest.mock('@/lib/storage/client', () => ({ prepareFileUpload: jest.fn() }));
jest.mock('@/lib/shared/network', () => ({ requestJson: jest.fn() }));
jest.mock('@/components/forms/NewOrderForm', () => ({
  NewOrderForm: ({ onSubmit }: { onSubmit: (data: FormData) => Promise<void> }) =>
    <button onClick={() => void onSubmit(new FormData())}>Submit fixture</button>,
}));

it('keeps the UUID after a timeout and creates a new UUID for a new form instance', async () => {
  const uuid = jest.fn().mockReturnValueOnce('11111111-1111-4111-8111-111111111111').mockReturnValueOnce('22222222-2222-4222-8222-222222222222');
  Object.defineProperty(globalThis.crypto, 'randomUUID', { configurable: true, value: uuid });
  const keys: FormDataEntryValue[] = [];
  jest.mocked(requestJson).mockImplementation(async <T,>(url: RequestInfo | URL, init?: RequestInit) => {
    if (url === '/api/v1/orders') {
      keys.push((init?.body as FormData).get('clientRequestId')!);
      return { ok: false, status: 0, data: null, error: 'Timeout' };
    }
    return { ok: true, status: 200, data: { available: false } as T, error: null };
  });
  const first = render(<NewOrderPage />);
  fireEvent.click(screen.getByText('Submit fixture'));
  await waitFor(() => expect(keys).toHaveLength(1));
  fireEvent.click(screen.getByText('Submit fixture'));
  await waitFor(() => expect(keys).toHaveLength(2));
  expect(keys[0]).toBe(keys[1]);
  first.unmount();
  render(<NewOrderPage />);
  fireEvent.click(screen.getByText('Submit fixture'));
  await waitFor(() => expect(keys).toHaveLength(3));
  expect(keys[2]).not.toBe(keys[0]);
  expect(uuid).toHaveBeenCalledTimes(2);
});
