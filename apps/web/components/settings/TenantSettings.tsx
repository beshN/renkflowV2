'use client';
import Link from 'next/link';

import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/lib/context/AuthContext';
import { toast } from 'sonner';
import { TEMPLATE_DEFINITIONS, TemplateKey, DEFAULT_TEMPLATE_KEY } from '@/lib/config/templates';
import { Input } from '../ui/Input';
import { Button } from '../ui/Button';
import { Building, Save } from 'lucide-react';

export function TenantSettings() {
  const { user, refreshUser } = useAuth();
  const [isLoading, setIsLoading] = useState(false);

  // Start from the firm's saved values; a legacy template keeps its key until the user picks another one.
  const [savedData, setSavedData] = useState(() => ({
    name: user?.tenantName || '',
    brandColor: user?.brandColor || '#4f46e5',
    logoUrl: user?.logoUrl || '',
    templateKey: (user?.templateKey as TemplateKey) || DEFAULT_TEMPLATE_KEY,
  }));
  const [formData, setFormData] = useState(savedData);
  useEffect(() => {
    const fromSession = {
      name: user?.tenantName || '',
      brandColor: user?.brandColor || '#4f46e5',
      logoUrl: user?.logoUrl || '',
      templateKey: (user?.templateKey as TemplateKey) || DEFAULT_TEMPLATE_KEY,
    };
    setSavedData(fromSession);
    setFormData(fromSession);
  }, [user?.tenantId, user?.tenantName, user?.brandColor, user?.logoUrl, user?.templateKey]);

  const selectedTemplate = useMemo(() => TEMPLATE_DEFINITIONS.find((t) => t.key === formData.templateKey), [formData.templateKey]);

  const handleUpdateTenant = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.tenantId) return;

    // Send only what changed, so saving the name cannot reset the template or industry.
    const changes = Object.fromEntries(
      (Object.keys(savedData) as Array<keyof typeof savedData>).filter((key) => formData[key] !== savedData[key]).map((key) => [key, formData[key]]),
    );
    if (Object.keys(changes).length === 0) {
      toast.success('Değişiklik yok');
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch('/api/tenant/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenantId: user.tenantId, ...changes }),
      });

      if (!response.ok) {
        const body = await response.json().catch(() => null);
        throw new Error(body?.error || 'Güncelleme başarısız oldu');
      }
      setSavedData(formData);

      toast.success('Firma bilgileri güncellendi');
      await refreshUser();
    } catch (error: any) {
      toast.error(error instanceof Error ? error.message : 'Güncelleme başarısız oldu');
    } finally {
      setIsLoading(false);
    }
  };

  if (!user?.tenantId) {
    return (
      <div className="p-8 text-center bg-slate-50 dark:bg-slate-900/50 rounded-2xl border border-slate-200 dark:border-slate-800 border-dashed">
        <Building className="mx-auto h-12 w-12 text-slate-400 mb-3" />
        <h3 className="text-lg font-medium text-slate-900 dark:text-white">Organizasyon Bulunamadı</h3>
        <p className="text-slate-500 dark:text-slate-400">Bir organizasyona bağlı değilsiniz.</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Organization Settings */}
      <section className="p-1">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-2.5 bg-indigo-50 dark:bg-indigo-900/20 rounded-xl text-indigo-600 dark:text-indigo-400">
            <Building size={24} />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Renk Alüminyum firma ayarları</h2>
            <p className="text-sm text-slate-500 dark:text-slate-400">Firmanızın temel yapılandırma ve marka ayarları.</p>
          </div>
        </div>

        <form onSubmit={handleUpdateTenant} className="space-y-5">
          <div className="grid gap-5">
            <Input
              label="Firma Adı"
              variant="glass"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="Firma Adı"
            />

            <div>
              <label htmlFor="tenant-template" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Üretim alanı</label>
              <div className="relative">
                <select
                  id="tenant-template"
                  value={formData.templateKey}
                  onChange={(e) => setFormData({ ...formData, templateKey: e.target.value as TemplateKey })}
                  className="w-full h-11 px-4 rounded-xl border border-slate-200/50 dark:border-slate-800/50 bg-white/40 dark:bg-slate-900/40 backdrop-blur-sm text-slate-900 dark:text-white appearance-none focus:outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500/50 transition-all text-sm shadow-sm"
                >
                  {!TEMPLATE_DEFINITIONS.some((template) => template.key === savedData.templateKey) && (
                    <option value={savedData.templateKey}>{user?.tenantIndustry || savedData.templateKey} (mevcut)</option>
                  )}
                  {TEMPLATE_DEFINITIONS.map((template) => (
                    <option key={template.key} value={template.key}>
                      {template.industry}
                    </option>
                  ))}
                </select>
                <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-slate-500">
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6"/></svg>
                </div>
              </div>
              <p className="text-xs text-slate-500 mt-2">{selectedTemplate?.description || 'Firmanın mevcut üretim alanı korunur; değiştirmek için listeden seçin.'}</p>
            </div>

            <Input
              label="Logo bağlantısı (isteğe bağlı)"
              type="url"
              variant="glass"
              value={formData.logoUrl}
              onChange={(e) => setFormData({ ...formData, logoUrl: e.target.value })}
              placeholder="https://ornek.com/logo.png"
            />
            
            <div>
              <label htmlFor="tenant-brand-color" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Marka Rengi</label>
              <div className="flex items-center gap-3 p-3 bg-slate-50 dark:bg-slate-900/50 rounded-xl border border-slate-200 dark:border-slate-800">
                <div className="relative w-12 h-10 overflow-hidden rounded-lg border border-slate-200 dark:border-slate-700 shadow-sm">
                   <input
                    id="tenant-brand-color"
                    type="color"
                    value={formData.brandColor}
                    onChange={(e) => setFormData({ ...formData, brandColor: e.target.value })}
                    className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[150%] h-[150%] p-0 border-0 cursor-pointer"
                  />
                </div>
                <div className="flex-1">
                   <p className="text-sm font-medium text-slate-900 dark:text-white uppercase">{formData.brandColor}</p>
                   <p className="text-xs text-slate-500">Tema renginiz</p>
                </div>
              </div>
            </div>
          </div>

          <div className="flex justify-end pt-2">
            <Button
              type="submit"
              variant="primary"
              disabled={isLoading}
              className="pl-4 pr-6"
            >
              <Save size={18} className="mr-2" />
              {isLoading ? 'Kaydediliyor...' : 'Değişiklikleri Kaydet'}
            </Button>
          </div>
        </form>
      </section>

      {/* Invites moved to the team screen (role + access role + expiry). */}
      <section className="p-1">
        <h2 className="text-lg font-semibold mb-1">Ekip davetleri</h2>
        <p className="text-sm text-muted-foreground">Üye davet etme, rol ve yetki rolü seçme, davet süresi ve iptal: <Link href="/team" className="text-primary underline">Ekip ve yetkiler</Link>.</p>
      </section>
    </div>
  );
}
