'use client';

import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';

export type ConfirmOptions = {
  title: string;
  description?: ReactNode;
  /** Label of the confirming button (default "Onayla"). */
  confirmLabel?: string;
  /** Label of the cancelling button (default "Vazgeç"). */
  cancelLabel?: string;
  /** 'danger' paints the confirming button red: deleting, revoking, closing sessions. */
  tone?: 'danger' | 'default';
};

type Pending = ConfirmOptions & { resolve: (ok: boolean) => void };

/**
 * The branded replacement for window.confirm. Focus starts on "Vazgeç", Esc and the
 * cancel button answer no; clicking outside does nothing (an alert dialog wants an answer).
 */
export function ConfirmDialog({ options, onAnswer }: { options: ConfirmOptions | null; onAnswer: (ok: boolean) => void }) {
  const cancelRef = useRef<HTMLButtonElement>(null);
  const danger = options?.tone !== 'default';
  return (
    <Dialog.Root open={!!options} onOpenChange={(open) => { if (!open) onAnswer(false); }}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[90] bg-slate-950/55" />
        <Dialog.Content
          role="alertdialog"
          onOpenAutoFocus={(event) => { event.preventDefault(); cancelRef.current?.focus(); }}
          onPointerDownOutside={(event) => event.preventDefault()}
          onInteractOutside={(event) => event.preventDefault()}
          className="rf-command-dialog fixed left-1/2 top-1/2 z-[91] w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-lg border border-border bg-card p-5 text-card-foreground shadow-xl outline-none"
        >
          {options && (
            <>
              <div className="flex items-start gap-3">
                {danger && (
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-red-200 bg-red-50 text-red-700 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-300">
                    <AlertTriangle size={17} aria-hidden />
                  </span>
                )}
                <div className="min-w-0">
                  <Dialog.Title className="text-sm font-semibold">{options.title}</Dialog.Title>
                  {options.description
                    ? <Dialog.Description className="mt-1.5 text-sm text-muted-foreground">{options.description}</Dialog.Description>
                    : <Dialog.Description className="sr-only">Onaylamak veya vazgeçmek için seçin</Dialog.Description>}
                </div>
              </div>
              <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                <button ref={cancelRef} type="button" className="rf-secondary-button" onClick={() => onAnswer(false)}>
                  {options.cancelLabel ?? 'Vazgeç'}
                </button>
                <button
                  type="button"
                  className={cn('rf-primary-button', danger && '!border-red-700 !bg-red-700 !text-white hover:!bg-red-800 dark:!border-red-600 dark:!bg-red-600')}
                  onClick={() => onAnswer(true)}
                >
                  {options.confirmLabel ?? 'Onayla'}
                </button>
              </div>
            </>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

/**
 * `const [confirm, confirmDialog] = useConfirm();` then `if (!(await confirm({ title: '…' }))) return;`
 * and render `{confirmDialog}` once in the component. Asking again while a question is open answers the
 * first one "no".
 */
export function useConfirm(): [(options: ConfirmOptions) => Promise<boolean>, ReactNode] {
  const [pending, setPending] = useState<Pending | null>(null);
  const pendingRef = useRef<Pending | null>(null);
  const confirm = useCallback((options: ConfirmOptions) => new Promise<boolean>((resolve) => {
    pendingRef.current?.resolve(false);
    const next = { ...options, resolve };
    pendingRef.current = next;
    setPending(next);
  }), []);
  const answer = useCallback((ok: boolean) => {
    const current = pendingRef.current;
    pendingRef.current = null;
    setPending(null);
    current?.resolve(ok);
  }, []);
  // A component that unmounts with a question open answers it "no", so no caller waits forever.
  useEffect(() => () => { pendingRef.current?.resolve(false); pendingRef.current = null; }, []);
  return [confirm, <ConfirmDialog key="rf-confirm" options={pending} onAnswer={answer} />];
}
