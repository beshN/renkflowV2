'use client';

import { useMemo } from 'react';
import { usePathname } from 'next/navigation';
import { motion } from 'framer-motion';

type SurfaceVariant = 'landing' | 'dashboard' | 'auth';

interface ExperienceBackdropProps {
  variant: SurfaceVariant;
}

interface MoodLayer {
  base: string;
  accentA: string;
  accentB: string;
  grainOpacity: number;
}

interface MoodRule {
  pattern: RegExp;
  mood: MoodLayer;
}

const LANDING_MOOD_RULES: MoodRule[] = [
  { pattern: /^\/$/, mood: { base: '#f8f3ec', accentA: 'rgba(184, 116, 68, 0.2)', accentB: 'rgba(44, 113, 88, 0.15)', grainOpacity: 0.2 } },
  { pattern: /^\/full-landing$/, mood: { base: '#f9f2e9', accentA: 'rgba(111, 73, 50, 0.18)', accentB: 'rgba(80, 98, 118, 0.14)', grainOpacity: 0.2 } },
  { pattern: /^\/features$/, mood: { base: '#f7eee2', accentA: 'rgba(184, 116, 68, 0.22)', accentB: 'rgba(59, 143, 111, 0.15)', grainOpacity: 0.21 } },
  { pattern: /^\/pricing$/, mood: { base: '#f7efe5', accentA: 'rgba(191, 141, 95, 0.24)', accentB: 'rgba(44, 113, 88, 0.17)', grainOpacity: 0.22 } },
  { pattern: /^\/integrations$/, mood: { base: '#f7f0e7', accentA: 'rgba(184, 116, 68, 0.23)', accentB: 'rgba(59, 143, 111, 0.18)', grainOpacity: 0.22 } },
  { pattern: /^\/docs$/, mood: { base: '#f4ece3', accentA: 'rgba(80, 98, 118, 0.18)', accentB: 'rgba(184, 116, 68, 0.12)', grainOpacity: 0.2 } },
  { pattern: /^\/changelog$/, mood: { base: '#f5ede3', accentA: 'rgba(80, 98, 118, 0.2)', accentB: 'rgba(184, 116, 68, 0.14)', grainOpacity: 0.2 } },
  { pattern: /^\/roadmap$/, mood: { base: '#f6eee4', accentA: 'rgba(191, 141, 95, 0.2)', accentB: 'rgba(80, 98, 118, 0.14)', grainOpacity: 0.2 } },
  { pattern: /^\/security$/, mood: { base: '#f4ece2', accentA: 'rgba(80, 98, 118, 0.22)', accentB: 'rgba(44, 113, 88, 0.14)', grainOpacity: 0.2 } },
  { pattern: /^\/status$/, mood: { base: '#f4ede4', accentA: 'rgba(44, 113, 88, 0.18)', accentB: 'rgba(80, 98, 118, 0.16)', grainOpacity: 0.2 } },
  { pattern: /^\/contact$/, mood: { base: '#f6efe6', accentA: 'rgba(184, 116, 68, 0.2)', accentB: 'rgba(80, 98, 118, 0.14)', grainOpacity: 0.2 } },
  { pattern: /^\/press$/, mood: { base: '#f5ece2', accentA: 'rgba(111, 73, 50, 0.18)', accentB: 'rgba(80, 98, 118, 0.14)', grainOpacity: 0.2 } },
  { pattern: /^\/blog$/, mood: { base: '#f8efe5', accentA: 'rgba(184, 116, 68, 0.2)', accentB: 'rgba(80, 98, 118, 0.12)', grainOpacity: 0.2 } },
  { pattern: /^\/blog\/[^/]+$/, mood: { base: '#f7eee4', accentA: 'rgba(191, 141, 95, 0.2)', accentB: 'rgba(80, 98, 118, 0.14)', grainOpacity: 0.2 } },
  { pattern: /^\/careers$/, mood: { base: '#f6eee5', accentA: 'rgba(111, 73, 50, 0.18)', accentB: 'rgba(44, 113, 88, 0.12)', grainOpacity: 0.2 } },
  { pattern: /^\/careers\/[^/]+$/, mood: { base: '#f5ece2', accentA: 'rgba(111, 73, 50, 0.2)', accentB: 'rgba(80, 98, 118, 0.14)', grainOpacity: 0.2 } },
  { pattern: /^\/faq$/, mood: { base: '#f7eee4', accentA: 'rgba(44, 113, 88, 0.16)', accentB: 'rgba(184, 116, 68, 0.14)', grainOpacity: 0.2 } },
  { pattern: /^\/about$/, mood: { base: '#f5ece3', accentA: 'rgba(111, 73, 50, 0.2)', accentB: 'rgba(80, 98, 118, 0.14)', grainOpacity: 0.2 } },
  { pattern: /^\/privacy$/, mood: { base: '#f6ede4', accentA: 'rgba(80, 98, 118, 0.18)', accentB: 'rgba(191, 141, 95, 0.12)', grainOpacity: 0.2 } },
  { pattern: /^\/terms$/, mood: { base: '#f5ece3', accentA: 'rgba(80, 98, 118, 0.18)', accentB: 'rgba(184, 116, 68, 0.12)', grainOpacity: 0.2 } },
  { pattern: /^\/cookies$/, mood: { base: '#f6ede3', accentA: 'rgba(80, 98, 118, 0.18)', accentB: 'rgba(184, 116, 68, 0.12)', grainOpacity: 0.2 } },
  { pattern: /^\/coming-soon$/, mood: { base: '#f4e9dc', accentA: 'rgba(184, 116, 68, 0.26)', accentB: 'rgba(44, 113, 88, 0.2)', grainOpacity: 0.25 } },
];

const DASHBOARD_MOOD_RULES: MoodRule[] = [
  { pattern: /^\/dashboard$/, mood: { base: '#f8f1e7', accentA: 'rgba(184, 116, 68, 0.16)', accentB: 'rgba(44, 113, 88, 0.1)', grainOpacity: 0.2 } },
  { pattern: /^\/dashboard\/professional$/, mood: { base: '#f6ece0', accentA: 'rgba(80, 98, 118, 0.2)', accentB: 'rgba(191, 141, 95, 0.12)', grainOpacity: 0.2 } },
  { pattern: /^\/orders$/, mood: { base: '#f7efe5', accentA: 'rgba(184, 116, 68, 0.18)', accentB: 'rgba(80, 98, 118, 0.14)', grainOpacity: 0.22 } },
  { pattern: /^\/orders\/[^/]+$/, mood: { base: '#f6ece2', accentA: 'rgba(184, 116, 68, 0.2)', accentB: 'rgba(80, 98, 118, 0.16)', grainOpacity: 0.22 } },
  { pattern: /^\/orders\/[^/]+\/invoice$/, mood: { base: '#f5ece2', accentA: 'rgba(191, 141, 95, 0.2)', accentB: 'rgba(80, 98, 118, 0.14)', grainOpacity: 0.2 } },
  { pattern: /^\/new-order$/, mood: { base: '#f8f1e8', accentA: 'rgba(44, 113, 88, 0.14)', accentB: 'rgba(184, 116, 68, 0.16)', grainOpacity: 0.2 } },
  { pattern: /^\/work-orders$/, mood: { base: '#f7eee4', accentA: 'rgba(184, 116, 68, 0.18)', accentB: 'rgba(80, 98, 118, 0.14)', grainOpacity: 0.22 } },
  { pattern: /^\/work-orders\/[^/]+$/, mood: { base: '#f6ede3', accentA: 'rgba(184, 116, 68, 0.18)', accentB: 'rgba(44, 113, 88, 0.12)', grainOpacity: 0.22 } },
  { pattern: /^\/inventory$/, mood: { base: '#f7efe6', accentA: 'rgba(44, 113, 88, 0.16)', accentB: 'rgba(184, 116, 68, 0.14)', grainOpacity: 0.2 } },
  { pattern: /^\/inventory\/new$/, mood: { base: '#f8f1e8', accentA: 'rgba(44, 113, 88, 0.18)', accentB: 'rgba(191, 141, 95, 0.14)', grainOpacity: 0.2 } },
  { pattern: /^\/inventory\/[^/]+$/, mood: { base: '#f6ede3', accentA: 'rgba(44, 113, 88, 0.16)', accentB: 'rgba(80, 98, 118, 0.12)', grainOpacity: 0.2 } },
  { pattern: /^\/kanban$/, mood: { base: '#f6ede3', accentA: 'rgba(191, 141, 95, 0.2)', accentB: 'rgba(44, 113, 88, 0.14)', grainOpacity: 0.22 } },
  { pattern: /^\/crm$/, mood: { base: '#f6ece2', accentA: 'rgba(80, 98, 118, 0.2)', accentB: 'rgba(184, 116, 68, 0.14)', grainOpacity: 0.2 } },
  { pattern: /^\/suppliers$/, mood: { base: '#f7eee4', accentA: 'rgba(191, 141, 95, 0.18)', accentB: 'rgba(44, 113, 88, 0.14)', grainOpacity: 0.2 } },
  { pattern: /^\/team$/, mood: { base: '#f6ede3', accentA: 'rgba(80, 98, 118, 0.18)', accentB: 'rgba(184, 116, 68, 0.14)', grainOpacity: 0.2 } },
  { pattern: /^\/members$/, mood: { base: '#f6ede4', accentA: 'rgba(80, 98, 118, 0.18)', accentB: 'rgba(44, 113, 88, 0.12)', grainOpacity: 0.2 } },
  { pattern: /^\/search$/, mood: { base: '#f7eee4', accentA: 'rgba(80, 98, 118, 0.2)', accentB: 'rgba(191, 141, 95, 0.14)', grainOpacity: 0.2 } },
  { pattern: /^\/notifications$/, mood: { base: '#f6ede3', accentA: 'rgba(184, 116, 68, 0.16)', accentB: 'rgba(80, 98, 118, 0.16)', grainOpacity: 0.2 } },
  { pattern: /^\/analytics$/, mood: { base: '#f5ece2', accentA: 'rgba(80, 98, 118, 0.22)', accentB: 'rgba(184, 116, 68, 0.12)', grainOpacity: 0.2 } },
  { pattern: /^\/reports$/, mood: { base: '#f6ede3', accentA: 'rgba(80, 98, 118, 0.2)', accentB: 'rgba(191, 141, 95, 0.12)', grainOpacity: 0.2 } },
  { pattern: /^\/settings$/, mood: { base: '#f6ede4', accentA: 'rgba(80, 98, 118, 0.18)', accentB: 'rgba(184, 116, 68, 0.12)', grainOpacity: 0.2 } },
  { pattern: /^\/accounting$/, mood: { base: '#f4eadf', accentA: 'rgba(191, 141, 95, 0.24)', accentB: 'rgba(44, 113, 88, 0.14)', grainOpacity: 0.24 } },
  { pattern: /^\/finance$/, mood: { base: '#f4eadf', accentA: 'rgba(191, 141, 95, 0.24)', accentB: 'rgba(44, 113, 88, 0.14)', grainOpacity: 0.24 } },
  { pattern: /^\/finance\/invoice$/, mood: { base: '#f4eadf', accentA: 'rgba(191, 141, 95, 0.24)', accentB: 'rgba(80, 98, 118, 0.14)', grainOpacity: 0.24 } },
  { pattern: /^\/finance\/invoice\/print$/, mood: { base: '#f5ece1', accentA: 'rgba(191, 141, 95, 0.2)', accentB: 'rgba(80, 98, 118, 0.12)', grainOpacity: 0.2 } },
  { pattern: /^\/finance\/payments$/, mood: { base: '#f4eadf', accentA: 'rgba(191, 141, 95, 0.24)', accentB: 'rgba(44, 113, 88, 0.14)', grainOpacity: 0.24 } },
  { pattern: /^\/finance\/documents$/, mood: { base: '#f5ebe0', accentA: 'rgba(191, 141, 95, 0.22)', accentB: 'rgba(80, 98, 118, 0.14)', grainOpacity: 0.22 } },
  { pattern: /^\/finance\/employees$/, mood: { base: '#f5ebe0', accentA: 'rgba(191, 141, 95, 0.22)', accentB: 'rgba(80, 98, 118, 0.14)', grainOpacity: 0.22 } },
  { pattern: /^\/finance\/employees\/[^/]+$/, mood: { base: '#f4eadf', accentA: 'rgba(191, 141, 95, 0.22)', accentB: 'rgba(80, 98, 118, 0.14)', grainOpacity: 0.22 } },
];

const AUTH_MOOD_RULES: MoodRule[] = [
  { pattern: /^\/auth\/login$/, mood: { base: '#f4ece2', accentA: 'rgba(184, 116, 68, 0.2)', accentB: 'rgba(80, 98, 118, 0.14)', grainOpacity: 0.22 } },
  { pattern: /^\/signup$/, mood: { base: '#f4ede3', accentA: 'rgba(44, 113, 88, 0.2)', accentB: 'rgba(184, 116, 68, 0.14)', grainOpacity: 0.22 } },
  { pattern: /^\/auth\/forgot-password$/, mood: { base: '#f4ece2', accentA: 'rgba(191, 141, 95, 0.2)', accentB: 'rgba(80, 98, 118, 0.14)', grainOpacity: 0.22 } },
  { pattern: /^\/auth\/update-password$/, mood: { base: '#f4ece2', accentA: 'rgba(191, 141, 95, 0.2)', accentB: 'rgba(80, 98, 118, 0.14)', grainOpacity: 0.22 } },
  { pattern: /^\/auth\/accept-invite$/, mood: { base: '#f5ede3', accentA: 'rgba(44, 113, 88, 0.18)', accentB: 'rgba(184, 116, 68, 0.12)', grainOpacity: 0.22 } },
  { pattern: /^\/auth\/sso-verify$/, mood: { base: '#f5ede3', accentA: 'rgba(80, 98, 118, 0.2)', accentB: 'rgba(184, 116, 68, 0.12)', grainOpacity: 0.22 } },
];

const DEFAULT_LANDING_MOOD: MoodLayer = {
  base: '#f8f3ec',
  accentA: 'rgba(184, 116, 68, 0.18)',
  accentB: 'rgba(44, 113, 88, 0.14)',
  grainOpacity: 0.18,
};

const DEFAULT_DASHBOARD_MOOD: MoodLayer = {
  base: '#f8f3ec',
  accentA: 'rgba(184, 116, 68, 0.16)',
  accentB: 'rgba(44, 113, 88, 0.12)',
  grainOpacity: 0.2,
};

const DEFAULT_AUTH_MOOD: MoodLayer = {
  base: '#f4ece2',
  accentA: 'rgba(184, 116, 68, 0.16)',
  accentB: 'rgba(80, 98, 118, 0.14)',
  grainOpacity: 0.2,
};

function pickMood(pathname: string, rules: MoodRule[], fallback: MoodLayer): MoodLayer {
  return rules.find((rule) => rule.pattern.test(pathname))?.mood ?? fallback;
}

function getMood(variant: SurfaceVariant, pathname: string): MoodLayer {
  if (variant === 'landing') {
    return pickMood(pathname, LANDING_MOOD_RULES, DEFAULT_LANDING_MOOD);
  }

  if (variant === 'auth') {
    return pickMood(pathname, AUTH_MOOD_RULES, DEFAULT_AUTH_MOOD);
  }

  return pickMood(pathname, DASHBOARD_MOOD_RULES, DEFAULT_DASHBOARD_MOOD);
}

export function ExperienceBackdrop({ variant }: ExperienceBackdropProps) {
  const pathname = usePathname();
  const mood = useMemo(() => getMood(variant, pathname), [variant, pathname]);
  const isDashboard = variant === 'dashboard';

  return (
    <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
      <motion.div
        key={`${variant}-${pathname}-base`}
        className="absolute inset-0"
        initial={{ opacity: 0.35 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
        style={{
          background: isDashboard
            ? 'linear-gradient(180deg, color-mix(in srgb, var(--rf-bg) 94%, #ffffff 6%) 0%, color-mix(in srgb, var(--rf-bg-muted) 96%, #ffffff 4%) 100%)'
            : `linear-gradient(180deg, ${mood.base} 0%, color-mix(in srgb, ${mood.base} 80%, #ffffff 20%) 100%)`,
        }}
      />
      <motion.div
        key={`${variant}-${pathname}-radial`}
        className="absolute inset-0"
        initial={{ opacity: 0.2, scale: 1.04 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 1.1, ease: [0.22, 1, 0.36, 1] }}
        style={{
          background: isDashboard
            ? 'radial-gradient(58% 46% at 12% 4%, color-mix(in srgb, var(--rf-accent) 22%, transparent), transparent 72%), radial-gradient(44% 34% at 88% 0%, color-mix(in srgb, var(--rf-accent-strong) 14%, transparent), transparent 72%), linear-gradient(180deg, color-mix(in srgb, var(--rf-surface) 44%, transparent) 0%, transparent 60%)'
            : `radial-gradient(55% 45% at 15% 10%, ${mood.accentA}, transparent 70%), radial-gradient(46% 40% at 82% 2%, ${mood.accentB}, transparent 72%), radial-gradient(38% 42% at 50% 100%, ${mood.accentA}, transparent 75%)`,
        }}
      />
      <div
        className="absolute inset-0"
        style={{
          opacity: isDashboard ? 0.1 : mood.grainOpacity,
          backgroundImage:
            isDashboard
              ? 'radial-gradient(circle at 1px 1px, rgba(15, 23, 42, 0.13) 1px, transparent 0)'
              : 'radial-gradient(circle at 1px 1px, rgba(67, 55, 44, 0.14) 1px, transparent 0)',
          backgroundSize: isDashboard ? '24px 24px' : '22px 22px',
          maskImage: 'linear-gradient(180deg, black 0%, rgba(0,0,0,0.25) 100%)',
        }}
      />
    </div>
  );
}
