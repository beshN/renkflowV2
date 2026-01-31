'use client';

import React, { useState, useEffect, memo } from 'react';
import { WaitlistNavbar } from '@/components/landing-new/WaitlistNavbar';
import { Hero } from '@/components/landing-new/Hero';
import { Features } from '@/components/landing-new/Features';
import { TestimonialSection } from '@/components/landing-new/TestimonialSection';
import { Pricing } from '@/components/landing-new/Pricing';
import { FAQ } from '@/components/landing-new/FAQ';
import { CTA } from '@/components/landing-new/CTA';
import { Footer } from '@/components/landing-new/Footer';

const LandingContainerComponent = () => {
  const [mounted, setMounted] = useState(false);
  
  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <WaitlistNavbar />
      <Hero />
      <Features />
      <TestimonialSection />
      <Pricing />
      <FAQ />
      <CTA />
      <Footer />
    </div>
  );
};

export const LandingContainer = memo(LandingContainerComponent);
