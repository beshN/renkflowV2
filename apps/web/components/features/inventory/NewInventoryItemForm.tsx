'use client';
import { useRef,useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/lib/context/AuthContext';
import { requestJson } from '@/lib/shared/network';
import { BusinessField as Field } from '@/components/shared/ui/BusinessDialog';
import { COUNT_UNITS, PROCESSED_STATES, STATE_LABELS, STOCK_UNITS, UNIT_LABELS } from '@/lib/features/inventory/vocabulary';
export function NewInventoryItemForm(){
  const {user}=useAuth(),router=useRouter(),allowed=!!user && ['owner','admin'].includes(user.role);
  const [unit,setUnit]=useState('adet'),[busy,setBusy]=useState(false),[error,setError]=useState('');
  const key=useRef<{hash:string;id:string}|null>(null),lock=useRef(false);
  return <form className="rf-panel space-y-5 p-5" onSubmit={async e=>{
    e.preventDefault();if(!allowed || lock.current)return;lock.current=true;setBusy(true);setError('');
    const f=new FormData(e.currentTarget),piece=f.get('pieceLength'),data={sku:f.get('sku'),name:f.get('name'),itemType:f.get('itemType'),uom:unit,minStock:Number(f.get('minStock')),standardLengthMm:unit==='m'?Number(f.get('length')):0,weightPerMeterKg:unit==='m'?Number(f.get('weight')):0,profileCode:String(f.get('profileCode')||''),sizeLabel:String(f.get('sizeLabel')||''),processedStates:f.getAll('processedStates'),pieceLengthMm:unit!=='m' && piece?Number(piece):null};
    const hash=JSON.stringify(data);if(key.current?.hash!==hash)key.current={hash,id:crypto.randomUUID()};
    const result=await requestJson<{data:{id:string}}>('/api/v1/production',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({commandId:key.current.id,action:'material.save',data})});
    lock.current=false;setBusy(false);if(result.ok && result.data)router.push('/inventory/'+result.data.data.id);else setError(result.error || 'Malzeme kaydedilemedi');
  }}>
    {!allowed && <p role="alert" className="text-sm text-amber-700">Malzeme kartını firma yöneticisi oluşturabilir.</p>}{error && <p role="alert" className="text-sm text-red-700">{error}</p>}
    <fieldset disabled={!allowed || busy} className="grid gap-4 sm:grid-cols-2"><Field label="Stok kodu · SKU" name="sku" required maxLength={180}/><Field label="Malzeme adı" name="name" required maxLength={180}/><label className="text-xs">Malzeme türü<select className="rf-input mt-2 w-full" name="itemType"><option value="raw_material">Hammadde / profil</option><option value="consumable">Sarf malzeme</option><option value="finished_good">Mamul</option></select></label><label className="text-xs">Stok birimi<select className="rf-input mt-2 w-full" value={unit} onChange={e=>setUnit(e.target.value)}>{STOCK_UNITS.map(u=><option key={u} value={u}>{u==='m'?'Metre · fiziksel profil':UNIT_LABELS[u]}</option>)}</select></label><Field label="Profil kodu (ör. 108)" name="profileCode" maxLength={40}/><Field label="Ölçü (ör. 40x60)" name="sizeLabel" maxLength={40}/><Field label="Minimum stok seviyesi" name="minStock" required type="number" min={0} max={1000000} step={COUNT_UNITS.has(unit)?1:'any'} defaultValue={0}/>{unit!=='m' && <Field label="Parça boyu · mm (ör. 4500; yoksa boş)" name="pieceLength" type="number" min={1} max={30000} step={1}/>}<div className="text-xs sm:col-span-2"><p className="mb-1">İşlenmiş hâl (her hâl ayrı kalem)</p><div className="flex flex-wrap gap-3">{PROCESSED_STATES.map(s=><label key={s} className="flex items-center gap-1"><input type="checkbox" name="processedStates" value={s}/> {STATE_LABELS[s]}</label>)}</div></div>{unit==='m' && <><Field label="Standart profil boyu · mm" name="length" required type="number" min={100} max={30000} step={1} defaultValue={6000}/><Field label="Doğrulanmış profil ağırlığı · kg/m" name="weight" required type="number" min="0.000001" step="any"/></>}</fieldset>
    <p className="text-xs text-muted-foreground">Kalem = profil kodu + ölçü + işlenmiş hâl; profilin rengi ve boyu her çubukta tutulur. Kart oluşturmak stok girişi yapmaz. Gerçek malzeme girişi, depo ve fiziksel profil boyuyla mal kabul ekranından kaydedilir.</p>
    <div className="flex justify-end gap-2"><Link className="rf-secondary-button" href="/inventory">Vazgeç</Link><button type="submit" className="rf-primary-button" disabled={!allowed || busy}>{busy?'Kaydediliyor…':'Malzemeyi kaydet'}</button></div>
  </form>;
}
