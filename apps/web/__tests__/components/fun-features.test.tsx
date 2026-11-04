import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { SWRConfig } from 'swr';
import { KonamiCode } from '@/components/spells/KonamiCode';
import { ForkliftEmpty } from '@/components/spells/ForkliftEmpty';
import { ScrapHuntButton } from '@/components/spells/ScrapHuntButton';
import { CutGame } from '@/components/spells/CutGame';
import { WhileYouWait } from '@/components/spells/WhileYouWait';
import { BrushLogo } from '@/components/spells/BrushLogo';
import { TeaBreak } from '@/components/spells/TeaBreak';
import { TearCalendar } from '@/components/spells/TearCalendar';
import { OccasionBadge } from '@/components/spells/OccasionBadge';
import OrderMilestone from '@/components/spells/OrderMilestone';
import { useFunFeatures } from '@/lib/features/settings/useFunFeatures';

let tenant = 'a';
jest.mock('@/lib/context/AuthContext', () => ({ useOptionalAuth: () => tenant === 'public' ? undefined : ({ user: { id: 'user', tenantId: tenant }, isLoading: false }) }));
const success = jest.fn();
jest.mock('sonner', () => ({ toast: { success: (...args: unknown[]) => success(...args) } }));
const CODE = ['ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight', 'b', 'a'];
function Status() { const enabled = useFunFeatures(); return <output>{enabled === undefined ? 'loading' : enabled ? 'enabled' : 'disabled'}</output>; }
const content = <><Status /><KonamiCode /><ForkliftEmpty /><ScrapHuntButton /><CutGame /><WhileYouWait /><TeaBreak /><TearCalendar /><OccasionBadge /><OrderMilestone tenantId="a" count={100} /><BrushLogo><a href="#">Logo</a></BrushLogo></>;
beforeEach(() => { tenant = 'a'; jest.clearAllMocks(); });
it('does not mount or trigger any optional spell while policy is loading or disabled', async () => {
  let resolve!: (value: unknown) => void;
  global.fetch = jest.fn(() => new Promise(r => { resolve = r; })) as jest.Mock;
  render(<SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0 }}>{content}</SWRConfig>);
  expect(screen.getByText('loading')).toBeInTheDocument();
  expect(screen.queryByRole('button')).not.toBeInTheDocument();
  resolve({ ok: true, json: async () => ({ enabled: false, canEdit: true }) });
  await screen.findByText('disabled');
  expect(fetch).toHaveBeenCalledTimes(1);
  for (const key of CODE) fireEvent.keyDown(window, { key });
  for (let i = 0; i < 7; i++) expect(fireEvent.click(screen.getByText('Logo'))).toBe(true);
  expect(success).not.toHaveBeenCalled();
  expect(screen.queryByRole('button')).not.toBeInTheDocument();
});
it('uses a fresh policy on tenant switch and fails closed on a read error', async () => {
  global.fetch = jest.fn().mockResolvedValueOnce({ ok: true, json: async () => ({ enabled: true }) }).mockResolvedValue({ ok: false });
  const cache = new Map();
  const ui = () => <SWRConfig value={{ provider: () => cache, shouldRetryOnError: false }}><Status /></SWRConfig>;
  const { rerender } = render(ui());
  await screen.findByText('enabled');
  tenant = 'b'; rerender(ui());
  expect(screen.getByText('loading')).toBeInTheDocument();
  await waitFor(() => expect(fetch).toHaveBeenCalledTimes(2));
  expect(screen.getByText('loading')).toBeInTheDocument();
  expect(screen.queryByText('enabled')).not.toBeInTheDocument();
});

it('does not reuse a previous public-page policy after a new mount', async () => {
  tenant = 'public';
  global.fetch = jest.fn().mockResolvedValueOnce({ ok: true, json: async () => ({ enabled: true }) }).mockResolvedValue({ ok: true, json: async () => ({ enabled: false }) });
  const cache = new Map();
  const ui = () => <SWRConfig value={{ provider: () => cache }}><Status /></SWRConfig>;
  const first = render(ui());
  await screen.findByText('enabled');
  first.unmount();
  render(ui());
  expect(screen.getByText('loading')).toBeInTheDocument();
  await waitFor(() => expect(fetch).toHaveBeenCalledTimes(2));
  expect(screen.getByText('disabled')).toBeInTheDocument();
});

it('does not poll continuously and revalidates on window focus', async () => {
  jest.useFakeTimers();
  try {
    global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => ({ enabled: false }) });
    render(<SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0 }}><Status /></SWRConfig>);
    await screen.findByText('disabled');
    expect(fetch).toHaveBeenCalledTimes(1);
    await act(async () => { jest.advanceTimersByTime(60_000); });
    expect(fetch).toHaveBeenCalledTimes(1);
    await act(async () => { window.dispatchEvent(new Event('focus')); jest.advanceTimersByTime(1); });
    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(2));
  } finally { jest.useRealTimers(); }
});
