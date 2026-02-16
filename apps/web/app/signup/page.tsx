'use client';

export const dynamic = 'force-dynamic';

import Link from 'next/link';
import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AppleCard } from '@/components/shared/ui/AppleCard';
import { Button } from '@/components/shared/ui/Button';
import { Input } from '@/components/shared/ui/Input';
import { User, Building2, LayoutTemplate, Mail, Lock } from 'lucide-react';
import { cn } from '@/lib/utils';

import { DEFAULT_TEMPLATE_KEY, TEMPLATE_DEFINITIONS, type TemplateKey } from '@/lib/config/templates';
import { requestJson } from '@/lib/shared/network';

export default function SignupPage() {
  const router = useRouter();

  const [name, setName] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [templateKey, setTemplateKey] = useState<TemplateKey>(DEFAULT_TEMPLATE_KEY);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true);
    setError('');
    setSuccess('');

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

    setSuccess('Hesabın oluşturuldu. Giriş sayfasına yönlendiriliyorsun.');
    setTimeout(() => {
      router.push('/auth/login');
    }, 1200);
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-[#F2F2F7] dark:bg-black relative overflow-hidden py-10">
        {/* Abstract Background */}
        <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
            <div className="absolute top-[-10%] right-[0%] w-[60%] h-[60%] bg-blue-400/20 blur-[130px] rounded-full mix-blend-multiply dark:mix-blend-normal" />
            <div className="absolute bottom-[-10%] left-[-10%] w-[60%] h-[60%] bg-indigo-400/20 blur-[130px] rounded-full mix-blend-multiply dark:mix-blend-normal" />
        </div>

        <AppleCard variant="glass" className="w-full max-w-lg p-8 relative z-10 shadow-2xl">
            <div className="text-center mb-8">
               <div className="w-12 h-12 bg-neutral-900 dark:bg-white rounded-xl flex items-center justify-center text-white dark:text-black font-bold text-xl shadow-lg mx-auto mb-6">
                  R
                </div>
                <h1 className="text-2xl font-display font-bold tracking-tight text-foreground">Yeni Hesap Oluştur</h1>
                <p className="text-sm text-muted-foreground mt-2">İşletmenizi yönetmeye dakikalar içinde başlayın.</p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
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
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                        Sektör Şablonu
                    </label>
                    <div className="relative">
                         <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">
                            <LayoutTemplate size={18} />
                        </div>
                        <select
                            value={templateKey}
                            onChange={(e) => setTemplateKey(e.target.value as TemplateKey)}
                            className={cn(
                                'w-full h-11 pl-10 pr-4 rounded-2xl outline-none transition-all duration-200',
                                'text-sm appearance-none',
                                'border border-input bg-white/50 dark:bg-black/50 backdrop-blur-sm',
                                'focus:bg-white dark:focus:bg-black',
                                'focus:border-primary/50 focus:ring-4 focus:ring-primary/10',
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
                    placeholder="En az 6 karakter"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    minLength={6}
                    leftIcon={<Lock size={18} />}
                    variant="default"
                />

                 {error && (
                    <div className="p-3 rounded-lg bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-sm font-medium animate-shake">
                        {error}
                    </div>
                )}
                {success && (
                    <div className="p-3 rounded-lg bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 text-sm font-medium">
                        {success}
                    </div>
                )}

                <Button 
                    type="submit" 
                    variant="primary" 
                    className="w-full h-12 text-base shadow-xl shadow-primary/20 mt-2"
                    isLoading={loading}
                    loadingText="Hesap oluşturuluyor..."
                >
                    Hesabı Oluştur
                </Button>
            </form>
            
             <p className="mt-8 text-center text-sm text-muted-foreground">
                Zaten hesabınız var mı?{' '}
                <Link href="/auth/login" className="font-semibold text-primary hover:underline transition-colors">
                  Giriş Yapın
                </Link>
              </p>
        </AppleCard>
        
        {/* Footer */}
        <div className="absolute bottom-6 text-center w-full">
            <p className="text-xs text-muted-foreground/60">
                &copy; 2024 RenkFlow.
                <span className="mx-2">•</span>
                <Link href="#" className="hover:underline">Gizlilik</Link>
                <span className="mx-2">•</span>
                <Link href="#" className="hover:underline">Şartlar</Link>
            </p>
        </div>
    </div>
  );
}
