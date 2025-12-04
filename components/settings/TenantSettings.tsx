'use client';

import { useState } from 'react';
import { useAuth } from '@/lib/context/AuthContext';
import { toast } from 'sonner';
import { motion } from 'framer-motion';

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
  });

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
        }),
      });

      if (!response.ok) throw new Error('Update failed');

      toast.success('Firma bilgileri güncellendi');
      await refreshUser();
    } catch (error: any) {
      console.error('Error updating tenant:', error);
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

      toast.success('Davet oluşturuldu! Link konsola yazıldı.');
      console.log('Invite Link:', data.inviteLink);
      
      // Copy to clipboard
      navigator.clipboard.writeText(data.inviteLink);
      toast.info('Davet linki panoya kopyalandı');

      setInviteEmail('');
      setInviteRole(null);
    } catch (error: any) {
      console.error('Error inviting user:', error);
      toast.error('Davet gönderilemedi');
    } finally {
      setIsInviting(false);
    }
  };

  if (!user?.tenantId) {
    return (
      <div className="p-6 bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
        <p className="text-center text-gray-500">Bir organizasyona bağlı değilsiniz.</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Organization Settings */}
      <section className="bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
        <h2 className="text-xl font-semibold mb-4">Organizasyon Ayarları</h2>
        <form onSubmit={handleUpdateTenant} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Firma Adı</label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="input-professional w-full"
              placeholder="Firma Adı"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Logo URL</label>
            <input
              type="url"
              value={formData.logoUrl}
              onChange={(e) => setFormData({ ...formData, logoUrl: e.target.value })}
              className="input-professional w-full"
              placeholder="https://ornek.com/logo.png"
            />
            <p className="text-xs text-gray-500 mt-1">Logo görselinin direkt bağlantısını girin.</p>
          </div>
          
          <div>
            <label className="block text-sm font-medium mb-1">Marka Rengi</label>
            <div className="flex items-center gap-3">
              <input
                type="color"
                value={formData.brandColor}
                onChange={(e) => setFormData({ ...formData, brandColor: e.target.value })}
                className="h-10 w-20 rounded cursor-pointer"
              />
              <span className="text-sm text-gray-500">{formData.brandColor}</span>
            </div>
          </div>

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={isLoading}
              className="bg-primary text-white px-4 py-2 rounded-md hover:bg-primary/90 transition-colors disabled:opacity-50"
            >
              {isLoading ? 'Kaydediliyor...' : 'Değişiklikleri Kaydet'}
            </button>
          </div>
        </form>
      </section>

      {/* Invite Members */}
      <section className="bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
        <h2 className="text-xl font-semibold mb-4">Üye Davet Et</h2>
        <p className="text-sm text-gray-500 mb-6">
          Ekip arkadaşlarınızı rollerine göre davet edin. Her rol için farklı yetkiler tanımlanmıştır.
        </p>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Admin Invite */}
          <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 hover:border-primary/50 transition-colors">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-full bg-purple-100 text-purple-600 flex items-center justify-center">
                <span className="material-symbols-outlined">admin_panel_settings</span>
              </div>
              <div>
                <h3 className="font-semibold">Yönetici</h3>
                <p className="text-xs text-gray-500">Tam yetkili</p>
              </div>
            </div>
            <button
              onClick={() => {
                setInviteRole('admin');
                setInviteEmail('');
                // Focus input if needed or open modal
              }}
              className={`w-full py-2 rounded-md text-sm font-medium transition-colors ${
                inviteRole === 'admin' 
                  ? 'bg-purple-600 text-white' 
                  : 'bg-gray-100 dark:bg-slate-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-slate-600'
              }`}
            >
              {inviteRole === 'admin' ? 'Seçildi' : 'Seç'}
            </button>
          </div>

          {/* Office Invite */}
          <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 hover:border-primary/50 transition-colors">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center">
                <span className="material-symbols-outlined">desk</span>
              </div>
              <div>
                <h3 className="font-semibold">Ofis</h3>
                <p className="text-xs text-gray-500">Sipariş/Müşteri yönetimi</p>
              </div>
            </div>
            <button
              onClick={() => {
                setInviteRole('office');
                setInviteEmail('');
              }}
              className={`w-full py-2 rounded-md text-sm font-medium transition-colors ${
                inviteRole === 'office' 
                  ? 'bg-blue-600 text-white' 
                  : 'bg-gray-100 dark:bg-slate-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-slate-600'
              }`}
            >
              {inviteRole === 'office' ? 'Seçildi' : 'Seç'}
            </button>
          </div>

          {/* Worker Invite */}
          <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 hover:border-primary/50 transition-colors">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-full bg-orange-100 text-orange-600 flex items-center justify-center">
                <span className="material-symbols-outlined">engineering</span>
              </div>
              <div>
                <h3 className="font-semibold">Usta</h3>
                <p className="text-xs text-gray-500">Üretim takibi</p>
              </div>
            </div>
            <button
              onClick={() => {
                setInviteRole('worker');
                setInviteEmail('');
              }}
              className={`w-full py-2 rounded-md text-sm font-medium transition-colors ${
                inviteRole === 'worker' 
                  ? 'bg-orange-600 text-white' 
                  : 'bg-gray-100 dark:bg-slate-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-slate-600'
              }`}
            >
              {inviteRole === 'worker' ? 'Seçildi' : 'Seç'}
            </button>
          </div>
        </div>

        {inviteRole && (
          <motion.form
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            onSubmit={handleInvite}
            className="mt-6 p-4 bg-gray-50 dark:bg-slate-900/50 rounded-lg border border-gray-200 dark:border-gray-700"
          >
            <div className="flex gap-4 items-end">
              <div className="flex-1">
                <label className="block text-sm font-medium mb-1">
                  {inviteRole === 'admin' ? 'Yönetici' : inviteRole === 'office' ? 'Ofis Personeli' : 'Usta'} E-posta Adresi
                </label>
                <input
                  type="email"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  className="input-professional w-full"
                  placeholder="ornek@sirket.com"
                  required
                />
              </div>
              <button
                type="submit"
                disabled={isInviting}
                className="bg-green-600 text-white px-6 py-2 rounded-md hover:bg-green-700 transition-colors disabled:opacity-50 h-[42px] font-medium"
              >
                {isInviting ? 'Gönderiliyor...' : 'Davet Gönder'}
              </button>
            </div>
          </motion.form>
        )}
      </section>
    </div>
  );
}
