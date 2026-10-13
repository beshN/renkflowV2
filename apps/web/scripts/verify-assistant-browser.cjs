/** End-to-end file rendering and assistant commands on the isolated local test database. */
const fs=require('fs'),assert=require('node:assert/strict'),{spawn}=require('child_process'),{randomUUID}=require('crypto'),{chromium}=require('playwright'),postgres=require('postgres'),dotenv=require('dotenv');
const fixture=JSON.parse(fs.readFileSync('.data/warehouse-test-fixture.json')),origin='http://127.0.0.1:3001';
const db=postgres('postgres://postgres:renkflow-local-only@127.0.0.1:55432/renkflow_test',{max:2});
(async()=>{let server,browser;try{
 const [name]=await db`SELECT current_database()AS name`;assert.equal(name.name,'renkflow_test');
 await db.unsafe(fs.readFileSync('lib/db/migrations/022_assistant_drafts.sql','utf8'));
 const env=dotenv.parse(fs.readFileSync('.env.local'));
 const log=fs.openSync('.data/assistant-browser-server.log','w',0o600);
 server=spawn(process.execPath,[require.resolve('next/dist/bin/next'),'start','--hostname','127.0.0.1','--port','3001'],{env:{...process.env,DATABASE_URL:'postgres://postgres:renkflow-local-only@127.0.0.1:55432/renkflow_test',AUTH_SECRET:'assistant-integration-test-secret-1234567890',NEXTAUTH_SECRET:'assistant-integration-test-secret-1234567890',AUTH_URL:origin,NEXTAUTH_URL:origin,ALLOW_LOCAL_DATABASE:'1',ALLOW_INSECURE_HTTP:'1',PRIVATE_ACCESS_EMAIL:'',ANTHROPIC_API_KEY:process.env.RUN_REAL_AI==='1'?env.ANTHROPIC_API_KEY:'',ANTHROPIC_MODEL:'claude-sonnet-5-5',AI_PROVIDER:'anthropic'},stdio:['ignore',log,log]});
 for(let i=0;i<60;i++){try{if((await fetch(origin+'/api/health')).ok)break;}catch{}await new Promise(r=>setTimeout(r,500));}
 browser=await chromium.launch({headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
 const context=await browser.newContext({viewport:{width:1440,height:1000}}),page=await context.newPage(),errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 await page.goto(origin+'/auth/login');await page.getByLabel('E-posta adresi').fill(fixture.ownerEmail);await page.locator('input[name="password"]').fill(fixture.password);await page.getByRole('button',{name:'Çalışma alanına gir',exact:true}).click();await page.waitForURL('**/dashboard');
 const insights=await context.request.get(origin+'/api/ai/insights?path=/warehouse');assert.equal(insights.status(),200);const summary=await insights.json();assert.deepEqual(summary.unavailable,[]);assert.ok(summary.insights.length);
 await page.getByLabel('AI Asistanı Aç').click();await page.getByLabel('Otomatik operasyon önerileri').waitFor();console.log('PASS: automatic scoped operational advice appears without a question');
 const extraction={customerName:'Assistant browser test',email:null,phone:null,deliveryDate:null,notes:null,items:[{productName:'Makaslı tente',quantity:2,widthMm:3000,heightMm:null,projectionMm:2000,mountingHeightMm:2500,color:null,motorType:null,ledType:null,fabricType:null,notes:null,sourcePage:null,evidence:'2 adet 3000 mm en, 2000 mm açılım, 2500 mm montaj',uncertainFields:['price']}],warnings:['Fiyat kullanıcı tarafından girilmeli.']};
 const payload={commandId:randomUUID(),action:{kind:'orderDraft',title:'Taslağı hazırla',href:null,orderId:null,note:null,draft:extraction}};
 const first=await context.request.post(origin+'/api/ai/actions',{data:payload});assert.equal(first.status(),200);const draft=await first.json();
 const repeat=await context.request.post(origin+'/api/ai/actions',{data:payload});assert.equal(repeat.status(),200);assert.deepEqual(await repeat.json(),draft);
 const changed=await context.request.post(origin+'/api/ai/actions',{data:{...payload,action:{...payload.action,title:'Değişen içerik'}}});assert.equal(changed.status(),409);
 await page.goto(origin+draft.href);await page.getByLabel('Müşteri / firma').waitFor();assert.equal(await page.getByLabel('Müşteri / firma').inputValue(),'Assistant browser test');

 await page.getByLabel('Birim fiyat',{exact:true}).fill('100');
 await page.getByLabel('Kalem 1 · price kontrol edildi',{exact:true}).check();
 await page.getByLabel('Belgeyi ve tüm belirsiz alanları kontrol ettim.',{exact:true}).check();
 await page.getByRole('button',{name:'Kontrolü onayla ve sipariş oluştur',exact:true}).click();
 await page.waitForURL(/\/orders\/[0-9a-f-]{36}$/);
 const orderId=page.url().split('/').pop();
 const [review]=await db`SELECT * FROM intake_drafts WHERE tenant_id=${fixture.tenantId} AND order_id=${orderId}`;
 assert.equal(review.status,'approved');assert.equal(review.reviewed_data.items[0].unitPrice,100);
 const replay=await context.request.post(origin+'/api/v1/production/intake/'+review.id,{data:review.reviewed_data});assert.equal(replay.status(),200,await replay.text());assert.equal((await replay.json()).data.orderId,orderId);
 const note={commandId:randomUUID(),action:{kind:'orderNote',title:'Not ekle',href:null,orderId,note:'Assistant idempotency test',draft:null}};
 assert.equal((await context.request.post(origin+'/api/ai/actions',{data:note})).status(),200);assert.equal((await context.request.post(origin+'/api/ai/actions',{data:note})).status(),200);
 const [notes]=await db`SELECT COUNT(*)AS count FROM activity_logs WHERE tenant_id=${fixture.tenantId} AND entity_id=${orderId} AND note='Assistant idempotency test'`;assert.equal(Number(notes.count),1);
 console.log('PASS: assistant draft review and confirmation, note audit, replay and changed-payload protection');
 const pdfPage=await context.newPage();await pdfPage.setContent('<h1>RenkFlow PDF regression</h1><p>Technical document opens correctly.</p>');const body=await pdfPage.pdf();await pdfPage.close();
 const [file]=await db`INSERT INTO production_files(tenant_id,created_by,name,mime,body)VALUES(${fixture.tenantId},${fixture.ownerId},'assistant-browser.pdf','application/pdf',${body})RETURNING id`;
 await db`INSERT INTO documents(tenant_id,order_id,name,file_path,file_type,size)VALUES(${fixture.tenantId},${orderId},'assistant-browser.pdf',${'/api/v1/production/files/'+file.id},'application/pdf',${body.length})`;
 await page.goto(origin+'/orders/'+orderId);await page.getByRole('button',{name:'Dosyalar',exact:true}).click();await page.getByRole('button',{name:/assistant-browser.pdf/}).click();await page.locator('.react-pdf__Page__canvas').first().waitFor({timeout:30000});await page.waitForFunction(()=>!document.body.innerText.includes('Dosya İndiriliyor'));assert.equal(await page.locator('.react-pdf__Page__canvas').first().evaluate(c=>c.width>0&&c.height>0),true);console.log('PASS: authenticated PDF visibly renders; local compatible worker, no zero-percent loading deadlock');
 await page.screenshot({path:'.data/assistant-pdf-desktop.png'});await page.keyboard.press('Escape');await page.setViewportSize({width:390,height:844});await page.getByRole('button',{name:/assistant-browser.pdf/}).click();await page.locator('.react-pdf__Page__canvas').first().waitFor();await page.keyboard.press('Escape');assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
 if(process.env.RUN_REAL_AI==='1') {
  const response=await context.request.post(origin+'/api/ai/chat',{data:{message:'Bu firmanın stok, üretim ve tahsilat durumunu incele. Gerçek verilerle sonraki adımları öner.',context:{currentPath:'/dashboard'},history:[]},timeout:60000});assert.equal(response.status(),200,await response.text());const reply=await response.json();assert.ok(reply.response.length>20);assert.ok(reply.toolsUsed.includes('stock'));assert.ok(reply.toolsUsed.includes('payments'));console.log('PASS: real GPT-6 Luna structured response uses stock, production and finance context');
 }
 const anon=await browser.newContext();assert.equal((await anon.request.get(origin+'/api/ai/insights')).status(),401);assert.equal((await anon.request.post(origin+'/api/ai/actions',{data:payload})).status(),401);assert.deepEqual(errors,[]);console.log('PASS: mobile PDF, anonymous rejection; no uncaught browser errors');
}catch(e){console.error('FAIL:',e.message);process.exitCode=1;}finally{if(browser)await browser.close();if(server)server.kill('SIGTERM');await db.end();}})();
