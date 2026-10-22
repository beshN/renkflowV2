import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import SSOVerifyPage from '@/app/auth/sso-verify/page';
import { signIn } from 'next-auth/react';

const replace = jest.fn(), refresh = jest.fn();
jest.mock('next/navigation', () => ({ useRouter: () => ({ replace, refresh }) }));
jest.mock('next-auth/react', () => ({ signIn: jest.fn() }));
jest.mock('@/components/app-core/AuthFrame', () => ({ AuthFrame: ({ children }: { children: React.ReactNode }) => <main>{children}</main> }));

beforeEach(() => {
  (signIn as jest.Mock).mockReset();
  window.history.replaceState(null, '', '/auth/sso-verify#' + new URLSearchParams({ email: 'test@example.invalid', ticket: 'a'.repeat(64) }));
});
it('removes the temporary secret from the URL, requests MFA and completes the same ticket after a valid code', async () => {
  (signIn as jest.Mock)
    .mockResolvedValueOnce({ error: 'CredentialsSignin', code: 'otp_required' })
    .mockResolvedValueOnce({ error: 'CredentialsSignin', code: 'otp_invalid' })
    .mockResolvedValueOnce({ ok: true });
  render(<SSOVerifyPage />);
  const code = await screen.findByLabelText(/^Doğrulama kodu/);
  expect(window.location.hash).toBe('');
  expect(window.location.search).toBe('');
  fireEvent.change(code, { target: { value: '123456' } });
  fireEvent.click(screen.getByRole('button', { name: 'Girişi tamamla' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('Kod doğrulanamadı');
  fireEvent.change(code, { target: { value: '654321' } });
  fireEvent.click(screen.getByRole('button', { name: 'Girişi tamamla' }));
  await waitFor(() => expect(replace).toHaveBeenCalledWith('/dashboard'));
  expect(signIn).toHaveBeenLastCalledWith('credentials', { email: 'test@example.invalid', ticket: 'a'.repeat(64), otp: '654321', redirect: false });
});
it('returns an expired ticket to login without creating a session', async () => {
  (signIn as jest.Mock).mockResolvedValue({ error: 'CredentialsSignin', code: 'invalid_credentials' });
  render(<SSOVerifyPage />);
  await waitFor(() => expect(replace).toHaveBeenCalledWith('/auth/login?error=sso_expired'));
  expect(refresh).not.toHaveBeenCalled();
});
