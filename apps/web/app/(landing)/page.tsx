import { FullLandingContent } from '@/components/landing-new/FullLandingContent';
import { Metadata } from 'next';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'RenkFlow | The Operating System for Modern Production',
  description:
    'RenkFlow helps manufacturers streamline production workflows, track inventory and manage teams in one visual platform.',
  alternates: {
    canonical: 'https://renkflow.com',
  },
};

export default function LandingPage() {
  return <FullLandingContent />;
}
