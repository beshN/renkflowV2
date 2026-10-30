/** @jest-environment node */
import { createAwning } from '@/lib/features/awning/model';

const state = (widthMm: number) => ({ width: widthMm / 10, depth: 400, height: 300, opening: 100, time: 0, body: '#333', fabric: '#ddd', light: 'off', brightness: 0 });

describe('WINMAX scissor arms', () => {
  it.each([[3000, 2], [4000, 2], [8000, 2], [8100, 3], [12000, 3], [12100, 4], [15000, 4]])('width %i mm has %i arms', (width, arms) => {
    const model = createAwning(state(width) as never);
    expect(model.group.userData.terminalLinks).toBe(arms);
    model.dispose();
  });
});
