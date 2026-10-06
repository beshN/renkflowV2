'use client';

import { useEffect, useRef, useState } from 'react';
import { Search } from 'lucide-react';

interface NavbarProps {
  title: string;
  showSearch?: boolean;
  onSearch?: (term: string) => void;
}

/**
 * In-page heading for legacy module pages. The workspace header already provides
 * navigation, theme and account controls, so this renders only the title and an
 * optional local search.
 */
export function Navbar({ title, showSearch = true, onSearch }: NavbarProps) {
  const [value, setValue] = useState('');
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (!onSearch) return;
    if (debounce.current) clearTimeout(debounce.current);
    debounce.current = setTimeout(() => onSearch(value), 300);
    return () => { if (debounce.current) clearTimeout(debounce.current); };
  }, [value, onSearch]);

  return (
    <div className="mx-auto flex w-full max-w-[1600px] flex-wrap items-end justify-between gap-4 px-4 pt-7 md:px-7">
      <h1 className="rf-page-title !mt-0">{title}</h1>
      {showSearch && onSearch && (
        <label className="relative w-full max-w-xs">
          <span className="sr-only">{title} içinde ara</span>
          <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input value={value} onChange={(event) => setValue(event.target.value)} placeholder="Ara…" className="rf-input h-9 w-full pl-9" />
        </label>
      )}
    </div>
  );
}
