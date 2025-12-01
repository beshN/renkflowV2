'use client';

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';

export default function Template({ children }: { children: React.ReactNode }) {
  const [opacity, setOpacity] = useState(0);
  const pathname = usePathname();

  useEffect(() => {
    // Reset opacity to 0 when pathname changes (start of transition)
    setOpacity(0);
    
    // Small timeout to trigger the fade-in
    const timeout = setTimeout(() => {
      setOpacity(1);
    }, 50);

    return () => clearTimeout(timeout);
  }, [pathname]);

  return (
    <div
      className="transition-opacity duration-500 ease-in-out"
      style={{ opacity }}
    >
      {children}
    </div>
  );
}
