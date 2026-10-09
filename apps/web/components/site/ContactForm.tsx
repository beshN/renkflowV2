'use client';

import Link from 'next/link';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { ArrowRight } from 'lucide-react';

export function ContactForm() {
  const inFlight = useRef(false);
  const confirmation = useRef<HTMLDivElement>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const [sent, setSent] = useState(false);
  useEffect(() => { if (sent) confirmation.current?.focus(); }, [sent]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (inFlight.current) return;
    const form = event.currentTarget;
    const fields = new FormData(form);
    inFlight.current = true;
    setPending(true);
    setError('');
    try {
      const response = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: fields.get('name'), email: fields.get('email'), subject: fields.get('subject'), message: fields.get('message'), pagePath: '/contact', locale: 'tr' }),
      });
      const result = await response.json().catch(() => ({ error: 'Gönderim sonucu doğrulanamadı. Lütfen daha sonra tekrar deneyin.' }));
      if (!response.ok || !result.success) throw new Error(result.error || 'Talebiniz gönderilemedi. Lütfen tekrar deneyin.');
      setSent(true);
      form.reset();
    } catch (cause) {
      setError(cause instanceof Error && cause.message !== 'Failed to fetch' ? cause.message : 'Bağlantı kurulamadı. Yazdıklarınız korunuyor; tekrar deneyebilirsiniz.');
    } finally {
      inFlight.current = false;
      setPending(false);
    }
  }

  return (
    <section aria-labelledby="contact-form-title" className="mb-16 max-w-2xl">
      <h2 id="contact-form-title" className="text-2xl font-semibold tracking-tight">Talebinizi iletin</h2>
      <p className="mt-3 text-sm leading-6 text-muted-foreground">Demo için iş akışınızı, destek için yaşadığınız sorunu kısaca anlatın.</p>
      {sent ? <div ref={confirmation} tabIndex={-1} role="status" className="mt-6 rounded-xl border border-border bg-card p-6"><p className="font-medium">Talebiniz alındı.</p><p className="mt-2 text-sm text-muted-foreground">Ekibimiz belirttiğiniz e-posta adresinden size ulaşacak.</p></div> : (
        <form onSubmit={submit} className="mt-6 space-y-5" aria-busy={pending}>
          <fieldset disabled={pending} className="space-y-5 disabled:opacity-70">
            <div className="grid gap-5 sm:grid-cols-2">
              <label className="grid gap-2 text-sm">Ad soyad<input className="rf-input w-full" name="name" autoComplete="name" required minLength={2} maxLength={100} /></label>
              <label className="grid gap-2 text-sm">E-posta<input className="rf-input w-full" type="email" name="email" autoComplete="email" required maxLength={254} /></label>
            </div>
            <label className="grid gap-2 text-sm">Konu<select className="rf-input w-full" name="subject" defaultValue="sales"><option value="sales">Demo ve fiyat teklifi</option><option value="technical">Teknik destek</option><option value="general">Diğer konular</option></select></label>
            <label className="grid gap-2 text-sm">Mesajınız<textarea className="rf-input min-h-36 w-full resize-y" name="message" required minLength={10} maxLength={5000} rows={5} /></label>
            <p className="text-xs leading-5 text-muted-foreground">İletişim bilgileriniz talebinize yanıt vermek için kullanılır. <Link href="/privacy" className="underline underline-offset-4">Gizlilik politikası</Link></p>
            {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
            <button type="submit" className="rf-ink-button min-h-11 px-5 text-sm" disabled={pending}>{pending ? 'Gönderiliyor…' : 'Talebi gönder'}<ArrowRight size={16} /></button>
          </fieldset>
        </form>
      )}
    </section>
  );
}
