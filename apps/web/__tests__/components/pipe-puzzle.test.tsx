import { render, fireEvent, screen } from '@testing-library/react';

const celebrate = jest.fn();
jest.mock('@/components/spells/celebrate', () => ({ celebrate: (...a: unknown[]) => celebrate(...a) }));

import PipePuzzle from '@/components/spells/PipePuzzle';
import { createPuzzle } from '@/lib/features/spells/pipes';

describe('PipePuzzle', () => {
  it('turns pieces on click and celebrates once the line is joined', () => {
    render(<PipePuzzle seed={42} />);
    expect(screen.queryByText('Hat tamam!')).toBeNull();
    const cells = screen.getAllByRole('button', { name: /Satır/ });
    expect(cells).toHaveLength(20);
    const p = createPuzzle(42, 4, 5);
    p.solution.forEach((target, i) => {
      for (let k = 0; k < (target - p.turns[i] + 4) % 4; k += 1) fireEvent.click(cells[i]);
    });
    expect(screen.getByText('Hat tamam!')).toBeTruthy();
    expect(celebrate).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('button', { name: /Yeni bulmaca/ })).toBeTruthy();
  });

  it('moves focus between pieces with the arrow keys', () => {
    render(<PipePuzzle seed={7} />);
    const cells = screen.getAllByRole('button', { name: /Satır/ });
    cells[0].focus();
    fireEvent.keyDown(cells[0], { key: 'ArrowRight' });
    expect(document.activeElement).toBe(cells[1]);
    fireEvent.keyDown(cells[1], { key: 'ArrowDown' });
    expect(document.activeElement).toBe(cells[6]);
  });
});
