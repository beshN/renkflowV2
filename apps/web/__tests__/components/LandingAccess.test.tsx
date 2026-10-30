import { render, screen } from '@testing-library/react';
import { LandingV2 } from '@/components/site/v2/LandingV2';

describe('landing page for signed-in and signed-out visitors', () => {
  it('shows a login link to a visitor who is not signed in', () => {
    render(<LandingV2 />);
    const links = screen.getAllByRole('link', { name: /Giriş yap|Panele giriş yap/ });
    expect(links.length).toBeGreaterThan(0);
    for (const link of links) expect(link).toHaveAttribute('href', '/auth/login');
    expect(screen.queryByRole('link', { name: 'Panele git' })).not.toBeInTheDocument();
  });

  it('keeps showing the landing to a signed-in visitor, with a link to the workspace instead of login', () => {
    render(<LandingV2 signedIn />);
    expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument();
    const links = screen.getAllByRole('link', { name: 'Panele git' });
    expect(links.length).toBeGreaterThan(0);
    for (const link of links) expect(link).toHaveAttribute('href', '/dashboard');
    expect(screen.queryByRole('link', { name: /Giriş yap/ })).not.toBeInTheDocument();
  });

  it('labels the product showcase as sample data', () => {
    render(<LandingV2 />);
    expect(screen.getByText(/Örnek veri\. Tarayıcınızda çalışır/)).toBeInTheDocument();
  });
});
