'use client';

export const dynamic = 'force-dynamic';

import { motion } from 'framer-motion';
import Image from 'next/image';
import Link from 'next/link';
import { useState } from 'react';
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
      await signIn(provider, { callbackUrl: '/orders' });
    } catch (error: unknown) {
      toast.error(`${provider} kaydı başarısız.`);
    }
  };

  return (
    <AuthLayout>
      <div className="text-center mb-8">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Aramıza Katılın</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-2">30 gün boyunca ücretsiz deneyin</p>
      </div>

      <form onSubmit={handleSignup} className="space-y-4">
        
        {/* Name Input */}
        <div className="space-y-1">
          <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 ml-1">Ad Soyad</label>
          <div className="relative group">
            <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-blue-500 transition-colors" />
            <input
              type="text"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                if (formErrors.name) setFormErrors({ ...formErrors, name: undefined });
              }}
              className={`w-full pl-10 pr-4 py-3 bg-white/40 dark:bg-slate-900/40 backdrop-blur-md border ${formErrors.name ? 'border-red-500' : 'border-slate-200/50 dark:border-slate-700/50'} rounded-xl focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none transition-all text-sm`}
              placeholder="Adınız Soyadınız"
              required
            />
          </div>
          {formErrors.name && <p className="text-xs text-red-500 ml-1">{formErrors.name}</p>}
        </div>

        {/* Company Input */}
        <div className="space-y-1">
          <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 ml-1">Şirket Adı</label>
          <div className="relative group">
            <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-blue-500 transition-colors" />
            <input
              type="text"
              value={companyName}
              onChange={(e) => {
                setCompanyName(e.target.value);
                if (formErrors.companyName) setFormErrors({ ...formErrors, companyName: undefined });
              }}
              className={`w-full pl-10 pr-4 py-3 bg-white/40 dark:bg-slate-900/40 backdrop-blur-md border ${formErrors.companyName ? 'border-red-500' : 'border-slate-200/50 dark:border-slate-700/50'} rounded-xl focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none transition-all text-sm`}
              placeholder="Şirketinizin Adı (opsiyonel)"
            />
          </div>
        </div>

        {/* Industry Template */}
        <div className="space-y-2">
          <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 ml-1">Meslek / Sektör</label>
          <div className="relative group">
            <Briefcase className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-blue-500 transition-colors" />
            <select
              value={templateKey}
              onChange={(e) => setTemplateKey(e.target.value as TemplateKey)}
              className="w-full pl-10 pr-4 py-3 bg-white/40 dark:bg-slate-900/40 backdrop-blur-md border border-slate-200/50 dark:border-slate-700/50 rounded-xl focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none transition-all text-sm"
            >
              {TEMPLATE_DEFINITIONS.map((template) => (
                <option key={template.key} value={template.key}>
                  {template.industry}
                </option>
              ))}
            </select>
          </div>
          <div className="rounded-xl border border-slate-200/50 bg-white/30 backdrop-blur-sm p-3 text-xs text-slate-500 dark:border-slate-700/50 dark:bg-slate-900/30 dark:text-slate-300">
            {TEMPLATE_DEFINITIONS.find((t) => t.key === templateKey)?.description}
          </div>
        </div>

        {/* Email Input */}
        <div className="space-y-1">
          <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 ml-1">E-posta</label>
          <div className="relative group">
            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-blue-500 transition-colors" />
            <input
              type="email"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                if (formErrors.email) setFormErrors({ ...formErrors, email: undefined });
              }}
              className={`w-full pl-10 pr-4 py-3 bg-white/40 dark:bg-slate-900/40 backdrop-blur-md border ${formErrors.email ? 'border-red-500' : 'border-slate-200/50 dark:border-slate-700/50'} rounded-xl focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none transition-all text-sm`}
              placeholder="ornek@sirket.com"
              required
            />
          </div>
          {formErrors.email && <p className="text-xs text-red-500 ml-1">{formErrors.email}</p>}
        </div>

        {/* Password Input */}
        <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 ml-1">Şifre</label>
            <div className="relative group">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-blue-500 transition-colors" />
                <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => {
                    setPassword(e.target.value);
                    if (formErrors.password) setFormErrors({ ...formErrors, password: undefined });
                }}
                className={`w-full pl-10 pr-10 py-3 bg-white/40 dark:bg-slate-900/40 backdrop-blur-md border ${formErrors.password ? 'border-red-500' : 'border-slate-200/50 dark:border-slate-700/50'} rounded-xl focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none transition-all text-sm`}
                placeholder="En az 6 karakter"
                required
                minLength={6}
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
            <div className="p-3 bg-red-50 text-red-600 text-xs rounded-lg border border-red-100 flex items-center gap-2">
                <AlertCircle size={14} /> {formErrors.general}
            </div>
        )}

        <motion.button
            whileHover={{ scale: 1.01 }}
            whileTap={{ scale: 0.99 }}
            type="submit"
            disabled={isLoading}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 rounded-xl shadow-lg shadow-blue-500/25 transition-all text-sm disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
            {isLoading ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : 'Hesap Oluştur'}
        </motion.button>
      </form>

      {/* Divider */}
      <div className="relative my-6">
        <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-slate-200 dark:border-slate-700"></div></div>
        <div className="relative flex justify-center text-xs uppercase"><span className="bg-white dark:bg-slate-900 px-2 text-slate-400">veya</span></div>
      </div>

       {/* Social Buttons (Compact) */}
       <div className="grid grid-cols-2 gap-3 mb-6">
        <button 
            onClick={() => handleSocialSignup('google')}
            className="flex items-center justify-center gap-2 py-2.5 border border-slate-200/50 dark:border-slate-700/50 rounded-xl hover:bg-slate-50/50 dark:hover:bg-slate-800/50 transition-colors bg-white/60 dark:bg-slate-950/60 backdrop-blur-sm"
        >
            <Image src="https://authjs.dev/img/providers/google.svg" width={18} height={18} alt="Google" />
            <span className="text-xs font-medium text-slate-700 dark:text-slate-300">Google</span>
        </button>
        <button 
             onClick={() => handleSocialSignup('azure-ad')}
             className="flex items-center justify-center gap-2 py-2.5 border border-slate-200/50 dark:border-slate-700/50 rounded-xl hover:bg-slate-50/50 dark:hover:bg-slate-800/50 transition-colors bg-white/60 dark:bg-slate-950/60 backdrop-blur-sm"
        >
             <Image src="https://authjs.dev/img/providers/microsoft-entra-id.svg" width={18} height={18} alt="Microsoft" />
             <span className="text-xs font-medium text-slate-700 dark:text-slate-300">Microsoft</span>
        </button>
      </div>

      <p className="text-center text-xs text-slate-500">
        Zaten hesabınız var mı?{' '}
        <Link href="/auth/login" className="text-blue-600 hover:underline font-semibold">
          Giriş Yap
        </Link>
      </p>
    </AuthLayout>
  );
}
