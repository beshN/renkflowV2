import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { ExtractPanel } from '@/components/features/ai/ExtractPanel';

const json = (status: number, body: unknown) => Promise.resolve({ ok: status < 400, status, json: async () => body, text: async () => JSON.stringify(body) } as Response);
const preview = {
  type: 'preview', suggestionId: 's1', version: 1, usedModel: false,
  request: {
    customer: { value: 'Selin Aydın', confidence: 'medium', source: 'rules' }, phone: { value: '05321234567', confidence: 'high', source: 'rules' }, email: null, address: null,
    lines: [{ family: { value: 'pergola', confidence: 'high', source: 'rules' }, widthMm: { value: 3000, confidence: 'medium', source: 'rules' }, projectionMm: { value: 4000, confidence: 'medium', source: 'rules' }, color: null, quantity: { value: 1, confidence: 'medium', source: 'rules' } }],
    notes: ['Renk belirtilmemiş satır var.'],
  },
};

describe('ExtractPanel', () => {
  it('message → preview: sure fields plain, unsure or missing ones yellow; approval opens the draft', async () => {
    const posts: any[] = [];
    global.fetch = jest.fn((url: string, init?: RequestInit) => {
      posts.push({ url, body: JSON.parse(String(init?.body)) });
      return url.includes('/suggestions/') ? json(200, { status: 'approved', result: { href: '/quotations/q1' } }) : json(200, preview);
    }) as any;
    render(<ExtractPanel />);
    fireEvent.change(screen.getByLabelText('WhatsApp / e-posta metni'), { target: { value: '3x4 pergola istiyoruz Selin Aydın' } });
    fireEvent.click(screen.getByRole('button', { name: 'Teklif taslağı çıkar' }));
    const card = await screen.findByLabelText('Teklif taslağı önizleme');
    const row = (label: string) => within(card).getByText(label).parentElement!;
    expect(row('Telefon').dataset.confidence).toBe('high');
    expect(row('Telefon').className).not.toMatch(/amber/);
    expect(row('Müşteri').className).toMatch(/amber/);
    expect(row('Renk').dataset.confidence).toBe('missing');
    expect(within(card).getByText(/Müşteriye hiçbir şey gönderilmez/)).toBeInTheDocument();
    fireEvent.click(within(card).getByRole('button', { name: /Onayla/ }));
    await waitFor(() => expect(within(card).getByRole('status')).toHaveTextContent('Taslak oluşturuldu'));
    expect(posts[1]).toMatchObject({ url: '/api/v1/ai/suggestions/s1', body: { action: 'approve', expectedVersion: 1 } });
  });
  it('count lists go to the existing line-by-line count import', () => {
    render(<ExtractPanel />);
    fireEvent.click(screen.getByRole('tab', { name: 'Sayım listesi' }));
    expect(screen.getByRole('link', { name: 'Sayım listesi yükle' })).toHaveAttribute('href', '/inventory/count-import');
  });
});
