# RLS / tenant izolasyonu incelemesi

Taban: `cae494f5` (`main`). Production, Neon ve Vercel sorgulanmadı; aşağıdaki katalog sonuçları yalnız geçici, loopback `renkflow_test` içindir. Production rolü, migration geçmişi ve mevcut veri tutarlılığı **doğrulanmadı**.

## Bulgular

Dosya yolları `apps/web/` altındadır; satırlar bu PR sonrasına aittir.

| Dosya:satır | Risk | Kanıt / sınır | Önerilen düzeltme |
|---|---|---|---|
| `lib/features/orders/postgres/order.postgres.ts:104`, `:177` | Orta | Önceki join yalnız `order_id` kontrol ediyordu. DB'nin kabul ettiği B tenant belgesi → A siparişi ilişkisiyle gerçek servis çağrısında A'ya B'nin belge metadatası döndü; yeni test düzeltme öncesi başarısız, sonrası başarılı. Bu tutarsız ilişkinin HTTP üzerinden oluşturulabilmesi **doğrulanmadı**. | **Bu PR:** her iki join'de `d.tenant_id = o.tenant_id`. Composite tenant FK ayrı çalışma olarak değerlendirilmeli. |
| `lib/export/service.ts:140` | Düşük (ölü kod) | `generateOrderReportPDF` için uygulamada çağıran bulunmadı. Aynı tenant filtresiz belge join deseni ve `json_agg(d.*)` file_path dahil gereksiz alanları okuyordu; mevcut PDF üreticisi belge alanlarını kullanmıyor. Bu yoldan dışarı belge verisi çıktığı **doğrulanmadı**. | **Bu PR:** gereksiz belge join/aggregate tamamen kaldırıldı; yalnız PDF'nin kullandığı 8 sipariş kolonu seçiliyor. Ölü kod, aynı desen, düzeltildi. |
| `lib/features/finance/invoices.server.ts:399,407`; `lib/features/finance/receivables.server.ts:25,27,85`; `lib/features/accounting/posting.server.ts:132` | Orta | Fatura/ödeme tenant filtreliydi fakat bağlı sipariş yalnız id ile eşleşiyordu. DB'nin kabul ettiği A faturası/ödemesi → B siparişi ilişkisiyle gerçek `receivables` çağrısı B müşteri kimliğini döndürdü; yeni test düzeltme öncesi başarısız. Bu tutarsız ilişkinin HTTP üzerinden oluşturulabilmesi **doğrulanmadı**. Muhasebe join'inin yabancı sipariş numarasını taşıyabildiği koddan görüldü; o yolun tutarsız veriyle uçtan uca davranışı ayrıca **doğrulanmadı**. | **Bu PR:** altı join'e `o.tenant_id = i.tenant_id` veya `p.tenant_id` eklendi. Test iki yönde cari liste/ekstre, iptal edilen fatura ve fatura liste/detay okumalarını pozitif kendi-tenant kontrolleriyle sınar. |
| `lib/db/migrations/010_work_orders.sql:6`, `012_native_manufacturing.sql:49`, `014_production_platform.sql:129`; aşağıdaki envanter | Yüksek (eksik DB savunması) | Uygulanan yerel şemada tenant kolonu olan 163 tablonun 158'inde RLS kapalı ve politika yok. Teklif, iş emri, stok ve sevkiyat bunlara dahil. Bu tek başına uzaktan istismar kanıtı değildir; servis filtreleri hâlâ uygulanıyor. | Ayrı PR: non-owner/NOBYPASSRLS uygulama rolü, doğrulanmış transaction-local tenant bağlamı ve additive/idempotent politikalar; worker/global işler ayrı tasarlanmalı. Bu PR toplu RLS açmaz. |
| `lib/db/schema.sql:7`, `:145`; `lib/db/index.ts:106`, `:158`; `scripts/ensure-backend-schema.ts:213`; `lib/db/migrations/003_enterprise_features.sql:45` | Orta | Temel `auth.uid()` NULL döndüren stub; temel politikalar bu fonksiyona bağlı. Eski enterprise politikaları `app.current_tenant_id` okuyor; uygulama DB katmanında bunu kuran çağrı yok. Backend bootstrap finance migration'ının RLS bölümünü kesiyor, enterprise migration'ı listede değil. Yerel 5 tenant tablosunda RLS açık ama FORCE kapalı. Owner/superuser bypass mümkün; production bağlantısının owner/BYPASSRLS olup olmadığı **doğrulanmadı**. | Kimlik kaynağı ve rol sözleşmesini birlikte düzelt; shared pool üzerinde session-wide SET kullanma. Production rolü/izinlerini bu inceleme kapsamı dışında yetkili ortamda doğrula. |
| `lib/features/orders/postgres/order.postgres.ts:153` | Düşük | Tenant filtresiz ilk lookup yabancı UUID için TenantMismatchError, olmayan UUID için null döndürüyor. Sonraki veri sorgusu tenant filtreli; içerik sızıntısı gösterilmedi. API'nin 403/404 sözleşmesi mevcut güvenlik testlerinde bilinçli korunuyor. | Ayrı karar: kaynak varlığını gizlemek istenirse tenant filtreli tek lookup + ortak 404 ve sözleşme testlerini güncelle. |
| `lib/db/migrations/003_enterprise_features.sql:195`, `:364` | Düşük | Legacy `document_comments` ve `report_executions` için ENABLE var, karşılık gelen CREATE POLICY yok. Bu migration standart backend listesinde değil; yerel aktif şemada bu tablolar yok. Production'da uygulanması **doğrulanmadı**. Politikasız RLS normal rolü deny-all yapar, izolasyon sızıntısı kanıtı değildir. | Legacy migration'ı doğrudan yeniden çalıştırma; kullanım varsa ayrı additive/idempotent politika migration'ı ve rol testleri. |

## Tenant kolonu olmayan bağlı veri

- `order_items` (`lib/db/schema.sql:106`): tenant sipariş üzerinden miras alınır; RLS SELECT/INSERT politikaları parent sipariş + üyelik üzerinden (`:293`, `:304`). Servis önce tenant kontrollü siparişi yükler, sonra kalemleri okur. Tenant kolonu olmaması tek başına açık değildir.
- `journal_entry_lines` (`lib/db/migrations/007_accounting_journal_tables.sql:30`): parent `journal_entries` ve `accounts` üzerinden tenant taşır; RLS yok. `lib/features/accounting/posting.server.ts:153,185` parent işlem bağlamıyla okuyor. Cross-tenant account ilişkisinin tüm yazma yollarında engellenmesi **doğrulanmadı**; composite FK önerilir.
- `notification_attempts` (`lib/db/migrations/014_production_platform.sql:147`): tenant outbox üzerinden miras alınır; RLS yok. `notification.service.ts:138,145` worker'ın seçtiği outbox kaydına yazar; tüm tenant'ları alan kuyruk worker sorguları kullanıcıya açık listeleme olarak değerlendirilmedi.
- `mobile_refresh_tokens` (`lib/features/mobile/migrations/004_sessions.sql:16`): tenant session üzerinden miras alınır; RLS yok. Mobil kapsamı değiştirilmedi; mobil uçtan uca izolasyonu **doğrulanmadı**.

## Sunucu erişimi taraması

`app/actions`, `app/api`, `lib` SQL erişimleri ve tenant guard baseline tarandı. Session/üyelik kaynağı: `lib/features/auth/serverAuth.ts:71`, `work-orders/security.ts:70`; client tenant seçimi doğrudan güvenilir sayılmıyor (`app/api/tenant/update/route.ts:27`, `invite/route.ts:43`).

İncelenen girişler: `app/actions/order.actions.ts:42`, `app/api/v1/quotations/[id]/route.ts`, `app/api/v1/production/route.ts:38`, `app/api/v1/reports/operations/route.ts:8`, `app/api/export/route.ts:29`, `lib/export/service.ts:64,104,148,177,358,463`, `lib/features/account/export.server.ts`, `app/api/ai/document-extract/route.ts:44`, `app/api/v1/production/intake/route.ts:15`, `lib/features/manufacturing/intake.service.ts:81,88,106`, `lib/ai/commands`, `lib/features/knowledge/service.server.ts:61`. İncelenen HTTP girişlerinde tenant session actor/context'ten geliyor; export PDF ölü kodunda ve finans sipariş join'lerinde yukarıdaki eksikler ayrıca düzeltildi; intake insan incelemesi şartı korunuyor. Bearer public quote/tracking linkleri ve sistem kuyrukları session tenant sorguları değildir. Tüm olası çalışma zamanı yollarının eksiksiz güvenliği iddia edilmiyor; tutarsız bağlı veri üzerinden gösterilen sızıntılar yukarıda ayrı kaydedildi; bunların HTTP üzerinden oluşturulma yolları doğrulanmadı.

Uygulama ortak `postgres` DATABASE_URL havuzunu kullanıyor; ayrı bir Supabase service-role client tespit edilmedi. DB rolünün yetkileri koddan çıkarılamaz. RLS testi geçti iddiası yok: integration test gerçek servislerdeki **uygulama tenant filtrelerini** test DB'nin bootstrap rolüyle sınar; non-owner RLS davranışı ve HTTP auth zinciri bu testin kapsamı dışındadır.

## Tekrarlanabilir doğrulama

`apps/web` içinde `npm run test:tenant-isolation` veya `npm run test:integration -- tenant-isolation finance tenant-export`. Runner uzak DATABASE_URL kabul etmez; geçici cluster + boş port seçer, script URL'yi loopback `renkflow_test` ile değiştirir ve hem fixture bağlantısında hem gerçek servis havuzunda current_database doğrular. Runner bitince cluster silinir. İki tenant fixture'ı yalnız test verisidir; KPI değildir.

Yeni test iki yönde sipariş/teklif, iş emri, stok/malzeme ve sevkiyat okuma/yazma engelini, pozitif kendi-tenant okumalarını ve reddedilen yazmalardan sonra yabancı kayıtların değişmediğini kontrol eder. Ek olarak DB'nin kabul ettiği tutarsız belge sahipliğini ve fatura/ödeme → yabancı sipariş ilişkisini kapsar. Yabancı sevkiyat teslim komutu artık “Sevkiyat bulunamadı” döndürür; sürüm/durum uyuşmazlığı mesajından ayrıdır. Migration eklenmedi.

## Düzeltme commit’i kontrol sonuçları

- `npm run type-check`: geçti.
- `npm run lint`: geçti; değişmeyen dosyalarda aynı 3 uyarı var.
- İlgili Jest testleri: finance-engine, ledger-chart, tenant-export-plan, tenant-export-stream ve einvoice; **5/5 süit, 64/64 test geçti**. Tam Jest paketi bu commit için tekrar çalıştırılmadı; önceki commit'in eksik xmllint sonucu aşağıda korunuyor.
- `npm run test:integration -- tenant-isolation finance tenant-export`: **3/3 geçti**, yalnız geçici yerel `renkflow_test` üzerinde. Yeni finans regresyonu düzeltme öncesinde yabancı müşteri UUID'siyle başarısız, sonrasında başarılı.
- `npm run build`: geçti; loopback test DB URL override, standalone PDF postbuild kontrolleri dahil. Production'a erişilmedi.
- Son script sürümünde `npm run test:tenant-isolation`: **1/1 geçti**; PDF pozitif çıktı ve yabancı sipariş erişiminin reddi de doğrulandı.
- Opsiyonel küçük iyileştirmeler: servis havuzunda `current_database()` kontrolü; olmayan/yabancı sevkiyat için 404 “Sevkiyat bulunamadı”; `test:tenant-isolation` npm komutu.

## İlk commit kontrol sonuçları

- `npm run type-check`: geçti.
- `npm run lint`: geçti; değişmeyen dosyalarda 3 kullanılmayan eslint-disable uyarısı var.
- `npm test -- --runInBand`: 223/224 süit, 1666/1673 test geçti. `__tests__/lib/einvoice-xsd.test.ts` içindeki 7 test ortamda `xmllint` bulunmadığından (`spawnSync xmllint ENOENT`) başarısız. İlk sandbox denemesinde Next/Jest TypeScript config alt süreci hata verdi; normal yerel süreç izinleriyle alınan sonuç burada yazılıdır.
- `npm run build`: geçti (normal yerel süreç izinleriyle, loopback test DB URL override; production DB kullanılmadı). Standalone PDF worker/extraction postbuild kontrolü de geçti. İlk sandbox build'i derleme aşamasında ilerlemedi ve durduruldu.
- `npm run guard:tenant-scope`: geçti. Ek `guard:tenant-scope-sql`: mevcut 5 SSO sorgusu nedeniyle başarısız (`app/api/auth/sso/callback/route.ts:36`, `lib/features/auth/sso.ts:192,225,447,490`). Bu dosyalar değiştirilmedi; state/provider tabanlı giriş akışları için filtresiz sorgu bulmak tek başına tenant sızıntısı kanıtı değil. SSO uçtan uca izolasyonu **doğrulanmadı**; baseline'a körlemesine istisna eklenmedi.
- `npm run test:integration -- tenant-isolation tenant-export sales chain stock-depth production-depth records`: **7/7 geçti**, tamamı geçici yerel `renkflow_test` üzerinde.
- Yeni test düzeltme öncesi `foreign-document` metadatasını döndürerek başarısız oldu; düzeltme sonrası iki tenant ve export testleri geçti. Son script sürümünün katalog + iki-tenant çalışması da geçti.

## Yerel tenant tablo envanteri

Katalog sorgusu yeni integration script'inde `RLS_INVENTORY` olarak yazılır. `tenant_id` veya `organization_id` taşıyan public tabloların tamamı aşağıdadır. FORCE RLS hepsinde kapalı. Organization kolonu taşıyan ayrı tablo tespit edilmedi.

| Tablo | RLS | Politika sayısı | Kimlik kaynağı |
|---|---|---|---|
| `customers` | Açık | 3 | auth.uid() → tenant_members; yerel stub NULL |
| `documents` | Açık | 3 | auth.uid() → tenant_members; yerel stub NULL |
| `invitations` | Açık | 2 | auth.uid() → tenant_members; yerel stub NULL |
| `orders` | Açık | 4 | auth.uid() → tenant_members; yerel stub NULL |
| `tenant_members` | Açık | 3 | auth.uid() → tenant_members; yerel stub NULL |

Aşağıdaki **158 tablonun her birinde RLS kapalı, politika sayısı 0**, dolayısıyla DB politika kimlik kaynağı yok:

- `access_roles`, `accounting_budgets`, `accounting_period_closes`, `accounts`, `activity_logs`
- `ai_call_reservations`, `ai_feedback_examples`, `ai_settings`, `ai_suggestions`, `ai_usage`
- `bank_reconciliation_periods`, `bank_statement_lines`, `bom_items`, `boms`, `company_address_claims`
- `company_addresses`, `customer_price_rules`, `customer_tracking_links`, `cutting_losses`, `cutting_plan_sources`
- `cutting_plans`, `data_subject_requests`, `document_extractions`, `employee_attendance`, `employee_ledger_entries`
- `employees`, `expenses`, `factory_labels`, `firm_colors`, `fixed_assets`
- `fleet_settings`, `goods_receipt_lines`, `goods_receipts`, `inbound_messages`, `installations`
- `intake_drafts`, `inventory_item_stocks`, `inventory_items`, `invoice_lines`, `invoice_number_series`
- `invoices`, `journal_entries`, `knowledge_categories`, `knowledge_documents`, `knowledge_revisions`
- `lead_quotation_links`, `lead_research_runs`, `lead_research_sources`, `leads`, `manufacturing_preferences`
- `material_request_lines`, `material_requests`, `mobile_push_devices`, `mobile_receipts`, `mobile_sessions`
- `mobile_upload_chunks`, `mobile_uploads`, `notification_outbox`, `notifications`, `office_files`
- `office_tasks`, `onboarding_sessions`, `onboarding_steps`, `order_change_requests`, `order_deliveries`
- `order_documents`, `order_payment_plans`, `order_qr_tokens`, `order_technical_revisions`, `order_transition_commands`
- `payments`, `personnel_attendance_settings`, `price_matrices`, `product_drilling_rules`, `product_family_recipes`
- `production_commands`, `production_delays`, `production_events`, `production_files`, `production_operations`
- `production_parts`, `production_reason_codes`, `production_recipes`, `production_resources`, `production_rework`
- `production_runs`, `production_schedules`, `production_scrap_events`, `production_shipments`, `production_units`
- `purchase_order_lines`, `purchase_orders`, `purchase_rfq_lines`, `purchase_rfq_responses`, `purchase_rfqs`
- `quality_inspections`, `quotation_approval_links`, `quotation_items`, `quotation_revisions`, `quotation_templates`
- `quotations`, `quote_settings`, `receiving_documents`, `receiving_inspections`, `record_activities`
- `record_attachments`, `record_checklist_items`, `record_comments`, `record_followers`, `record_meta`
- `record_rule_runs`, `record_rules`, `record_tag_links`, `record_tags`, `scrap_records`
- `service_settings`, `service_tickets`, `shipment_items`, `shipments`, `site_surveys`
- `station_checklist_checks`, `station_devices`, `stock_balances`, `stock_count_documents`, `stock_count_lines`
- `stock_entries`, `stock_entry_lines`, `stock_lots`, `stock_movements`, `stock_reservation_lines`
- `stock_reservations`, `storage_cleanup_queue`, `suppliers`, `support_tickets`, `tax_transactions`
- `technical_material_decisions`, `user_sessions`, `vehicle_assignments`, `vehicle_devices`, `vehicle_documents`
- `vehicle_fuel`, `vehicle_maintenance`, `vehicle_positions`, `vehicles`, `warehouse_counts`
- `warehouse_location_balances`, `warehouse_location_moves`, `warehouse_locations`, `warehouses`, `work_centers`
- `work_order_checklist_items`, `work_order_comments`, `work_order_events`, `work_order_material_lots`, `work_order_materials`
- `work_orders`, `workspace_view_commands`, `workspace_views`
