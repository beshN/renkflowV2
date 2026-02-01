'use client';

import { useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Navbar } from '@/components/layout/Navbar';
import { Card } from '@/components/ui/Card';
import { useAuth } from '@/lib/context/AuthContext';
import { UserPlus, ShieldCheck, CalendarClock, Briefcase } from 'lucide-react';

const teamMembers = [
  { name: 'Ayşe Demir', role: 'Üretim Lideri', status: 'Aktif', shift: '08:00 - 16:00', workload: 'Yüksek' },
  { name: 'Mehmet Kaya', role: 'Planlama', status: 'Aktif', shift: '09:00 - 17:00', workload: 'Orta' },
  { name: 'Elif Yılmaz', role: 'Kalite', status: 'Aktif', shift: '08:00 - 16:00', workload: 'Düşük' },
  { name: 'Can Arslan', role: 'Lojistik', status: 'İzinli', shift: '—', workload: '—' },
];

const activityFeed = [
  { title: 'Ayşe Demir', description: '3 siparişi üretime aldı', time: '25 dk önce' },
  { title: 'Mehmet Kaya', description: 'Haftalık planı güncelledi', time: '1 saat önce' },
  { title: 'Elif Yılmaz', description: 'Kalite kontrol raporu ekledi', time: 'Bugün 09:30' },
];

export default function TeamPage() {
  const { user, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && !user) {
      router.push('/auth/login');
    }
  }, [user, isLoading, router]);

  const stats = useMemo(() => {
    const active = teamMembers.filter((member) => member.status === 'Aktif').length;
    const onLeave = teamMembers.filter((member) => member.status !== 'Aktif').length;
    return { active, onLeave };
  }, []);

  if (isLoading || !user) return null;

  return (
    <div className="flex-1 flex flex-col">
      <Navbar title="Ekip" showSearch />
      <main className="flex-1 p-4 md:p-8 pt-16 md:pt-8 space-y-6">
        <Card spotlight className="p-6">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">Organizasyon</p>
              <h2 className="text-2xl font-bold text-text-light dark:text-text-dark">Ekip Yönetimi</h2>
              <p className="text-sm text-subtle-light dark:text-subtle-dark">
                Roller, vardiyalar ve sorumluluk dağılımını tek yerden yönetin.
              </p>
            </div>
            <button className="inline-flex items-center gap-2 rounded-full bg-slate-900 text-white px-5 py-2.5 text-sm font-semibold shadow-[0_18px_40px_-24px_rgba(15,23,42,0.7)] hover:opacity-90">
              <UserPlus size={16} />
              Yeni Üye Ekle
            </button>
          </div>
        </Card>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card spotlight className="p-5">
            <p className="text-xs text-slate-500 dark:text-slate-400">Aktif Üyeler</p>
            <p className="text-2xl font-bold text-slate-900 dark:text-white">{stats.active}</p>
          </Card>
          <Card spotlight className="p-5">
            <p className="text-xs text-slate-500 dark:text-slate-400">İzinli</p>
            <p className="text-2xl font-bold text-slate-900 dark:text-white">{stats.onLeave}</p>
          </Card>
          <Card spotlight className="p-5">
            <p className="text-xs text-slate-500 dark:text-slate-400">Roller</p>
            <p className="text-2xl font-bold text-slate-900 dark:text-white">4</p>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[1.4fr_0.6fr] gap-6">
          <Card spotlight className="p-6">
            <h3 className="text-lg font-semibold text-text-light dark:text-text-dark mb-4">Takım Üyeleri</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {teamMembers.map((member) => (
                <div key={member.name} className="rounded-2xl border border-slate-200/70 bg-white/70 p-4 dark:border-slate-700/60 dark:bg-slate-900/60">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-sm font-semibold text-slate-900 dark:text-white">{member.name}</p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">{member.role}</p>
                    </div>
                    <span className={`text-xs rounded-full px-2 py-1 ${member.status === 'Aktif' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                      {member.status}
                    </span>
                  </div>
                  <div className="mt-3 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
                    <span>{member.shift}</span>
                    <span>{member.workload}</span>
                  </div>
                </div>
              ))}
            </div>
          </Card>

          <Card spotlight className="p-6">
            <h3 className="text-lg font-semibold text-text-light dark:text-text-dark mb-4">Ekip Sağlığı</h3>
            <div className="space-y-3 text-sm text-subtle-light dark:text-subtle-dark">
              <div className="rounded-2xl border border-slate-200/70 bg-white/70 p-4 dark:border-slate-700/60 dark:bg-slate-900/60">
                <div className="flex items-center gap-2 text-slate-700 dark:text-slate-200 font-semibold">
                  <ShieldCheck size={16} />
                  Güvenlik ve rol kontrolü aktif
                </div>
                <p className="text-xs mt-1">Yeni üyeler sadece davet ile katılabilir.</p>
              </div>
              <div className="rounded-2xl border border-slate-200/70 bg-white/70 p-4 dark:border-slate-700/60 dark:bg-slate-900/60">
                <div className="flex items-center gap-2 text-slate-700 dark:text-slate-200 font-semibold">
                  <CalendarClock size={16} />
                  Vardiya planı güncel
                </div>
                <p className="text-xs mt-1">Haftalık planlar otomatik güncellenir.</p>
              </div>
              <div className="rounded-2xl border border-slate-200/70 bg-white/70 p-4 dark:border-slate-700/60 dark:bg-slate-900/60">
                <div className="flex items-center gap-2 text-slate-700 dark:text-slate-200 font-semibold">
                  <Briefcase size={16} />
                  Rol dağılımı dengeli
                </div>
                <p className="text-xs mt-1">Üretim ve kalite arasında iş dağılımı optimize.</p>
              </div>
            </div>
          </Card>
        </div>

        <Card spotlight className="p-6">
          <h3 className="text-lg font-semibold text-text-light dark:text-text-dark mb-4">Son Aktivite</h3>
          <div className="space-y-3">
            {activityFeed.map((item) => (
              <div key={item.title + item.time} className="rounded-2xl border border-slate-200/70 bg-white/70 px-4 py-3 text-sm dark:border-slate-700/60 dark:bg-slate-900/60">
                <p className="font-semibold text-slate-900 dark:text-white">{item.title}</p>
                <p className="text-xs text-slate-500 dark:text-slate-400">{item.description}</p>
                <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-1">{item.time}</p>
              </div>
            ))}
          </div>
        </Card>
      </main>
    </div>
  );
}
