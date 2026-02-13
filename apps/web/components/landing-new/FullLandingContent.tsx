'use client';

import React, { memo, Suspense } from 'react';
import dynamic from 'next/dynamic';
import { HeroSection } from './full/HeroSection';

const FeaturesGrid = dynamic(() => import('./full/FeaturesGrid').then((mod) => ({ default: mod.FeaturesGrid })));
const DetailedFeatures = dynamic(() => import('./full/DetailedFeatures').then((mod) => ({ default: mod.DetailedFeatures })));
const OptimizationSection = dynamic(() => import('./full/OptimizationSection').then((mod) => ({ default: mod.OptimizationSection })));
const FAQSection = dynamic(() => import('./full/FAQSection').then((mod) => ({ default: mod.FAQSection })));
const CTASection = dynamic(() => import('./full/CTASection').then((mod) => ({ default: mod.CTASection })));

const SectionSkeleton = memo(() => (
  <div className="py-14">
    <div className="rf-page-wrap">
      <div className="h-7 w-52 animate-pulse rounded-lg bg-slate-200 dark:bg-slate-800" />
      <div className="mt-5 grid gap-4 md:grid-cols-3">
        {Array.from({ length: 3 }).map((_, index) => (
          <div
            key={index}
            className="h-40 animate-pulse rounded-2xl bg-slate-100 dark:bg-slate-900"
          />
        ))}
      </div>
    </div>
  </div>
));
SectionSkeleton.displayName = 'SectionSkeleton';

export const FullLandingContent: React.FC = memo(() => {
  return (
    <div className="rf-app-shell relative overflow-x-hidden">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-[520px] bg-[radial-gradient(circle_at_14%_16%,rgba(59,130,246,0.12),transparent_42%),radial-gradient(circle_at_85%_0%,rgba(34,197,94,0.1),transparent_42%),linear-gradient(180deg,rgba(255,255,255,0.3),transparent_58%)] dark:bg-[radial-gradient(circle_at_14%_16%,rgba(59,130,246,0.2),transparent_45%),radial-gradient(circle_at_85%_0%,rgba(20,184,166,0.12),transparent_45%),linear-gradient(180deg,rgba(2,6,23,0.42),transparent_58%)]"
      />

      <HeroSection />

      <Suspense fallback={<SectionSkeleton />}>
        <FeaturesGrid />
      </Suspense>

      <Suspense fallback={<SectionSkeleton />}>
        <DetailedFeatures />
      </Suspense>

      <Suspense fallback={<SectionSkeleton />}>
        <OptimizationSection />
      </Suspense>

      <Suspense fallback={<SectionSkeleton />}>
        <FAQSection />
      </Suspense>

      <Suspense fallback={<SectionSkeleton />}>
        <CTASection />
      </Suspense>
    </div>
  );
});

FullLandingContent.displayName = 'FullLandingContent';
