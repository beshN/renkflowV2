"use client";
import { useEffect, useState } from 'react';
import { BusinessDialog } from '@/components/shared/ui/BusinessDialog';
import { ATTENDANCE, type AttendanceKind } from '@/lib/features/personnel/payroll';
import { policyDays, type AttendancePolicy } from '@/lib/features/personnel/attendance-policy';
import { money } from './shared';
export function AttendanceEntryDialog({ open, onClose, busy, rows, today, policy, onSave, initial }: {
 initial?: {employeeId: string;day:string;kind:AttendanceKind} | null; open: boolean; onClose: () => void; busy: boolean; rows: Array<{ id: string; fullName: string; payType: string; payAmount: number | null; currency: string }>; today: string; policy: AttendancePolicy;
 onSave: (input: Record<string, unknown>) => Promise<unknown>;
}) {
 const [employeeId, setEmployeeId] = useState(''), [day, setDay] = useState(today), [kind, setKind] = useState<AttendanceKind>('absent'), [note, setNote] = useState(''), [error, setError] = useState('');
 useEffect(() => { if (open) { setEmployeeId(initial?.employeeId || ''); setDay(initial?.day || today); setKind(initial?.kind || 'absent'); setNote(''); setError(''); } }, [open, initial, today]);
 const e = rows.find(r => r.id === employeeId), rate = e?.payAmount == null ? null : e.payType === 'daily' ? e.payAmount : e.payAmount / 30;
 const days = policyDays(kind, policy);
 return <BusinessDialog title="Devamsızlık / izin kaydı ekle" open={open} busy={busy} error={error} onClose={onClose}><form className="space-y-4" onSubmit={async event => { event.preventDefault(); setError(''); try { await onSave({ employeeId, days: [day], kind, note }); onClose(); } catch (e) { setError(e instanceof Error ? e.message : 'Kaydedilemedi'); } }}>
   <label className="rf-field">Çalışan<select aria-label="Çalışan" required className="rf-input" value={employeeId} onChange={e => setEmployeeId(e.target.value)}><option value="">Çalışan seçin</option>{rows.map(r => <option key={r.id} value={r.id}>{r.fullName}</option>)}</select></label>
   <div className="grid gap-3 sm:grid-cols-2"><label className="rf-field">Gün<input required type="date" className="rf-input" value={day} onChange={e => setDay(e.target.value)} /></label><label className="rf-field">Gün türü<select aria-label="Gün türü" className="rf-input" value={kind} onChange={e => setKind(e.target.value as AttendanceKind)}>{Object.entries(ATTENDANCE).map(([key, v]) => <option key={key} value={key}>{v.label}</option>)}</select></label></div>
   <label className="rf-field">Açıklama<input className="rf-input" maxLength={500} value={note} onChange={e => setNote(e.target.value)} /></label>
   <div className="rounded-lg bg-muted p-3 text-sm"><p>{days ? `${days.toLocaleString('tr-TR')} günlük ücret kesintisi` : 'Maaş kesintisi yok'} · kural sürümü {policy.version || 'ilk ayar'}</p>{e && <p className="mt-1 text-xs text-muted-foreground">{days} × {money(rate, e.currency)} = {money(rate === null ? null : rate * days, e.currency)}. Bu hesap günün kaydında saklanır.</p>}</div>
   <button disabled={busy || !employeeId} className="rf-primary-button">Günü kaydet</button>
 </form></BusinessDialog>;
}
