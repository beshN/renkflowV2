import { act, render, waitFor } from '@testing-library/react';
import { OfficeWorkspace } from '@/components/features/office/OfficeWorkspace';
import { OfficeSimulation } from '@/lib/features/office/simulation';
import type { StagePick } from '@/lib/features/office/scene';
let enabled: boolean | undefined = false;
jest.mock('@/lib/features/settings/useFunFeatures', () => ({ useFunFeatures: () => enabled }));
const createOfficeStage = jest.fn((..._args: unknown[]) => ({
  setFunFeatures: jest.fn(), setSpeed: jest.fn(), setPaused: jest.fn(), setNight: jest.fn(), setRecord: jest.fn(),
  dispose: jest.fn(), cameraView: jest.fn(), wave: jest.fn(), brew: jest.fn(), setVisitorPlaying: jest.fn(),
}));
jest.mock('@/lib/features/office/scene', () => ({ createOfficeStage: (...args: unknown[]) => createOfficeStage(...args) }));
const rally = jest.fn();
jest.mock('@/components/features/office/RallyGame', () => ({ RallyGame: () => { rally(); return <div>Rally mounted</div>; } }));
beforeEach(() => {
  enabled = false;
  global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => ({ data: { live: true, tasks: [], reason: null } }) });
});
it('passes disabled policy to the scene and ignores TV/coffee/staff picks without loading the game', async () => {
  render(<OfficeWorkspace officeKey="disabled-policy" />);
  await waitFor(() => expect(createOfficeStage).toHaveBeenCalled());
  const options = (createOfficeStage.mock.calls[0] as unknown as [unknown, unknown, unknown, { funFeatures: boolean; onPick: (pick: StagePick) => void }])[3];
  expect(options.funFeatures).toBe(false);
  act(() => { options.onPick({ kind: 'tv' }); options.onPick({ kind: 'coffee' }); options.onPick({ kind: 'agent', id: 'manager' }); });
  expect(rally).not.toHaveBeenCalled();
  expect(createOfficeStage.mock.results[0].value.brew).not.toHaveBeenCalled();
});

it('builds once while policy loads and does not end retained game breaks', async () => {
  const games = jest.spyOn(OfficeSimulation.prototype, 'setGamesEnabled');
  const sync = jest.spyOn(OfficeSimulation.prototype, 'sync');
  enabled = undefined;
  const { rerender } = render(<OfficeWorkspace officeKey="loading-policy" />);
  await waitFor(() => expect(createOfficeStage).toHaveBeenCalledTimes(1));
  expect(games).not.toHaveBeenCalled();
  const sim = sync.mock.contexts[0] as OfficeSimulation;
  // Represents an existing break in the persistent office, before the new visit's policy resolves.
  act(() => {
    for (let i = 0; i < 3000 && !sim.agents.some(a => a.activity === 'game'); i++) sim.tick(1);
  });
  expect(sim.agents.some(a => a.activity === 'game')).toBe(true);
  enabled = true;
  rerender(<OfficeWorkspace officeKey="loading-policy" />);
  expect(createOfficeStage).toHaveBeenCalledTimes(1);
  expect(createOfficeStage.mock.results[0].value.setFunFeatures).toHaveBeenLastCalledWith(true);
  expect(games).toHaveBeenCalledTimes(1);
  expect(games).toHaveBeenCalledWith(true);
  expect(sim.agents.some(a => a.activity === 'game')).toBe(true);
  rerender(<OfficeWorkspace officeKey="loading-policy" />);
  expect(createOfficeStage).toHaveBeenCalledTimes(1);
  games.mockRestore(); sync.mockRestore();
});
