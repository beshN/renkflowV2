/** Isolated, real API browser test. Run test:production and build first. */
const { chromium } = require("playwright");
const { spawn } = require("node:child_process");
const fs = require("fs");
const assert = require("assert/strict");
const postgres = require("postgres");
const fixture = JSON.parse(
  fs.readFileSync(".data/production-test-fixture.json"),
);
const origin = "http://127.0.0.1:3001";
let server;
let browser;
let db;
let debugPage;
(async () => {
  try {
    await fetch(origin + "/api/health", { signal: AbortSignal.timeout(1000) });
    throw new Error("Port 3001 is in use; stop the test server first");
  } catch (e) {
    if (e.message.includes("in use")) throw e;
  }
  const log = fs.openSync(".data/production-browser-server.log", "w", 0o600);
  server = spawn(
    process.execPath,
    [
      require.resolve("next/dist/bin/next"),
      "start",
      "--hostname",
      "127.0.0.1",
      "--port",
      "3001",
    ],
    {
      env: {
        ...process.env,
        DATABASE_URL:
          "postgres://postgres:renkflow-local-only@127.0.0.1:55432/renkflow_test",
        AUTH_SECRET: "integration-test-secret-local-only-1234567890",
        NEXTAUTH_SECRET: "integration-test-secret-local-only-1234567890",
        AUTH_URL: origin,
        NEXTAUTH_URL: origin,
        ALLOW_INSECURE_HTTP: "1",
        ALLOW_LOCAL_DATABASE: "1",
        NATIVE_INVENTORY_ENABLED: "1",
        OPENAI_API_KEY: "",
        RESEND_API_KEY: "",
        WHATSAPP_ACCESS_TOKEN: "",
      },
      stdio: ["ignore", log, log],
    },
  );
  let ready = false;
  for (let i = 0; i < 60; i++) {
    if (server.exitCode !== null)
      throw new Error(
        "Test server failed; inspect .data/production-browser-server.log",
      );
    try {
      if (
        (
          await fetch(origin + "/api/health", {
            signal: AbortSignal.timeout(1000),
          })
        ).ok
      ) {
        ready = true;
        break;
      }
    } catch {}
    await new Promise((r) => setTimeout(r, 500));
  }
  if (!ready) throw Error("Test server startup timeout");
  db = postgres(
    "postgres://postgres:renkflow-local-only@127.0.0.1:55432/renkflow_test",
  );
  browser = await chromium.launch({
    headless: true,
    executablePath:
      process.env.CHROME_EXECUTABLE ||
      "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  });
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
  });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("http://127.0.0.1:3001/auth/login?callbackUrl=%2Ffactory");
  await page.getByLabel("E-posta adresi").fill(fixture.workerEmail);
  await page.locator('input[name="password"]').fill(fixture.password);
  await page
    .getByRole("button", { name: "Çalışma alanına gir", exact: true })
    .click();
  await page
    .getByRole("heading", { name: "Usta ekranı", exact: true })
    .waitFor({ timeout: 45000 });
  await page.getByRole("button", { name: /Kesim/ }).waitFor({ timeout: 20000 });
  assert.equal(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
    true,
  );
  const privateResponse = await context.request.get(
    origin + "/api/v1/production",
  );
  const privateData = (await privateResponse.json()).data;
  assert.equal(privateData.jobs.length, 1);
  assert.equal(privateData.notifications, undefined);
  await page.getByLabel("Etiket veya barkod kodu").fill(fixture.jobId);
  await page.getByRole("button", { name: "Kaydı bul", exact: true }).click();
  await page.getByRole("button", { name: /Kesim/ }).click();
  await page.getByRole("button", { name: "Başlat", exact: true }).click();
  await page.getByRole("button", { name: "Duraklat", exact: true }).waitFor();
  await context.setOffline(true);
  await page.getByLabel("İş notu / sorun açıklaması").fill("Offline test note");
  await page.getByRole("button", { name: "Duraklat", exact: true }).click();
  await page.getByText("Cihazda sırada", { exact: false }).waitFor();
  assert.equal(
    (
      await db`SELECT status FROM production_operations WHERE work_order_id=${fixture.jobId} AND position=0`
    )[0].status,
    "running",
  );
  await context.setOffline(false);
  await page
    .getByRole("button", { name: "Başlat", exact: true })
    .waitFor({ timeout: 30000 });
  assert.equal(
    (
      await db`SELECT status FROM production_operations WHERE work_order_id=${fixture.jobId} AND position=0`
    )[0].status,
    "paused",
  );
  await page.getByRole("button", { name: "Başlat", exact: true }).click();
  await page.getByRole("button", { name: "Duraklat", exact: true }).waitFor();
  await context.setOffline(true);
  await page.waitForTimeout(200);
  const focusSessionRequests=[];
  const captureOfflineSession=request=>{if(request.url().endsWith('/api/auth/session'))focusSessionRequests.push(request.url());};
  page.on('request',captureOfflineSession);
  await page.evaluate(()=>document.dispatchEvent(new Event('visibilitychange')));
  await page.waitForTimeout(200);
  assert.equal(focusSessionRequests.length,0,'offline visibility must not attempt session refresh');
  page.off('request',captureOfflineSession);
  await page.getByRole('heading',{name:'Usta ekranı',exact:true}).waitFor();
  const adminContext = await browser.newContext();
  const adminPage = await adminContext.newPage();debugPage=adminPage;
  await adminPage.goto(origin + "/auth/login?callbackUrl=%2Ffactory");
  await adminPage.getByLabel("E-posta adresi").fill(fixture.ownerEmail);
  await adminPage.locator("input[name=password]").fill(fixture.password);
  await adminPage
    .getByRole("button", { name: "Çalışma alanına gir", exact: true })
    .click();
  await adminPage
    .getByRole("heading", { name: "Usta ekranı", exact: true })
    .waitFor();
  const [running] =
    await db`SELECT id,version FROM production_operations WHERE work_order_id=${fixture.jobId} AND position=0`;
  const paused = await adminContext.request.post(
    origin + "/api/v1/production",
    {
      data: {
        commandId: require("node:crypto").randomUUID(),
        action: "operation",
        data: {
          operationId: running.id,
          version: running.version,
          action: "pause",
        },
      },
      headers: { Origin: origin },
    },
  );
  assert.equal(paused.status(), 200);
  await page
    .getByRole("button", { name: "1 adet tamamlandı", exact: true })
    .click();
  await page.getByText("Cihazda sırada", { exact: false }).waitFor();
  await context.setOffline(false);
  await page
    .getByText("Çakışma:", { exact: false })
    .waitFor({ timeout: 30000 });
  assert.equal(
    Number(
      (
        await db`SELECT completed_qty FROM production_operations WHERE work_order_id=${fixture.jobId} AND position=0`
      )[0].completed_qty,
    ),
    0,
  );
  await page.screenshot({
    path: "/tmp/renkflow-worker-offline.png",
    fullPage: true,
  });
  await page
    .getByRole("button", {
      name: "Güncel kaydı kullan · bekleyen talebi kaldır",
      exact: true,
    })
    .click();
  await page.getByRole("button", { name: "Başlat", exact: true }).waitFor();
  for (const name of ["Kesim", "Delme", "Montaj", "Kalite", "Paketleme"]) {
    await page
      .getByRole("button", { name: new RegExp("\\d " + name + " ") })
      .click();
    await page.getByRole("button", { name: "Başlat", exact: true }).click();
    if(name==='Kalite') {
      await page.getByLabel('Visual inspection',{exact:true}).selectOption('fail');
      await page.getByLabel('Measured width',{exact:true}).fill('2990');
      await page.getByRole('button',{name:'1 adet tamamlandı',exact:true}).click();
      await page.getByRole('button',{name:'Başlat',exact:true}).waitFor();
      const [qc]=await db`SELECT * FROM production_operations WHERE work_order_id=${fixture.jobId} AND position=3`;
      assert.equal(qc.status,'blocked');
      assert.equal(Number(qc.completed_qty),0);
      await page.getByText('İmalatta sorun çıktı · yeniden işlem',{exact:true}).click();
      await page.getByLabel('İş notu / sorun açıklaması').fill('Browser quality defect needs rework');
      await page.getByLabel(/^Sorun türü/).selectOption('quality');
      await page.getByLabel(/^Geri dönülecek aşama/).selectOption(qc.id);
      await page.getByLabel('Kök neden adayı · isteğe bağlı',{exact:true}).fill('Fixture alignment suspect');
      await page.getByRole('button',{name:'Gerekçeyle rework başlat',exact:true}).click();
      await page.getByRole('heading',{name:'Yeniden işlem vakaları ve çözüm kaydı',exact:true}).waitFor();

      await page.getByRole('button',{name:'Başlat',exact:true}).click();
      await page.getByRole('button',{name:'Duraklat',exact:true}).waitFor();
      await page.getByLabel('Visual inspection',{exact:true}).selectOption('pass');
      await page.getByLabel('Measured width',{exact:true}).fill('2990');
    }
    await page
      .getByRole("button", { name: "1 adet tamamlandı", exact: true })
      .click();
    await page
      .getByRole("button", { name: "1 adet tamamlandı", exact: true })
      .waitFor({ state: "hidden" });
  }
  assert.equal(
    (await db`SELECT status FROM work_orders WHERE id=${fixture.jobId}`)[0]
      .status,
    "done",
  );

  const [browserRework]=await db`SELECT * FROM production_rework WHERE work_order_id=${fixture.jobId} AND status='open'`;
  assert.ok(browserRework);assert.ok(browserRework.inspection_id);
  const casePanel=page.getByRole('heading',{name:'Yeniden işlem vakaları ve çözüm kaydı',exact:true}).locator('..');
  await casePanel.locator('summary').first().click();
  await casePanel.getByLabel(/^Kök neden açıklaması/).fill('Fixture alignment verified');
  await casePanel.getByLabel(/^Kök neden değerlendirmesi/).selectOption('confirmed');
  await casePanel.getByLabel('Uygulanan çözüm',{exact:true}).fill('Adjusted fixture and repeated inspection');
  await context.setOffline(true);
  await casePanel.getByRole('button',{name:'Çözümü kaydet ve vakayı kapat',exact:true}).click();
  await casePanel.getByRole('button',{name:'Sunucu onayı bekliyor',exact:true}).waitFor();
  assert.equal((await db`SELECT status FROM production_rework WHERE id=${browserRework.id}`)[0].status,'open');
  await context.setOffline(false);
  await page.getByText('Çözüm: Adjusted fixture and repeated inspection',{exact:true}).waitFor({timeout:30000});
  const [resolved]=await db`SELECT * FROM production_rework WHERE id=${browserRework.id}`;
  assert.equal(resolved.status,'resolved');assert.equal(resolved.root_cause_status,'confirmed');assert.equal(resolved.labor_method,'operation_attempt_events');
  console.log('PASS · failed quality to real rework, source inspection linkage, tablet resolution queued offline and closed after server acceptance');
  adminPage.on('pageerror',e=>errors.push(e.message));
  await adminPage.goto(origin+'/production?tab=recipes');
  await adminPage.getByRole('button',{name:'Yeni sürüm hazırla',exact:true}).first().click();
  await adminPage.getByLabel('Reçete adı',{exact:true}).fill('Browser validated recipe version');
  await adminPage.getByRole('button',{name:'Parametre ekle',exact:true}).click();
  await adminPage.getByLabel('Formül parametresi',{exact:true}).last().fill('fixtureSpacing');
  await adminPage.getByLabel('Parametre adı',{exact:true}).last().fill('Fixture spacing');
  await adminPage.getByLabel('Birim',{exact:true}).last().fill('mm');
  await adminPage.getByLabel('Alt sınır',{exact:true}).last().fill('50');
  await adminPage.getByLabel('Üst sınır',{exact:true}).last().fill('500');
  await adminPage.getByLabel(/^Fixture spacing ·/).nth(0).fill('100');
  await adminPage.getByLabel(/^Fixture spacing ·/).nth(1).fill('150');
  await adminPage.getByRole('button',{name:'Hesap sonucunu incele',exact:true}).first().click();
  await adminPage.getByText('Hesaplanan BOM',{exact:true}).waitFor();
  await adminPage.getByRole('button',{name:'Reçete taslağını kaydet',exact:true}).click();
  await adminPage.getByRole('button',{name:'Reçete taslağını kaydet',exact:true}).waitFor({state:'hidden'});
  const recipeCard=adminPage.locator('article').filter({hasText:'Browser validated recipe version'});
  await recipeCard.getByRole('button',{name:'Örnekleri doğrula ve yayınla',exact:true}).click();
  await recipeCard.getByRole('button',{name:'Yeni sürüm hazırla',exact:true}).waitFor();
  const [publishedBrowser]=await db`SELECT * FROM production_recipes WHERE tenant_id=${fixture.tenantId} AND name='Browser validated recipe version'`;
  assert.equal(publishedBrowser.status,'published');assert.ok(publishedBrowser.parameter_definitions.some(p=>p.key==='fixtureSpacing'));
  const [originalJob]=await db`SELECT bom_snapshot FROM work_orders WHERE id=${fixture.jobId}`;
  assert.equal(originalJob.bom_snapshot.recipeVersion,1);
  await adminPage.goto(origin+'/production?tab=planning');
  await adminPage.getByRole('button',{name:'Kaynak ekle',exact:true}).click();
  await adminPage.getByLabel('Kaynak kodu',{exact:true}).fill('BROWSER-MACHINE');
  await adminPage.getByLabel('Ad',{exact:true}).fill('Browser machine');
  await adminPage.getByRole('group',{name:'Uygun iş merkezleri · makine için zorunlu',exact:true}).getByLabel('Kesim',{exact:true}).check();
  await adminPage.getByRole('button',{name:'Duruş ekle',exact:true}).click();
  await adminPage.getByRole('button',{name:'Duruşu kaldır',exact:true}).click();
  await adminPage.getByRole('button',{name:'Takvimi kaydet',exact:true}).click();
  await adminPage.getByRole('button',{name:'Browser machine · makine',exact:true}).waitFor();
  assert.equal((await db`SELECT * FROM production_resources WHERE tenant_id=${fixture.tenantId} AND code='BROWSER-MACHINE'`).length,1);
  await adminPage.getByLabel('Plan başlangıcı · İstanbul',{exact:true}).fill('2026-10-05T08:00');
  await adminPage.getByRole('button',{name:'Çizelge öner',exact:true}).click();
  await adminPage.getByRole('button',{name:'Çizelgeyi yayınla',exact:true}).first().click();
  await adminPage.waitForTimeout(500);
  assert.ok((await db`SELECT id FROM production_schedules WHERE tenant_id=${fixture.tenantId} AND status='published'`).length);
  console.log('PASS · recipe version UI/custom parameters/examples/publish, historical snapshot preservation; machine calendar UI and manager scheduling proposal/publish');
  await adminPage.goto(origin+'/suppliers');
  await adminPage.getByRole('button',{name:'Yeni tedarikçi',exact:true}).click();
  await adminPage.getByLabel('Tedarikçi adı',{exact:true}).fill('BROWSER synthetic supplier');
  await adminPage.getByLabel('Vade (gün)',{exact:true}).fill('0');
  await adminPage.getByRole('button',{name:'Kaydet',exact:true}).click();
  await adminPage.getByRole('dialog').waitFor({state:'hidden'});
  await adminPage.getByRole('navigation',{name:'Tedarik bölümleri'}).getByRole('link',{name:'Satın alma',exact:true}).click();
  await adminPage.getByRole('button',{name:'Yeni satın alma',exact:true}).click();
  await adminPage.getByLabel('Tedarikçi',{exact:true}).selectOption({label:'BROWSER synthetic supplier'});
  await adminPage.getByLabel('Malzeme',{exact:true}).selectOption({label:'TEST profile · m'});
  await adminPage.getByLabel('Hammadde deposu',{exact:true}).selectOption({label:'RAW'});
  await adminPage.getByLabel('Çubuk adedi',{exact:true}).fill('2');
  await adminPage.getByLabel('Birim fiyat · TRY/m',{exact:true}).fill('50');
  await adminPage.getByLabel('Profil rengi',{exact:true}).fill('black');
  await adminPage.getByRole('button',{name:'Taslağı oluştur',exact:true}).click();
  await adminPage.getByRole('dialog').waitFor({state:'hidden'});
  const row=adminPage.getByRole('row').filter({hasText:'BROWSER synthetic supplier'});
  await row.getByRole('button',{name:'Onayla',exact:true}).click();
  await row.getByRole('button',{name:'Teslim al',exact:true}).click();
  await adminPage.getByLabel(/Kabul · çubuk adedi/).fill('1');
  await adminPage.getByRole('button',{name:'Mal kabulü kaydet',exact:true}).click();
  await adminPage.getByRole('dialog').waitFor({state:'hidden'});
  await row.getByText('Kısmi kabul',{exact:true}).waitFor();
  const [browserPO]=await db`SELECT po.* FROM purchase_orders po JOIN suppliers s ON s.id=po.supplier_id WHERE po.tenant_id=${fixture.tenantId} AND s.name='BROWSER synthetic supplier'`;
  assert.equal(browserPO.status,'partially_received');
  const [browserLine]=await db`SELECT * FROM purchase_order_lines WHERE purchase_order_id=${browserPO.id}`;
  assert.equal(Number(browserLine.received_qty),6);
  const [browserReceipt]=await db`SELECT * FROM goods_receipts WHERE purchase_order_id=${browserPO.id}`;
  assert.equal((await db`SELECT * FROM stock_lots WHERE metadata->>'goodsReceiptId'=${browserReceipt.id}`).length,1);
  await adminPage.getByRole('navigation',{name:'Tedarik bölümleri'}).getByRole('link',{name:'Mal kabul',exact:true}).click();
  await adminPage.getByRole('button',{name:'Ters kayıtla düzelt',exact:true}).first().click();
  await adminPage.getByLabel('Düzeltme gerekçesi',{exact:true}).fill('Synthetic browser correction');
  await adminPage.getByRole('button',{name:'Ters kayıt oluştur',exact:true}).click();
  await adminPage.getByRole('dialog').waitFor({state:'hidden'});
  assert.equal((await db`SELECT status FROM goods_receipts WHERE id=${browserReceipt.id}`)[0].status,'reversed');
  assert.equal(Number((await db`SELECT received_qty FROM purchase_order_lines WHERE id=${browserLine.id}`)[0].received_qty),0);
  await adminPage.setViewportSize({width:390,height:844});
  await adminPage.waitForFunction(()=>{const r=document.getElementById('workspace-content')?.getBoundingClientRect();return r && Math.abs(r.x)<1 && r.width>=innerWidth-1;});
  await adminPage.screenshot({path:'/tmp/renkflow-procurement-mobile.png',fullPage:true});
  assert.equal(await adminPage.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
  console.log('PASS · purchasing UI: supplier, profile order, approval, partial receipt, physical lot, reversal, mobile layout; quality fail/pass gate');
  await adminPage.setViewportSize({width:1440,height:1000});
  await adminPage.goto(origin+'/inventory/new');
  await adminPage.getByLabel('Stok kodu · SKU',{exact:true}).fill('BROWSER-MATERIAL');
  await adminPage.getByLabel('Malzeme adı',{exact:true}).fill('BROWSER synthetic material');
  await adminPage.getByRole('button',{name:'Malzemeyi kaydet',exact:true}).click();
  await adminPage.waitForURL(/\/inventory\/[0-9a-f-]{36}$/);
  await adminPage.getByText('BROWSER synthetic material',{exact:true}).waitFor();
  const [browserMaterial]=await db`SELECT id FROM inventory_items WHERE tenant_id=${fixture.tenantId} AND sku='BROWSER-MATERIAL'`;
  assert.equal((await db`SELECT * FROM stock_entries e JOIN stock_entry_lines l ON l.stock_entry_id=e.id WHERE l.item_id=${browserMaterial.id}`).length,0);
  await adminPage.goto(origin+'/finance/employees');
  await adminPage.getByRole('button',{name:'Çalışan ekle',exact:true}).click();
  await adminPage.getByLabel('Ad soyad',{exact:true}).fill('BROWSER synthetic employee');
  await adminPage.getByLabel('Görev',{exact:true}).fill('Browser verification');
  await adminPage.getByRole('button',{name:'Kaydet',exact:true}).click();
  await adminPage.getByRole('dialog').waitFor({state:'hidden'});
  await adminPage.getByRole('link',{name:'BROWSER synthetic employee',exact:true}).click();
  await adminPage.getByRole('button',{name:'Hesap hareketi ekle',exact:true}).click();
  await adminPage.getByLabel('Tutar',{exact:true}).fill('1000');
  await adminPage.getByLabel('İşlem tarihi',{exact:true}).fill('2026-10-03');
  await adminPage.getByRole('button',{name:'Kaydet',exact:true}).click();
  await adminPage.getByRole('dialog').waitFor({state:'hidden'});
  const [employee]=await db`SELECT id FROM employees WHERE tenant_id=${fixture.tenantId} AND full_name='BROWSER synthetic employee'`;
  assert.equal((await db`SELECT * FROM employee_ledger_entries WHERE tenant_id=${fixture.tenantId} AND employee_id=${employee.id}`).length,1);
  await adminPage.goto(origin+'/finance/payments');
  await adminPage.getByRole('button',{name:'Tahsilat ekle',exact:true}).click();
  const paymentWorkspace=(await (await adminContext.request.get(origin+'/api/v1/finance/workspace')).json()).data;
  const paymentOrderId=paymentWorkspace.orders.find(o=>Number(o.total_amount)-Number(o.paid_amount)>=25)?.id;assert.ok(paymentOrderId);
  await adminPage.getByLabel('Sipariş',{exact:true}).selectOption(paymentOrderId);
  await adminPage.getByLabel('Ödeme yöntemi',{exact:true}).selectOption('check');
  await adminPage.getByLabel(/^Tutar · /).fill('25');
  await adminPage.getByLabel('Tahsilat zamanı',{exact:true}).fill('2026-10-03T12:00');
  await adminPage.getByLabel('Açıklama',{exact:true}).fill('BROWSER synthetic payment');
  await adminPage.getByRole('button',{name:'Kaydet',exact:true}).click();
  await adminPage.getByRole('dialog').waitFor({state:'hidden'});
  const [payment]=await db`SELECT * FROM payments WHERE tenant_id=${fixture.tenantId} AND note='BROWSER synthetic payment'`;
  assert.equal(Number(payment.amount),25);assert.equal(payment.method,'check');assert.equal(payment.order_id,paymentOrderId);
  assert.equal((await context.request.get(origin+'/api/v1/finance/workspace')).status(),403);
  console.log('PASS · inventory card/detail without fictitious stock; employee/payroll and cheque payment UI, durable records, worker finance denial');
  await adminPage.goto(origin+'/notifications');
  await adminPage.getByRole('heading',{name:'BROWSER verification notice',exact:false}).waitFor();
  assert.equal(await adminPage.getByText('OTHER FIRM notice',{exact:true}).count(),0);
  await adminPage.getByRole('button',{name:'BROWSER verification notice bildirimini okundu işaretle',exact:true}).click();
  await adminPage.getByRole('button',{name:'BROWSER verification notice bildirimini okundu işaretle',exact:true}).waitFor({state:'hidden'});
  const noticeCount=(await (await adminContext.request.get(origin+'/api/notifications')).json()).unreadCount;
  assert.equal(noticeCount,0);
  await adminPage.getByLabel('Yalnız okunmamış bildirimler',{exact:true}).check();
  await adminPage.getByRole('heading',{name:'Okunmamış bildirim yok',exact:true}).waitFor();
  assert.equal((await adminContext.request.post(origin+'/api/v1/inventory/stock-entries',{headers:{Origin:origin},data:{entryType:'MANUFACTURE',idempotencyKey:'browser-unsafe-managed',referenceType:'cutting_plan',referenceId:fixture.jobId,lines:[{itemId:browserMaterial.id,warehouseId:browserLine.warehouse_id,uom:'adet',quantityDelta:5}]}})).status(),409);
  console.log('PASS · notification read/unread controls, same-user company isolation, forged managed stock write denied');
  const failedResponses=[];
  adminPage.on('response',r=>{if(r.url().startsWith(origin) && r.status()>=500)failedResponses.push(r.status()+' '+new URL(r.url()).pathname);});
  const routes=['/dashboard','/orders','/new-order','/production','/factory','/work-orders','/kanban','/shipments','/inventory','/inventory/movements','/scrap','/suppliers','/purchases','/receipts','/finance','/finance/payments','/finance/employees','/finance/documents','/finance/invoice','/accounting','/crm','/quotations','/reports','/team','/settings','/notifications','/search','/cutting-optimizer','/analytics','/members','/dashboard/professional'];
  for(const route of routes){
    const response=await adminPage.goto(origin+route);assert.ok(response.status()<400,route+' failed: '+response.status());
    await adminPage.waitForTimeout(800);
    assert.equal(await adminPage.getByText('Application error: a client-side exception has occurred',{exact:false}).count(),0,route);
  }
  await adminPage.goto(origin+'/accounting');
  await adminPage.getByRole('navigation',{name:'Muhasebe raporları'}).waitFor();
  await adminPage.getByText('Net Kâr',{exact:true}).first().waitFor({timeout:15000});
  for(const label of ['Gelir ve gider','Bilanço','Nakit akışı','Vergi özeti','Dönem ve banka kontrolü']){
    await adminPage.getByRole('navigation',{name:'Muhasebe raporları'}).getByRole('button',{name:label,exact:true}).click();
    await adminPage.waitForTimeout(300);
  }
  assert.deepEqual(failedResponses,[]);
  console.log('PASS · '+routes.length+' authenticated routes and legacy redirects, six accounting views; no server 5xx or uncaught browser exceptions');
  assert.deepEqual(errors, []);
  console.log(
    "PASS · real worker login, mobile layout, offline pause synchronization, concurrent-version conflict retained, conflict discard, complete five operations to finished stock",
  );
  // The general order API and search must enforce the same boundary as the factory workspace.
  const workerOrders=(await (await context.request.get(origin+'/api/v1/orders')).json()).data;
  assert.ok(workerOrders.length>0);
  for(const order of workerOrders){assert.equal(order.financialHidden,true);for(const key of ['totalAmount','currency','email','phone','customFields'])assert.equal(Object.hasOwn(order,key),false);for(const item of order.items || []){assert.equal(Object.hasOwn(item,'unitPrice'),false);assert.equal(Object.hasOwn(item,'totalPrice'),false);}}
  const [workerJob]=await db`SELECT order_id FROM work_orders WHERE id=${fixture.jobId}`;
  assert.ok(workerOrders.every(order=>order.id===workerJob.order_id));
  assert.equal((await context.request.patch(origin+'/api/v1/orders/'+workerJob.order_id,{headers:{Origin:origin},data:{totalAmount:999999}})).status(),403);
  const workerSearch=await (await context.request.get(origin+'/api/v1/search?q=')).json();
  for(const order of workerSearch.data.items)assert.equal(Object.hasOwn(order,'totalAmount'),false);
  assert.equal((await context.request.get(origin+'/api/analytics/orders')).status(),403);
  assert.equal((await context.request.post(origin+'/api/v1/orders/'+workerJob.order_id+'/transition',{headers:{Origin:origin},data:{commandId:require('node:crypto').randomUUID(),version:1,newStatus:'shipped'}})).status(),403);
  assert.equal((await context.request.get(origin+'/api/v1/activity-logs?entityType=order&entityId='+workerJob.order_id)).status(),403);
  assert.equal((await context.request.get(origin+'/api/orders/documents/'+fixture.ownerId+'/content')).status(),403);
  const csrf=(await (await context.request.get(origin+'/api/auth/csrf')).json()).csrfToken;
  const attemptedEscalation=await context.request.post(origin+'/api/auth/session',{headers:{Origin:origin},data:{csrfToken:csrf,data:{user:{id:fixture.ownerId,tenantId:fixture.tenantId,role:'owner',email:fixture.ownerEmail}}}});
  assert.equal(attemptedEscalation.status(),200);
  const stillWorker=await attemptedEscalation.json();
  assert.equal(stillWorker.user.id,fixture.workerId);assert.equal(stillWorker.user.role,'worker');
  assert.equal((await context.request.get(origin+'/api/v1/finance/workspace')).status(),403);
  console.log('PASS · forged session update rejected, assigned order/search privacy, worker commercial writes and analytics blocked');

  await adminPage.goto(origin+'/orders?view=active&q=TEST');
  await adminPage.getByRole('button',{name:'Görünümü kaydet',exact:true}).waitFor();
  await adminPage.getByRole('button',{name:'Görünümü kaydet',exact:true}).click();
  await adminPage.getByLabel('Görünüm adı',{exact:true}).fill('BROWSER kişisel işler');
  await adminPage.getByRole('dialog').getByRole('button',{name:'Kaydet',exact:true}).click();
  await adminPage.getByRole('dialog').waitFor({state:'hidden'});
  const savedId=await adminPage.getByLabel('Kayıtlı görünüm',{exact:true}).inputValue();assert.ok(savedId);
  await adminPage.getByLabel('Sıralama',{exact:true}).selectOption('delivery');
  await adminPage.getByRole('button',{name:'Favoriye ekle',exact:true}).click();
  await adminPage.getByRole('button',{name:'Favoriden çıkar',exact:true}).waitFor();
  assert.equal(new URL(adminPage.url()).searchParams.get('sort'),'delivery','pinning must preserve unsaved filters');
  await adminPage.getByRole('button',{name:'Filtreleri güncelle',exact:true}).click();
  await adminPage.getByText('Kaydedilmemiş filtreler',{exact:true}).waitFor({state:'hidden'});
  await adminPage.getByRole('button',{name:'Yeniden adlandır',exact:true}).click();
  await adminPage.getByLabel('Görünüm adı',{exact:true}).fill('BROWSER termin işleri');
  await adminPage.getByRole('dialog').getByRole('button',{name:'Kaydet',exact:true}).click();
  await adminPage.getByRole('dialog').waitFor({state:'hidden'});
  await adminPage.reload();
  await adminPage.getByRole('button',{name:'Favoriden çıkar',exact:true}).waitFor();
  assert.equal(await adminPage.getByLabel('Kayıtlı görünüm',{exact:true}).inputValue(),savedId);
  const [serverView]=await db`SELECT * FROM workspace_views WHERE id=${savedId}`;
  assert.equal(serverView.name,'BROWSER termin işleri');assert.equal(serverView.filters.sort,'delivery');assert.equal(serverView.pinned,true);
  assert.ok(!(await (await context.request.get(origin+'/api/v1/workspace/views')).json()).data.some(view=>view.id===savedId));
  assert.equal((await context.request.post(origin+'/api/v1/workspace/views',{headers:{Origin:origin},data:{commandId:require('node:crypto').randomUUID(),action:'delete',id:savedId,version:serverView.version}})).status(),404);
  assert.equal((await adminContext.request.post(origin+'/api/v1/workspace/views',{headers:{Origin:'https://example.invalid'},data:{commandId:require('node:crypto').randomUUID(),action:'delete',id:savedId,version:serverView.version}})).status(),403);
  await adminContext.grantPermissions(['clipboard-read','clipboard-write'],{origin});
  await adminPage.getByRole('button',{name:'Bağlantıyı kopyala',exact:true}).click();
  await adminPage.getByText('Filtreli görünüm bağlantısı kopyalandı.',{exact:true}).waitFor();
  const copiedUrl=new URL(await adminPage.evaluate(()=>navigator.clipboard.readText()));
  assert.equal(copiedUrl.searchParams.get('sort'),'delivery');assert.equal(copiedUrl.searchParams.get('q'),'TEST');assert.equal(copiedUrl.searchParams.has('savedView'),false);
  await adminPage.setViewportSize({width:390,height:844});
  await adminPage.waitForFunction(()=>document.querySelector('main')?.getBoundingClientRect().width>350);
  await adminPage.waitForTimeout(300);
  assert.ok(await adminPage.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth+1));
  await adminPage.screenshot({path:'/tmp/renkflow-views-mobile.png',fullPage:true});
  await adminPage.getByRole('button',{name:'Kişisel görünümü sil',exact:true}).click();
  await adminPage.getByRole('dialog').getByRole('button',{name:'Görünümü sil',exact:true}).click();
  await adminPage.getByRole('dialog').waitFor({state:'hidden'});
  assert.equal((await db`SELECT id FROM workspace_views WHERE id=${savedId}`).length,0);
  console.log('PASS · saved view create/apply/update/favorite/rename/reload/copy/delete, unsaved filters retained, private ownership, CSRF rejection and mobile layout');


  const newDraftResponse=await adminContext.request.post(origin+'/api/v1/orders',{headers:{Origin:origin},data:{customerName:'BROWSER transition test',productName:'BROWSER technical line',quantity:1,totalAmount:123,currency:'TRY'}});
  assert.equal(newDraftResponse.status(),200);const transitionDraft=(await newDraftResponse.json()).data;
  await adminPage.goto(origin+'/orders/'+transitionDraft.id);
  await adminPage.getByRole('heading',{name:'Sipariş #'+transitionDraft.orderNumber,exact:true}).waitFor();
  const statusRequest=adminPage.waitForRequest(request=>request.url().endsWith('/transition') && request.method()==='POST');
  await adminPage.getByRole('button',{name:'Onaylandı',exact:true}).click();
  const sentTransition=(await statusRequest).postDataJSON();
  await adminPage.waitForFunction(()=>document.querySelector('button[aria-label="Onaylandı"]')?.getAttribute('aria-current')==='step');
  assert.equal((await adminContext.request.post(origin+'/api/v1/orders/'+transitionDraft.id+'/transition',{headers:{Origin:origin},data:sentTransition})).status(),200);
  await adminPage.getByRole('button',{name:'Aktivite',exact:true}).click();
  await adminPage.getByLabel('Aktivite notu',{exact:true}).fill('BROWSER verified note');
  await adminPage.getByRole('button',{name:'Notu gönder',exact:true}).click();
  await adminPage.getByText('BROWSER verified note',{exact:true}).waitFor();
  assert.equal((await adminContext.request.post(origin+'/api/v1/activity-logs',{headers:{Origin:origin},data:{entityType:'order',entityId:transitionDraft.id,action:'status_changed',note:'FORGED audit'}})).status(),400);
  const history=(await (await adminContext.request.get(origin+'/api/v1/activity-logs?entityType=order&entityId='+transitionDraft.id)).json()).logs;
  assert.equal(history.filter(log=>log.action==='status_changed').length,1);assert.equal(history.find(log=>log.action==='note_added').note,'BROWSER verified note');
  assert.equal((await adminContext.request.delete(origin+'/api/v1/orders/'+transitionDraft.id,{headers:{Origin:origin}})).status(),409);
  console.log('PASS · authenticated order transition and note history, duplicate transition protected, fabricated audit rejected, linked deletion protected');

  const deletableResponse=await adminContext.request.post(origin+'/api/v1/orders',{headers:{Origin:origin},data:{customerName:'BROWSER transition test',productName:'BROWSER unlinked line',quantity:1,totalAmount:0,currency:'TRY'}});
  assert.equal(deletableResponse.status(),200);const deletable=(await deletableResponse.json()).data;
  await adminPage.goto(origin+'/orders?q=BROWSER%20transition');
  await adminPage.getByRole('checkbox',{name:'Kaydı seç',exact:true}).nth(1).waitFor();
  assert.equal(await adminPage.getByRole('checkbox',{name:'Kaydı seç',exact:true}).count(),2,'new API order must immediately appear in the server-action list');
  await adminPage.getByRole('checkbox',{name:'Bu sayfadaki tüm kayıtları seç',exact:true}).check();
  await adminPage.getByRole('button',{name:'Seçili siparişleri sil',exact:true}).click();
  await adminPage.getByRole('dialog').getByRole('button',{name:'Siparişleri sil',exact:true}).click();
  await adminPage.getByRole('dialog').getByRole('alert').filter({hasText:'1 sipariş silindi. 1 kayıt korundu.'}).waitFor();
  await adminPage.getByRole('dialog').getByRole('button',{name:'Vazgeç',exact:true}).click();
  assert.equal(await adminPage.getByRole('checkbox',{name:'Kaydı seç',exact:true}).count(),1);
  assert.equal(await adminPage.getByRole('checkbox',{name:'Kaydı seç',exact:true}).isChecked(),true);
  assert.equal((await db`SELECT id FROM orders WHERE id=${deletable.id}`).length,0);
  assert.equal((await db`SELECT id FROM orders WHERE id=${transitionDraft.id}`).length,1);
  console.log('PASS · immediate order-list freshness and mixed bulk deletion: draft removed, audited order retained and selected, business reason displayed');

  // Refreshing a signed session also refreshes live membership; client-supplied identity is irrelevant.
  await db`UPDATE tenant_members SET role='worker' WHERE tenant_id=${fixture.tenantId} AND user_id=${fixture.ownerId}`;
  assert.equal((await (await adminContext.request.get(origin+'/api/auth/session')).json()).user.role,'worker');
  assert.equal((await adminContext.request.get(origin+'/api/v1/finance/workspace')).status(),403);
  await db`DELETE FROM tenant_members WHERE tenant_id=${fixture.tenantId} AND user_id=${fixture.ownerId}`;
  const revoked=await (await adminContext.request.get(origin+'/api/auth/session')).json();assert.ok(!revoked?.user);
  assert.equal((await adminContext.request.get(origin+'/api/v1/orders')).status(),401);
  console.log('PASS · live role demotion and membership revocation invalidate privileged sessions');
  assert.deepEqual(failedResponses,[]);
  assert.deepEqual(errors,[]);
  console.log("PASS · final complete-flow audit: no server 5xx or uncaught browser exceptions");
  await context.close();
  console.log("PASS · barcode lookup, worker data isolation");
})()
  .catch(async (e) => {
    if(debugPage && !debugPage.isClosed()){await debugPage.screenshot({path:'/tmp/renkflow-browser-failure.png',fullPage:true});fs.writeFileSync('.data/browser-failure.txt',await debugPage.locator('body').innerText(),{mode:0o600});}
    console.error(e.stack);
    process.exitCode = 1;
  })
  .finally(async () => {
    await browser?.close();
    await db?.end();
    server?.kill("SIGTERM");
  });
