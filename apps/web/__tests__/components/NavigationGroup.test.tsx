import { fireEvent, render, screen } from '@testing-library/react';
import { NavigationGroup } from '@/components/layout/NavigationGroup';

test('secondary groups collapse and open their links, and following an active destination opens its group', () => {
  const { rerender } = render(
    <NavigationGroup label="Finans" active={false}>
      <a href="/finance/employees">Personel</a>
    </NavigationGroup>,
  );
  expect(screen.getByRole('button', { name: 'Finans' })).toHaveAttribute(
    'aria-expanded',
    'false',
  );
  expect(
    screen.queryByRole('link', { name: 'Personel' }),
  ).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Finans' }));
  expect(screen.getByRole('link', { name: 'Personel' })).toBeVisible();
  fireEvent.click(screen.getByRole('button', { name: 'Finans' }));
  rerender(
    <NavigationGroup label="Finans" active>
      <a href="/finance/employees">Personel</a>
    </NavigationGroup>,
  );
  expect(screen.getByRole('link', { name: 'Personel' })).toBeVisible();
});

test('the compact sidebar retains keyboard-accessible icon links even when their group was collapsed', () => {
  render(
    <NavigationGroup label="Stok" active={false} expanded={false}>
      <a href="/inventory">Stok</a>
    </NavigationGroup>,
  );
  expect(screen.getByRole('link', { name: 'Stok' })).toBeVisible();
});

test('group preference is retained per company and member, and active routes remain reachable', () => {
  const saved = new Map<string, string>();
  (localStorage.getItem as jest.Mock).mockImplementation(
    (key: string) => saved.get(key) ?? null,
  );
  (localStorage.setItem as jest.Mock).mockImplementation(
    (key: string, value: string) => saved.set(key, value),
  );
  const { unmount } = render(
    <NavigationGroup
      label="Finans"
      active={false}
      storageKey="rf.nav.company-a.member.financial"
    >
      <a href="/finance">Finans ekranı</a>
    </NavigationGroup>,
  );
  fireEvent.click(screen.getByRole('button', { name: 'Finans' }));
  expect(localStorage.getItem('rf.nav.company-a.member.financial')).toBe(
    'true',
  );
  unmount();
  render(
    <NavigationGroup
      label="Finans"
      active={false}
      storageKey="rf.nav.company-b.member.financial"
    >
      <a href="/finance">Finans ekranı</a>
    </NavigationGroup>,
  );
  expect(screen.getByRole('button', { name: 'Finans' })).toHaveAttribute(
    'aria-expanded',
    'false',
  );
});
