'use client';

import React, { useState, useEffect } from 'react';
import { Hero } from '@/components/landing-new/Hero';

export default function ComingSoonPage() {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  return <Hero />;
}
