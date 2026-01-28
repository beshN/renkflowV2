v'use client';

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
    <>
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
    </>
  );
};
