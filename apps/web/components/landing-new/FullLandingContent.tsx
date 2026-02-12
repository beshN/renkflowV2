'use client';

import React, { Suspense, memo } from 'react';
import dynamic from 'next/dynamic';
import { HeroSection } from './full/HeroSection';

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
    <div className="rf-page-wrap">
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
    <div className="rf-app-shell relative overflow-hidden bg-slate-50 dark:bg-slate-950">

      <HeroSection />
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
