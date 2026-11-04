import { fireEvent, render, screen } from '@testing-library/react';
import { TearCalendar } from '@/components/spells/TearCalendar';
import { ForkliftEmpty } from '@/components/spells/ForkliftEmpty';

let enabled: boolean | undefined;
jest.mock('@/lib/features/settings/useFunFeatures', () => ({ useFunFeatures: () => enabled }));
const date = new Date('2026-11-04T12:00:00Z');
const ui = () => <><TearCalendar date={date} /><ForkliftEmpty /></>;

it('keeps the same inert date and complete empty-list drawing while loading and disabled', () => {
  enabled = undefined;
  const { container, rerender } = render(ui());
  const calendar = screen.getByRole('img', { name: 'KAS 4, bugün' });
  expect(calendar).toHaveClass('h-[46px]', 'w-[42px]');
  expect(calendar).toHaveTextContent('KAS4');
  expect(container.querySelector('svg[width="176"]')).toHaveAttribute('height', '72');
  expect(container.querySelector('svg[width="78"]')).toHaveAttribute('height', '72');
  expect(screen.queryByRole('button')).not.toBeInTheDocument();
  const loading = container.innerHTML;
  fireEvent.click(calendar);
  fireEvent.keyDown(calendar, { key: 'Enter' });
  expect(container.innerHTML).toBe(loading);
  enabled = false;
  rerender(ui());
  expect(container.innerHTML).toBe(loading);
});
it('adds only the interactions when enabled, keeping calendar and drawing dimensions', () => {
  enabled = false;
  const { container, rerender } = render(ui());
  const geometry = () => Array.from(container.querySelectorAll('svg path, svg rect, svg circle, svg line')).map(n => n.outerHTML);
  const before = geometry();
  enabled = true; rerender(ui());
  expect(screen.getByRole('button', { name: 'KAS 4, bugün' })).toHaveClass('h-[46px]', 'w-[42px]');
  expect(screen.getByRole('button', { name: /Forklift: palet/ })).toHaveClass('h-[72px]', 'w-[78px]');
  expect(geometry().map(s => s.replace(/ class="[^"]*"/g, ''))).toEqual(before.map(s => s.replace(/ class="[^"]*"/g, '')));
  enabled = false; rerender(ui());
  expect(screen.queryByRole('button')).not.toBeInTheDocument();
  expect(screen.getByRole('img', { name: 'KAS 4, bugün' })).toBeInTheDocument();
});
