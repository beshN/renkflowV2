import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { TenantSettings } from '@/components/settings/TenantSettings';

jest.mock('sonner', () => ({ toast: { success: jest.fn(), error: jest.fn() } }));
jest.mock('@/lib/context/AuthContext', () => ({
  useAuth: () => ({
    user: { tenantId: 't-1', role: 'owner', tenantName: 'Eski Firma', tenantIndustry: 'Mobilya', templateKey: 'mobilya', brandColor: '#123456', logoUrl: '' },
    refreshUser: jest.fn(),
  }),
}));

beforeEach(() => {
  (global.fetch as jest.Mock | undefined) = jest.fn(async () => ({ ok: true, json: async () => ({ success: true }) })) as unknown as jest.Mock;
});

it('sends only the renamed field for a firm on a legacy template', async () => {
  render(<TenantSettings />);
  expect(screen.getByRole('option', { name: 'Mobilya (mevcut)' })).toBeInTheDocument();
  fireEvent.change(screen.getByLabelText('Firma Adı'), { target: { value: 'Renk Alüminyum' } });
  fireEvent.click(screen.getByRole('button', { name: /Değişiklikleri Kaydet/ }));
  await waitFor(() => expect(global.fetch).toHaveBeenCalled());
  const [url, init] = (global.fetch as jest.Mock).mock.calls[0];
  expect(url).toBe('/api/tenant/update');
  expect(JSON.parse(init.body)).toEqual({ tenantId: 't-1', name: 'Renk Alüminyum' });
});

it('does not call the server when nothing changed', async () => {
  render(<TenantSettings />);
  fireEvent.click(screen.getByRole('button', { name: /Değişiklikleri Kaydet/ }));
  await new Promise((resolve) => setTimeout(resolve, 0));
  expect(global.fetch).not.toHaveBeenCalled();
});
