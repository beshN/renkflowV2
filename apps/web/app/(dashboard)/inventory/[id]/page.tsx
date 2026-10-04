import Link from 'next/link';
import { notFound } from 'next/navigation';
import { z } from 'zod';
import { sql } from '@/lib/db';
import { requireWorkOrderActor } from '@/lib/features/work-orders/security';
import { hasPermission } from '@/lib/auth/permissions';
export default async function Page({params}:{params:Promise<{id:string}>}){
  const {id}=await params;if(!z.string().uuid().safeParse(id).success)notFound();
  const actor=await requireWorkOrderActor();if(!hasPermission(actor.role,'inventory.view'))return <main className="rf-page"><p role="alert">Malzeme erişim yetkiniz yok.</p></main>;
  const [items,balances,lots]=await Promise.all([
    sql`SELECT id,name,sku,stock_uom,item_type,min_stock,active,standard_length_m,weight_per_meter_kg FROM inventory_items WHERE tenant_id=${actor.tenantId} AND id=${id}`,
    sql`SELECT b.*,w.name FROM stock_balances b JOIN warehouses w ON w.id=b.warehouse_id AND w.tenant_id=b.tenant_id WHERE b.tenant_id=${actor.tenantId} AND b.item_id=${id} ORDER BY w.name`,
    sql`SELECT l.id,l.lot_number,l.remaining_qty,l.status,l.metadata->>'color' AS color,w.name AS warehouse_name FROM stock_lots l JOIN warehouses w ON w.id=l.warehouse_id AND w.tenant_id=l.tenant_id WHERE l.tenant_id=${actor.tenantId} AND l.item_id=${id} ORDER BY l.created_at DESC LIMIT 100`,
  ]);
  const item=items[0];if(!item)notFound();const amount=(n:unknown)=>Number(n || 0).toLocaleString('tr-TR',{maximumFractionDigits:4});
  return <main className="rf-page space-y-5"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="rf-eyebrow">MALZEME · {item.sku}</p><h1 className="rf-page-title">{item.name}</h1><p className="mt-2 text-xs text-muted-foreground">{item.active?'Aktif':'Pasif'} · Stok birimi: {item.stock_uom} · Minimum stok: {amount(item.min_stock)}</p></div><Link className="rf-secondary-button" href="/inventory">Stok listesine dön</Link></div>
    {item.stock_uom==='m' && <div className="rf-panel p-4 text-sm">Standart fiziksel boy: {amount(Number(item.standard_length_m)*1000)} mm · Profil ağırlığı: {amount(item.weight_per_meter_kg)} kg/m</div>}
    <div className="rf-panel p-4"><h2 className="font-semibold">Depo bakiyeleri</h2>{!balances.length?<p className="mt-3 text-sm text-muted-foreground">Henüz stok girişi yapılmadı.</p>:<div className="mt-3 grid gap-3 sm:grid-cols-3">{balances.map((b: {warehouse_id:string;name:string;on_hand_qty:string})=><div key={b.warehouse_id} className="rounded border border-border p-3"><p className="text-xs text-muted-foreground">{b.name}</p><p className="mt-2 text-lg font-semibold">{amount(b.on_hand_qty)} {item.stock_uom}</p></div>)}</div>}</div>
    <div className="rf-panel overflow-hidden"><h2 className="border-b border-border p-4 font-semibold">Fiziksel lot geçmişi · son 100 kayıt</h2>{!lots.length?<p className="p-4 text-sm text-muted-foreground">Fiziksel lot kaydı yok.</p>:<div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead><tr>{['Lot','Depo / renk','Kalan boy','Durum'].map(h=><th key={h} className="p-3 text-xs text-muted-foreground">{h}</th>)}</tr></thead><tbody>{lots.map((l: {id:string;lot_number:string;warehouse_name:string;color:string;remaining_qty:string;status:string})=><tr key={l.id} className="border-t border-border"><td className="p-3">{l.lot_number}</td><td className="p-3">{l.warehouse_name} · {l.color || 'Renksiz'}</td><td className="p-3 whitespace-nowrap">{amount(Number(l.remaining_qty)*1000)} mm</td><td className="p-3">{l.status==='available'?'Kullanılabilir':l.status==='reserved'?'Rezerve':'Tüketildi'}</td></tr>)}</tbody></table></div>}</div><Link className="rf-secondary-button" href="/inventory/movements">Stok hareketlerini aç</Link>
  </main>;
}
