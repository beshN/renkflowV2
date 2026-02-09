'use client';

import React, { Suspense, memo } from 'react';
import dynamic from 'next/dynamic';
import { HeroSection } from './full/HeroSection';
import { ClientsSection } from './full/ClientsSection';

// Lazy load below-the-fold sections for faster initial page load
const FeaturesGrid = dynamic(() => import('./full/FeaturesGrid').then(mod => ({ default: mod.FeaturesGrid })), {
  loading: () => <SectionSkeleton />,
});
const DetailedFeatures = dynamic(() => import('./full/DetailedFeatures').then(mod => ({ default: mod.DetailedFeatures })), {
  loading: () => <SectionSkeleton />,
});
const OptimizationSection = dynamic(() => import('./full/OptimizationSection').then(mod => ({ default: mod.OptimizationSection })), {
  loading: () => <SectionSkeleton />,
});
const Testimonials = dynamic(() => import('./full/Testimonials').then(mod => ({ default: mod.Testimonials })), {
  loading: () => <SectionSkeleton />,
});
const FAQSection = dynamic(() => import('./full/FAQSection').then(mod => ({ default: mod.FAQSection })), {
  loading: () => <SectionSkeleton />,
});
const CTASection = dynamic(() => import('./full/CTASection').then(mod => ({ default: mod.CTASection })), {
  loading: () => <SectionSkeleton />,
});
const PricingSection = dynamic(() => import('./full/PricingSection').then(mod => ({ default: mod.PricingSection })), {
  loading: () => <SectionSkeleton />,
});

// Minimal skeleton for lazy-loaded sections
const SectionSkeleton = memo(() => (
  <div className="py-16 px-6">
    <div className="w-full px-4 sm:px-6 lg:px-12 xl:px-16">
      <div className="h-8 w-48 bg-slate-200 dark:bg-slate-800 rounded-lg mx-auto mb-8 animate-pulse" />
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-48 bg-slate-100 dark:bg-slate-900 rounded-xl animate-pulse" />
        ))}
      </div>
    </div>
  </div>
));
SectionSkeleton.displayName = 'SectionSkeleton';

export const FullLandingContent: React.FC = memo(() => {
  return (
    <div className="relative overflow-hidden bg-[#f7f8fb] dark:bg-slate-950">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute left-0 top-0 h-[520px] w-full bg-[radial-gradient(circle_at_20%_20%,rgba(14,165,233,0.18),transparent_45%),radial-gradient(circle_at_80%_0%,rgba(16,185,129,0.18),transparent_40%),linear-gradient(180deg,rgba(15,23,42,0.03),transparent_45%)] dark:bg-[radial-gradient(circle_at_20%_20%,rgba(56,189,248,0.15),transparent_45%),radial-gradient(circle_at_80%_0%,rgba(45,212,191,0.14),transparent_40%),linear-gradient(180deg,rgba(15,23,42,0.35),transparent_55%)]"
      />
      {/* Aurora Blobs - GPU accelerated */}
      <div className="absolute top-0 left-0 w-full h-[500px] overflow-hidden pointer-events-none z-0">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-purple-400/30 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-blob will-change-transform" />
        <div className="absolute top-[-10%] right-[-10%] w-[40%] h-[40%] bg-blue-400/30 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-blob animation-delay-2000 will-change-transform" />
        <div className="absolute bottom-[-20%] left-[20%] w-[40%] h-[40%] bg-emerald-400/30 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-blob animation-delay-4000 will-change-transform" />
      </div>

      <HeroSection />
      <div className="cv-auto">
        <ClientsSection />
      </div>
      <Suspense fallback={<SectionSkeleton />}>
        <div className="cv-auto">
          <FeaturesGrid />
        </div>
      </Suspense>
      <Suspense fallback={<SectionSkeleton />}>
        <div className="cv-auto">
          <DetailedFeatures />
        </div>
      </Suspense>
      <Suspense fallback={<SectionSkeleton />}>
        <div className="cv-auto">
          <OptimizationSection />
        </div>
      </Suspense>
      <Suspense fallback={<SectionSkeleton />}>
        <div className="cv-auto">
          <Testimonials />
        </div>
      </Suspense>
      <Suspense fallback={<SectionSkeleton />}>
        <div className="cv-auto">
          <PricingSection />
        </div>
      </Suspense>
      <Suspense fallback={<SectionSkeleton />}>
        <div className="cv-auto">
          <FAQSection />
        </div>
      </Suspense>
      <Suspense fallback={<SectionSkeleton />}>
        <div className="cv-auto">
          <CTASection />
        </div>
      </Suspense>
      
      <div id="contact"></div>
    </div>
  );
});
FullLandingContent.displayName = 'FullLandingContent';
