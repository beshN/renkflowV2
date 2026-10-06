'use client';

import { useEffect, useState } from 'react';

type Occasion = { label: string; solemn?: boolean };

const OCCASIONS: Record<string, Occasion> = {
  '01-01': { label: 'Mutlu yıllar' },
  '04-23': { label: '23 Nisan Ulusal Egemenlik ve Çocuk Bayramı kutlu olsun' },
  '05-19': { label: '19 Mayıs Atatürk’ü Anma, Gençlik ve Spor Bayramı kutlu olsun' },
  '07-15': { label: '15 Temmuz Demokrasi ve Millî Birlik Günü', solemn: true },
  '08-30': { label: '30 Ağustos Zafer Bayramı kutlu olsun' },
  '10-28': { label: 'Cumhuriyet Bayramı arifesi' },
  '10-29': { label: '29 Ekim Cumhuriyet Bayramı kutlu olsun' },
  '11-10': { label: 'Atatürk’ü saygı ve özlemle anıyoruz', solemn: true },
};

/** National days in Istanbul time; rendered after mount to avoid hydration drift. */
export function OccasionBadge() {
  const [occasion, setOccasion] = useState<Occasion | null>(null);
  useEffect(() => {
    const key = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Istanbul', month: '2-digit', day: '2-digit' }).format(new Date());
    setOccasion(OCCASIONS[key] || null);
  }, []);
  if (!occasion) return null;
  return (
    <span className="rf-chip ml-1 animate-in fade-in-0 slide-in-from-left-1 duration-500">
      {occasion.solemn
        ? <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-foreground/60" />
        : <svg aria-hidden viewBox="0 0 30 20" className="h-2.5 w-[15px] shrink-0 rounded-[1.5px]"><rect width="30" height="20" fill="#e30a17" /><circle cx="10.0" cy="10" r="5.0" fill="#fff" /><circle cx="11.25" cy="10" r="4.0" fill="#e30a17" /><polygon points="14.16,10.00 15.89,9.44 15.89,7.62 16.96,9.09 18.68,8.53 17.62,10.00 18.68,11.47 16.96,10.91 15.89,12.38 15.89,10.56" fill="#fff" /></svg>}
      {occasion.label}
    </span>
  );
}
