'use client';

import { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/auth/supabase';
import { toast } from 'sonner';
import LandingNav from '@/components/landing/LandingNav';
import { motion } from 'framer-motion';

function AcceptInviteContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const token = searchParams.get('token');
  const [isProcessing, setIsProcessing] = useState(true);
  const [status, setStatus] = useState<'verifying' | 'valid' | 'invalid' | 'success'>('verifying');
  const [inviteData, setInviteData] = useState<any>(null);

  useEffect(() => {
    if (!token) {
      setStatus('invalid');
      setIsProcessing(false);
      return;
    }

    const verifyToken = async () => {
      try {
        // 1. Check if token exists and is valid
        const { data: invite, error } = await supabase
          .from('invitations')
          .select('*, tenants(name)')
          .eq('token', token)
          .single();

        if (error || !invite) {
          console.error('Invite verification error:', error);
          setStatus('invalid');
          return;
        }

        if (new Date(invite.expires_at) < new Date()) {
          toast.error('Bu davetiyenin süresi dolmuş.');
          setStatus('invalid');
          return;
        }

        setInviteData(invite);
        setStatus('valid');

        // 2. Check if user is logged in
        const { data: { session } } = await supabase.auth.getSession();
        
        if (session?.user) {
          // User is logged in, link immediately
          await linkUserToTenant(session.user.id, invite);
        }
        // If not logged in, show login/signup buttons (handled in render)

      } catch (error) {
        console.error('Verification error:', error);
        setStatus('invalid');
      } finally {
        setIsProcessing(false);
      }
    };

    verifyToken();
  }, [token]);

  const linkUserToTenant = async (userId: string, invite: any) => {
    setIsProcessing(true);
    try {
      // 1. Add to tenant_members
      const { error: memberError } = await supabase
        .from('tenant_members')
        .insert({
          tenant_id: invite.tenant_id,
          user_id: userId,
          role: invite.role
        });

      if (memberError) {
        if (memberError.code === '23505') { // Unique violation
           toast.info('Zaten bu organizasyonun üyesisiniz.');
        } else {
           throw memberError;
        }
      }

      // 2. Delete invitation
      await supabase
        .from('invitations')
        .delete()
        .eq('id', invite.id);

      toast.success(`${invite.tenants.name} organizasyonuna başarıyla katıldınız!`);
      setStatus('success');
      
      // Redirect to dashboard
      setTimeout(() => router.push('/dashboard'), 1500);

    } catch (error: any) {
      console.error('Linking error:', error);
      toast.error('Organizasyona katılım sırasında bir hata oluştu.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleAuthRedirect = (path: string) => {
    // Redirect to login/signup with return URL back here
    const returnUrl = encodeURIComponent(`/auth/accept-invite?token=${token}`);
    router.push(`${path}?returnUrl=${returnUrl}`);
  };

  if (status === 'verifying') {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
        <p className="mt-4 text-gray-500">Davetiye kontrol ediliyor...</p>
      </div>
    );
  }

  if (status === 'invalid') {
    return (
      <div className="text-center p-8 bg-red-50 dark:bg-red-900/20 rounded-lg max-w-md mx-auto mt-10">
        <span className="material-symbols-outlined text-4xl text-red-500 mb-2">error</span>
        <h2 className="text-xl font-bold text-red-700 dark:text-red-400 mb-2">Geçersiz Davetiye</h2>
        <p className="text-gray-600 dark:text-gray-300">
          Bu davetiye bağlantısı geçersiz veya süresi dolmuş. Lütfen organizasyon yöneticinizden yeni bir davet isteyin.
        </p>
      </div>
    );
  }

  if (status === 'success') {
    return (
      <div className="text-center p-8 bg-green-50 dark:bg-green-900/20 rounded-lg max-w-md mx-auto mt-10">
        <span className="material-symbols-outlined text-4xl text-green-500 mb-2">check_circle</span>
        <h2 className="text-xl font-bold text-green-700 dark:text-green-400 mb-2">Başarılı!</h2>
        <p className="text-gray-600 dark:text-gray-300">
          Organizasyona katıldınız. Yönlendiriliyorsunuz...
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto mt-10 p-8 bg-white dark:bg-slate-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700">
      <div className="text-center mb-8">
        <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
          <span className="material-symbols-outlined text-3xl text-primary">group_add</span>
        </div>
        <h1 className="text-2xl font-bold mb-2">Davet Edildiniz!</h1>
        <p className="text-gray-600 dark:text-gray-300">
          <span className="font-semibold text-primary">{inviteData?.tenants?.name}</span> ekibine katılmak için davet aldınız.
        </p>
      </div>

      <div className="space-y-4">
        <button
          onClick={() => handleAuthRedirect('/auth/login')}
          className="w-full bg-primary text-white py-3 rounded-lg font-semibold hover:bg-primary/90 transition-colors shadow-sm"
        >
          Giriş Yap ve Katıl
        </button>
        
        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-gray-200 dark:border-gray-700"></div>
          </div>
          <div className="relative flex justify-center text-sm">
            <span className="px-2 bg-white dark:bg-slate-800 text-gray-500">veya</span>
          </div>
        </div>

        <button
          onClick={() => handleAuthRedirect('/signup')}
          className="w-full bg-white dark:bg-slate-700 text-gray-700 dark:text-white border border-gray-300 dark:border-gray-600 py-3 rounded-lg font-semibold hover:bg-gray-50 dark:hover:bg-slate-600 transition-colors"
        >
          Yeni Hesap Oluştur
        </button>
      </div>
    </div>
  );
}

export default function AcceptInvitePage() {
  return (
    <div className="min-h-screen bg-background-light dark:bg-background-dark font-display">
      <LandingNav />
      <div className="pt-32 px-4">
        <Suspense fallback={<div>Yükleniyor...</div>}>
          <AcceptInviteContent />
        </Suspense>
      </div>
    </div>
  );
}
