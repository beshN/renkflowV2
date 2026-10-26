import { render, fireEvent } from '@testing-library/react';

const success = jest.fn();
jest.mock('sonner', () => ({ toast: { success: (...a: unknown[]) => success(...a) } }));
const celebrate = jest.fn();
jest.mock('@/components/spells/celebrate', () => ({ celebrate: (...a: unknown[]) => celebrate(...a) }));

import { KonamiCode } from '@/components/spells/KonamiCode';

const CODE = ['ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight', 'b', 'a'];

describe('Konami code', () => {
  beforeEach(() => { jest.useFakeTimers(); success.mockClear(); celebrate.mockClear(); });
  afterEach(() => jest.useRealTimers());

  it('celebrates after the full sequence, even after a false start', () => {
    render(<KonamiCode />);
    for (const key of ['ArrowUp', 'x', ...CODE]) fireEvent.keyDown(window, { key });
    jest.runAllTimers();
    expect(success).toHaveBeenCalledTimes(1);
    expect(celebrate).toHaveBeenCalled();
  });

  it('ignores a wrong sequence and typing in a field', () => {
    const { container } = render(<><KonamiCode /><input /></>);
    for (const key of CODE.slice(0, 8)) fireEvent.keyDown(window, { key });
    fireEvent.keyDown(window, { key: 'a' });
    const input = container.querySelector('input')!;
    for (const key of CODE) fireEvent.keyDown(input, { key });
    jest.runAllTimers();
    expect(success).not.toHaveBeenCalled();
  });
});
