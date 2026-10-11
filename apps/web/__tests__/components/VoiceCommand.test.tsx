import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { VoiceCommand } from '@/components/features/ai/VoiceCommand';

const json = (body: unknown) => Promise.resolve({ ok: true, status: 200, json: async () => body, text: async () => JSON.stringify(body) } as Response);
let recognizer: any;
class FakeRec { lang = ''; interimResults = false; maxAlternatives = 1; onresult: any; onend: any; onerror: any; constructor() { recognizer = this; } start() {} stop() {} }

function setup(voice: boolean, posts: any[] = []) {
  global.fetch = jest.fn((url: string, init?: RequestInit) => {
    if (init?.method === 'POST') { posts.push({ url, body: JSON.parse(String(init.body)) }); return json({ ok: true }); }
    if (url.includes('/ai/features')) return json({ mode: 'rules', features: { voice } });
    return json({ reasons: { scrap: [{ code: 'cut_error', label: 'Kesim hatası' }] } });
  }) as any;
}
const say = (text: string) => act(() => { recognizer.onresult({ results: [[{ transcript: text }]] }); recognizer.onend(); });

describe('VoiceCommand', () => {
  afterEach(() => { delete (window as any).webkitSpeechRecognition; });
  it('hidden when the browser has no speech recognition', async () => {
    setup(true);
    const { container } = render(<VoiceCommand target={{ operationId: 'o', workOrderId: 'w', name: 'Kesim', status: 'running' }} onStart={jest.fn()} onComplete={jest.fn()} />);
    await waitFor(() => expect(global.fetch).toHaveBeenCalled());
    expect(container).toBeEmptyDOMElement();
  });
  it('heard text is shown first; scrap is recorded with the firm\'s reason only after "Uygula"', async () => {
    (window as any).webkitSpeechRecognition = FakeRec;
    const posts: any[] = [];
    setup(true, posts);
    render(<VoiceCommand target={{ operationId: 'o1', workOrderId: 'w1', name: 'Kesim', status: 'running' }} onStart={jest.fn()} onComplete={jest.fn()} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Sesle söyle' }));
    say('3 adet fire, kesim hatası');
    expect(screen.getByText('3 adet fire · Kesim hatası')).toBeInTheDocument();
    expect(posts).toHaveLength(0);
    fireEvent.click(screen.getByRole('button', { name: /Uygula/ }));
    await waitFor(() => expect(posts[0]).toMatchObject({ url: '/api/v1/production/jobs/w1/depth', body: { action: 'scrap', reasonCode: 'cut_error', quantity: 3, operationId: 'o1' } }));
  });
  it('"Başla" on a running step is refused (it would otherwise finish it)', async () => {
    (window as any).webkitSpeechRecognition = FakeRec;
    setup(true);
    const onStart = jest.fn();
    render(<VoiceCommand target={{ operationId: 'o1', workOrderId: 'w1', name: 'Kesim', status: 'running' }} onStart={onStart} onComplete={jest.fn()} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Sesle söyle' }));
    say('başla');
    expect(screen.getByText(/zaten başlamış/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Uygula/ })).toBeNull();
  });
});
