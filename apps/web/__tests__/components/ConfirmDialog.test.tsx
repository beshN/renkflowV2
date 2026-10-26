/** @jest-environment jsdom */
import { useState } from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { useConfirm } from '@/components/kit/ConfirmDialog';

function Harness() {
  const [confirm, confirmDialog] = useConfirm();
  const [answer, setAnswer] = useState('');
  return (
    <>
      {confirmDialog}
      <button type="button" onClick={async () => setAnswer(String(await confirm({ title: 'Kayıt silinsin mi?', confirmLabel: 'Sil' })))}>Sil</button>
      <output>{answer}</output>
    </>
  );
}

it('asks in a branded alert dialog with focus on cancel and answers yes', async () => {
  render(<Harness />);
  fireEvent.click(screen.getByRole('button', { name: 'Sil' }));
  const dialog = await screen.findByRole('alertdialog', { name: 'Kayıt silinsin mi?' });
  expect(dialog).toBeInTheDocument();
  await waitFor(() => expect(screen.getByRole('button', { name: 'Vazgeç' })).toHaveFocus());
  fireEvent.click(screen.getAllByRole('button', { name: 'Sil' }).find((b) => dialog.contains(b))!);
  await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('true'));
  expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
});

it('answers no on Escape', async () => {
  render(<Harness />);
  fireEvent.click(screen.getByRole('button', { name: 'Sil' }));
  const dialog = await screen.findByRole('alertdialog');
  fireEvent.keyDown(dialog, { key: 'Escape' });
  await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('false'));
});
