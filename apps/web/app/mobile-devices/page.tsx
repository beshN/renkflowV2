import Link from 'next/link';
import { deviceOwner } from './identity';
import { revokeDevice } from './actions';
import { RevokeButton } from './RevokeButton';
import { mobileDevices } from '@/lib/features/mobile/sessions';
import { WorkOrderApiError } from '@/lib/features/work-orders/security';
import { PageHeader } from '@/components/kit';

export const dynamic='force-dynamic';
const date=(value:string)=>new Intl.DateTimeFormat('tr-TR',{dateStyle:'medium',timeStyle:'short',timeZone:'Europe/Istanbul'}).format(new Date(value));

export default async function MobileDevicesPage() {
  const owner=await deviceOwner();
  let data:Awaited<ReturnType<typeof mobileDevices>>;
  try { data=await mobileDevices(owner.userId,owner.tenantId,{includeExpiry:true}); }
  catch(error) {
    if(!(error instanceof WorkOrderApiError) || error.status!==503) throw error;
    return <main className="rf-page mx-auto max-w-3xl py-8"><p role="alert" className="rf-panel">Mobil cihaz bilgileri şu anda alınamıyor. Biraz sonra tekrar deneyin.</p><Link href="/account" className="rf-secondary-button mt-4 inline-flex">Hesabıma dön</Link></main>;
  }
  return <main className="rf-page mx-auto max-w-3xl space-y-5 py-8">
    <Link href="/account" className="text-sm text-muted-foreground underline underline-offset-4">Hesabıma dön</Link>
    <PageHeader eyebrow="Hesabım" title="Mobil cihazlarım" hint="Bir cihazın oturumunu kapattığınızda erişimi kesilir. Bekleyen saha kayıtları o cihazda korunur; göndermek için yeniden giriş gerekir." />
    {data.devices.length===0 ? <p className="rf-panel text-sm text-muted-foreground">Henüz mobil oturum açılmamış.</p> : <ul className="space-y-3">{data.devices.map(device=>{
      const expired=Boolean(device.expiresAt && new Date(device.expiresAt).getTime()<=Date.now());
      const closed=device.revoked || expired;
      return <li key={device.id} className="rf-panel flex flex-wrap items-center justify-between gap-4">
        <div><h2 className="font-semibold">{device.platform==='ios' ? 'iPhone / iPad' : 'Android'}</h2><p className="mt-1 text-xs text-muted-foreground">Son etkinlik: {date(device.lastSeenAt)}</p><p className="mt-1 text-sm">{device.revoked ? 'Oturum kapatıldı' : expired ? 'Oturumun süresi doldu' : 'Etkin oturum'}</p></div>
        {closed ? null : <form action={revokeDevice}><input type="hidden" name="id" value={device.id}/><RevokeButton /></form>}
      </li>;
    })}</ul>}
  </main>;
}
