'use client';

import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Button } from './Button';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}

export function Modal({ isOpen, onClose, title, children }: ModalProps) {
  const overlayRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      document.body.style.overflow = 'hidden';
    }

    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = 'unset';
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleOverlayClick = (e: React.MouseEvent) => {
    if (e.target === overlayRef.current) {
      onClose();
    }
  };

  return createPortal(
    <div
      ref={overlayRef}
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-sm p-4 animate-in fade-in duration-200"
      onClick={handleOverlayClick}
    >
      <div className="bg-white/90 dark:bg-slate-900/90 rounded-2xl shadow-[0_40px_90px_-60px_rgba(15,23,42,0.7)] w-full max-w-2xl max-h-[90vh] overflow-y-auto animate-in zoom-in-95 duration-200 border border-slate-200/70 dark:border-slate-800 backdrop-blur">
        <div className="flex items-center justify-between p-6 border-b border-slate-200/70 dark:border-slate-800 sticky top-0 bg-white/80 dark:bg-slate-900/80 z-10 backdrop-blur">
          <h2 className="text-xl font-semibold text-text-light dark:text-text-dark">
            {title}
          </h2>
          <button
            onClick={onClose}
            className="text-subtle-light dark:text-subtle-dark hover:text-text-light dark:hover:text-text-dark transition-colors"
          >
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>
        <div className="p-6">
          {children}
        </div>
      </div>
    </div>,
    document.body
  );
}
