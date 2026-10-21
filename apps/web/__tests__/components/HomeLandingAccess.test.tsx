import { render, screen } from '@testing-library/react';
import { HomeLanding } from '@/components/site/HomeLanding';

describe('landing page for signed-in and signed-out visitors', () => {
  it('shows a login link to a visitor who is not signed in', () => {
    render(<HomeLanding />);
    const links = screen.getAllByRole('link', { name: /Giriş yap|Panele giriş yap/ });
    expect(links.length).toBeGreaterThan(0);
    for (const link of links) expect(link).toHaveAttribute('href', '/auth/login');
    expect(screen.queryByRole('link', { name: 'Panele git' })).not.toBeInTheDocument();
  });

  it('keeps showing the landing to a signed-in visitor, with a link to the workspace instead of login', () => {
    render(<HomeLanding signedIn />);
    expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument();
    const links = screen.getAllByRole('link', { name: 'Panele git' });
    expect(links.length).toBeGreaterThan(0);
    for (const link of links) expect(link).toHaveAttribute('href', '/dashboard');
    expect(screen.queryByRole('link', { name: /Giriş yap/ })).not.toBeInTheDocument();
  });
});
