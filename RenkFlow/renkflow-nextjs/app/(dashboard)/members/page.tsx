'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Navbar } from '@/components/layout/Navbar';
import { Card } from '@/components/ui/Card';
import { useAuth } from '@/lib/context/AuthContext';
import { ShieldCheck, UserPlus, Mail, BadgeCheck, UserCircle2, Crown, Briefcase, Copy, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

type Member = {
  id: string;
  name: string;
  email: string;
  role: string;
  avatar?: string | null;
  joinedAt?: string;
};

type Invite = {
  id: string;
  email: string;
  role: string;
  token: string;
  createdAt: string;
  expiresAt: string;
};

export default function MembersPage() {
  const { user, isLoading } = useAuth();
  const router = useRouter();
  const [members, setMembers] = useState<Member[]>([]);
  const [invites, setInvites] = useState<Invite[]>([]);
  const [isFetching, setIsFetching] = useState(true);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<'admin' | 'office' | 'worker' | 'member'>('member');
  const [isInviting, setIsInviting] = useState(false);

  useEffect(() => {
    if (!isLoading && !user) {
      router.push('/auth/login');
    }
  }, [user, isLoading, router]);

  useEffect(() => {
    if (!user?.tenantId) return;
    const fetchData = async () => {
      try {
        const [membersRes, invitesRes] = await Promise.all([
          fetch('/api/tenant/members'),
          fetch('/api/tenant/invites'),
        ]);

        if (membersRes.ok) {
          const membersData = await membersRes.json();
          setMembers(membersData.members || []);
        }

        if (invitesRes.ok) {
          const invitesData = await invitesRes.json();
          setInvites(invitesData.invites || []);
        }
      } catch (error) {
        console.error('Members fetch error:', error);
      } finally {
        setIsFetching(false);
      }
    };

    fetchData();
  }, [user?.tenantId]);

  const stats = useMemo(() => {
    const active = members.length;
    const pending = invites.length;
    return { active, pending, total: members.length };
  }, [members, invites]);

  const handleInvite = async () => {
    if (!user?.tenantId || !inviteEmail.trim()) return;
    setIsInviting(true);
    try {
      const response = await fetch('/api/tenant/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenantId: user.tenantId,
          email: inviteEmail.trim(),
          role: inviteRole,
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        toast.error(data.error || 'Davet oluşturulamadı');
        return;
      }

      toast.success('Davet oluşturuldu ve link kopyalandı');
      if (data.inviteLink) {
        navigator.clipboard.writeText(data.inviteLink);
      }
      setInviteEmail('');
      setInviteRole('member');

      const invitesRes = await fetch('/api/tenant/invites');
      if (invitesRes.ok) {
        const invitesData = await invitesRes.json();
        setInvites(invitesData.invites || []);
      }
    } catch (error) {
      toast.error('Davet oluşturulamadı');
    } finally {
      setIsInviting(false);
    }
  };

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
              {isFetching ? (
                <div className="flex items-center justify-center py-12 text-sm text-slate-500">
                  <Loader2 className="w-5 h-5 animate-spin mr-2" /> Yükleniyor...
                </div>
              ) : members.length === 0 ? (
                <div className="rounded-xl border border-dashed border-slate-200 p-6 text-sm text-slate-500 dark:border-slate-700">
                  Henüz üye bulunmuyor.
                </div>
              ) : members.map((member) => (
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
                    <span className="text-xs rounded-full px-2 py-1 bg-emerald-100 text-emerald-700">
                      Aktif
                    </span>
                    {member.joinedAt && (
                      <span className="text-xs text-slate-400">
                        {new Date(member.joinedAt).toLocaleDateString('tr-TR')}
                      </span>
                    )}
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

            <div className="pt-3 border-t border-slate-200/70 dark:border-slate-700/60 space-y-4">
              <div>
                <p className="text-xs font-semibold text-slate-700 dark:text-slate-200 mb-2">Üye daveti oluştur</p>
                <div className="flex flex-col gap-2">
                  <input
                    type="email"
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    placeholder="E-posta adresi"
                    className="input-professional w-full"
                  />
                  <select
                    value={inviteRole}
                    onChange={(e) => setInviteRole(e.target.value as typeof inviteRole)}
                    className="input-professional w-full"
                  >
                    <option value="member">Member</option>
                    <option value="office">Office</option>
                    <option value="worker">Worker</option>
                    <option value="admin">Admin</option>
                  </select>
                  <button
                    onClick={handleInvite}
                    disabled={isInviting}
                    className="inline-flex items-center justify-center gap-2 rounded-full bg-slate-900 text-white px-4 py-2 text-xs font-semibold disabled:opacity-60"
                  >
                    {isInviting ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserPlus size={14} />}
                    Davet Gönder
                  </button>
                </div>
              </div>

              <div>
                <p className="text-xs font-semibold text-slate-700 dark:text-slate-200 mb-2">Bekleyen davetler</p>
                <div className="space-y-2">
                  {invites.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-slate-200 p-4 text-xs text-slate-500 dark:border-slate-700">
                      Bekleyen davet yok.
                    </div>
                  ) : invites.map((invite) => (
                    <div key={invite.id} className="flex items-center justify-between rounded-xl border border-slate-200/70 bg-white/70 px-3 py-2 text-xs dark:border-slate-700/60 dark:bg-slate-900/60">
                      <div className="flex items-center gap-2">
                        <Mail size={14} className="text-slate-500" />
                        <div>
                          <p className="text-slate-600 dark:text-slate-300">{invite.email}</p>
                          <p className="text-[10px] text-slate-400">{invite.role}</p>
                        </div>
                      </div>
                      <button
                        onClick={() => navigator.clipboard.writeText(`${window.location.origin}/auth/accept-invite?token=${invite.token}`)}
                        className="text-slate-500 hover:text-slate-900"
                        title="Link kopyala"
                      >
                        <Copy size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </Card>
        </div>
      </main>
    </div>
  );
}
