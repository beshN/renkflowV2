'use client';

/** The required consent box for sign-up, invite acceptance and the one-time dashboard prompt. */
export function LegalConsentCheckbox({ checked, onChange, id = 'legal-consent' }: { checked: boolean; onChange: (checked: boolean) => void; id?: string }) {
  const link = 'font-medium text-primary underline-offset-2 hover:underline';
  return (
    <div className="flex items-start gap-2.5 text-sm leading-5 text-foreground">
      <input
        id={id}
        type="checkbox"
        required
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="mt-0.5 h-4 w-4 shrink-0 accent-[var(--primary,currentColor)]"
      />
      <label htmlFor={id}>
        <a href="/terms" target="_blank" rel="noopener noreferrer" className={link}>Kullanım Koşulları</a>&apos;nı okudum ve kabul ediyorum;{' '}
        <a href="/privacy" target="_blank" rel="noopener noreferrer" className={link}>Gizlilik ve KVKK Aydınlatma Metni</a>&apos;ni okudum.
      </label>
    </div>
  );
}
