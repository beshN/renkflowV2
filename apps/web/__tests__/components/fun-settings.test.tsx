import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { FunFeaturesSettings } from '@/components/settings/FunFeaturesSettings';
let canEdit = true;
const mutate = jest.fn();
jest.mock('@/lib/features/settings/useFunFeatures', () => ({ useFunPolicy: () => ({ data: { enabled: true, canEdit }, mutate }) }));
jest.mock('sonner', () => ({ toast: { success: jest.fn(), error: jest.fn() } }));
beforeEach(() => { canEdit = true; global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => ({ enabled: false, canEdit: true }) }); });
it('saves one boolean through the existing firm settings switch without sending a tenant', async () => {
  render(<FunFeaturesSettings />);
  fireEvent.click(screen.getByRole('switch', { name: 'Eğlence özellikleri açık' }));
  await waitFor(() => expect(mutate).toHaveBeenCalledWith({ enabled: false, canEdit: true }));
  const [url, request] = (fetch as jest.Mock).mock.calls[0];
  expect(url).toBe('/api/tenant/fun-features');
  expect(JSON.parse(request.body)).toEqual({ enabled: false });
});
it('does not let a non-manager change the setting', () => {
  canEdit = false;
  render(<FunFeaturesSettings />);
  expect(screen.getByRole('switch')).toBeDisabled();
  fireEvent.click(screen.getByRole('switch'));
  expect(fetch).not.toHaveBeenCalled();
});
