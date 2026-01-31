'use client';

import React from 'react';
import { HeroSection } from './full/HeroSection';
import { ClientsSection } from './full/ClientsSection';
import { FeaturesGrid } from './full/FeaturesGrid';
import { DetailedFeatures } from './full/DetailedFeatures';
import { OptimizationSection } from './full/OptimizationSection';
import { Testimonials } from './full/Testimonials';
import { FAQSection } from './full/FAQSection';
import { CTASection } from './full/CTASection';
import { PricingSection } from './full/PricingSection';

export const FullLandingContent: React.FC = () => {
  return (
    <div className="relative overflow-hidden bg-[#f7f8fb] dark:bg-slate-950">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute left-0 top-0 h-[520px] w-full bg-[radial-gradient(circle_at_20%_20%,rgba(14,165,233,0.18),transparent_45%),radial-gradient(circle_at_80%_0%,rgba(16,185,129,0.18),transparent_40%),linear-gradient(180deg,rgba(15,23,42,0.03),transparent_45%)] dark:bg-[radial-gradient(circle_at_20%_20%,rgba(56,189,248,0.15),transparent_45%),radial-gradient(circle_at_80%_0%,rgba(45,212,191,0.14),transparent_40%),linear-gradient(180deg,rgba(15,23,42,0.35),transparent_55%)]"
      />

      <HeroSection />
      <ClientsSection />
      <FeaturesGrid />
      <DetailedFeatures />
      <OptimizationSection />
      <Testimonials />
      <PricingSection />
      <FAQSection />
      <CTASection />
      
      <div id="contact"></div>
    </div>
  );
};
