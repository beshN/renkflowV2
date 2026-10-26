'use client';

import { useEffect } from 'react';
import { toast } from 'sonner';
import { celebrate } from './celebrate';

const SEQUENCE = ['ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight', 'b', 'a'];

/**
 * The old cheat code, anywhere in the workspace (not while typing in a field): a shower of
 * aluminium offcuts and a word from the workshop. Nothing changes but the mood.
 */
export function KonamiCode() {
  useEffect(() => {
    let at = 0;
    const onKey = (e: KeyboardEvent) => {
      // Keys pressed with nothing focused come from the window or document, which are not elements.
      const target = e.target instanceof Element ? e.target : null;
      if (target?.closest('input, textarea, select, [contenteditable="true"]')) return;
      const key = e.key.length === 1 ? e.key.toLowerCase() : e.key;
      at = key === SEQUENCE[at] ? at + 1 : key === SEQUENCE[0] ? 1 : 0;
      if (at < SEQUENCE.length) return;
      at = 0;
      for (let i = 0; i < 4; i++) {
        setTimeout(() => celebrate({ x: window.innerWidth * (0.2 + Math.random() * 0.6), y: window.innerHeight * (0.2 + Math.random() * 0.3) }), i * 220);
      }
      toast.success('Usta modu açıldı', { description: 'Bugün fire yok, kesimler milimetrik. (Gerçek bir şey değişmedi, ama iyi hissettirir.)' });
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
  return null;
}
