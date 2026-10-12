'use client';

import { ReactNode, useEffect } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { usePathname } from 'next/navigation';

interface RouteTransitionProps {
  children: ReactNode;
  className?: string;
}

// Set after the first client mount. The server-rendered first paint must stay
// visible (no opacity 0 before hydration); only in-app navigations animate.
let hasMounted = false;

export function RouteTransition({ children, className }: RouteTransitionProps) {
  const pathname = usePathname();
  const prefersReducedMotion = useReducedMotion();

  useEffect(() => {
    hasMounted = true;
  }, []);

  if (prefersReducedMotion) {
    return <div className={className}>{children}</div>;
  }

  return (
    <motion.div
      key={pathname}
      className={className}
      initial={hasMounted ? { opacity: 0, y: 8 } : false}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.38, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </motion.div>
  );
}
