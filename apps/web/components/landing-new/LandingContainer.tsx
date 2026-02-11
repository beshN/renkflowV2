'use client';

import React, { memo } from 'react';
import { WaitlistNavbar } from '@/components/landing-new/WaitlistNavbar';
import { Hero } from '@/components/landing-new/Hero';
import { Features } from '@/components/landing-new/Features';
import { TestimonialSection } from '@/components/landing-new/TestimonialSection';
import { Pricing } from '@/components/landing-new/Pricing';
import { FAQ } from '@/components/landing-new/FAQ';
import { CTA } from '@/components/landing-new/CTA';
import { Footer } from '@/components/landing-new/Footer';

const LandingContainerComponent = ({ compact = false }: { compact?: boolean }) => {
  return (
    <div className="rf-app-shell flex min-h-[100svh] flex-col relative overflow-hidden">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_10%,rgba(14,165,233,0.12),transparent_45%),radial-gradient(circle_at_80%_0%,rgba(16,185,129,0.12),transparent_40%)]"
      />
      <WaitlistNavbar />
      <Hero />
      <Features showStats={!compact} />
      {!compact && <TestimonialSection />}
      {!compact && <Pricing />}
      <FAQ />
      <CTA />
      <Footer />
    </div>
  );
};

export const LandingContainer = memo(LandingContainerComponent);
