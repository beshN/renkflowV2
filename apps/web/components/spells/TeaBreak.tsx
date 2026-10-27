'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { isLateNight } from '@/lib/spells/late-night';
import styles from './TeaBreak.module.css';

const LABEL = 'Geç oldu, bir çay molası?';

/**
 * Between 00:00 and 05:00 Istanbul time a steaming tulip tea glass sits in the header.
 * Rendered after mount only (server and browser clocks differ); rechecked every few minutes.
 */
export function TeaBreak() {
  const [night, setNight] = useState(false);
  useEffect(() => {
    const check = () => setNight(isLateNight(new Date()));
    check();
    const timer = window.setInterval(check, 5 * 60 * 1000);
    return () => window.clearInterval(timer);
  }, []);
  if (!night) return null;
  return (
    <button
      type="button"
      title={LABEL}
      aria-label={LABEL}
      onClick={() => toast('Çay demlendi.', { description: 'Gözlerinizi biraz dinlendirin.' })}
      className="rf-icon-button animate-in fade-in-0 duration-700"
    >
      <svg aria-hidden viewBox="0 0 24 24" className="h-[19px] w-[19px] overflow-visible">
        <path className={styles.steam} d="M10.6 5.2c-.8-.9.8-1.5 0-2.6" />
        <path className={styles.steam} d="M13.4 5.2c-.8-.9.8-1.5 0-2.6" />
        {/* Tea, up to just under the rim */}
        <path d="M8.2 8.6h7.6c-.2 1.9-1.6 3-1.6 4.4 0 1.3 1.6 2.2 1.6 4.2 0 1.6-1.6 2.6-3.8 2.6s-3.8-1-3.8-2.6c0-2 1.6-2.9 1.6-4.2 0-1.4-1.4-2.5-1.6-4.4Z" fill="#b4531f" opacity=".9" />
        {/* İnce belli glass */}
        <path d="M7.6 6.6h8.8c0 3.2-2 4.6-2 6.4 0 1.6 1.8 2.4 1.8 4.4 0 2-1.9 3.1-4.2 3.1s-4.2-1.1-4.2-3.1c0-2 1.8-2.8 1.8-4.4 0-1.8-2-3.2-2-6.4Z" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
        {/* Saucer */}
        <path d="M5.6 21.8h12.8" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
      </svg>
    </button>
  );
}
