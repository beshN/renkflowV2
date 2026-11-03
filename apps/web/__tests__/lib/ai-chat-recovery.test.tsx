import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { AIChat } from '@/components/features/ai/AIChat';
import { AI_CREDIT_MESSAGE } from '@/lib/ai/chat-errors';

test('credit failure is visible, loading clears, and the next turn can succeed without error history', async () => {
  Element.prototype.scrollIntoView = jest.fn();
  const log = jest.spyOn(console, 'error').mockImplementation(() => {});
  const fetchMock = jest.mocked(fetch);
  fetchMock.mockResolvedValueOnce({ ok: false, json: async () => ({ code: 'ai_insufficient_credit', error: AI_CREDIT_MESSAGE }) } as Response);
  fetchMock.mockResolvedValueOnce({ ok: true, json: async () => ({ response: 'Gerçek sağlayıcı yanıtı', suggestions: [] }) } as Response);
  try {
    render(<AIChat />);
    const input = screen.getByPlaceholderText('Bir şey sorun...');
    fireEvent.change(input, { target: { value: 'İşler nasıl?' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(await screen.findByText(AI_CREDIT_MESSAGE)).toBeVisible();
    await waitFor(() => expect(screen.queryByText('Düşünüyorum...')).not.toBeInTheDocument());
    fireEvent.change(input, { target: { value: 'Yeniden dene' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(await screen.findByText('Gerçek sağlayıcı yanıtı')).toBeVisible();
    const body = JSON.parse(String(fetchMock.mock.calls.at(-1)?.[1]?.body));
    expect(body.history.some((turn: { content: string }) => turn.content === AI_CREDIT_MESSAGE)).toBe(false);
  } finally { log.mockRestore(); }
});
