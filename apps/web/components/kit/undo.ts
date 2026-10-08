'use client';

import { toast } from 'sonner';

/**
 * Do something only if the person does not take it back: the change shows at once (the caller
 * updates the screen), a toast offers "Geri al" for a few seconds, and only then is it sent.
 * Undo restores the screen and nothing reaches the server.
 */
export function withUndo({ message, commit, undo, seconds = 5 }: {
  message: string;
  commit: () => Promise<void> | void;
  undo: () => void;
  seconds?: number;
}) {
  let settled = false;
  const finish = () => {
    if (settled) return;
    settled = true;
    void Promise.resolve(commit()).catch((error: unknown) => {
      undo();
      toast.error(error instanceof Error ? error.message : 'Kaydedilemedi');
    });
  };
  toast(message, {
    duration: seconds * 1000,
    action: { label: 'Geri al', onClick: () => { if (settled) return; settled = true; undo(); } },
    onAutoClose: finish,
    onDismiss: finish,
  });
}
