'use client';

import { useOptimizedInView, usePrefersReducedMotion } from '@/lib/hooks/usePerformance';
import { 
  OptimizedMotion, 
  StaggerContainer, 
  StaggerItem, 
  FadeInSection,
  ScaleHover 
} from '@/components/animations';
import { motion } from 'framer-motion';

/**
 * Example: How to use optimized animation components for better performance
 */

// ============================================
// EXAMPLE 1: Optimized InView Hook (Replaces react-intersection-observer)
// ============================================
export function OptimizedHeroSection() {
  const [ref, isInView] = useOptimizedInView<HTMLDivElement>({
    threshold: 0.1,
    triggerOnce: true,
  });

  return (
    <div ref={ref} className="section-contain">
      {isInView && (
        <div>
          <h1>Content loaded when visible</h1>
        </div>
      )}
    </div>
  );
}

// ============================================
// EXAMPLE 2: FadeInSection Component
// ============================================
export function FeatureSection() {
  return (
    <FadeInSection 
      className="section-contain py-20"
      delay={0.2}
      direction="up"
    >
      <div className="container mx-auto">
        <h2>Feature Title</h2>
        <p>Feature description</p>
      </div>
    </FadeInSection>
  );
}

// ============================================
// EXAMPLE 3: Stagger Container for Lists
// ============================================
export function FeatureList() {
  const features = [
    { title: 'Feature 1', desc: 'Description 1' },
    { title: 'Feature 2', desc: 'Description 2' },
    { title: 'Feature 3', desc: 'Description 3' },
  ];

  return (
    <StaggerContainer 
      className="grid grid-cols-3 gap-6"
      staggerDelay={0.1}
    >
      {features.map((feature, index) => (
        <StaggerItem key={index} direction="scale">
          <div className="card-contain p-6 rounded-xl bg-white shadow-lg">
            <h3>{feature.title}</h3>
            <p>{feature.desc}</p>
          </div>
        </StaggerItem>
      ))}
    </StaggerContainer>
  );
}

// ============================================
// EXAMPLE 4: Scale Hover Effect
// ============================================
export function HoverCard({ children }: { children: React.ReactNode }) {
  return (
    <ScaleHover scale={1.02} className="card-contain">
      <div className="p-6 bg-white rounded-xl shadow-md">
        {children}
      </div>
    </ScaleHover>
  );
}

// ============================================
// EXAMPLE 5: Optimized Motion (Low-level)
// ============================================
export function CustomAnimation() {
  return (
    <OptimizedMotion
      className="widget-contain"
      initial={{ opacity: 0, y: 30 }}
      whileInView={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, delay: 0.1 }}
    >
      <div>Your content here</div>
    </OptimizedMotion>
  );
}

// ============================================
// EXAMPLE 6: With Reduced Motion Check
// ============================================
export function AccessibleAnimation() {
  const prefersReducedMotion = usePrefersReducedMotion();

  return (
    <motion.div
      initial={prefersReducedMotion ? false : { opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={prefersReducedMotion ? { duration: 0 } : { duration: 0.5 }}
    >
      Content respects user motion preferences
    </motion.div>
  );
}

// ============================================
// EXAMPLE 7: Landing Page Optimization
// ============================================
export function OptimizedLandingPage() {
  return (
    <main>
      {/* Hero - no delay */}
      <FadeInSection direction="up" className="section-contain">
        <h1>Hero Title</h1>
      </FadeInSection>

      {/* Features - staggered */}
      <StaggerContainer className="features-grid" staggerDelay={0.05}>
        {[1, 2, 3, 4].map((i) => (
          <StaggerItem key={i} direction="up">
            <div className="card-contain feature-card">
              Feature {i}
            </div>
          </StaggerItem>
        ))}
      </StaggerContainer>

      {/* Stats - scale animation */}
      <FadeInSection delay={0.3} direction="none">
        <div className="stats-container">
          <StatCard />
        </div>
      </FadeInSection>
    </main>
  );
}

function StatCard() {
  return (
    <ScaleHover scale={1.05} className="stat-card">
      <div className="p-4">
        <span className="text-2xl font-bold">100+</span>
        <p>Happy Customers</p>
      </div>
    </ScaleHover>
  );
}
