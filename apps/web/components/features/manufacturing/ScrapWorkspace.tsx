'use client';
import { useCallback,useEffect,useState } from 'react';
import { useSession } from 'next-auth/react';
import Link from 'next/link';
import { RefreshCw,Scissors,Printer } from 'lucide-react';
import { RFListView } from '@/components/shared/views/RFListView';
import { requestJson } from '@/lib/shared/network';
type Lot={id:string;lot_number:string;status:string;remaining_qty:string;metadata:{color?:string;unitCost?:number};name:string;sku:string;weight_per_meter_kg:string;warehouse_name:string};
type Loss={id:string;lot_number:string;name:string;plan_id:string;weight_kg:string;cost:string;created_at:string;length_mm:string};
type Data={lots:Lot[];losses:Loss[];totals:{weight_kg:string;cost:string;loss_count:string}};
const amount=(n:unknown)=>Number(n || 0).toLocaleString('tr-TR',{maximumFractionDigits:3});
const money=(n:unknown)=>Number(n || 0).toLocaleString('tr-TR',{style:'currency',currency:'TRY'});
export default function ScrapWorkspace(){
  const {data:session}=useSession(),scope=(session?.user?.tenantId || '')+':'+(session?.user?.id || '');
  const canOpenProduction=['owner','admin','office'].includes(session?.user?.role || '');
  const [data,setData]=useState<Data|null>(null),[loading,setLoading]=useState(true),[error,setError]=useState(''),[revision,setRevision]=useState(0);
  const reload=useCallback(()=>setRevision(v=>v+1),[]);
  useEffect(()=>{
    const ac=new AbortController();setLoading(true);setError('');setData(null);
    void requestJson<{data:Data}>('/api/v1/inventory/remnants',{signal:ac.signal,cache:'no-store'},{timeoutMs:15000}).then(result=>{
      if(ac.signal.aborted)return;
      if(result.ok && result.data){setData(result.data.data);}else setError(result.error || 'Kayıtlar alınamadı.');setLoading(false);
    });return()=>ac.abort();
  },[scope,revision]);
  const available=(data?.lots || []).filter(l=>l.status==='available');
  return <main className="rf-page space-y-5"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="rf-eyebrow">MALZEME VERİMLİLİĞİ</p><h1 className="rf-page-title">Hurda ve kullanılabilir artıklar</h1><p className="mt-2 text-xs text-muted-foreground">Gerçek kesimden kalan fiziksel lotlar, hurda ağırlığı ve kayıp maliyeti.</p></div><div className="flex gap-2"><button disabled={loading} aria-label="Hurda kayıtlarını yenile" className="rf-icon-button" onClick={reload}><RefreshCw size={16}/></button>{canOpenProduction && <Link className="rf-primary-button" href="/production?tab=cutting"><Scissors size={15}/>Toplu kesim</Link>}</div></div>
    <div className="grid grid-cols-2 gap-3 md:grid-cols-4">{[['Kesim hurdası · toplam',amount(data?.totals.weight_kg)+' kg'],['Kesim kaybı maliyeti',money(data?.totals.cost)],['Listelenen kullanılabilir artık',amount(available.reduce((s,l)=>s+Number(l.remaining_qty),0))+' m'],['Artık lotu · listelenen',amount(available.length)]].map(([label,value])=><div key={label} className="rf-panel p-4"><p className="text-xs text-muted-foreground">{label}</p><p className="mt-2 text-xl font-semibold">{loading?'—':value}</p></div>)}</div>
    <div className="rf-panel p-4 text-xs leading-6 text-muted-foreground">Kullanılabilir artıklar tekrar kesime girebilir. Rezerve lotlar başka kesime ayrılamaz. Hurda kg ve maliyetleri gerçekleşen kesimden hesaplanır; iade veya hurda satış kaydı değildir.</div>
    <RFListView<Lot> title="Fiziksel artık lotları" description="En son 500 lot; mevcut kalan metre ve durum" data={data?.lots || []} isLoading={loading} error={error || undefined} onRetry={reload} columns={[
      {key:'lot_number',label:'Lot / profil',render:(_,l)=><div><p className="font-medium">{l.lot_number}</p><p className="mt-1 text-xs text-muted-foreground">{l.name} · {l.metadata?.color || 'Renksiz'}</p></div>},
      {key:'remaining_qty',label:'Kalan boy',render:v=>amount(Number(v)*1000)+' mm'},
      {key:'status',label:'Durum',render:v=>v==='available'?'Kullanılabilir':v==='reserved'?'Rezerve':'Tüketildi'},
      {key:'warehouse_name',label:'Depo'},
      {key:'id',label:'Etiket',render:(_,l)=>canOpenProduction?<Link className="rf-secondary-button" href={'/warehouse/labels?kind=lot&id='+l.id}><Printer size={14}/>QR / barkod</Link>:<span className="text-xs text-muted-foreground">{l.lot_number}</span>},
    ]} emptyState={{title:'Henüz kullanılabilir artık yok',description:'Onaylı kesim gerçekleştikçe fiziksel artık lotları burada görünür.'}}/>
    <RFListView<Loss> title="Gerçekleşen kesim hurdası" description="En son 300 kayıt; üstteki kg ve maliyet tüm kesim kayıtlarının toplamıdır." data={data?.losses || []} isLoading={loading} error={error || undefined} onRetry={reload} columns={[
      {key:'name',label:'Profil',render:(_,l)=><div>{l.name}<p className="mt-1 text-xs text-muted-foreground">{l.lot_number}</p></div>},
      {key:'length_mm',label:'Kayıp boy',render:v=>amount(v)+' mm'},
      {key:'weight_kg',label:'Hurda',render:v=>amount(v)+' kg'},
      {key:'cost',label:'Maliyet',render:v=>money(v)},
      {key:'created_at',label:'Tarih',render:v=>new Date(v).toLocaleString('tr-TR')},
      {key:'plan_id',label:'Kaynak',render:(_,l)=>canOpenProduction?<Link href={'/production?tab=cutting&cut='+l.plan_id} className="text-sky-700 underline">Kesim planını aç</Link>:<span className="text-xs text-muted-foreground">{l.plan_id.slice(0,8)}</span>},
    ]} emptyState={{title:'Henüz kesim hurdası yok',description:'Ölçülmüş artık ve gerçekleşen kesim kayıpları kullanılır.'}}/>
  </main>;
}
