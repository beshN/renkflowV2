'use client';
import { useEffect,useState } from 'react';
import { useSession } from 'next-auth/react';
import Link from 'next/link';
import { listAllDocuments } from '@/app/actions/finance.documents.actions';
import { type OrderDocument,DOCUMENT_TYPE_LABELS } from '@/lib/types/finance';
import { RFListView } from '@/components/shared/views/RFListView';
type Document=OrderDocument & {orderNumber?:string;customerName?:string};
export default function DocumentArchive(){
  const {data:session}=useSession(),scope=(session?.user?.tenantId || '')+':'+(session?.user?.id || '');
  const [rows,setRows]=useState<Document[]>([]),[loading,setLoading]=useState(true),[error,setError]=useState(''),[revision,setRevision]=useState(0);
  useEffect(()=>{let active=true;setRows([]);setLoading(true);setError('');void listAllDocuments({limit:500}).then(data=>{if(active)setRows(data);}).catch(()=>{if(active)setError('Belge arşivi alınamadı. Erişim yetkinizi ve bağlantıyı kontrol edin.');}).finally(()=>{if(active)setLoading(false);});return()=>{active=false;};},[scope,revision]);
  return <main className="rf-page space-y-5"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="rf-eyebrow">FİNANS BELGELERİ</p><h1 className="rf-page-title">Belge arşivi</h1><p className="mt-2 text-xs text-muted-foreground">Fatura, irsaliye ve sözleşmeleri bağlı sipariş üzerinden açın.</p></div><Link className="rf-secondary-button" href="/finance">Finansa dön</Link></div><RFListView<Document> title="Sipariş belgeleri" description="En son 500 belge; yükleme ve belge yönetimi sipariş detayından yapılır." data={rows} isLoading={loading} error={error || undefined} onRetry={()=>setRevision(v=>v+1)} columns={[
    {key:'fileName',label:'Belge',render:(_,d)=>/^(https?:\/\/|\/api\/)/.test(d.fileUrl)?<a className="text-sky-700 underline" href={d.fileUrl} target="_blank" rel="noopener noreferrer">{d.fileName}</a>:<span>{d.fileName} · dosya bağlantısı geçersiz</span>},
    {key:'type',label:'Tür',render:v=>DOCUMENT_TYPE_LABELS[v as keyof typeof DOCUMENT_TYPE_LABELS]},
    {key:'orderNumber',label:'Sipariş',render:(_,d)=><Link className="text-sky-700 underline" href={'/orders/'+d.orderId}>{d.orderNumber || 'Siparişi aç'}</Link>},
    {key:'customerName',label:'Müşteri'},
    {key:'uploadedAt',label:'Yükleme',render:v=>new Date(v).toLocaleString('tr-TR')},
  ]} emptyState={{title:'Henüz finans belgesi yok',description:'Sipariş detayından fatura, makbuz veya sözleşme ekleyin.'}}/></main>;
}
