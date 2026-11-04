import { act, render, waitFor } from '@testing-library/react';
import { OfficeWorkspace } from '@/components/features/office/OfficeWorkspace';
import type { StagePick } from '@/lib/features/office/scene';
let enabled = false;
jest.mock('@/lib/features/settings/useFunFeatures', () => ({ useFunFeatures: () => enabled }));
const createOfficeStage = jest.fn((..._args: unknown[]) => ({
  setSpeed: jest.fn(), setPaused: jest.fn(), setNight: jest.fn(), setRecord: jest.fn(),
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
