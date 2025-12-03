'use client';

import { useState } from 'react';
import { useAuth } from '@/lib/context/AuthContext';
import { supabase } from '@/lib/auth/supabase';
import { toast } from 'sonner';
import { motion } from 'framer-motion';

export function TenantSettings() {
  const { user, refreshUser } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [isInviting, setIsInviting] = useState(false);

  const [formData, setFormData] = useState({
    name: user?.tenantName || '',
    brandColor: '#6366f1', // Default
  });

  const handleUpdateTenant = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.tenantId) return;

    setIsLoading(true);
    try {
      const { error } = await supabase
        .from('tenants')
        .update({
          name: formData.name,
          brand_color: formData.brandColor,
        })
        .eq('id', user.tenantId);

      if (error) throw error;

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
    if (!user?.tenantId || !inviteEmail) return;

    setIsInviting(true);
    try {
      // 1. Create invitation record
      const token = Math.random().toString(36).substring(2) + Date.now().toString(36);
      const { error } = await supabase
        .from('invitations')
        .insert({
          tenant_id: user.tenantId,
          email: inviteEmail,
          token,
          role: 'member',
          expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), // 7 days
        });

      if (error) {
        if (error.code === '23505') { // Unique violation
          toast.error('Bu e-posta adresi için zaten bekleyen bir davet var.');
        } else {
          throw error;
        }
        return;
      }

      // 2. In a real app, send email here via API route
      // For now, we'll just show the magic link in a toast for demo purposes
      const inviteLink = `${window.location.origin}/auth/accept-invite?token=${token}`;
      console.log('Invite Link:', inviteLink);
      
      toast.success('Davet oluşturuldu! (Link konsola yazıldı - Demo)');
      
      // Copy to clipboard for convenience
      navigator.clipboard.writeText(inviteLink);
      toast.info('Davet linki panoya kopyalandı');

      setInviteEmail('');
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
        <p className="text-sm text-gray-500 mb-4">
          Ekip arkadaşlarınızı e-posta adresi ile davet edin. Onlara bir katılım linki gönderilecektir.
        </p>
        
        <form onSubmit={handleInvite} className="flex gap-4 items-end">
          <div className="flex-1">
            <label className="block text-sm font-medium mb-1">E-posta Adresi</label>
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
            className="bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700 transition-colors disabled:opacity-50 h-[42px]"
          >
            {isInviting ? 'Gönderiliyor...' : 'Davet Gönder'}
          </button>
        </form>
      </section>
    </div>
  );
}
