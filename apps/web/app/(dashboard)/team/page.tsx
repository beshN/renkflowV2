'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Navbar } from '@/components/layout/Navbar';
import { Card } from '@/components/ui/Card';
import { useAuth } from '@/lib/context/AuthContext';
import { useOrders } from '@/lib/hooks/useOrders';
import { formatDate } from '@/lib/utils';
import { UserPlus, ShieldCheck, CalendarClock, Briefcase, Users, Loader2 } from 'lucide-react';

type TeamMember = {
  id: string;
  name: string;
  email: string;
  role: string;
  avatar?: string | null;
  joinedAt?: string | null;
};

const roleLabels: Record<string, string> = {
  owner: 'Sahip',
  admin: 'Yönetici',
  member: 'Üye',
  office: 'Ofis',
  worker: 'Üretim',
};

export default function TeamPage() {
  const { user, isLoading } = useAuth();
  const router = useRouter();
  const { orders } = useOrders();
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [membersLoading, setMembersLoading] = useState(true);
  const [membersError, setMembersError] = useState<string | null>(null);

  useEffect(() => {
    if (!isLoading && !user) {
      router.push('/auth/login');
    }
  }, [user, isLoading, router]);

  useEffect(() => {
    const fetchMembers = async () => {
      setMembersLoading(true);
      setMembersError(null);
      try {
        const res = await fetch('/api/tenant/members');
        if (!res.ok) throw new Error('Üyeler yüklenemedi');
        const data = await res.json();
        setMembers(data.members || []);
      } catch (error) {
        setMembersError('Üyeler yüklenemedi, lütfen tekrar deneyin.');
      } finally {
        setMembersLoading(false);
      }
    };

    if (user) {
      fetchMembers();
    }
  }, [user]);

  const stats = useMemo(() => {
    const active = members.length;
    const roles = new Set(members.map((member) => member.role));
    return { active, roles: roles.size };
  }, [members]);

  const workloadSummary = useMemo(() => {
    const totalOrders = orders?.length || 0;
    const activeOrders = orders?.filter((o) => o.status !== 'delivered').length || 0;
    const deliveredOrders = orders?.filter((o) => o.status === 'delivered').length || 0;
    const avgPerMember = members.length ? Math.round(activeOrders / members.length) : 0;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const overdue = (orders || []).filter((o) => {
      if (!o.deliveryDate || o.status === 'delivered') return false;
      return new Date(o.deliveryDate) < today;
    }).length;

    return { totalOrders, activeOrders, deliveredOrders, avgPerMember, overdue };
  }, [orders, members.length]);

  const activityFeed = useMemo(() => {
    return (orders || [])
      .slice()
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
      .slice(0, 5)
      .map((order) => ({
        id: order.id,
        title: order.customerName,
        description: `${order.orderNumber} • ${order.productName}`,
        time: formatDate(order.updatedAt),
      }));
  }, [orders]);

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
            <Link
              href="/members"
              className="inline-flex items-center gap-2 rounded-full bg-slate-900 text-white px-5 py-2.5 text-sm font-semibold shadow-[0_18px_40px_-24px_rgba(15,23,42,0.7)] hover:opacity-90"
            >
              <UserPlus size={16} />
              Üye Davet Et
            </Link>
          </div>
        </Card>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card spotlight className="p-5">
            <p className="text-xs text-slate-500 dark:text-slate-400">Aktif Üyeler</p>
            <p className="text-2xl font-bold text-slate-900 dark:text-white">{stats.active}</p>
          </Card>
          <Card spotlight className="p-5">
            <p className="text-xs text-slate-500 dark:text-slate-400">Aktif Sipariş</p>
            <p className="text-2xl font-bold text-slate-900 dark:text-white">{workloadSummary.activeOrders}</p>
          </Card>
          <Card spotlight className="p-5">
            <p className="text-xs text-slate-500 dark:text-slate-400">Roller</p>
            <p className="text-2xl font-bold text-slate-900 dark:text-white">{stats.roles}</p>
          </Card>
          <Card spotlight className="p-5">
            <p className="text-xs text-slate-500 dark:text-slate-400">Kişi Başına İş</p>
            <p className="text-2xl font-bold text-slate-900 dark:text-white">{workloadSummary.avgPerMember}</p>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[1.4fr_0.6fr] gap-6">
          <Card spotlight className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-text-light dark:text-text-dark">Takım Üyeleri</h3>
              <span className="text-xs text-slate-500 dark:text-slate-400">{members.length} kişi</span>
            </div>
            {membersLoading ? (
              <div className="flex items-center gap-2 text-sm text-slate-500">
                <Loader2 className="w-4 h-4 animate-spin" />
                Üyeler yükleniyor...
              </div>
            ) : membersError ? (
              <div className="rounded-2xl border border-rose-200/70 bg-rose-50/60 p-4 text-sm text-rose-600 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-200">
                {membersError}
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {members.map((member) => (
                  <div key={member.id} className="rounded-2xl border border-slate-200/70 bg-white/70 p-4 dark:border-slate-700/60 dark:bg-slate-900/60">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="text-sm font-semibold text-slate-900 dark:text-white">{member.name}</p>
                        <p className="text-xs text-slate-500 dark:text-slate-400">{member.email}</p>
                      </div>
                      <span className="text-xs rounded-full px-2 py-1 bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-200">
                        {roleLabels[member.role] || member.role}
                      </span>
                    </div>
                    <div className="mt-3 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
                      <span>Katılım: {member.joinedAt ? formatDate(member.joinedAt) : '-'}</span>
                      <span>Aktif</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
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
                  Teslimat riskleri izleniyor
                </div>
                <p className="text-xs mt-1">{workloadSummary.overdue} geciken sipariş için erken uyarı açık.</p>
              </div>
              <div className="rounded-2xl border border-slate-200/70 bg-white/70 p-4 dark:border-slate-700/60 dark:bg-slate-900/60">
                <div className="flex items-center gap-2 text-slate-700 dark:text-slate-200 font-semibold">
                  <Briefcase size={16} />
                  Kapasite kullanımı
                </div>
                <p className="text-xs mt-1">Kişi başına ortalama {workloadSummary.avgPerMember} aktif iş.</p>
              </div>
              <div className="rounded-2xl border border-slate-200/70 bg-white/70 p-4 dark:border-slate-700/60 dark:bg-slate-900/60">
                <div className="flex items-center gap-2 text-slate-700 dark:text-slate-200 font-semibold">
                  <Users size={16} />
                  Teslimat çıktısı
                </div>
                <p className="text-xs mt-1">Toplam {workloadSummary.deliveredOrders} sipariş teslim edildi.</p>
              </div>
            </div>
          </Card>
        </div>

        <Card spotlight className="p-6">
          <h3 className="text-lg font-semibold text-text-light dark:text-text-dark mb-4">Son Aktivite</h3>
          {activityFeed.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-200 p-6 text-sm text-slate-500 dark:border-slate-700">
              Henüz aktivite yok. Sipariş güncellemeleri burada görünecek.
            </div>
          ) : (
            <div className="space-y-3">
              {activityFeed.map((item) => (
                <div key={item.id} className="rounded-2xl border border-slate-200/70 bg-white/70 px-4 py-3 text-sm dark:border-slate-700/60 dark:bg-slate-900/60">
                  <p className="font-semibold text-slate-900 dark:text-white">{item.title}</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">{item.description}</p>
                  <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-1">{item.time}</p>
                </div>
              ))}
            </div>
          )}
        </Card>
      </main>
    </div>
  );
}
