'use client';

import * as Dialog from '@radix-ui/react-dialog';
import Link from 'next/link';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowUpRight, Bell, BellOff, CalendarClock, Check, CheckSquare, ClipboardList, FileText, Mail, Paperclip, Pencil, Phone, Plus,
  Ruler, Send, Tag as TagIcon, Trash2, Truck, Factory, MessageSquareHeart, X, History,
} from 'lucide-react';
import { toast } from 'sonner';
import { ACTIVITY_KINDS, ACTIVITY_LABELS, ROLES_WITHOUT_ACCESS, activityState, checklistPercent, plainMentions, type ActivityKind, type RecordType } from '@/lib/features/records/types';
import { prepareBrowserFile } from '@/lib/storage/client';
import { useAuth } from '@/lib/context/AuthContext';
import { cn, formatDate } from '@/lib/utils';
import { EmptyState, ProgressRing, SkeletonRows } from '@/components/kit';

type Member = { id: string; name: string; role: string };
type Tag = { id: string; name: string; color: string };
type TimelineItem =
  | { kind: 'comment'; id: string; at: string; actor: string | null; mine: boolean; body: string | null; edited: boolean; deleted: boolean; attachments: Array<{ id: string; name: string; mime: string; size: number }> }
  | { kind: 'event'; id: string; at: string; actor: string | null; action: string; changes: Record<string, { from: unknown; to: unknown }> | null; note: string | null };
type RecordData = {
  head: { type: RecordType; id: string; title: string; subtitle: string | null; href: string };
  canEdit: boolean;
  related: Array<{ key: string; label: string; count: number; href: string }>;
  tags: Tag[];
  owner: { id: string | null; name: string | null; dueOn: string | null };
  checklist: Array<{ id: string; title: string; done: boolean; doneBy: string | null }>;
  activities: Array<{ id: string; kind: ActivityKind; title: string; dueOn: string; done: boolean; assigneeId: string | null; assigneeName: string | null; fromRule: string | null }>;
  following: boolean;
  followers: Array<{ id: string; name: string }>;
  today: string;
  timeline: TimelineItem[];
};

const TAG_TONE: Record<string, string> = {
  slate: 'border-slate-400/50 text-slate-700 dark:text-slate-300', blue: 'border-blue-500/50 text-blue-700 dark:text-blue-300',
  green: 'border-emerald-600/50 text-emerald-700 dark:text-emerald-300', amber: 'border-amber-500/60 text-amber-800 dark:text-amber-300',
  red: 'border-rose-500/60 text-rose-700 dark:text-rose-300', violet: 'border-violet-500/50 text-violet-700 dark:text-violet-300',
  teal: 'border-teal-600/50 text-teal-700 dark:text-teal-300',
};
const KIND_ICON: Record<ActivityKind, typeof Phone> = { call: Phone, email: Mail, measure: Ruler, delivery: Truck, production: Factory, feedback: MessageSquareHeart, todo: CheckSquare };
const EVENT_LABEL: Record<string, string> = {
  created: 'oluşturdu', updated: 'güncelledi', status_changed: 'durumu değiştirdi', tags_changed: 'etiketleri değiştirdi', owner_changed: 'sahibini / tarihini değiştirdi',
  checklist_added: 'kontrol maddesi ekledi', checklist_done: 'maddeyi tamamladı', checklist_reopened: 'maddeyi yeniden açtı', checklist_removed: 'maddeyi sildi',
  activity_planned: 'aktivite planladı', activity_done: 'aktiviteyi tamamladı', activity_reopened: 'aktiviteyi yeniden açtı', late_notified: 'gecikme bildirimi gönderildi',
  converted: 'siparişe dönüştürdü', deleted: 'sildi', note_added: 'not ekledi',
};
const when = (at: string) => new Date(at).toLocaleString('tr-TR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
const show = (v: unknown) => (v === null || v === undefined || v === '' ? '—' : Array.isArray(v) ? v.join(', ') || '—' : typeof v === 'object' ? JSON.stringify(v) : String(v));
const toBase64 = (file: File) => new Promise<string>((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = () => resolve(String(reader.result).split(',')[1] ?? '');
  reader.onerror = () => reject(reader.error);
  reader.readAsDataURL(file);
});

/** Renders "@[Ayşe](id)" as a highlighted @Ayşe. */
function CommentBody({ body }: { body: string }) {
  const parts = body.split(/(@\[[^\]\n]{1,80}\]\([0-9a-f-]{36}\))/gi);
  return <p className="whitespace-pre-wrap break-words text-sm">{parts.map((p, i) => {
    const m = /^@\[([^\]]+)\]/.exec(p);
    return m ? <span key={i} className="rounded bg-primary/10 px-1 font-medium text-primary">@{m[1]}</span> : <span key={i}>{p}</span>;
  })}</p>;
}

/**
 * One drawer for any main record (Odoo chatter + Trello card): related records with counts,
 * tags, owner and due date, checklist with progress, planned activities, followers, and one
 * stream of comments (mentions, files) and recorded changes with who and when.
 */
function useRecord(type: RecordType, id: string, active: boolean) {
  const [data, setData] = useState<RecordData | null>(null);
  const [error, setError] = useState('');
  const [status, setStatus] = useState(0);
  const [members, setMembers] = useState<Member[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const r = await fetch(`/api/v1/records/${type}/${id}`, { cache: 'no-store' });
      const body = await r.json();
      setStatus(r.status);
      if (!r.ok) { setError(body.error || 'Kayıt açılamadı'); return; }
      setData(body); setError('');
    } catch { setError('Bağlantı yok'); }
  }, [type, id]);
  useEffect(() => {
    if (!active) return;
    setData(null);
    void load();
    // Only people who can open this record are offered for mentions and assignment.
    void fetch('/api/tenant/members').then(async (r) => r.ok && setMembers(((await r.json()).members ?? []).filter((m: Member) => !ROLES_WITHOUT_ACCESS[type].includes(m.role)))).catch(() => undefined);
    void fetch('/api/v1/records/tags').then(async (r) => r.ok && setTags((await r.json()).tags ?? [])).catch(() => undefined);
  }, [active, load]);

  const send = useCallback(async (command: Record<string, unknown>, done?: string) => {
    setBusy(true);
    try {
      const r = await fetch(`/api/v1/records/${type}/${id}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(command) });
      const body = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(body.error || 'Kaydedilemedi');
      if (done) toast.success(done);
      await load();
      return true;
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Kaydedilemedi');
      return false;
    } finally { setBusy(false); }
  }, [type, id, load]);
  // 409 before the record platform's migration is applied: pages fall back to what they had.
  return { data, error, unavailable: status === 409 && !data, members, tags, setTags, busy, send };
}

/** The record sections without a frame: smart buttons, tags, owner, checklist, activities, chatter. */
function RecordSections({ rec, canAttach }: { rec: ReturnType<typeof useRecord>; canAttach: boolean }) {
  const { data, members, tags, setTags, busy, send } = rec;
  if (!data) return null;
  return (
    <>
      {data.related.length > 0 && (
        <nav aria-label="İlişkili kayıtlar" className="flex flex-wrap gap-2">
          {data.related.map((r) => (
            <Link key={r.key} href={r.href} className={cn('inline-flex min-h-9 items-center gap-2 rounded-md border border-border px-3 text-sm hover:border-primary/50', !r.count && 'opacity-50')}>
              <span className="font-semibold tabular-nums">{r.count}</span>{r.label}
            </Link>
          ))}
        </nav>
      )}
      <MetaRow data={data} members={members} tags={tags} setTags={setTags} busy={busy} send={send} />
      <Checklist data={data} busy={busy} send={send} />
      <Activities data={data} members={members} busy={busy} send={send} />
      <Chatter data={data} members={members} busy={busy} send={send} canAttach={canAttach} />
    </>
  );
}

function FollowButton({ rec }: { rec: ReturnType<typeof useRecord> }) {
  const { data, send } = rec;
  if (!data) return null;
  return (
    <button type="button" aria-pressed={data.following} aria-label={data.following ? 'Takibi bırak' : 'Takip et'} title={data.followers.map((f) => f.name).join(', ')}
      onClick={() => void send({ action: 'follow', on: !data.following })} className="relative grid h-10 w-10 shrink-0 place-items-center rounded-md border border-border">
      {data.following ? <Bell size={18} className="text-primary" /> : <BellOff size={18} />}
      {data.followers.length > 0 && <span className="absolute -right-1 -top-1 rounded-full bg-primary px-1 text-[10px] font-semibold text-primary-foreground">{data.followers.length}</span>}
    </button>
  );
}

/** The same record content inline, inside a page (order "Aktivite" tab, customer page). */
export function RecordPanel({ type, id, className, fallback }: { type: RecordType; id: string; className?: string; fallback?: React.ReactNode }) {
  const { user } = useAuth();
  const rec = useRecord(type, id, true);
  if (rec.unavailable && fallback) return <>{fallback}</>;
  if (!rec.data) return rec.error ? <p role="alert" className="rf-alert text-sm">{rec.error}</p> : <SkeletonRows rows={6} />;
  return (
    <div className={cn('space-y-5', className)}>
      <div className="flex justify-end"><FollowButton rec={rec} /></div>
      <RecordSections rec={rec} canAttach={user?.role !== 'worker'} />
    </div>
  );
}

export function RecordDrawer({ type, id, open, onOpenChange }: { type: RecordType; id: string; open: boolean; onOpenChange: (open: boolean) => void }) {
  const { user } = useAuth();
  const rec = useRecord(type, id, open);
  const { data, error } = rec;
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[80] bg-slate-950/40" />
        <Dialog.Content className="fixed inset-y-0 right-0 z-[81] flex w-full max-w-xl flex-col border-l border-border bg-card shadow-xl outline-none">
          {!data ? (
            <div className="p-5">
              <Dialog.Title className="sr-only">Kayıt</Dialog.Title>
              {error ? <p role="alert" className="rf-alert">{error}</p> : <SkeletonRows rows={8} />}
            </div>
          ) : (
            <>
              <header className="flex items-start gap-3 border-b border-border p-4">
                <div className="min-w-0 flex-1">
                  <Dialog.Title className="truncate text-lg font-semibold">{data.head.title}</Dialog.Title>
                  <Dialog.Description className="truncate text-xs text-muted-foreground">{data.head.subtitle || ' '}</Dialog.Description>
                </div>
                <FollowButton rec={rec} />
                <Link href={data.head.href} aria-label="Sayfasını aç" className="grid h-10 w-10 place-items-center rounded-md border border-border"><ArrowUpRight size={18} /></Link>
                <Dialog.Close aria-label="Kapat" className="grid h-10 w-10 place-items-center rounded-md border border-border"><X size={18} /></Dialog.Close>
              </header>
              <div className="flex-1 space-y-5 overflow-y-auto p-4">
                <RecordSections rec={rec} canAttach={user?.role !== 'worker'} />
              </div>
            </>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

type SectionProps = { data: RecordData; busy: boolean; send: (c: Record<string, unknown>, done?: string) => Promise<boolean> };

function MetaRow({ data, members, tags, setTags, busy, send }: SectionProps & { members: Member[]; tags: Tag[]; setTags: (t: Tag[]) => void }) {
  const [picking, setPicking] = useState(false);
  const [newTag, setNewTag] = useState('');
  const chosen = new Set(data.tags.map((t) => t.id));
  const toggle = (tagId: string) => void send({ action: 'tags.set', tagIds: chosen.has(tagId) ? [...chosen].filter((x) => x !== tagId) : [...chosen, tagId] });
  const create = async () => {
    const name = newTag.trim();
    if (!name) return;
    const r = await fetch('/api/v1/records/tags', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name, color: 'blue' }) });
    const body = await r.json().catch(() => ({}));
    if (!r.ok) return toast.error(body.error || 'Etiket eklenemedi');
    setTags([...tags, body]);
    setNewTag('');
    void send({ action: 'tags.set', tagIds: [...chosen, body.id] });
  };
  return (
    <section aria-label="Etiket ve sahip" className="space-y-3">
      <div className="flex flex-wrap items-center gap-1.5">
        <TagIcon size={15} aria-hidden className="text-muted-foreground" />
        {data.tags.map((t) => <span key={t.id} className={cn('rounded-full border px-2 py-0.5 text-xs font-medium', TAG_TONE[t.color])}>{t.name}</span>)}
        {data.canEdit && <button type="button" aria-expanded={picking} onClick={() => setPicking((v) => !v)} className="inline-flex h-7 items-center gap-1 rounded-full border border-dashed border-border px-2 text-xs"><Plus size={12} />Etiket</button>}
      </div>
      {picking && (
        <div className="space-y-2 rounded-md border border-border p-2">
          <div className="flex flex-wrap gap-1.5">
            {tags.map((t) => (
              <button key={t.id} type="button" disabled={busy} aria-pressed={chosen.has(t.id)} onClick={() => toggle(t.id)}
                className={cn('inline-flex min-h-8 items-center gap-1 rounded-full border px-2.5 text-xs', TAG_TONE[t.color], chosen.has(t.id) && 'ring-2 ring-primary/30')}>
                {chosen.has(t.id) && <Check size={12} aria-hidden />}{t.name}
              </button>
            ))}
          </div>
          <div className="flex gap-2">
            <input className="rf-input h-9 flex-1 text-sm" placeholder="Yeni etiket" maxLength={40} value={newTag} onChange={(e) => setNewTag(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); void create(); } }} />
            <button type="button" onClick={() => void create()} className="rf-secondary-button h-9 px-3 text-xs" disabled={!newTag.trim()}>Ekle</button>
          </div>
        </div>
      )}
      <div className="grid gap-2 sm:grid-cols-2">
        <label className="text-xs text-muted-foreground">Sahip
          <select className="rf-input mt-1 w-full" disabled={!data.canEdit || busy} value={data.owner.id ?? ''}
            onChange={(e) => void send({ action: 'owner.set', assigneeId: e.target.value || null, dueOn: data.owner.dueOn })}>
            <option value="">—</option>
            {members.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
          </select>
        </label>
        <label className="text-xs text-muted-foreground">Bitiş
          <input type="date" className="rf-input mt-1 w-full" disabled={!data.canEdit || busy} value={data.owner.dueOn ?? ''}
            onChange={(e) => void send({ action: 'owner.set', assigneeId: data.owner.id, dueOn: e.target.value || null })} />
        </label>
      </div>
    </section>
  );
}

function Checklist({ data, busy, send }: SectionProps) {
  const [title, setTitle] = useState('');
  const percent = checklistPercent(data.checklist);
  if (!data.checklist.length && !data.canEdit) return null;
  return (
    <section aria-label="Kontrol listesi" className="space-y-2">
      <h3 className="flex items-center gap-2 text-sm font-semibold">
        <ProgressRing size={32} stroke={4} value={percent} max={100} label={`Kontrol listesi %${percent}`} center={<span className="text-[10px]">%{percent}</span>} />
        Kontrol listesi
      </h3>
      <ul className="space-y-1">
        {data.checklist.map((c) => (
          <li key={c.id} className="group flex items-center gap-2 rounded-md px-1 hover:bg-accent/50">
            <label className="flex min-h-10 flex-1 items-center gap-2 text-sm">
              <input type="checkbox" className="h-5 w-5" checked={c.done} disabled={busy} onChange={(e) => void send({ action: 'checklist.toggle', itemId: c.id, done: e.target.checked })} />
              <span className={cn(c.done && 'text-muted-foreground line-through')}>{c.title}</span>
            </label>
            {data.canEdit && <button type="button" aria-label={`${c.title} sil`} onClick={() => void send({ action: 'checklist.remove', itemId: c.id })} className="grid h-8 w-8 place-items-center text-muted-foreground opacity-60 hover:opacity-100"><Trash2 size={14} /></button>}
          </li>
        ))}
      </ul>
      {data.canEdit && (
        <form className="flex gap-2" onSubmit={async (e) => { e.preventDefault(); if (title.trim() && await send({ action: 'checklist.add', title })) setTitle(''); }}>
          <input className="rf-input h-9 flex-1 text-sm" placeholder="Madde ekle" maxLength={200} value={title} onChange={(e) => setTitle(e.target.value)} aria-label="Yeni kontrol maddesi" />
          <button type="submit" aria-label="Maddeyi ekle" className="rf-secondary-button h-9 w-9 justify-center p-0" disabled={!title.trim() || busy}><Plus size={16} /></button>
        </form>
      )}
    </section>
  );
}

function Activities({ data, members, busy, send }: SectionProps & { members: Member[] }) {
  const [kind, setKind] = useState<ActivityKind>('call');
  const [title, setTitle] = useState('');
  const [dueOn, setDueOn] = useState(data.today);
  const [assignee, setAssignee] = useState('');
  const [adding, setAdding] = useState(false);
  return (
    <section aria-label="Aktiviteler" className="space-y-2">
      <h3 className="flex items-center justify-between text-sm font-semibold">
        <span className="flex items-center gap-2"><CalendarClock size={16} aria-hidden /> Aktiviteler</span>
        {data.canEdit && <button type="button" onClick={() => setAdding((v) => !v)} aria-expanded={adding} className="inline-flex h-8 items-center gap-1 rounded-md border border-border px-2 text-xs"><Plus size={12} />Planla</button>}
      </h3>
      {adding && (
        <form className="grid gap-2 rounded-md border border-border p-2 sm:grid-cols-2" onSubmit={async (e) => {
          e.preventDefault();
          if (await send({ action: 'activity.add', kind, title: title || ACTIVITY_LABELS[kind], dueOn, assigneeId: assignee || null }, 'Aktivite planlandı')) { setTitle(''); setAdding(false); }
        }}>
          <div className="flex flex-wrap gap-1 sm:col-span-2" role="radiogroup" aria-label="Tür">
            {ACTIVITY_KINDS.map((k) => {
              const Icon = KIND_ICON[k];
              return <button key={k} type="button" role="radio" aria-checked={kind === k} onClick={() => setKind(k)} className={cn('inline-flex min-h-9 items-center gap-1 rounded-md border px-2 text-xs', kind === k ? 'border-primary bg-primary/10' : 'border-border')}><Icon size={14} aria-hidden />{ACTIVITY_LABELS[k]}</button>;
            })}
          </div>
          <input className="rf-input h-9 text-sm sm:col-span-2" placeholder={ACTIVITY_LABELS[kind]} maxLength={200} value={title} onChange={(e) => setTitle(e.target.value)} aria-label="Başlık" />
          <input type="date" className="rf-input h-9 text-sm" required value={dueOn} onChange={(e) => setDueOn(e.target.value)} aria-label="Tarih" />
          <select className="rf-input h-9 text-sm" value={assignee} onChange={(e) => setAssignee(e.target.value)} aria-label="Kime">
            <option value="">Atanmamış</option>
            {members.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
          </select>
          <button type="submit" className="rf-primary-button h-9 sm:col-span-2" disabled={busy}>Planla</button>
        </form>
      )}
      {data.activities.length ? (
        <ul className="space-y-1">
          {data.activities.map((a) => {
            const Icon = KIND_ICON[a.kind] ?? CheckSquare;
            const state = activityState(a.dueOn, data.today, a.done);
            return (
              <li key={a.id} className="flex items-center gap-2 rounded-md border border-border p-2">
                <input type="checkbox" className="h-5 w-5" aria-label={`${a.title} tamamlandı`} checked={a.done} disabled={busy} onChange={(e) => void send({ action: 'activity.done', activityId: a.id, done: e.target.checked })} />
                <Icon size={16} aria-hidden className="shrink-0 text-muted-foreground" />
                <span className={cn('min-w-0 flex-1 truncate text-sm', a.done && 'text-muted-foreground line-through')}>{a.title}</span>
                <span className={cn('shrink-0 text-xs tabular-nums', state === 'overdue' && 'font-semibold text-rose-700 dark:text-rose-300', state === 'today' && 'font-semibold text-primary')}>
                  {state === 'overdue' ? '! ' : ''}{state === 'today' ? 'Bugün' : formatDate(a.dueOn)}
                </span>
                {a.assigneeName && <span className="hidden max-w-[90px] truncate text-xs text-muted-foreground sm:inline">{a.assigneeName}</span>}
              </li>
            );
          })}
        </ul>
      ) : !adding && <p className="flex items-center gap-2 text-xs text-muted-foreground"><ClipboardList size={14} aria-hidden />—</p>}
    </section>
  );
}

function Chatter({ data, members, busy, send, canAttach }: SectionProps & { members: Member[]; canAttach: boolean }) {
  const [body, setBody] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [query, setQuery] = useState<string | null>(null);
  const [editing, setEditing] = useState<{ id: string; body: string } | null>(null);
  const input = useRef<HTMLTextAreaElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const suggestions = useMemo(() => (query === null ? [] : members.filter((m) => m.name?.toLocaleLowerCase('tr-TR').includes(query.toLocaleLowerCase('tr-TR'))).slice(0, 6)), [query, members]);

  const onChange = (value: string) => {
    setBody(value);
    // "@" starts a mention; the word after it filters the people.
    const caret = input.current?.selectionStart ?? value.length;
    const m = /(?:^|\s)@([^\s@\[\]]{0,30})$/.exec(value.slice(0, caret));
    setQuery(m ? m[1] : null);
  };
  const pick = (m: Member) => {
    const caret = input.current?.selectionStart ?? body.length;
    const before = body.slice(0, caret).replace(/@([^\s@\[\]]{0,30})$/, `@[${m.name}](${m.id}) `);
    setBody(before + body.slice(caret));
    setQuery(null);
    input.current?.focus();
  };
  const submit = async () => {
    if (!body.trim()) return;
    const attachments = [];
    for (const f of files) {
      if (f.size > 10 * 1024 * 1024) return toast.error(`${f.name}: 10 MB sınırı`);
      const prepared = await prepareBrowserFile(f, 'order').catch((e) => { toast.error(e instanceof Error ? e.message : 'Yükleme yapılamadı'); return null; });
      if (!prepared) return;
      attachments.push(prepared instanceof File ? { name: f.name, mime: f.type, base64: await toBase64(f) } : prepared);
    }
    if (await send({ action: 'comment.add', body, attachments })) { setBody(''); setFiles([]); }
  };

  return (
    <section aria-label="Yazışma ve geçmiş" className="space-y-3">
      <h3 className="flex items-center gap-2 text-sm font-semibold"><History size={16} aria-hidden /> Yazışma ve geçmiş</h3>
      <div className="relative rounded-md border border-border">
        <textarea ref={input} rows={3} maxLength={4000} value={body} onChange={(e) => onChange(e.target.value)} aria-label="Yorum (@ ile kişi anın)"
          placeholder="Yorum… @ ile kişi anın" className="w-full resize-y rounded-md bg-transparent p-2 text-sm outline-none"
          onKeyDown={(e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); void submit(); } if (e.key === 'Escape') setQuery(null); }} />
        {suggestions.length > 0 && (
          <ul role="listbox" aria-label="Kişiler" className="absolute left-2 top-full z-10 mt-1 w-56 rounded-md border border-border bg-popover p-1 shadow-md">
            {suggestions.map((m) => <li key={m.id}><button type="button" role="option" aria-selected={false} onMouseDown={(e) => { e.preventDefault(); pick(m); }} className="w-full rounded px-2 py-1.5 text-left text-sm hover:bg-accent">{m.name}</button></li>)}
          </ul>
        )}
        <div className="flex items-center gap-2 border-t border-border p-1.5">
          {canAttach && <>
            <input ref={fileInput} type="file" multiple hidden accept="image/*,application/pdf,.doc,.docx,.xls,.xlsx" onChange={(e) => setFiles([...(e.target.files ?? [])].slice(0, 5))} />
            <button type="button" aria-label="Dosya ekle" onClick={() => fileInput.current?.click()} className="grid h-9 w-9 place-items-center rounded-md hover:bg-accent"><Paperclip size={16} /></button>
          </>}
          <span className="min-w-0 flex-1 truncate text-xs text-muted-foreground">{files.map((f) => f.name).join(', ')}</span>
          <button type="button" onClick={() => void submit()} disabled={busy || !body.trim()} className="rf-primary-button h-9 gap-1 px-3 text-xs"><Send size={14} /> Gönder</button>
        </div>
      </div>
      {data.timeline.length ? (
        <ol className="space-y-3 border-l border-border pl-4">
          {data.timeline.map((item) => item.kind === 'comment' ? (
            <li key={item.id} className="relative">
              <span aria-hidden className="absolute -left-[21px] top-1.5 h-2.5 w-2.5 rounded-full bg-primary" />
              <p className="text-xs text-muted-foreground"><span className="font-medium text-foreground">{item.actor ?? '—'}</span> · {when(item.at)}{item.edited && !item.deleted && ' · düzenlendi'}</p>
              {item.deleted ? <p className="text-sm italic text-muted-foreground">Yorum silindi</p> : editing?.id === item.id ? (
                <form className="mt-1 space-y-1" onSubmit={async (e) => { e.preventDefault(); if (await send({ action: 'comment.edit', commentId: item.id, body: editing.body })) setEditing(null); }}>
                  <textarea className="rf-input w-full text-sm" rows={3} value={editing.body} onChange={(e) => setEditing({ id: item.id, body: e.target.value })} aria-label="Yorumu düzenle" />
                  <div className="flex gap-2"><button type="submit" className="rf-primary-button h-8 px-3 text-xs" disabled={busy}>Kaydet</button><button type="button" className="rf-secondary-button h-8 px-3 text-xs" onClick={() => setEditing(null)}>Vazgeç</button></div>
                </form>
              ) : <CommentBody body={item.body ?? ''} />}
              {item.attachments.length > 0 && (
                <ul className="mt-1 flex flex-wrap gap-1.5">{item.attachments.map((f) => (
                  <li key={f.id}><a href={`/api/v1/records/attachments/${f.id}`} target="_blank" rel="noopener" className="inline-flex items-center gap-1 rounded border border-border px-2 py-1 text-xs hover:bg-accent"><FileText size={12} aria-hidden />{f.name}</a></li>
                ))}</ul>
              )}
              {item.mine && !item.deleted && editing?.id !== item.id && (
                <div className="mt-1 flex gap-1">
                  <button type="button" aria-label="Yorumu düzenle" onClick={() => setEditing({ id: item.id, body: item.body ?? '' })} className="grid h-7 w-7 place-items-center rounded text-muted-foreground hover:bg-accent"><Pencil size={12} /></button>
                  <button type="button" aria-label="Yorumu sil" onClick={() => void send({ action: 'comment.delete', commentId: item.id }, 'Yorum silindi')} className="grid h-7 w-7 place-items-center rounded text-muted-foreground hover:bg-accent"><Trash2 size={12} /></button>
                </div>
              )}
            </li>
          ) : (
            <li key={item.id} className="relative">
              <span aria-hidden className="absolute -left-[20px] top-1.5 h-2 w-2 rounded-full bg-muted-foreground/50" />
              <p className="text-xs text-muted-foreground"><span className="font-medium text-foreground">{item.actor ?? 'Sistem'}</span> {EVENT_LABEL[item.action] ?? item.action} · {when(item.at)}</p>
              {item.changes && Object.keys(item.changes).length > 0 && (
                <ul className="text-xs">{Object.entries(item.changes).slice(0, 4).map(([k, v]) => (
                  <li key={k} className="text-muted-foreground"><span className="font-medium">{k}</span>: {show(v?.from)} → <span className="text-foreground">{show(v?.to)}</span></li>
                ))}</ul>
              )}
              {item.note && <p className="text-xs">{plainMentions(item.note)}</p>}
            </li>
          ))}
        </ol>
      ) : <EmptyState title="Henüz kayıt yok" icon={History} />}
    </section>
  );
}

/** A button that opens the record drawer: drop it into any record's page or list row. */
export function RecordButton({ type, id, label = 'Kayıt', compact = false, className }: { type: RecordType; id: string; label?: string; compact?: boolean; className?: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={(e) => { e.stopPropagation(); setOpen(true); }} aria-label={`${label}: yorum, etiket, aktivite`}
        className={cn(compact ? 'grid h-9 w-9 place-items-center rounded-md border border-border hover:border-primary/50' : 'rf-secondary-button h-9 gap-1.5 px-3 text-xs', className)}>
        <History size={compact ? 16 : 14} />{!compact && label}
      </button>
      {open && <RecordDrawer type={type} id={id} open={open} onOpenChange={setOpen} />}
    </>
  );
}
