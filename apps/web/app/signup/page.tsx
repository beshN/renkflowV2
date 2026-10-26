'use client';

export const dynamic = 'force-dynamic';

import { PASSWORD_POLICY, passwordProblem } from '@/lib/security/access-matrix';
import Link from 'next/link';
import { FormEvent, useState } from 'react';
import { AuthShell } from '@/components/auth/AuthShell';
import { Button } from '@/components/shared/ui/Button';
import { Input } from '@/components/shared/ui/Input';
import { User, Building2, LayoutTemplate, Mail, Lock, UserPlus, MailCheck } from 'lucide-react';
import { cn } from '@/lib/utils';

import { DEFAULT_TEMPLATE_KEY, TEMPLATE_DEFINITIONS, type TemplateKey } from '@/lib/config/templates';
import { requestJson } from '@/lib/shared/network';

export default function SignupPage() {
  const [name, setName] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [templateKey, setTemplateKey] = useState<TemplateKey>(DEFAULT_TEMPLATE_KEY);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [registeredEmail, setRegisteredEmail] = useState('');

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const problem = passwordProblem(password, email);
    if (problem) {
      setError(problem);
      return;
    }
    setLoading(true);
    setError('');

    const result = await requestJson('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: name.trim(),
        email: email.trim().toLowerCase(),
        password,
        companyName: companyName.trim(),
        templateKey,
      }),
    }, {
      timeoutMs: 25000,
      fallbackError: 'Kayıt isteği şu anda tamamlanamadı.',
    });
    setLoading(false);

    if (!result.ok) {
      setError(result.error || 'Kayıt işlemi tamamlanamadı.');
      return;
    }

    // Sign-in needs a verified e-mail, so the next step is the inbox, not the login form.
    setRegisteredEmail(email.trim().toLowerCase());
  };

  if (registeredEmail) {
    return <VerifyEmailNotice email={registeredEmail} onChangeEmail={() => { setRegisteredEmail(''); setPassword(''); }} />;
  }

  return (
    <AuthShell
      icon={<UserPlus size={18} />}
      eyebrow="Yeni çalışma alanı"
      title="Hesabınızı oluşturun"
      description="İşletmenizi yönetmeye dakikalar içinde başlayın."
      footer={<>Zaten hesabınız var mı? <Link href="/auth/login" className="font-medium text-primary hover:underline">Giriş yapın</Link></>}
    >
            <form method="post" onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input
                  type="text"
                  label="Ad Soyad"
                  placeholder="Adınız"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  leftIcon={<User size={18} />}
                  variant="default"
              />
              <Input
                  type="text"
                  label="Şirket Adı"
                  placeholder="Opsiyonel"
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  leftIcon={<Building2 size={18} />}
                  variant="default"
              />
          </div>

          {/* Custom Select styling to match Input */}
          <div className="space-y-2">
              <label className="block text-sm font-medium text-foreground">
                  Sektör Şablonu
              </label>
              <div className="relative">
                   <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">
                      <LayoutTemplate size={18} />
                  </div>
                  <select
                      aria-label="Sektör şablonu"
                      value={templateKey}
                      onChange={(e) => setTemplateKey(e.target.value as TemplateKey)}
                      className={cn(
                          'w-full h-11 pl-10 pr-4 rounded-[10px] outline-none transition-all duration-200',
                          'text-sm appearance-none',
                          'border border-input bg-card hover:border-primary/40',
                          'focus:border-primary focus:ring-4 focus:ring-[var(--rf-focus-ring)]',
                          'shadow-sm text-foreground'
                      )}
                  >
                       {TEMPLATE_DEFINITIONS.map((template) => (
                          <option key={template.key} value={template.key}>
                              {template.industry}
                          </option>
                      ))}
                  </select>
                   <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none opacity-50">
                      <svg width="10" height="6" viewBox="0 0 10 6" fill="none" xmlns="http://www.w3.org/2000/svg">
                          <path d="M1 1L5 5L9 1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                  </div>
              </div>
          </div>

          <Input
              type="email"
              label="E-posta"
              placeholder="ornek@sirket.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              leftIcon={<Mail size={18} />}
              variant="default"
          />

          <Input
              type="password"
              label="Şifre"
              placeholder={`En az ${PASSWORD_POLICY.minLength} karakter`}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={PASSWORD_POLICY.minLength}
              leftIcon={<Lock size={18} />}
              variant="default"
          />

           {error && (
              <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs leading-5 text-rose-700 dark:border-rose-900/60 dark:bg-rose-950/40 dark:text-rose-300">
                  {error}
              </div>
          )}

          <Button 
              type="submit" 
              variant="primary" 
              className="mt-2 h-11 w-full"
              isLoading={loading}
              loadingText="Hesap oluşturuluyor..."
          >
              Hesabı Oluştur
          </Button>
      </form>
      
    </AuthShell>
  );
}

/** Shown after a successful signup: sign-in opens once the address is verified. */
function VerifyEmailNotice({ email, onChangeEmail }: { email: string; onChangeEmail: () => void }) {
  const [sending, setSending] = useState(false);
  const [notice, setNotice] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null);

  const resend = async () => {
    setSending(true);
    setNotice(null);
    const result = await requestJson<{ message?: string }>('/api/auth/resend-verification', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    }, { timeoutMs: 20000, fallbackError: 'Doğrulama e-postası şu anda gönderilemedi.' });
    setSending(false);
    setNotice(result.ok
      ? { tone: 'ok', text: 'Doğrulama e-postası yeniden gönderildi. Gelen kutunuzu ve istenmeyen klasörünü kontrol edin.' }
      : { tone: 'error', text: result.error || 'Doğrulama e-postası şu anda gönderilemedi.' });
  };

  return (
    <AuthShell
      icon={<MailCheck size={18} />}
      eyebrow="Hesabınız oluşturuldu"
      title="E-postanızı doğrulayın"
      description="Giriş yapabilmek için e-posta adresinizi doğrulamanız gerekiyor."
      footer={<>Doğruladınız mı? <Link href="/auth/login" className="font-medium text-primary hover:underline">Giriş yapın</Link></>}
    >
      <div className="space-y-4" role="status">
        <p className="text-sm leading-6 text-foreground">
          <span className="font-semibold break-all">{email}</span> adresine bir doğrulama bağlantısı gönderdik.
        </p>
        <ol className="list-decimal space-y-1.5 pl-5 text-sm leading-6 text-muted-foreground">
          <li>Gelen kutunuzda &quot;Renkflow Hesabınızı Doğrulayın&quot; konulu e-postayı açın.</li>
          <li>E-postadaki doğrulama bağlantısına tıklayın.</li>
          <li>E-posta adresiniz ve şifrenizle giriş yapın; kurulum adımları panelde sizi bekliyor olacak.</li>
        </ol>
        {notice && (
          <div role={notice.tone === 'error' ? 'alert' : 'status'} className={cn('rounded-xl border p-3 text-xs leading-5',
            notice.tone === 'ok'
              ? 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-300'
              : 'border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-900/60 dark:bg-rose-950/40 dark:text-rose-300')}>
            {notice.text}
          </div>
        )}
        <p className="text-xs leading-5 text-muted-foreground">
          E-posta gelmedi mi?{' '}
          <button type="button" onClick={() => void resend()} disabled={sending} className="font-medium text-primary hover:underline disabled:opacity-60">
            {sending ? 'Gönderiliyor...' : 'Yeniden gönderin'}
          </button>
          {' '}veya{' '}
          <button type="button" onClick={onChangeEmail} className="font-medium text-primary hover:underline">farklı bir adresle kaydolun</button>.
        </p>
      </div>
    </AuthShell>
  );
}
