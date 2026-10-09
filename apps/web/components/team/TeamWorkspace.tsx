'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { KeyRound, Mail, Plus, ShieldCheck, Trash2, UserCheck, UserX, Users } from 'lucide-react';
import { EmptyState, HintTip, PageHeader, Skeleton, StatusChip } from '@/components/kit';
import { requestJson } from '@/lib/shared/network';
import { cn } from '@/lib/utils';
import {
  ACTION_LABELS, BASE_CAPS, BASE_HIDDEN, FIELD_LABELS, MODULE_LABELS,
  type Action, type FieldGroup, type Matrix, type Module,
} from '@/lib/security/access-matrix';
import { BASE_ROLE_LABELS, INVITE_TTL } from '@/lib/security/team-rules';
import type { UserRole } from '@/lib/auth/permissions';

type Member = {
  userId: string; name: string | null; email: string; role: UserRole; accessRole: string; accessRoleName: string; hidden: FieldGroup[];
  active: boolean; lastSeenAt: string | null; openSessions: number;
};
type RoleRow = { key: string; id?: string; roleName: string; base: UserRole; permissions: Matrix; hidden: FieldGroup[]; builtIn: boolean; members: number; description?: string };
type Invite = { id: string; email: string; role: UserRole; accessRoleName: string; expiresAt: string; expired: boolean; invitedBy: string | null };
type TeamData = {
  members: Member[]; invites: Invite[]; me: string; myRole: UserRole;
  roles: { modules: Module[]; actions: Action[]; fields: FieldGroup[]; assignable: UserRole[]; presets: RoleRow[]; custom: RoleRow[] };
};
type Tab = 'members' | 'invites' | 'roles';

const send = (url: string, method: string, body?: unknown) =>
  requestJson<any>(url, { method, headers: body === undefined ? undefined : { 'Content-Type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) });
const when = (iso: string | null) => (iso ? new Intl.DateTimeFormat('tr-TR', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(iso)) : '—');

/** Team and access: members and their roles, invites, and the firm's custom roles. */
export function TeamWorkspace() {
  const [data, setData] = useState<TeamData | null>(null);
  const [error, setError] = useState('');
  const [tab, setTab] = useState<Tab>('members');
  const load = useCallback(async () => {
    const r = await requestJson<TeamData>('/api/v1/team', { cache: 'no-store' });
    if (r.ok && r.data) { setData(r.data); setError(''); } else setError(r.error || 'Ekip bilgisi alınamadı');
  }, []);
  useEffect(() => { void load(); }, [load]);

  if (!data) return error ? <p role="alert" className="rf-panel text-sm">{error}</p> : <Skeleton className="h-64" />;
  const active = data.members.filter((m) => m.active).length;
  const openInvites = data.invites.filter((i) => !i.expired).length;
  return (
    <div className="space-y-4">
      <PageHeader eyebrow="Ekip" title="Ekip ve yetkiler" hint="Her kişinin bir temel rolü (Yönetici, Ofis, Muhasebe, Atölye, Ekip üyesi) ve bir yetki rolü vardır. Yetki rolü temel rolün izinlerini yalnızca daraltır: modül × eylem ve gizli alanlar (fiyat, maliyet, kâr, müşteri iletişimi). Gizli alanlar ekrandan da API'den de çıkar."
        kpis={[{ label: 'aktif üye', value: active, icon: Users }, { label: 'pasif', value: data.members.length - active }, { label: 'açık davet', value: openInvites, icon: Mail }, { label: 'özel rol', value: data.roles.custom.length, icon: KeyRound }]} />
      {error && <p role="alert" className="text-sm text-rose-700 dark:text-rose-300">{error}</p>}
      <div className="flex gap-1 rounded-md border border-border p-1" role="tablist" aria-label="Ekip bölümleri">
        {([['members', 'Üyeler', Users], ['invites', 'Davetler', Mail], ['roles', 'Roller', ShieldCheck]] as const).map(([k, label, Icon]) => (
          <button key={k} type="button" role="tab" aria-selected={tab === k} onClick={() => setTab(k)}
            className={cn('flex flex-1 items-center justify-center gap-1.5 rounded px-3 py-2 text-xs font-medium', tab === k ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground')}>
            <Icon size={14} aria-hidden /> {label}
          </button>
        ))}
      </div>
      {tab === 'members' && <Members data={data} reload={load} onError={setError} />}
      {tab === 'invites' && <Invites data={data} reload={load} onError={setError} />}
      {tab === 'roles' && <Roles data={data} reload={load} onError={setError} />}
    </div>
  );
}

/** Access roles that fit a base role: its presets and the custom roles made for it. */
function rolesFor(data: TeamData, base: UserRole) {
  return [...data.roles.presets, ...data.roles.custom].filter((r) => r.base === base);
}

/** Why the actor may not change this member (mirrors the server rule), or null. */
function lockReason(data: TeamData, m: Member) {
  if (m.userId === data.me) return 'Kendiniz';
  if (m.role === 'owner') return 'Firma sahibi';
  if (data.myRole === 'admin' && m.role === 'admin') return 'Yöneticileri sahip yönetir';
  return null;
}

function Members({ data, reload, onError }: { data: TeamData; reload: () => Promise<void>; onError: (e: string) => void }) {
  const [busy, setBusy] = useState<string | null>(null);
  async function patch(m: Member, body: Record<string, unknown>, confirmText?: string) {
    if (confirmText && !window.confirm(confirmText)) return;
    setBusy(m.userId);
    const r = await send(`/api/v1/team/members/${m.userId}`, 'PATCH', body);
    setBusy(null);
    if (!r.ok) onError(r.error || 'Kaydedilemedi'); else await reload();
  }
  async function closeSessions(m: Member) {
    if (!window.confirm(`${m.name || m.email} için tüm oturumlar kapatılsın mı? Yeniden giriş yapması gerekir.`)) return;
    setBusy(m.userId);
    const r = await send(`/api/v1/team/members/${m.userId}/sessions`, 'DELETE');
    setBusy(null);
    if (!r.ok) onError(r.error || 'Oturumlar kapatılamadı'); else await reload();
  }
  const assignable = data.roles.assignable.filter((r) => data.myRole === 'owner' || r !== 'admin');
  return (
    <ul className="space-y-2" aria-label="Üyeler">
      {data.members.map((m) => {
        const lock = lockReason(data, m);
        return (
          <li key={m.userId} className={cn('rf-panel flex flex-col gap-3 p-3 md:flex-row md:items-center', !m.active && 'opacity-70')}>
            <div className="min-w-0 flex-1">
              <p className="flex flex-wrap items-center gap-2 text-sm font-semibold">
                {m.name || m.email}
                <StatusChip tone={m.active ? 'success' : 'neutral'} label={m.active ? 'Aktif' : 'Pasif'} />
                {m.hidden.length > 0 && <StatusChip tone="info" label={`Gizli: ${m.hidden.map((h) => FIELD_LABELS[h]).join(', ')}`} />}
              </p>
              <p className="truncate text-xs text-muted-foreground">{m.email} · son görülme {when(m.lastSeenAt)} · {m.openSessions} açık oturum</p>
            </div>
            {lock ? (
              <p className="text-xs text-muted-foreground">{BASE_ROLE_LABELS[m.role]} · {m.accessRoleName} <span className="ml-1">({lock})</span></p>
            ) : (
              <div className="flex flex-wrap items-center gap-2">
                <label className="text-xs">
                  <span className="sr-only">Temel rol</span>
                  <select className="rf-input text-xs" value={m.role} disabled={busy === m.userId}
                    onChange={(e) => void patch(m, { role: e.target.value, accessRole: null })}>
                    {assignable.map((r) => <option key={r} value={r}>{BASE_ROLE_LABELS[r]}</option>)}
                  </select>
                </label>
                <label className="text-xs">
                  <span className="sr-only">Yetki rolü</span>
                  <select className="rf-input text-xs" value={m.accessRole} disabled={busy === m.userId}
                    onChange={(e) => void patch(m, { accessRole: e.target.value })}>
                    {rolesFor(data, m.role).map((r) => <option key={r.key} value={r.key}>{r.roleName}{r.builtIn ? '' : ' (özel)'}</option>)}
                  </select>
                </label>
                {m.active ? (
                  <button type="button" className="rf-secondary-button inline-flex items-center gap-1 text-xs" disabled={busy === m.userId}
                    onClick={() => void patch(m, { active: false }, `${m.name || m.email} pasifleştirilsin mi? Kayıtları kalır, oturumları kapanır.`)}>
                    <UserX size={14} aria-hidden /> Pasifleştir
                  </button>
                ) : (
                  <button type="button" className="rf-secondary-button inline-flex items-center gap-1 text-xs" disabled={busy === m.userId} onClick={() => void patch(m, { active: true })}>
                    <UserCheck size={14} aria-hidden /> Etkinleştir
                  </button>
                )}
                {m.openSessions > 0 && (
                  <button type="button" className="rf-secondary-button text-xs" disabled={busy === m.userId} onClick={() => void closeSessions(m)}>Oturumları kapat</button>
                )}
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}

function Invites({ data, reload, onError }: { data: TeamData; reload: () => Promise<void>; onError: (e: string) => void }) {
  const assignable = data.roles.assignable.filter((r) => data.myRole === 'owner' || r !== 'admin');
  const [form, setForm] = useState({ email: '', role: 'office' as UserRole, accessRole: '', ttlDays: String(INVITE_TTL.default) });
  const [link, setLink] = useState<{ url: string; emailSent: boolean } | null>(null);
  const [busy, setBusy] = useState(false);
  async function invite(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const r = await send('/api/tenant/invite', 'POST', { email: form.email, role: form.role, accessRole: form.accessRole || null, ttlDays: Number(form.ttlDays) });
    setBusy(false);
    if (!r.ok || !r.data) { onError(r.error || 'Davet gönderilemedi'); return; }
    setLink({ url: r.data.inviteLink, emailSent: Boolean(r.data.emailSent) });
    setForm((f) => ({ ...f, email: '' }));
    await reload();
  }
  async function revoke(i: Invite) {
    if (!window.confirm(`${i.email} daveti iptal edilsin mi?`)) return;
    const r = await send(`/api/tenant/invites/${i.id}`, 'DELETE');
    if (!r.ok) onError(r.error || 'İptal edilemedi'); else await reload();
  }
  return (
    <div className="space-y-3">
      <form onSubmit={invite} className="rf-panel grid gap-2 p-3 sm:grid-cols-2 lg:grid-cols-5" aria-label="Davet gönder">
        <label className="text-xs sm:col-span-2 lg:col-span-2">E-posta
          <input className="rf-input mt-1 w-full" type="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
        </label>
        <label className="text-xs">Temel rol
          <select className="rf-input mt-1 w-full" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value as UserRole, accessRole: '' })}>
            {assignable.map((r) => <option key={r} value={r}>{BASE_ROLE_LABELS[r]}</option>)}
          </select>
        </label>
        <label className="text-xs">Yetki rolü
          <select className="rf-input mt-1 w-full" value={form.accessRole} onChange={(e) => setForm({ ...form, accessRole: e.target.value })}>
            <option value="">Varsayılan</option>
            {rolesFor(data, form.role).map((r) => <option key={r.key} value={r.key}>{r.roleName}</option>)}
          </select>
        </label>
        <label className="text-xs">Geçerlilik (gün)
          <input className="rf-input mt-1 w-full" type="number" min={INVITE_TTL.min} max={INVITE_TTL.max} value={form.ttlDays} onChange={(e) => setForm({ ...form, ttlDays: e.target.value })} />
        </label>
        <div className="flex items-end sm:col-span-2 lg:col-span-5">
          <button type="submit" className="rf-primary-button inline-flex items-center gap-1 text-sm" disabled={busy}><Plus size={14} aria-hidden /> Davet gönder</button>
        </div>
      </form>
      {link && (
        <div className="rf-panel space-y-1 p-3 text-xs" role="status">
          <p>{link.emailSent ? 'E-posta gönderildi. Bağlantı yalnız bu kez gösterilir:' : 'E-posta gönderilemedi; bağlantıyı kendiniz iletin (yalnız bu kez gösterilir):'}</p>
          <input readOnly className="rf-input w-full font-mono text-xs" value={link.url} onFocus={(e) => e.currentTarget.select()} aria-label="Davet bağlantısı" />
        </div>
      )}
      {data.invites.length === 0 ? <EmptyState title="Bekleyen davet yok" icon={Mail} /> : (
        <ul className="space-y-2" aria-label="Davetler">
          {data.invites.map((i) => (
            <li key={i.id} className="rf-panel flex flex-wrap items-center gap-2 p-3 text-sm">
              <span className="min-w-0 flex-1 truncate font-medium">{i.email}</span>
              <span className="text-xs text-muted-foreground">{BASE_ROLE_LABELS[i.role]} · {i.accessRoleName}</span>
              <StatusChip tone={i.expired ? 'danger' : 'info'} label={i.expired ? 'Süresi doldu' : `Son: ${when(i.expiresAt)}`} />
              <button type="button" className="rf-icon-button" aria-label={`${i.email} davetini iptal et`} onClick={() => void revoke(i)}><Trash2 size={14} aria-hidden /></button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Roles({ data, reload, onError }: { data: TeamData; reload: () => Promise<void>; onError: (e: string) => void }) {
  const [editing, setEditing] = useState<RoleRow | 'new' | null>(null);
  const [viewing, setViewing] = useState<RoleRow | null>(null);
  async function remove(r: RoleRow) {
    if (!window.confirm(`"${r.roleName}" silinsin mi? Bu roldeki ${r.members} kişi temel rolünün varsayılanına döner.`)) return;
    const res = await send(`/api/v1/team/roles/${r.id}`, 'DELETE');
    if (!res.ok) onError(res.error || 'Silinemedi'); else await reload();
  }
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h2 className="rf-section-title flex items-center gap-2">Roller <HintTip text="Hazır roller değişmez. Özel rol bir temel rol üzerine kurulur ve onu yalnız daraltır; temel rolün vermediği bir izin seçilemez." /></h2>
        <button type="button" className="rf-primary-button inline-flex items-center gap-1 text-sm" onClick={() => setEditing('new')}><Plus size={14} aria-hidden /> Yeni rol</button>
      </div>
      {editing && <RoleEditor data={data} role={editing === 'new' ? null : editing} onClose={() => setEditing(null)} onSaved={async () => { setEditing(null); await reload(); }} onError={onError} />}
      <ul className="grid gap-2 md:grid-cols-2" aria-label="Rol listesi">
        {[...data.roles.custom, ...data.roles.presets].map((r) => (
          <li key={r.key} className="rf-panel space-y-1 p-3 text-sm">
            <p className="flex flex-wrap items-center gap-2 font-semibold">{r.roleName}
              <StatusChip tone={r.builtIn ? 'neutral' : 'info'} label={r.builtIn ? 'Hazır' : 'Özel'} />
              <span className="text-xs font-normal text-muted-foreground">{BASE_ROLE_LABELS[r.base]} üzerinde · {r.members} kişi</span>
            </p>
            {r.description && <p className="text-xs text-muted-foreground">{r.description}</p>}
            <p className="text-xs text-muted-foreground">Gizli: {r.hidden.length ? r.hidden.map((h) => FIELD_LABELS[h]).join(', ') : 'yok'}</p>
            <div className="flex gap-2 pt-1">
              <button type="button" className="rf-secondary-button text-xs" onClick={() => setViewing(viewing?.key === r.key ? null : r)}>{viewing?.key === r.key ? 'Gizle' : 'İzinleri gör'}</button>
              {!r.builtIn && <button type="button" className="rf-secondary-button text-xs" onClick={() => setEditing(r)}>Düzenle</button>}
              {!r.builtIn && <button type="button" className="rf-secondary-button text-xs" onClick={() => void remove(r)}>Sil</button>}
            </div>
            {viewing?.key === r.key && <MatrixGrid modules={data.roles.modules} actions={data.roles.actions} base={r.base} value={r.permissions} />}
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Module × action grid; cells the base role does not allow are shown disabled. */
function MatrixGrid({ modules, actions, base, value, onToggle }: { modules: Module[]; actions: Action[]; base: UserRole; value: Matrix; onToggle?: (m: Module, a: Action) => void }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[520px] text-xs">
        <thead><tr><th className="py-1 text-left font-medium">Modül</th>{actions.map((a) => <th key={a} className="px-1 py-1 font-medium">{ACTION_LABELS[a]}</th>)}</tr></thead>
        <tbody>
          {modules.map((m) => (
            <tr key={m} className="border-t border-border">
              <td className="py-1 pr-2">{MODULE_LABELS[m]}</td>
              {actions.map((a) => {
                const allowed = (BASE_CAPS[base][m] ?? []).includes(a);
                const on = (value[m] ?? []).includes(a);
                return (
                  <td key={a} className="px-1 py-1 text-center">
                    <input type="checkbox" aria-label={`${MODULE_LABELS[m]} – ${ACTION_LABELS[a]}`} checked={on && allowed} disabled={!allowed || !onToggle}
                      onChange={() => onToggle?.(m, a)} className="h-4 w-4" />
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function RoleEditor({ data, role, onClose, onSaved, onError }: { data: TeamData; role: RoleRow | null; onClose: () => void; onSaved: () => Promise<void>; onError: (e: string) => void }) {
  const [name, setName] = useState(role?.roleName ?? '');
  const [base, setBase] = useState<UserRole>(role?.base ?? 'office');
  const [matrix, setMatrix] = useState<Matrix>(role?.permissions ?? {});
  const [hidden, setHidden] = useState<FieldGroup[]>(role?.hidden ?? []);
  const forced = useMemo(() => BASE_HIDDEN[base], [base]);
  function toggle(m: Module, a: Action) {
    setMatrix((cur) => {
      const set = new Set(cur[m] ?? []);
      if (set.has(a)) {
        set.delete(a);
        if (a === 'view') set.clear(); // without view nothing else of the module works
      } else {
        set.add(a);
        set.add('view'); // any action implies view
      }
      return { ...cur, [m]: [...set] };
    });
  }
  async function save(e: React.FormEvent) {
    e.preventDefault();
    const body = { name, base, permissions: matrix, hidden: [...new Set([...hidden, ...forced])] };
    const r = role?.id ? await send(`/api/v1/team/roles/${role.id}`, 'PUT', body) : await send('/api/v1/team/roles', 'POST', body);
    if (!r.ok) onError(r.error || 'Kaydedilemedi'); else await onSaved();
  }
  return (
    <form onSubmit={save} className="rf-panel space-y-3 p-3" aria-label={role ? 'Rolü düzenle' : 'Yeni rol'}>
      <div className="grid gap-2 sm:grid-cols-2">
        <label className="text-xs">Rol adı
          <input className="rf-input mt-1 w-full" required minLength={2} maxLength={60} value={name} onChange={(e) => setName(e.target.value)} />
        </label>
        <label className="text-xs">Temel rol
          <select className="rf-input mt-1 w-full" value={base} disabled={Boolean(role?.id && role.members > 0)} onChange={(e) => { setBase(e.target.value as UserRole); setMatrix({}); }}>
            {data.roles.assignable.map((r) => <option key={r} value={r}>{BASE_ROLE_LABELS[r]}</option>)}
          </select>
        </label>
      </div>
      <MatrixGrid modules={data.roles.modules} actions={data.roles.actions} base={base} value={matrix} onToggle={toggle} />
      <fieldset className="space-y-1">
        <legend className="text-xs font-medium">Gizli alanlar</legend>
        <div className="flex flex-wrap gap-3">
          {data.roles.fields.map((f) => (
            <label key={f} className="inline-flex items-center gap-1 text-xs">
              <input type="checkbox" className="h-4 w-4" checked={hidden.includes(f) || forced.includes(f)} disabled={forced.includes(f)}
                onChange={() => setHidden((h) => (h.includes(f) ? h.filter((x) => x !== f) : [...h, f]))} />
              {FIELD_LABELS[f]}{forced.includes(f) ? ' (temel rol gizler)' : ''}
            </label>
          ))}
        </div>
      </fieldset>
      <div className="flex gap-2">
        <button type="submit" className="rf-primary-button text-sm">Kaydet</button>
        <button type="button" className="rf-secondary-button text-sm" onClick={onClose}>Vazgeç</button>
      </div>
    </form>
  );
}
