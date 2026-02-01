'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Navbar } from '@/components/layout/Navbar';
import { Card } from '@/components/ui/Card';
import { useAuth } from '@/lib/context/AuthContext';

const teamMembers = [
  { name: 'Ayşe Demir', role: 'Üretim Lideri', status: 'Aktif' },
  { name: 'Mehmet Kaya', role: 'Planlama', status: 'Aktif' },
  { name: 'Elif Yılmaz', role: 'Kalite', status: 'Aktif' },
  { name: 'Can Arslan', role: 'Lojistik', status: 'İzinli' },
];

export default function TeamPage() {
  const { user, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && !user) {
      router.push('/auth/login');
    }
  }, [user, isLoading, router]);

  if (isLoading || !user) return null;

  return (
    <div className="flex-1 flex flex-col">
      <Navbar title="Ekip" showSearch />
      <main className="flex-1 p-4 md:p-8 pt-16 md:pt-8 space-y-6">
        <Card spotlight className="p-6">
          <p className="text-xs uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">Organizasyon</p>
          <h2 className="text-2xl font-bold text-text-light dark:text-text-dark">Ekip Yönetimi</h2>
          <p className="text-sm text-subtle-light dark:text-subtle-dark">
            Roller, görevler ve aktif vardiya bilgisini hızlıca görüntüleyin.
          </p>
        </Card>

        <Card spotlight className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-text-light dark:text-text-dark">Takım Üyeleri</h3>
            <button className="rounded-full bg-slate-900 text-white px-4 py-2 text-sm font-semibold hover:opacity-90">
              Yeni Üye Ekle
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {teamMembers.map((member) => (
              <div key={member.name} className="rounded-2xl border border-slate-200/70 bg-white/70 p-4 dark:border-slate-700/60 dark:bg-slate-900/60">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold text-slate-900 dark:text-white">{member.name}</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">{member.role}</p>
                  </div>
                  <span className={`text-xs rounded-full px-2 py-1 ${member.status === 'Aktif' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                    {member.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </main>
    </div>
  );
}
