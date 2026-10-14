'use client';
import { useEffect, useState } from 'react';

/** Sync saved/template values without resetting local edits on unrelated parent renders. */
export function useConfigurationDraft<T extends object>(value: T) {
  const [draft, setDraft] = useState(value);
  const incoming = JSON.stringify(value);
  useEffect(() => {
    setDraft(previous => JSON.stringify(previous) === incoming ? previous : JSON.parse(incoming) as T);
  }, [incoming]);
  return [draft, setDraft] as const;
}
