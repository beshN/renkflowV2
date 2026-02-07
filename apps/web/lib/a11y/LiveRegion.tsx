'use client';

import React from 'react';

interface LiveRegionContextValue {
  announce: (message: string) => void;
}

const LiveRegionContext = React.createContext<LiveRegionContextValue | null>(null);

export function LiveRegionProvider({ children }: { children: React.ReactNode }) {
  const [message, setMessage] = React.useState('');

  const announce = React.useCallback((next: string) => {
    setMessage('');
    window.setTimeout(() => setMessage(next), 50);
  }, []);

  return (
    <LiveRegionContext.Provider value={{ announce }}>
      {children}
      <div aria-live="polite" aria-atomic="true" className="sr-only" role="status">
        {message}
      </div>
    </LiveRegionContext.Provider>
  );
}

export function useAnnounce() {
  const ctx = React.useContext(LiveRegionContext);
  return ctx?.announce ?? (() => undefined);
}
