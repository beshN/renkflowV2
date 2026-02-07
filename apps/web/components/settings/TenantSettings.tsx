'use client';

import { useMemo, useState } from 'react';
import { useAuth } from '@/lib/context/AuthContext';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';
import { TEMPLATE_DEFINITIONS, TemplateKey, DEFAULT_TEMPLATE_KEY } from '@/lib/config/templates';
import { Input } from '../ui/Input';
import { Button } from '../ui/Button';
import { Building, ShieldCheck, HardHat, MonitorSmartphone, Save, Copy } from 'lucide-react';

export function TenantSettings() {
  const { user, refreshUser } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<'admin' | 'office' | 'worker' | null>(null);
  const [isInviting, setIsInviting] = useState(false);

  const [formData, setFormData] = useState({
    name: user?.tenantName || '',
    brandColor: user?.brandColor || '#6366f1',
    logoUrl: user?.logoUrl || '',
    industry: user?.tenantIndustry || TEMPLATE_DEFINITIONS.find((t) => t.key === (user?.templateKey as TemplateKey))?.industry || TEMPLATE_DEFINITIONS[0]?.industry,
    templateKey: (user?.templateKey as TemplateKey) || DEFAULT_TEMPLATE_KEY,
  });

  const selectedTemplate = useMemo(() => {
    return TEMPLATE_DEFINITIONS.find((t) => t.key === formData.templateKey) || TEMPLATE_DEFINITIONS[0];
  }, [formData.templateKey]);

  const handleUpdateTenant = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.tenantId) return;

    setIsLoading(true);
    try {
      const response = await fetch('/api/tenant/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenantId: user.tenantId,
          name: formData.name,
          brandColor: formData.brandColor,
          logoUrl: formData.logoUrl,
          industry: selectedTemplate?.industry,
          templateKey: formData.templateKey,
        }),
      });

      if (!response.ok) throw new Error('Update failed');

      toast.success('Firma bilgileri güncellendi');
      await refreshUser();
    } catch (error: any) {
      toast.error('Güncelleme başarısız oldu');
    } finally {
      setIsLoading(false);
    }
  };

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.tenantId || !inviteEmail || !inviteRole) return;

    setIsInviting(true);
    try {
      const response = await fetch('/api/tenant/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenantId: user.tenantId,
          email: inviteEmail,
          role: inviteRole,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        if (data.error?.includes('zaten')) {
          toast.error('Bu e-posta adresi için zaten bekleyen bir davet var.');
        } else {
          throw new Error(data.error || 'Invite failed');
        }
        return;
      }

      toast.success('Davet oluşturuldu! Link panoya kopyalandı.');
      
      // Copy to clipboard
      navigator.clipboard.writeText(data.inviteLink);
      toast.info('Davet linki panoya kopyalandı');

      setInviteEmail('');
      setInviteRole(null);
    } catch (error: any) {
      toast.error('Davet gönderilemedi');
    } finally {
      setIsInviting(false);
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
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Organizasyon Ayarları</h2>
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
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Sektor / Meslek</label>
              <div className="relative">
                <select
                  value={formData.templateKey}
                  onChange={(e) => setFormData({ ...formData, templateKey: e.target.value as TemplateKey })}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200/50 dark:border-slate-800/50 bg-white/40 dark:bg-slate-900/40 backdrop-blur-sm text-slate-900 dark:text-white appearance-none focus:outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500/80 transition-all text-sm"
                >
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
              <p className="text-xs text-slate-500 mt-2">{selectedTemplate?.description}</p>
            </div>

            <Input
              label="Logo URL"
              type="url"
              variant="glass"
              value={formData.logoUrl}
              onChange={(e) => setFormData({ ...formData, logoUrl: e.target.value })}
              placeholder="https://ornek.com/logo.png"
            />
            
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Marka Rengi</label>
              <div className="flex items-center gap-3 p-3 bg-slate-50 dark:bg-slate-900/50 rounded-xl border border-slate-200 dark:border-slate-800">
                <div className="relative w-12 h-10 overflow-hidden rounded-lg border border-slate-200 dark:border-slate-700 shadow-sm">
                   <input
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

      {/* Invite Members */}
      <section className="p-1">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-1">Üye Davet Et</h2>
        <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">
          Ekip arkadaşlarınızı rollerine göre davet edin. Her rol için farklı yetkiler tanımlanmıştır.
        </p>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          {/* Admin Invite */}
          <div 
            onClick={() => { setInviteRole('admin'); setInviteEmail(''); }}
            className={`cursor-pointer border rounded-xl p-4 transition-all duration-200 ${
            inviteRole === 'admin' 
              ? 'border-purple-500 bg-purple-50/50 dark:bg-purple-900/20 ring-1 ring-purple-500' 
              : 'border-slate-200 dark:border-slate-800 hover:border-purple-300 dark:hover:border-purple-700 hover:bg-slate-50 dark:hover:bg-slate-900/50'
          }`}>
            <div className="flex items-center gap-3 mb-3">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center transition-colors ${
                inviteRole === 'admin' ? 'bg-purple-100 text-purple-600' : 'bg-slate-100 dark:bg-slate-800 text-slate-500'
              }`}>
                <ShieldCheck size={20} />
              </div>
              <div>
                <h3 className="font-semibold text-slate-900 dark:text-white text-sm">Yönetici</h3>
                <p className="text-xs text-slate-500">Tam yetkili</p>
              </div>
            </div>
            <div className={`w-4 h-4 rounded-full border-2 ml-auto ${
              inviteRole === 'admin' ? 'border-purple-500 bg-purple-500' : 'border-slate-300 dark:border-slate-600'
            }`} />
          </div>

          {/* Office Invite */}
          <div 
             onClick={() => { setInviteRole('office'); setInviteEmail(''); }}
             className={`cursor-pointer border rounded-xl p-4 transition-all duration-200 ${
             inviteRole === 'office' 
               ? 'border-blue-500 bg-blue-50/50 dark:bg-blue-900/20 ring-1 ring-blue-500' 
               : 'border-slate-200 dark:border-slate-800 hover:border-blue-300 dark:hover:border-blue-700 hover:bg-slate-50 dark:hover:bg-slate-900/50'
           }`}>
            <div className="flex items-center gap-3 mb-3">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center transition-colors ${
                inviteRole === 'office' ? 'bg-blue-100 text-blue-600' : 'bg-slate-100 dark:bg-slate-800 text-slate-500'
              }`}>
                <MonitorSmartphone size={20} />
              </div>
              <div>
                <h3 className="font-semibold text-slate-900 dark:text-white text-sm">Ofis</h3>
                <p className="text-xs text-slate-500">Sipariş yönetimi</p>
              </div>
            </div>
             <div className={`w-4 h-4 rounded-full border-2 ml-auto ${
              inviteRole === 'office' ? 'border-blue-500 bg-blue-500' : 'border-slate-300 dark:border-slate-600'
            }`} />
          </div>

          {/* Worker Invite */}
          <div 
             onClick={() => { setInviteRole('worker'); setInviteEmail(''); }}
             className={`cursor-pointer border rounded-xl p-4 transition-all duration-200 ${
             inviteRole === 'worker' 
               ? 'border-orange-500 bg-orange-50/50 dark:bg-orange-900/20 ring-1 ring-orange-500' 
               : 'border-slate-200 dark:border-slate-800 hover:border-orange-300 dark:hover:border-orange-700 hover:bg-slate-50 dark:hover:bg-slate-900/50'
           }`}>
            <div className="flex items-center gap-3 mb-3">
               <div className={`w-10 h-10 rounded-xl flex items-center justify-center transition-colors ${
                inviteRole === 'worker' ? 'bg-orange-100 text-orange-600' : 'bg-slate-100 dark:bg-slate-800 text-slate-500'
              }`}>
                <HardHat size={20} />
              </div>
              <div>
                <h3 className="font-semibold text-slate-900 dark:text-white text-sm">Usta</h3>
                <p className="text-xs text-slate-500">Üretim takibi</p>
              </div>
            </div>
             <div className={`w-4 h-4 rounded-full border-2 ml-auto ${
              inviteRole === 'worker' ? 'border-orange-500 bg-orange-500' : 'border-slate-300 dark:border-slate-600'
            }`} />
          </div>
        </div>

        <AnimatePresence>
          {inviteRole && (
            <motion.form
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              onSubmit={handleInvite}
              className="overflow-hidden"
            >
              <div className="p-4 bg-slate-50 dark:bg-slate-900/50 rounded-xl border border-slate-200 dark:border-slate-800 flex gap-3 items-end">
                <div className="flex-1">
                  <Input
                    label={`${inviteRole === 'admin' ? 'Yönetici' : inviteRole === 'office' ? 'Ofis Personeli' : 'Usta'} E-posta Adresi`}
                    type="email"
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    placeholder="ornek@sirket.com"
                    required
                    className="bg-white dark:bg-slate-950"
                  />
                </div>
                <Button
                  type="submit"
                  disabled={isInviting}
                  variant="primary"
                  className="mb-[2px]"
                >
                  {isInviting ? 'Gönderiliyor...' : 'Davet Gönder'}
                </Button>
              </div>
            </motion.form>
          )}
        </AnimatePresence>
      </section>
    </div>
  );
}
