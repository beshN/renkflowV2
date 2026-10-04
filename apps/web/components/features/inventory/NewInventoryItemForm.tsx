'use client';
import { useRef,useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/lib/context/AuthContext';
import { requestJson } from '@/lib/shared/network';
import { BusinessField as Field } from '@/components/shared/ui/BusinessDialog';
export function NewInventoryItemForm(){
  const {user}=useAuth(),router=useRouter(),allowed=!!user && ['owner','admin'].includes(user.role);
  const [unit,setUnit]=useState('adet'),[busy,setBusy]=useState(false),[error,setError]=useState('');
  const key=useRef<{hash:string;id:string}|null>(null),lock=useRef(false);
  return <form className="rf-panel space-y-5 p-5" onSubmit={async e=>{
    e.preventDefault();if(!allowed || lock.current)return;lock.current=true;setBusy(true);setError('');
    const f=new FormData(e.currentTarget),data={sku:f.get('sku'),name:f.get('name'),itemType:f.get('itemType'),uom:unit,minStock:Number(f.get('minStock')),standardLengthMm:unit==='m'?Number(f.get('length')):0,weightPerMeterKg:unit==='m'?Number(f.get('weight')):0};
    const hash=JSON.stringify(data);if(key.current?.hash!==hash)key.current={hash,id:crypto.randomUUID()};
    const result=await requestJson<{data:{id:string}}>('/api/v1/production',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({commandId:key.current.id,action:'material.save',data})});
    lock.current=false;setBusy(false);if(result.ok && result.data)router.push('/inventory/'+result.data.data.id);else setError(result.error || 'Malzeme kaydedilemedi');
  }}>
    {!allowed && <p role="alert" className="text-sm text-amber-700">Malzeme kartını firma yöneticisi oluşturabilir.</p>}{error && <p role="alert" className="text-sm text-red-700">{error}</p>}
    <fieldset disabled={!allowed || busy} className="grid gap-4 sm:grid-cols-2"><Field label="Stok kodu · SKU" name="sku" required maxLength={180}/><Field label="Malzeme adı" name="name" required maxLength={180}/><label className="text-xs">Malzeme türü<select className="rf-input mt-2 w-full" name="itemType"><option value="raw_material">Hammadde / profil</option><option value="consumable">Sarf malzeme</option><option value="finished_good">Mamul</option></select></label><label className="text-xs">Stok birimi<select className="rf-input mt-2 w-full" value={unit} onChange={e=>setUnit(e.target.value)}><option value="adet">Adet</option><option value="m">Metre · fiziksel profil</option><option value="m2">Metrekare</option><option value="kg">Kilogram</option></select></label><Field label="Minimum stok seviyesi" name="minStock" required type="number" min={0} max={1000000} step="any" defaultValue={0}/>{unit==='m' && <><Field label="Standart profil boyu · mm" name="length" required type="number" min={100} max={30000} step={1} defaultValue={6000}/><Field label="Doğrulanmış profil ağırlığı · kg/m" name="weight" required type="number" min="0.000001" step="any"/></>}</fieldset>
    <p className="text-xs text-muted-foreground">Kart oluşturmak stok girişi yapmaz. Gerçek malzeme girişi, depo ve fiziksel profil boyuyla mal kabul ekranından kaydedilir.</p>
    <div className="flex justify-end gap-2"><Link className="rf-secondary-button" href="/inventory">Vazgeç</Link><button type="submit" className="rf-primary-button" disabled={!allowed || busy}>{busy?'Kaydediliyor…':'Malzemeyi kaydet'}</button></div>
  </form>;
}
