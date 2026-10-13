'use client';

import { useEffect, useRef, useState, type FormEvent } from 'react';
import Link from 'next/link';
import { CheckSquare, ExternalLink, MessageSquare, Plus, Save } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/Dialog';
import { addWorkOrderComment, createWorkOrder, getWorkOrderDetails, toggleWorkOrderChecklistItem, updateWorkOrder, type TenantMember, type WorkOrder, type WorkOrderCapabilities, type WorkOrderDetails, type WorkOrderPriority, type WorkOrderStatus, type WorkOrderBlockReasonCategory } from '@/lib/features/work-orders/client';
import { canTransitionWorkOrderStatus } from '@/lib/features/work-orders/status';
import { BLOCK_LABELS, KANBAN_COLUMNS, PRIORITY_LABELS } from '@/lib/features/work-orders/kanban';

const inputClass = 'rf-input mt-1 min-h-11 w-full text-base sm:text-sm disabled:bg-muted disabled:text-muted-foreground';
const blank = { title: '', description: '', category: 'Üretim', priority: 'medium' as WorkOrderPriority, status: 'open' as WorkOrderStatus, dueAt: '', assignedTo: '', blockedCategory: 'material' as WorkOrderBlockReasonCategory, blockedDetail: '' };
function dateInput(value: string | null) {
  if (!value) return '';
  const d = new Date(value);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0,16);
}

export function KanbanCardDialog({ cardId, members, capabilities, onClose, onChanged }: { cardId: string | 'new'; members: TenantMember[]; capabilities: WorkOrderCapabilities; onClose: () => void; onChanged: (card: WorkOrder) => void }) {
  const isNew = cardId === 'new';
  const [data, setData] = useState<WorkOrderDetails | null>(null);
  const [form, setForm] = useState(blank);
  const [loading, setLoading] = useState(!isNew);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [checklistTitle, setChecklistTitle] = useState('');
  const [comment, setComment] = useState('');
  const baseUpdatedAt = useRef<string>();
  const baseRevision = useRef<number>();
  const operation = useRef(false);
  const edit = isNew ? capabilities.create : capabilities.edit;
  useEffect(() => {
    if (isNew) return;
    let active = true;
    getWorkOrderDetails(cardId).then(card => {
      if (!active) return;
      setData(card); baseUpdatedAt.current = card.updatedAt;
      baseRevision.current = card.revision;
      setForm({ title: card.title, description: card.description || '', category: card.category, priority: card.priority, status: card.status, dueAt: dateInput(card.dueAt), assignedTo: card.assignedTo || '', blockedCategory: card.blockedReasonCategory || 'material', blockedDetail: card.blockedReasonDetail || '' });
    }).catch(err => { if (active) setError(err instanceof Error ? err.message : 'Kart yüklenemedi.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [cardId, isNew]);

  async function run(task: () => Promise<void>) {
    if (operation.current) return;
    operation.current = true; setBusy(true); setError(''); setNotice('');
    try { await task(); }
    catch (err) { setError(err instanceof Error ? err.message : 'İşlem kaydedilemedi.'); }
    finally { operation.current = false; setBusy(false); }
  }
  async function reloadDetails() {
    if (isNew) return;
    const card = await getWorkOrderDetails(cardId);
    setData(card); onChanged(card);
  }
  function save(event: FormEvent) {
    event.preventDefault();
    void run(async () => {
      const fields = { title: form.title.trim(), description: form.description.trim(), category: form.category.trim(), priority: form.priority, dueAt: form.dueAt ? new Date(form.dueAt).toISOString() : null };
      if (isNew) {
        const card = await createWorkOrder({ ...fields, dueAt: fields.dueAt ?? undefined, assignedToUserId: capabilities.assign && form.assignedTo ? form.assignedTo : undefined });
        onChanged(card); onClose(); return;
      }
      if (!data) return;
      const changedStatus = form.status !== data.status;
      const saved = await updateWorkOrder(cardId, {
        ...(capabilities.edit ? fields : {}),
        ...(capabilities.assign ? { assignedToUserId: form.assignedTo || null } : {}),
        ...(changedStatus ? { status: form.status } : {}),
        ...(form.status === 'blocked' && capabilities.edit ? { blockedReasonCategory: form.blockedCategory, blockedReasonDetail: form.blockedDetail } : {}),
        expectedUpdatedAt: baseUpdatedAt.current,
        expectedRevision: baseRevision.current,
      });
      baseUpdatedAt.current = saved.updatedAt;
      baseRevision.current = saved.revision;
      onChanged(saved); await reloadDetails(); setNotice('Değişiklikler kaydedildi.');
    });
  }
  const availableStatuses = KANBAN_COLUMNS.filter(column => column.id === data?.status || (data && canTransitionWorkOrderStatus(data.status, column.id) && (!['done','cancelled'].includes(column.id) || capabilities.close) && (column.id !== 'blocked' || capabilities.edit)));
  return <Dialog open onOpenChange={open => { if (!open && !operation.current) onClose(); }}>
    <DialogContent showCloseButton={!busy} className="max-h-[90dvh] overflow-y-auto sm:max-w-3xl">
      <DialogHeader><DialogTitle>{isNew ? 'Yeni kart' : 'Kart detayı'}</DialogTitle><DialogDescription>{isNew ? 'Yeni iş emri Planlandı sütununa eklenir.' : 'İş emrini, sorumluyu, terminini ve ekip notlarını buradan yönetin.'}</DialogDescription></DialogHeader>
      {error && <div role="alert" className="rounded-xl bg-rose-50 p-3 text-sm text-rose-800 dark:bg-rose-950/40 dark:text-rose-200">{error}</div>}
      {notice && <p role="status" className="text-sm text-emerald-700 dark:text-emerald-300">{notice}</p>}
      {loading && <p role="status" className="py-8 text-center text-sm text-muted-foreground">Kart yükleniyor…</p>}
      {!loading && (isNew || data) && <>
        <form onSubmit={save} className="space-y-4">
          <fieldset disabled={busy} className="space-y-4">
            <label className="block text-sm font-medium">Başlık<input required minLength={3} maxLength={240} autoFocus={isNew} disabled={!edit} className={inputClass} value={form.title} onChange={event => setForm({ ...form, title: event.target.value })} placeholder="Örn. Teras projesi profil kesimi" /></label>
            <label className="block text-sm font-medium">Açıklama<textarea maxLength={5000} disabled={!edit} className={inputClass + ' min-h-28 resize-y'} value={form.description} onChange={event => setForm({ ...form, description: event.target.value })} placeholder="İşin ayrıntıları ve ekip için notlar" /></label>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <label className="text-sm font-medium">Etiket / kategori<input required maxLength={120} disabled={!edit} className={inputClass} value={form.category} onChange={event => setForm({ ...form, category: event.target.value })} /></label>
              <label className="text-sm font-medium">Öncelik<select disabled={!edit} className={inputClass} value={form.priority} onChange={event => setForm({ ...form, priority: event.target.value as WorkOrderPriority })}>{Object.entries(PRIORITY_LABELS).map(([value,label]) => <option key={value} value={value}>{label}</option>)}</select></label>
              <label className="text-sm font-medium">Termin<input type="datetime-local" disabled={!edit} className={inputClass} value={form.dueAt} onChange={event => setForm({ ...form, dueAt: event.target.value })} /></label>
              <label className="text-sm font-medium">Sorumlu<select disabled={!capabilities.assign || !members.length} className={inputClass} value={form.assignedTo} onChange={event => setForm({ ...form, assignedTo: event.target.value })}><option value="">Atanmadı</option>{data?.assignedTo && !members.some(member => member.id === data.assignedTo) && <option value={data.assignedTo}>{data.assigneeName || 'Mevcut sorumlu'}</option>}{members.map(member => <option key={member.id} value={member.id}>{member.name}</option>)}</select></label>
              {!isNew && <label className="text-sm font-medium">Sütun<select disabled={!capabilities.transition || !!data?.manufacturing} className={inputClass} value={form.status} onChange={event => setForm({ ...form, status: event.target.value as WorkOrderStatus })}>{availableStatuses.map(column => <option key={column.id} value={column.id}>{column.title}</option>)}</select></label>}
            </div>
            {form.status === 'blocked' && <div className="grid gap-3 rounded-xl border border-amber-200 bg-amber-50/40 p-3 sm:grid-cols-2 dark:border-amber-900 dark:bg-amber-950/20"><label className="text-sm">Bloke nedeni<select disabled={!capabilities.edit} className={inputClass} value={form.blockedCategory} onChange={event => setForm({ ...form, blockedCategory: event.target.value as WorkOrderBlockReasonCategory })}>{Object.entries(BLOCK_LABELS).map(([value,label]) => <option key={value} value={value}>{label}</option>)}</select></label><label className="text-sm">Gecikme açıklaması<input required minLength={5} maxLength={1000} disabled={!capabilities.edit} className={inputClass} value={form.blockedDetail} onChange={event => setForm({ ...form, blockedDetail: event.target.value })} /></label></div>}
            <div className="flex flex-wrap items-center justify-between gap-3">
              {!isNew && <Link href={'/work-orders/' + cardId} className="flex min-h-11 items-center gap-1 text-sm text-primary"><ExternalLink size={14} />İş emrini aç</Link>}
              {(edit || capabilities.assign || capabilities.transition && !data?.manufacturing) && <button className="rf-primary-button ml-auto flex min-h-11 items-center gap-2" disabled={busy || (!edit && !capabilities.assign && form.status === data?.status)}><Save size={16} />{busy ? 'Kaydediliyor…' : isNew ? 'Kart oluştur' : 'Kaydet'}</button>}
            </div>
          </fieldset>
        </form>
        {data?.manufacturing && <p className="rounded-xl border border-border bg-muted p-3 text-sm text-muted-foreground">Bu kart malzemeli üretim emrine bağlı. Durum değişikliği için <Link href="/production" className="font-medium text-primary">Üretim ekranında</Link> malzeme aktarımı / üretim kaydı kullanılır.</p>}
        {data && <section className="space-y-3 border-t border-border pt-5">
          <h3 className="flex items-center gap-2 font-semibold"><CheckSquare size={18} />Kontrol listesi <span className="ml-auto text-xs font-normal text-muted-foreground">{data.checklistCompleted}/{data.checklistTotal}</span></h3>
          {data.checklist.length > 0 && <div role="progressbar" aria-label="Kontrol listesi ilerlemesi" aria-valuemin={0} aria-valuemax={data.checklistTotal} aria-valuenow={data.checklistCompleted} className="h-1.5 overflow-hidden rounded-full bg-muted"><div style={{ width: String(data.checklistCompleted / data.checklistTotal * 100) + '%' }} className="h-full bg-emerald-500 transition-all" /></div>}
          {data.checklist.map(item => <label key={item.id} className="flex min-h-10 items-center gap-3 rounded-lg border border-border px-3 py-2 text-sm"><input type="checkbox" disabled={busy || !capabilities.checklist} checked={item.completed} onChange={event => { const completed = event.target.checked; void run(async () => { await toggleWorkOrderChecklistItem(cardId, item.id, completed); await reloadDetails(); }); }} /><span className={item.completed ? 'text-muted-foreground line-through' : ''}>{item.title}</span>{item.required && <span className="ml-auto text-xs text-muted-foreground">Zorunlu</span>}</label>)}
          {!data.checklist.length && <p className="text-sm text-muted-foreground">Henüz kontrol maddesi yok.</p>}
          {capabilities.edit && <form className="flex gap-2" onSubmit={event => { event.preventDefault(); void run(async () => { const saved = await updateWorkOrder(cardId, { appendChecklistItems: [{ title: checklistTitle.trim(), required: true }], expectedUpdatedAt: baseUpdatedAt.current, expectedRevision: baseRevision.current }); baseUpdatedAt.current = saved.updatedAt; baseRevision.current = saved.revision; setChecklistTitle(''); await reloadDetails(); }); }}><input required maxLength={240} aria-label="Yeni kontrol maddesi" placeholder="Kontrol maddesi ekle" value={checklistTitle} disabled={busy} onChange={event => setChecklistTitle(event.target.value)} className="rf-input min-h-11 min-w-0 flex-1 text-sm" /><button type="submit" aria-label="Kontrol maddesi ekle" disabled={busy || !checklistTitle.trim()} className="rf-primary-button min-h-11 px-3"><Plus size={18} /></button></form>}
        </section>}
        {data && <section className="space-y-3 border-t border-border pt-5">
          <h3 className="flex items-center gap-2 font-semibold"><MessageSquare size={18} />Ekip notları</h3>
          {capabilities.comment && <form className="space-y-2" onSubmit={event => { event.preventDefault(); void run(async () => { await addWorkOrderComment(cardId, comment.trim()); setComment(''); await reloadDetails(); }); }}><textarea required maxLength={2000} aria-label="Ekip notu" placeholder="Ekiple bir not paylaşın…" value={comment} disabled={busy} onChange={event => setComment(event.target.value)} className="rf-input min-h-20 w-full text-sm" /><button type="submit" disabled={busy || !comment.trim()} className="rf-primary-button min-h-11">Notu ekle</button></form>}
          {data.comments.slice().reverse().map(item => <div key={item.id} className="rounded-xl border border-border bg-muted/30 p-3"><p className="whitespace-pre-wrap break-words text-sm">{item.body}</p><p className="mt-2 text-xs text-muted-foreground">{item.authorName || 'Ekip üyesi'} · {new Date(item.createdAt).toLocaleString('tr-TR')}</p></div>)}
          {!data.comments.length && <p className="text-sm text-muted-foreground">Henüz ekip notu yok.</p>}
        </section>}
      </>}
    </DialogContent>
  </Dialog>;
}
