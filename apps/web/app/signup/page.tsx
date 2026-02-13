'use client';

export const dynamic = 'force-dynamic';

import { motion } from 'framer-motion';
import Image from 'next/image';
import Link from 'next/link';
import { useState } from 'react';
import { Button } from '@/components/shared/ui/Button';
import { Input } from '@/components/shared/ui/Input';
import { cn } from '@/lib/utils';
import { useRouter } from 'next/navigation';
import { signIn } from 'next-auth/react';
import { toast } from 'sonner';
import { AuthLayout } from '@/components/auth/AuthLayout';
import { Mail, Lock, User, Building2, Eye, EyeOff, AlertCircle, Briefcase } from 'lucide-react';
import { TEMPLATE_DEFINITIONS, DEFAULT_TEMPLATE_KEY, TemplateKey } from '@/lib/config/templates';

async function readJsonResponse(response: Response) {
  const text = await response.text();
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch {
    return {};
  }
}

export default function SignupPage() {
  const [showPassword, setShowPassword] = useState(false);
  const [name, setName] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [templateKey, setTemplateKey] = useState<TemplateKey>(DEFAULT_TEMPLATE_KEY);
  const [isLoading, setIsLoading] = useState(false);
  const [formErrors, setFormErrors] = useState<{
    name?: string;
    companyName?: string;
    email?: string;
    password?: string;
    general?: string;
  }>({});
  const router = useRouter();

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setFormErrors({});

    try {
      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim().toLowerCase(),
          password,
          companyName: companyName.trim() || `${name.trim()}'in Şirketi`,
          industry: TEMPLATE_DEFINITIONS.find((t) => t.key === templateKey)?.industry,
          templateKey,
        }),
      });

      const data = await readJsonResponse(response);

      if (!response.ok) {
        if (response.status === 429) {
          const retryAfter = typeof data?.retryAfter === 'number' ? data.retryAfter : null;
          setFormErrors({
            general: retryAfter
              ? `Çok fazla istek gönderdiniz. Lütfen ${retryAfter} saniye sonra tekrar deneyin.`
              : 'Çok fazla istek gönderdiniz. Lütfen biraz bekleyin.',
          });
          return;
        }

        if (data.field) {
          setFormErrors({ [data.field]: data.error });
        } else {
          setFormErrors({ general: data.error || 'Kayıt olurken bir hata oluştu.' });
        }
        return;
      }

      toast.success('Hesabınız oluşturuldu! Lütfen e-posta adresinizi kontrol edin.');
      toast.info('Gelen kutunuzdaki doğrulama linkine tıklayın.');
      
      setTimeout(() => {
        router.push('/auth/login');
      }, 2000);
    } catch (error: unknown) {
      setFormErrors({ general: 'Beklenmeyen bir hata oluştu.' });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSocialSignup = async (provider: 'google' | 'azure-ad') => {
    try {
      await signIn(provider, { callbackUrl: '/dashboard' });
    } catch (error: unknown) {
      toast.error(`${provider} kaydı başarısız.`);
    }
  };

  return (
    <AuthLayout>
      <div className="text-center mb-8 relative z-10 w-full max-w-md mx-auto">
        <div className="bg-white/70 dark:bg-slate-900/70 p-8 rounded-3xl shadow-[0_8px_32px_0_rgba(31,38,135,0.15)] backdrop-blur-xl border border-white/40 dark:border-white/10">
          <div className="mb-6">
            <h1 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-indigo-600 to-violet-600 dark:from-indigo-400 dark:to-violet-400">Aramıza Katılın</h1>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-2">İşletmenize uygun tenant ortamını dakikalar içinde kurun</p>
          </div>

          <form onSubmit={handleSignup} className="space-y-4 text-left">
            
            {/* Name Input */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 ml-1">Ad Soyad</label>
              <div className="relative group">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-indigo-500 transition-colors" />
                <Input
                  type="text"
                  value={name}
                  onChange={(e) => {
                    setName(e.target.value);
                    if (formErrors.name) setFormErrors({ ...formErrors, name: undefined });
                  }}
                  className={cn("pl-10", formErrors.name ? 'border-red-500 focus-visible:ring-red-500' : '')}
                  placeholder="Adınız Soyadınız"
                  required
                  variant="glass"
                />
              </div>
              {formErrors.name && <p className="text-xs text-red-500 ml-1">{formErrors.name}</p>}
            </div>

            {/* Company Input */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 ml-1">Şirket Adı</label>
              <div className="relative group">
                <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-indigo-500 transition-colors" />
                <Input
                  type="text"
                  value={companyName}
                  onChange={(e) => {
                    setCompanyName(e.target.value);
                    if (formErrors.companyName) setFormErrors({ ...formErrors, companyName: undefined });
                  }}
                  className={cn("pl-10", formErrors.companyName ? 'border-red-500 focus-visible:ring-red-500' : '')}
                  placeholder="Şirketinizin Adı (opsiyonel)"
                  variant="glass"
                />
              </div>
            </div>

            {/* Industry Template */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 ml-1">Meslek / Sektör</label>
              <div className="relative group">
                <Briefcase className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-indigo-500 transition-colors pointer-events-none z-10" />
                <select
                  value={templateKey}
                  onChange={(e) => setTemplateKey(e.target.value as TemplateKey)}
                  className="flex h-11 w-full rounded-2xl border border-white/40 dark:border-white/10 bg-white/50 dark:bg-slate-900/50 px-3 pl-10 py-2 text-sm ring-offset-transparent placeholder:text-slate-500 focus:bg-white/80 dark:focus:bg-slate-900/80 focus:border-indigo-500/50 focus:ring-4 focus:ring-indigo-500/10 backdrop-blur-xl transition-all outline-none appearance-none"
                >
                  {TEMPLATE_DEFINITIONS.map((template) => (
                    <option key={template.key} value={template.key}>
                      {template.industry}
                    </option>
                  ))}
                </select>
                <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6"/></svg>
                </div>
              </div>
              <div className="rounded-xl border border-indigo-100/50 bg-indigo-50/30 p-3 text-xs text-indigo-700/80 dark:border-indigo-900/30 dark:bg-indigo-900/10 dark:text-indigo-300/80">
                {TEMPLATE_DEFINITIONS.find((t) => t.key === templateKey)?.description}
              </div>
            </div>

            {/* Email Input */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 ml-1">E-posta</label>
              <div className="relative group">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-indigo-500 transition-colors" />
                <Input
                  type="email"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    if (formErrors.email) setFormErrors({ ...formErrors, email: undefined });
                  }}
                  className={cn("pl-10", formErrors.email ? 'border-red-500 focus-visible:ring-red-500' : '')}
                  placeholder="ornek@sirket.com"
                  required
                  variant="glass"
                />
              </div>
              {formErrors.email && <p className="text-xs text-red-500 ml-1">{formErrors.email}</p>}
            </div>

            {/* Password Input */}
            <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 ml-1">Şifre</label>
                <div className="relative group">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-indigo-500 transition-colors" />
                    <Input
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => {
                        setPassword(e.target.value);
                        if (formErrors.password) setFormErrors({ ...formErrors, password: undefined });
                    }}
                    className={cn("pl-10 pr-10", formErrors.password ? 'border-red-500 focus-visible:ring-red-500' : '')}
                    placeholder="En az 6 karakter"
                    required
                    minLength={6}
                    variant="glass"
                    />
                    <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                    >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                </div>
                {formErrors.password && <p className="text-xs text-red-500 ml-1">{formErrors.password}</p>}
            </div>

            {formErrors.general && (
                <div className="p-3 bg-red-50/50 backdrop-blur-sm text-red-600 dark:bg-red-900/20 dark:text-red-400 text-xs rounded-xl border border-red-100 dark:border-red-900/30 flex items-center gap-2">
                    <AlertCircle size={14} /> {formErrors.general}
                </div>
            )}

            <Button
                type="submit"
                disabled={isLoading}
                className="w-full h-12 text-sm font-semibold shadow-xl shadow-indigo-500/20 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 border-0"
            >
                {isLoading ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : 'Hesap Oluştur'}
            </Button>
          </form>

          {/* Divider */}
          <div className="relative my-8">
            <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-slate-200/60 dark:border-slate-700/60"></div></div>
            <div className="relative flex justify-center text-[10px] uppercase tracking-widest font-medium"><span className="bg-white/0 backdrop-blur-xl px-2 text-slate-400">veya devam et</span></div>
          </div>

           {/* Social Buttons (Compact) */}
           <div className="grid grid-cols-2 gap-3 mb-6">
            <button 
                onClick={() => handleSocialSignup('google')}
                className="flex items-center justify-center gap-2 py-3 border border-white/40 dark:border-slate-700/40 rounded-xl hover:bg-white/60 dark:hover:bg-slate-800/60 transition-all bg-white/40 dark:bg-slate-900/40 backdrop-blur-md shadow-sm hover:shadow-md group"
            >
                <Image src="https://authjs.dev/img/providers/google.svg" width={18} height={18} alt="Google" className="group-hover:scale-110 transition-transform" />
                <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">Google</span>
            </button>
            <button 
                 onClick={() => handleSocialSignup('azure-ad')}
                 className="flex items-center justify-center gap-2 py-3 border border-white/40 dark:border-slate-700/40 rounded-xl hover:bg-white/60 dark:hover:bg-slate-800/60 transition-all bg-white/40 dark:bg-slate-900/40 backdrop-blur-md shadow-sm hover:shadow-md group"
            >
                 <Image src="https://authjs.dev/img/providers/microsoft-entra-id.svg" width={18} height={18} alt="Microsoft" className="group-hover:scale-110 transition-transform" />
                 <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">Microsoft</span>
            </button>
          </div>

          <p className="text-center text-xs text-slate-500">
            Zaten hesabınız var mı?{' '}
            <Link href="/auth/login" className="text-indigo-600 hover:text-indigo-700 hover:underline font-bold transition-colors">
              Giriş Yap
            </Link>
          </p>
        </div>
      </div>
    </AuthLayout>
  );
}
