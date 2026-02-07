import { UnifiedNavbar } from '@/components/landing-new/UnifiedNavbar';
import { Footer } from '@/components/landing-new/Footer';

// Force dynamic rendering for all landing pages to prevent Vercel build timeout
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export default function LandingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <UnifiedNavbar />
      <main className="flex-grow">
        {children}
      </main>
      <Footer />
    </div>
  );
}
