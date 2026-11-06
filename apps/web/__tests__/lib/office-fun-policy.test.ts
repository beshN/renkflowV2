import { OfficeSimulation } from '@/lib/features/office/simulation';

it('does not send simulated staff to play while games are disabled, including an existing game break', () => {
  const sim = new OfficeSimulation({ seed: 42 });
  let found = false;
  for (let i = 0; i < 3000; i++) {
    sim.tick(1);
    if (sim.agents.some(a => a.activity === 'game')) { found = true; break; }
  }
  expect(found).toBe(true);
  sim.setGamesEnabled(false);
  expect(sim.agents.some(a => a.activity === 'game')).toBe(false);
  for (let i = 0; i < 3000; i++) {
    sim.tick(1);
    expect(sim.agents.some(a => a.activity === 'game')).toBe(false);
  }
});
