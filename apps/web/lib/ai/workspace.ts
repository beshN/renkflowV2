import 'server-only';
import { sql } from '@/lib/db';
import type { WorkOrderActor } from '@/lib/features/work-orders/security';
import { hasPermission,canAccessRoute } from '@/lib/features/auth/permissions';
import {qualityAnalytics} from '@/lib/features/manufacturing/quality.service';
import {productionAnalytics} from '@/lib/features/manufacturing/analytics.service';
import { createHash } from 'node:crypto';
import { unitLabel } from '@/lib/features/inventory/vocabulary';
export type AssistantInsight = { id: string; priority: 'high'|'medium'|'info'; title: string; detail: string; href: string; action: string };
export function assistantArea(path: string) {
 if (/warehouse|inventory|scrap/.test(path)) return 'stock';
 if (/production|factory|work-orders|kanban/.test(path)) return 'production';
 if (/finance|accounting/.test(path)) return 'finance';
 if (/purchases|receipts|suppliers/.test(path)) return 'purchasing';
 if (/quotations|new-order/.test(path)) return 'sales';
 return 'overview';
}
export function buildInsights(data: Record<string, any>, path: string): AssistantInsight[] {
 const all: AssistantInsight[] = [];
 const add=(id:string, priority:AssistantInsight['priority'], title:string, detail:string, href:string, action:string)=>all.push({id,priority,title,detail,href,action});
 const n=(v:unknown)=>Number(v || 0);
 const metrics=data.metrics?.[0] || {};
 if(n(metrics.overdue)>0) add('overdue','high',`${metrics.overdue} sipariş teslim tarihini geçti`,'Teslim planını ve üretimde bekleyen aşamaları birlikte kontrol edin.','/orders?status=in_production','Siparişleri incele');
 const blocked=(data.operations || []).filter((o:any)=>o.status==='blocked');
 if(blocked.length) add('blocked','high',`${blocked.length} üretim aşaması engelli`,'Gerekçeleri inceleyip malzeme veya kalite sorununu çözün.','/factory','İşleri aç');
 for(const center of data.productionAnalytics?.centers || [])if(center.bottleneck)add('bottleneck-'+center.code,'high',`${center.name} darboğazı`,`${center.reason}. ${center.queueLength} iş sırada; ${Math.round(center.workloadMinutes)} dk kalan yük. ${center.recommendedAction}`,'/production?tab=overview','Darboğazı incele');
 const late=(data.productionAnalytics?.predictions || []).filter((p:any)=>p.delayMinutes>0);if(late.length)add('forecast-delay','high',`${late.length} siparişte gecikme riski`,'Deterministik çizelge kapasite ve operasyon bağımlılıklarına göre gecikme gösteriyor.','/production?tab=planning','Çizelgeyi incele');
 const critical=(data.stock || []).filter((s:any)=>n(s.min_stock)>0 && n(s.available_qty)<n(s.min_stock));
 if(critical.length) add('critical','high',`${critical.length} malzeme minimum stok altında`,critical.slice(0,3).map((s:any)=>`${s.name}: ${n(s.available_qty).toLocaleString('tr-TR',{maximumFractionDigits:3})} ${unitLabel(s.stock_uom)} (en az ${n(s.min_stock).toLocaleString('tr-TR',{maximumFractionDigits:3})})`).join(' · '),'/inventory','Stoğu incele');
 if(n(data.counts?.[0]?.pending)>0) add('counts','medium',`${data.counts[0].pending} sayım onay bekliyor`,'Sayım miktarı henüz stoğa işlenmedi. Kaynak rafı doğrulayarak karar verin.','/warehouse','Sayımları incele');
 if(n(data.locations?.[0]?.unplaced)>0) add('unplaced','medium',`${data.locations[0].unplaced} stok kaydı raf bekliyor`,'Yerleştirme bekleyen malzemeleri hedef rafı okutarak taşıyın.','/warehouse/scan?mode=transfer','Rafa yerleştir');
 if(n(metrics.ready)>0) add('ready','medium',`${metrics.ready} sipariş sevkiyata hazır`,'Paketleme ve teslim miktarını doğruladıktan sonra sevkiyat kaydını oluşturun.','/shipments','Sevkiyatı aç');
 if((data.notifications || []).some((r:any)=>['failed','uncertain'].includes(r.status))) add('notices','medium','Müşteri bildirimleri kontrol bekliyor','Başarısız veya sonucu belirsiz gönderimleri teslimat geçmişinden inceleyin.','/production?tab=communication','Bildirimleri incele');
 if(data.recipes && !data.recipes.some((r:any)=>r.status==='published')) add('recipe','info','İlk üretim reçetenizi doğrulayın','Makaslı tente malzeme ve operasyon kurallarını yayınlayarak deterministik BOM akışını başlatın.','/production?tab=recipes','Reçeteleri aç');
 if(data.warehouses && !data.warehouses.length) add('warehouse-setup','info','Fabrikanızın depo yapısını kurun','Hammadde, üretim ve mamul depolarını tanımlayın; ardından raf etiketlerini hazırlayın.','/production?tab=stock','Depoları kur');
 if(data.unavailable?.length) add('data-unavailable','info','Bazı kayıtlar şu anda alınamadı','Eksik veriyle kesin sonuç çıkarmıyorum. İlgili ekranı yenileyip yeniden kontrol edebilirsiniz.',data.worker?'/factory':'/orders','Kayıtları incele');
 if(!all.length) add('clear','info','Açık bir operasyon uyarısı görünmüyor','Son kayıtları kontrol ettim. Yeni bir iş için ilgili modülden ilerleyebilirsiniz.',data.worker?'/factory':'/orders','Çalışma alanını aç');
 const area=assistantArea(path), score=(i:AssistantInsight)=>({high:0,medium:10,info:20}[i.priority] - ((area==='stock'&&['critical','counts','unplaced','warehouse-setup'].includes(i.id))||(area==='production'&&['blocked','recipe'].includes(i.id))?5:0));
 return all.sort((a,b)=>score(a)-score(b)).slice(0,5);
}
export async function assistantSnapshot(a:WorkOrderActor,path:string,query='') {
 const t=a.tenantId, worker=a.role==='worker', member=a.role==='member';
 const data:Record<string,any>={worker, role:a.role, generatedAt:new Date().toISOString(), scope:'Mevcut firma; listeler en fazla 40 kayıt. Sayılar sorgu kapsamı için hesaplanır.', unavailable:[]};
 const tasks:Record<string,Promise<any>>={};
 tasks.jobs=sql`SELECT w.id,w.title,w.status,w.planned_qty,w.produced_qty,w.due_at FROM work_orders w WHERE w.tenant_id=${t} AND (${!worker} OR w.assigned_to=${a.userId} OR EXISTS(SELECT 1 FROM production_operations p WHERE p.tenant_id=${t} AND p.work_order_id=w.id AND p.assigned_to=${a.userId})) ORDER BY w.due_at NULLS LAST,w.created_at DESC LIMIT 40`;
 tasks.operations=sql`SELECT p.id,p.work_order_id,p.name,p.status,p.planned_qty,p.completed_qty,p.active_seconds,p.version,p.reason FROM production_operations p JOIN work_orders w ON w.id=p.work_order_id AND w.tenant_id=p.tenant_id WHERE p.tenant_id=${t} AND p.status NOT IN ('done','cancelled') AND (${!worker} OR p.assigned_to=${a.userId} OR w.assigned_to=${a.userId}) ORDER BY p.ready_at NULLS LAST,p.position LIMIT 40`;
 if(!worker) {
  const search=query.trim().slice(0,160), pattern='%'+search+'%';
  tasks.orders=sql`SELECT id,order_number,customer_name,product_name,status,priority,delivery_date,shipment_status FROM orders WHERE tenant_id=${t} AND (${!search} OR order_number ILIKE ${pattern} OR customer_name ILIKE ${pattern} OR product_name ILIKE ${pattern}) ORDER BY created_at DESC LIMIT 40`;
  tasks.metrics=sql`SELECT COUNT(*) AS total, COUNT(*)FILTER(WHERE delivery_date < (now() AT TIME ZONE 'Europe/Istanbul')::date AND status NOT IN('completed','cancelled','delivered','shipped'))AS overdue, COUNT(*)FILTER(WHERE status IN('ready','ready_for_shipment'))AS ready FROM orders WHERE tenant_id=${t}`;
 }
 if(!worker && !member) {
  tasks.stock=sql`SELECT i.id,i.sku,i.name,i.stock_uom,i.min_stock,COALESCE(b.qty,0) AS on_hand_qty,COALESCE(r.qty,0) AS reserved_qty,COALESCE(b.qty,0)-COALESCE(r.qty,0) AS available_qty FROM inventory_items i LEFT JOIN LATERAL(SELECT SUM(on_hand_qty)AS qty FROM stock_balances WHERE tenant_id=${t} AND item_id=i.id)b ON true LEFT JOIN LATERAL(SELECT SUM(l.reserved_qty-l.consumed_qty-l.released_qty)AS qty FROM stock_reservation_lines l JOIN stock_reservations h ON h.id=l.reservation_id AND h.tenant_id=l.tenant_id WHERE l.tenant_id=${t} AND l.item_id=i.id AND h.status='active')r ON true WHERE i.tenant_id=${t} AND i.active ORDER BY (COALESCE(b.qty,0)-COALESCE(r.qty,0)<i.min_stock)DESC,i.name LIMIT 40`;
  tasks.purchases=sql`SELECT p.id,p.purchase_order_number,p.status,p.expected_at,s.name AS supplier_name FROM purchase_orders p LEFT JOIN suppliers s ON s.id=p.supplier_id AND s.tenant_id=p.tenant_id WHERE p.tenant_id=${t} ORDER BY p.created_at DESC LIMIT 40`;
  tasks.locations=sql`SELECT COUNT(*) AS unplaced FROM warehouse_location_balances b JOIN warehouse_locations l ON l.id=b.location_id AND l.tenant_id=b.tenant_id WHERE b.tenant_id=${t} AND b.quantity>0 AND l.location_type='unassigned'`;
  tasks.warehouses=sql`SELECT id,code,name,warehouse_type FROM warehouses WHERE tenant_id=${t} AND active LIMIT 40`;
 }
 if(['owner','admin','office'].includes(a.role)) {
  if(assistantArea(path)==='production' || assistantArea(path)==='overview')tasks.productionAnalytics=productionAnalytics(a).then(({algorithm:_algorithm,...summary})=>({...summary,predictions:summary.predictions.slice(0,40)}));
  if(assistantArea(path)==='production' || assistantArea(path)==='overview')tasks.qualityAnalytics=qualityAnalytics(a);
  tasks.recipes=sql`SELECT id,code,name,version,status FROM production_recipes WHERE tenant_id=${t} ORDER BY version DESC LIMIT 40`;
  tasks.notifications=sql`SELECT status,COUNT(*)AS count FROM notification_outbox WHERE tenant_id=${t} GROUP BY status`;
 }
 if(['owner','admin'].includes(a.role)) tasks.counts=sql`SELECT COUNT(*)FILTER(WHERE status='pending') AS pending FROM warehouse_counts WHERE tenant_id=${t}`;
 if(hasPermission(a.role,'finance.view')) {
  tasks.financialOrders=sql`SELECT currency,COUNT(*) AS order_count,SUM(total_amount) AS ordered_value FROM orders WHERE tenant_id=${t} AND created_at >= (date_trunc('month',now() AT TIME ZONE 'Europe/Istanbul') AT TIME ZONE 'Europe/Istanbul') AND status<>'cancelled' GROUP BY currency`;
  tasks.payments=sql`SELECT currency,COUNT(*) AS payment_count,SUM(amount)AS collected FROM payments WHERE tenant_id=${t} AND paid_at >= (date_trunc('month',now() AT TIME ZONE 'Europe/Istanbul') AT TIME ZONE 'Europe/Istanbul') GROUP BY currency`;
 }
 const keys=Object.keys(tasks), results=await Promise.allSettled(Object.values(tasks));
 results.forEach((r,i)=>{if(r.status==='fulfilled') data[keys[i]]=r.value;else { data.unavailable.push(keys[i]); console.error('[Assistant data]',keys[i],r.reason?.code || 'unavailable'); }});
 const orderId=path.match(/^\/orders\/([0-9a-f-]{36})(?:\/|$)/i)?.[1];
 if(orderId && !worker) {
  const [order]=await sql`SELECT id,order_number,customer_name,product_name,status,delivery_date FROM orders WHERE tenant_id=${t} AND id=${orderId}`;
  if(order) {data.currentOrder=order; data.orderItems=await sql`SELECT product_name,quantity,width_mm,height_mm,projection_mm,mounting_height_mm FROM order_items WHERE order_id=${orderId} LIMIT 40`;}
 }
 const insights=buildInsights(data,path).filter(i=>canAccessRoute(a.role,new URL(i.href,'https://internal.invalid').pathname)), fingerprint=createHash('sha256').update(JSON.stringify({insights,role:a.role,path,orders:data.metrics,operations:data.operations})).digest('hex').slice(0,20);
 return {data,insights,fingerprint};
}
export async function searchAssistant(a:WorkOrderActor,category:string,query:string) {
 const q='%'+query.trim().slice(0,120).replace(/[%_]/g,'')+'%',t=a.tenantId;
 if(category==='jobs')return sql`SELECT w.id,w.title,w.status,w.planned_qty,w.produced_qty,w.due_at FROM work_orders w WHERE w.tenant_id=${t} AND w.title ILIKE ${q} AND (${a.role!=='worker'} OR w.assigned_to=${a.userId} OR EXISTS(SELECT 1 FROM production_operations p WHERE p.tenant_id=${t} AND p.work_order_id=w.id AND p.assigned_to=${a.userId})) LIMIT 20`;
 if(a.role==='worker')return {scope:'Atanmış üretim işlerinde arama kullanılabilir.'};
 if(category==='orders')return sql`SELECT id,order_number,customer_name,product_name,status,delivery_date FROM orders WHERE tenant_id=${t} AND (order_number ILIKE ${q} OR customer_name ILIKE ${q} OR product_name ILIKE ${q}) ORDER BY created_at DESC LIMIT 20`;
 if(category==='customers' && hasPermission(a.role,'customers.view'))return sql`SELECT id,full_name,company_name FROM customers WHERE tenant_id=${t} AND (full_name ILIKE ${q} OR company_name ILIKE ${q}) LIMIT 20`;
 if(category==='materials' && ['owner','admin','office','accountant'].includes(a.role))return sql`SELECT i.id,i.sku,i.name,i.stock_uom,i.min_stock,COALESCE(SUM(b.on_hand_qty),0)AS on_hand_qty FROM inventory_items i LEFT JOIN stock_balances b ON b.item_id=i.id AND b.tenant_id=i.tenant_id WHERE i.tenant_id=${t} AND i.active AND (i.name ILIKE ${q} OR i.sku ILIKE ${q}) GROUP BY i.id ORDER BY i.name LIMIT 20`;
 return {scope:'Bu kayıt türü mevcut çalışma kapsamında değil; uygun ekranı açabilirsiniz.'};
}
