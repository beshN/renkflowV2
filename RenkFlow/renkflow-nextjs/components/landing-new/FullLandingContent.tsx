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
      {/* Aurora Blobs */}
      <div className="absolute top-0 left-0 w-full h-[500px] overflow-hidden pointer-events-none z-0">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-purple-400/30 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-blob" />
        <div className="absolute top-[-10%] right-[-10%] w-[40%] h-[40%] bg-blue-400/30 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-blob animation-delay-2000" />
        <div className="absolute bottom-[-20%] left-[20%] w-[40%] h-[40%] bg-emerald-400/30 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-blob animation-delay-4000" />
      </div>

      <HeroSection />
      <div className="cv-auto">
        <ClientsSection />
      </div>
      <div className="cv-auto">
        <FeaturesGrid />
      </div>
      <div className="cv-auto">
        <DetailedFeatures />
      </div>
      <div className="cv-auto">
        <OptimizationSection />
      </div>
      <div className="cv-auto">
        <Testimonials />
      </div>
      <div className="cv-auto">
        <PricingSection />
      </div>
      <div className="cv-auto">
        <FAQSection />
      </div>
      <div className="cv-auto">
        <CTASection />
      </div>
      
      <div id="contact"></div>
    </div>
  );
};
