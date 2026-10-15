import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { AssistantCommand } from '@/components/features/ai/AssistantCommand';
import { requestJson } from '@/lib/shared/network';

jest.mock('next/navigation', () => ({ useSearchParams: () => new URLSearchParams() }));
jest.mock('@/lib/shared/network', () => ({ requestJson: jest.fn() }));

beforeEach(() => jest.clearAllMocks());
it('fills an editable example without executing or creating a preview', () => {
  render(<AssistantCommand />);
  fireEvent.click(screen.getByRole('button', { name: /Stoğu inceleyin/ }));
  expect(screen.getByRole('textbox', { name: 'Komut' })).toHaveValue('Kritik stokları ve sonraki adımları açıkla');
  expect(requestJson).not.toHaveBeenCalled();
});
it('uses a full model-compatible timeout and shows the response source returned by the API', async () => {
  (requestJson as jest.Mock).mockResolvedValue({ ok: true, data: { type: 'answer', title: 'Asistan yanıtı', lines: [], note: 'Kayıtlara dayanan cevap.', processing: { source: 'model', label: 'Claude Sonnet 5.5 ile yanıtlandı' } } });
  render(<AssistantCommand />);
  fireEvent.change(screen.getByRole('textbox', { name: 'Komut' }), { target: { value: 'İşleri nasıl iyileştirebilirim?' } });
  fireEvent.click(screen.getByRole('button', { name: 'Gönder' }));
  await waitFor(() => expect(screen.getByText('Kayıtlara dayanan cevap.')).toBeInTheDocument());
  expect(screen.getByText('Claude Sonnet 5.5 ile yanıtlandı')).toBeInTheDocument();
  expect((requestJson as jest.Mock).mock.calls[0][2]).toEqual({ timeoutMs: 60000 });
});
