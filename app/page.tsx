'use client';

import React, { useState, useEffect } from 'react';
import { Navbar } from '@/components/landing-new/Navbar';
import { Hero } from '@/components/landing-new/Hero';
import { Features } from '@/components/landing-new/Features';
import { Pricing } from '@/components/landing-new/Pricing';
import { Testimonials } from '@/components/landing-new/Testimonials';
import { FAQ } from '@/components/landing-new/FAQ';
// ... (imports)

// ...
  return (
    <div className="flex min-h-screen flex-col">
      <Navbar isDark={theme === 'dark'} toggleTheme={toggleTheme} />
      <Hero />
      <Features />
      <Testimonials />
      <Pricing />
      <FAQ />
      <Footer />
    </div>
  );
}
