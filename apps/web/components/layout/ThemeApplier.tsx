'use client';

import { useEffect } from 'react';
import { useOptionalAuth } from '@/lib/context/AuthContext';

export function ThemeApplier() {
  const auth = useOptionalAuth();
  const user = auth?.user;

  useEffect(() => {
    if (user?.brandColor) {
      // Convert hex to HSL for Tailwind compatibility if needed, 
      // or just set the CSS variable if using direct color values.
      // Assuming --primary is used as a color value directly or via HSL.
      // If the project uses HSL variables (e.g. --primary: 222.2 47.4% 11.2%), we need to convert.
      // However, looking at globals.css might reveal the format.
      // For now, let's try setting a custom property that overrides the primary color.
      
      // A simple approach if Tailwind is configured to use <alpha-value> with HSL:
      // We might need a helper to convert Hex to HSL.
      
      const hex = user.brandColor.replace('#', '');
      const r = parseInt(hex.substring(0, 2), 16);
      const g = parseInt(hex.substring(2, 4), 16);
      const b = parseInt(hex.substring(4, 6), 16);
      
      // Convert to HSL
      const r_norm = r / 255;
      const g_norm = g / 255;
      const b_norm = b / 255;
      
      const max = Math.max(r_norm, g_norm, b_norm);
      const min = Math.min(r_norm, g_norm, b_norm);
      let h = 0, s = 0, l = (max + min) / 2;

      if (max !== min) {
        const d = max - min;
        s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
        switch (max) {
          case r_norm: h = (g_norm - b_norm) / d + (g_norm < b_norm ? 6 : 0); break;
          case g_norm: h = (b_norm - r_norm) / d + 2; break;
          case b_norm: h = (r_norm - g_norm) / d + 4; break;
        }
        h /= 6;
      }
      
      // Tailwind HSL format usually expects degrees (without unit) and percentages
      const h_deg = Math.round(h * 360);
      const s_pct = Math.round(s * 100);
      const l_pct = Math.round(l * 100);
      
      const hslValue = `${h_deg} ${s_pct}% ${l_pct}%`;
      
      document.documentElement.style.setProperty('--primary', hslValue);
      // Also update ring color etc if needed
    }
  }, [user?.brandColor]);

  return null;
}
