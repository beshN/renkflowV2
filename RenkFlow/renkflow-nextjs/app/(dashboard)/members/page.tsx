'use client';

import { useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Navbar } from '@/components/layout/Navbar';
import { Card } from '@/components/ui/Card';
import { useAuth } from '@/lib/context/AuthContext';
import { ShieldCheck, UserPlus, Mail, BadgeCheck, UserCircle2, Crown, Briefcase } from 'lucide-react';

const members = [
  {
    name: 'Berat Aksoy',
    role: 'Owner',
    email: 'berat@renkflow.com',
    status: 'Aktif',
    lastActive: 'Bugün 09:40',
    badge: 'Yetkili',
  },
  {
    name: 'Ayşe Demir',
    role: 'Production Lead',
    email: 'ayse@renkflow.com',
    status: 'Aktif',
    lastActive: 'Bugün 08:15',
    badge: 'Operasyon',
  },
  {
    name: 'Mehmet Kaya',
    role: 'Planner',
    email: 'mehmet@renkflow.com',
    status: 'Aktif',
    lastActive: 'Dün 18:30',
    badge: 'Planlama',
  },
  {
    name: 'Elif Yılmaz',
    role: 'Quality',
    email: 'elif@renkflow.com',
    status: 'İzinli',
    lastActive: '2 gün önce',
    badge: 'Kalite',
  },
];

const invites = [
  { email: 'yeni-uye@renkflow.com', role: 'Member', status: 'Bekliyor', sentAt: 'Bugün 10:12' },
  { email: 'lojistik@renkflow.com', role: 'Member', status: 'Bekliyor', sentAt: 'Dün 16:05' },
];

export default function MembersPage() {
  const { user, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && !user) {
      router.push('/auth/login');
    }
  }, [user, isLoading, router]);

  const stats = useMemo(() => {
    const active = members.filter((m) => m.status === 'Aktif').length;
    const pending = invites.length;
    return { active, pending, total: members.length };
  }, []);

  if (isLoading || !user) return null;

  return (
    <div className="flex-1 flex flex-col">
      <Navbar title="Üyeler" showSearch />
      <main className="flex-1 p-4 md:p-8 pt-16 md:pt-8 space-y-6">
        <Card spotlight className="p-6">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">Ekip & Yetkiler</p>
              <h2 className="text-2xl font-bold text-text-light dark:text-text-dark">Üye Yönetimi</h2>
              <p className="text-sm text-subtle-light dark:text-subtle-dark">
                Rol tabanlı erişim, davet ve aktivite takibini tek panelde yönetin.
              </p>
            </div>
            <button className="inline-flex items-center gap-2 rounded-full bg-slate-900 text-white px-5 py-2.5 text-sm font-semibold shadow-[0_18px_40px_-24px_rgba(15,23,42,0.7)] hover:opacity-90">
              <UserPlus size={16} />
              Üye Davet Et
            </button>
          </div>
        </Card>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card spotlight className="p-5">
            <p className="text-xs text-slate-500 dark:text-slate-400">Aktif Üyeler</p>
            <p className="text-2xl font-bold text-slate-900 dark:text-white">{stats.active}</p>
          </Card>
          <Card spotlight className="p-5">
            <p className="text-xs text-slate-500 dark:text-slate-400">Bekleyen Davet</p>
            <p className="text-2xl font-bold text-slate-900 dark:text-white">{stats.pending}</p>
          </Card>
          <Card spotlight className="p-5">
            <p className="text-xs text-slate-500 dark:text-slate-400">Toplam Üye</p>
            <p className="text-2xl font-bold text-slate-900 dark:text-white">{stats.total}</p>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[1.4fr_0.6fr] gap-6">
          <Card spotlight className="p-6">
            <h3 className="text-lg font-semibold text-text-light dark:text-text-dark mb-4">Üyeler</h3>
            <div className="space-y-3">
              {members.map((member) => (
                <div key={member.email} className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 rounded-2xl border border-slate-200/70 bg-white/70 px-4 py-3 text-sm dark:border-slate-700/60 dark:bg-slate-900/60">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-600">
                      <UserCircle2 size={20} />
                    </div>
                    <div>
                      <p className="font-semibold text-slate-900 dark:text-white">{member.name}</p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">{member.email}</p>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs rounded-full px-2 py-1 bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                      {member.role}
                    </span>
                    <span className={`text-xs rounded-full px-2 py-1 ${member.status === 'Aktif' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                      {member.status}
                    </span>
                    <span className="text-xs rounded-full px-2 py-1 bg-sky-50 text-sky-700 dark:bg-sky-500/10 dark:text-sky-200">
                      {member.badge}
                    </span>
                    <span className="text-xs text-slate-400">{member.lastActive}</span>
                  </div>
                </div>
              ))}
            </div>
          </Card>

          <Card spotlight className="p-6 space-y-4">
            <div className="flex items-center gap-2 text-slate-700 dark:text-slate-200 font-semibold">
              <ShieldCheck size={16} />
              Erişim Politikası
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Owner ve Admin rolleri kritik aksiyonlara erişebilir. Davetler 48 saat boyunca geçerlidir.
            </p>
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300">
                <Crown size={14} /> Owner: Tam yetki
              </div>
              <div className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300">
                <BadgeCheck size={14} /> Admin: Yönetim & raporlar
              </div>
              <div className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300">
                <Briefcase size={14} /> Member: Operasyon erişimi
              </div>
            </div>

            <div className="pt-3 border-t border-slate-200/70 dark:border-slate-700/60">
              <p className="text-xs font-semibold text-slate-700 dark:text-slate-200 mb-2">Bekleyen davetler</p>
              <div className="space-y-2">
                {invites.map((invite) => (
                  <div key={invite.email} className="flex items-center justify-between rounded-xl border border-slate-200/70 bg-white/70 px-3 py-2 text-xs dark:border-slate-700/60 dark:bg-slate-900/60">
                    <div className="flex items-center gap-2">
                      <Mail size={14} className="text-slate-500" />
                      <span className="text-slate-600 dark:text-slate-300">{invite.email}</span>
                    </div>
                    <span className="text-slate-400">{invite.sentAt}</span>
                  </div>
                ))}
              </div>
            </div>
          </Card>
        </div>
      </main>
    </div>
  );
}
