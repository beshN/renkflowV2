import { act, render, screen, waitFor } from '@testing-library/react';
import { SWRConfig } from 'swr';
import { TearCalendar } from '@/components/spells/TearCalendar';
import { ForkliftEmpty } from '@/components/spells/ForkliftEmpty';
import { OfficeWorkspace } from '@/components/features/office/OfficeWorkspace';
import { useFunFeatures, useFunPolicy } from '@/lib/features/settings/useFunFeatures';
import type { StagePick } from '@/lib/features/office/scene';

jest.mock('@/lib/context/AuthContext', () => ({ useOptionalAuth: () => ({ user: { id: 'user', tenantId: 'policy-retry' }, isLoading: false }) }));
const createOfficeStage = jest.fn((..._args: unknown[]) => ({
  setFunFeatures: jest.fn(), setSpeed: jest.fn(), setPaused: jest.fn(), setNight: jest.fn(), setRecord: jest.fn(),
  dispose: jest.fn(), cameraView: jest.fn(), wave: jest.fn(), brew: jest.fn(), setVisitorPlaying: jest.fn(),
}));
jest.mock('@/lib/features/office/scene', () => ({ createOfficeStage: (...args: unknown[]) => createOfficeStage(...args) }));

let fail: boolean;
let enabled: boolean;
let revalidate: () => Promise<unknown>;
function PolicyProbe() {
  const policy = useFunPolicy();
  const value = useFunFeatures();
  revalidate = () => policy.mutate();
  return <output>{`${value === undefined ? 'unknown' : value ? 'enabled' : 'disabled'}:${policy.error ? 'error' : 'ok'}`}</output>;
}
function ui(key: string) {
  return <SWRConfig value={{ provider: () => new Map(), shouldRetryOnError: false, dedupingInterval: 0 }}>
    <PolicyProbe /><TearCalendar date={new Date('2026-11-04T12:00:00Z')} /><ForkliftEmpty /><OfficeWorkspace officeKey={key} />
  </SWRConfig>;
}
beforeEach(() => {
  fail = false; enabled = true;
  global.fetch = jest.fn(async url => {
    if (url === '/api/tenant/fun-features') return { ok: !fail, json: async () => ({ enabled, canEdit: true }) };
    return { ok: true, json: async () => ({ data: { live: true, tasks: [], reason: null } }) };
  }) as jest.Mock;
});
async function retry() { await act(async () => { await revalidate().catch(() => {}); }); }

it.each([true, false])('keeps last successful policy %s and the same scene after a background read fails', async initial => {
  enabled = initial;
  render(ui(`background-error-${initial}`));
  await screen.findByText(`${initial ? 'enabled' : 'disabled'}:ok`);
  await waitFor(() => expect(createOfficeStage).toHaveBeenCalledTimes(1));
  const stage = createOfficeStage.mock.results[0].value;
  fail = true;
  await retry();
  expect(screen.getByText(`${initial ? 'enabled' : 'disabled'}:error`)).toBeInTheDocument();
  expect(!!screen.queryByRole('button', { name: 'KAS 4, bugün' })).toBe(initial);
  expect(!!screen.queryByRole('button', { name: /Forklift: palet/ })).toBe(initial);
  expect(createOfficeStage).toHaveBeenCalledTimes(1);
  expect(stage.dispose).not.toHaveBeenCalled();
  expect(stage.setFunFeatures).not.toHaveBeenCalledWith(!initial);
  // A later real policy change toggles the existing corner instead of replacing WebGL.
  fail = false; enabled = !initial;
  await retry();
  expect(stage.setFunFeatures).toHaveBeenLastCalledWith(!initial);
  expect(createOfficeStage).toHaveBeenCalledTimes(1);
  expect(stage.dispose).not.toHaveBeenCalled();
});

it('keeps a usable scene without games when the first read fails and enables its corner after recovery', async () => {
  fail = true;
  render(ui('first-read-error'));
  await screen.findByText('unknown:error');
  await waitFor(() => expect(createOfficeStage).toHaveBeenCalledTimes(1));
  const stage = createOfficeStage.mock.results[0].value;
  const options = createOfficeStage.mock.calls[0][3] as { funFeatures: boolean; onPick: (pick: StagePick) => void };
  expect(options.funFeatures).toBe(false);
  act(() => options.onPick({ kind: 'coffee' }));
  expect(stage.brew).not.toHaveBeenCalled();
  expect(stage.dispose).not.toHaveBeenCalled();
  fail = false;
  await retry();
  expect(screen.getByText('enabled:ok')).toBeInTheDocument();
  expect(stage.setFunFeatures).toHaveBeenLastCalledWith(true);
  act(() => options.onPick({ kind: 'coffee' }));
  expect(stage.brew).toHaveBeenCalledTimes(1);
  expect(createOfficeStage).toHaveBeenCalledTimes(1);
  expect(stage.dispose).not.toHaveBeenCalled();
});
