'use client';
import type { QualityCheck } from '@/lib/features/manufacturing/quality';
export function RecipeQualityEditor({ checks,onChange }: { checks:QualityCheck[];onChange:(checks:QualityCheck[])=>void }) {
  const update=(index:number,patch:Partial<QualityCheck>)=>onChange(checks.map((check,i)=>i===index?{...check,...patch}:check));
  return <div className="space-y-2 sm:col-span-4">
    {checks.map((check,index)=><div key={check.id} className="grid gap-3 rounded border border-border bg-muted/30 p-3 sm:grid-cols-3">
      <label className="text-xs">Kontrol adı<input className="rf-input mt-1 w-full" required minLength={2} value={check.name} onChange={e=>update(index,{name:e.target.value})}/></label>
      <label className="text-xs">Kontrol türü<select className="rf-input mt-1 w-full" value={check.kind} onChange={e=>update(index,{kind:e.target.value as QualityCheck['kind']})}><option value="pass_fail">Geçti / kaldı</option><option value="measurement">Ölçüm ve tolerans</option><option value="photo">Fotoğraf kanıtı</option></select></label>
      <button type="button" className="text-xs text-destructive" onClick={()=>onChange(checks.filter((_,i)=>i!==index))}>Kontrolü sil</button>
      {check.kind==='measurement' && <>
        <label className="text-xs">Alt sınır<input className="rf-input mt-1 w-full" required type="number" step="any" value={check.minimum ?? ''} onChange={e=>update(index,{minimum:e.target.value===''?undefined:Number(e.target.value)})}/></label>
        <label className="text-xs">Üst sınır<input className="rf-input mt-1 w-full" required type="number" step="any" value={check.maximum ?? ''} onChange={e=>update(index,{maximum:e.target.value===''?undefined:Number(e.target.value)})}/></label>
        <label className="text-xs">Birim<input className="rf-input mt-1 w-full" required maxLength={24} value={check.unit} onChange={e=>update(index,{unit:e.target.value})}/></label>
      </>}
    </div>)}
    <button type="button" className="rf-secondary-button text-xs" disabled={checks.length>=30} onClick={()=>onChange([...checks,{id:crypto.randomUUID(),name:'',kind:'pass_fail',unit:''}])}>Kalite kontrol noktası ekle</button>
  </div>;
}
