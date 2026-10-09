import Link from 'next/link';
import {deviceOwner} from './identity';
import {revokeDevice} from './actions';
import {mobileDevices} from '@/lib/features/mobile/sessions';
export const dynamic='force-dynamic';
export default async function MobileDevicesPage() {
 const owner=await deviceOwner(),{devices}=await mobileDevices(owner.userId,owner.tenantId);
 return <main className="min-h-screen bg-background px-6 py-12 text-foreground"><div className="mx-auto max-w-3xl space-y-8">
  <Link href="/dashboard" className="text-sm underline underline-offset-4">Panele dön</Link>
  <div><p className="mb-2 text-xs uppercase tracking-widest text-muted-foreground">RenkFlow Saha</p><h1 className="text-3xl font-semibold">Mobil cihazlarınız</h1><p className="mt-3 text-muted-foreground">Bir cihazın oturumunu kapattığınızda erişimi hemen kesilir. Bekleyen saha kayıtları o cihazda korunur; göndermek için yeniden giriş gerekir.</p></div>
  {devices.length===0?<p className="rounded-xl border p-6">Henüz mobil oturum açılmamış.</p>:<ul className="space-y-3">{devices.map((device:{id:string;platform:string;lastSeenAt:string;revoked:boolean})=><li key={device.id} className="flex flex-wrap items-center justify-between gap-4 rounded-xl border bg-card p-6">
   <div><h2 className="font-semibold">{device.platform==='ios'?'iPhone / iPad':'Android'}</h2><p className="mt-1 text-sm text-muted-foreground">Son giriş: {new Intl.DateTimeFormat('tr-TR',{dateStyle:'medium',timeStyle:'short',timeZone:'Europe/Istanbul'}).format(new Date(device.lastSeenAt))}</p><p className="mt-1 text-sm">{device.revoked?'Oturum kapatıldı':'Etkin oturum'}</p></div>
   {!device.revoked&&<form action={revokeDevice}><input type="hidden" name="id" value={device.id}/><button className="min-h-12 rounded-lg border px-4 font-medium hover:bg-muted" type="submit">Oturumu kapat</button></form>}
  </li>)}</ul>}
 </div></main>;
}
