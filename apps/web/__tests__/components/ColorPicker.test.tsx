import { fireEvent, render, screen } from '@testing-library/react';
import { ColorPicker } from '@/components/colors/ColorPicker';

test('RAL selection keeps its finish and uses the latest parent handler after memoized palette updates', () => {
  const first = jest.fn(), second = jest.fn();
  const { rerender } = render(<ColorPicker value="RAL 7016 Mat" onChange={first} />);
  expect(screen.getByRole('option', { name: /^RAL 7016 / })).toHaveAttribute('aria-selected', 'true');
  fireEvent.click(screen.getByRole('option', { name: /^RAL 9010 / }));
  expect(first).toHaveBeenLastCalledWith('RAL 9010 Mat');
  rerender(<ColorPicker value="RAL 9010 Mat" onChange={second} />);
  fireEvent.click(screen.getByRole('option', { name: /^RAL 7016 / }));
  expect(second).toHaveBeenLastCalledWith('RAL 7016 Mat');
  expect(screen.getByRole('option', { name: /^RAL 9010 / })).toHaveAttribute('aria-selected', 'true');
});

test('search and keyboard navigation still reach the last palette colour', () => {
  render(<ColorPicker value="" onChange={jest.fn()} />);
  const options = screen.getAllByRole('option');
  fireEvent.keyDown(screen.getByRole('listbox'), { key: 'End' });
  expect(options.at(-1)).toHaveFocus();
  fireEvent.change(screen.getByRole('searchbox', { name: 'RAL ara' }), { target: { value: '7016' } });
  expect(screen.getAllByRole('option')).toHaveLength(1);
  expect(screen.getByRole('option', { name: /^RAL 7016 / })).toHaveAttribute('tabindex', '0');
});
