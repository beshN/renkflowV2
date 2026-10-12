'use client';
import { useFormStatus } from 'react-dom';

export function RevokeButton() {
  const { pending }=useFormStatus();
  return <button className="rf-secondary-button min-h-11 px-4 text-sm disabled:opacity-50" disabled={pending} type="submit">
    <span aria-live="polite">{pending ? 'Kapatılıyor…' : 'Oturumu kapat'}</span>
  </button>;
}
