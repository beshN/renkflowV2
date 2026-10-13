/* Local browser verification with synthetic API fixtures. Never reaches a remote DB. */
const { chromium } = require('@playwright/test');
const { writeFileSync } = require('fs');
const assert = require('node:assert/strict');
const origin = 'http://127.0.0.1:4317';
const id = '11111111-1111-4111-8111-111111111111';
const tenant = '22222222-2222-4222-8222-222222222222';
let quote = { id, tenantId: tenant, quotationNumber:'TEK-2026-014', customerName:'Yükselen Yapı', status:'draft', currency:'TRY', version:1, revision:1, validUntil:'2027-01-01', vatPercent:20, subtotal:352800, discountAmount:0, taxAmount:70560, totalAmount:423360, notes:'Montaj hariçtir.', internalNotes:'GİZLİ MALİYET', termsAndConditions:'Teslimat: 30 gün.', createdAt:'2026-10-13T09:00:00Z', updatedAt:'2026-10-13T09:00:00Z', items:[{id:'33333333-3333-4333-8333-333333333333',productName:'Motorlu Giyotin Cam',quantity:15,unitPrice:24000,discountPercent:2,totalPrice:352800}] };
(async()=>{
 const browser = await chromium.launch({headless:true,args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 try {
 const context = await browser.newContext({viewport:{width:1440,height:1050}});
 const { encode } = await import('next-auth/jwt');
 const token=await encode({secret:'local-quote-3d-verification-2026',salt:'authjs.session-token',token:{sub:'local-fixture',id:'local-fixture',role:'owner',email:'local@example.invalid'}});
 await context.addCookies([{name:'authjs.session-token',value:token,url:origin}]);
 await context.route('**/api/**', async route=>{
  const req=route.request(),url=new URL(req.url()),path=url.pathname;
  let data={available:false,enabled:false,data:[],items:[],settings:{},features:[],notifications:[],insights:[],modelEnabled:false,unavailable:[],changes:[],rules:[],history:[]};
  if(path==='/api/auth/session')data={user:{id:'local-fixture',name:'Local QA',role:'owner',tenantId:tenant,tenantName:'Renk Alüminyum',email:'local@example.invalid'},expires:'2027-01-01T00:00:00Z'};
  else if(path==='/api/v1/quotations/'+id){
   if(req.method()==='PATCH') {const body=req.postDataJSON();quote={...quote,...body};for(const item of quote.items)item.totalPrice=item.quantity*item.unitPrice*(1-item.discountPercent/100);}
   data={data:quote};
  } else if(path.includes('/templates'))data={templates:[]};
  else if(path.includes('/customers'))data={customers:[]};
  else if(path.includes('/orders')&&req.method()==='POST') {writeFileSync('/workspace/artifacts/order-payload.txt',req.postData());data={success:true};}
  else if(path.includes('/sales/settings'))data={available:false,settings:{defaultVatPercent:20}};
  else if(path.includes('/products/configure'))data={family:{key:'pergola',label:'Pergola',dimensions:[]},recipes:[],colors:{favorites:[],stock:[]},matrix:null};
  await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(data)});
 });
 await context.addInitScript(() => { window._qaBuffers=0; for(const name of ['WebGLRenderingContext','WebGL2RenderingContext']) { const proto=window[name]?.prototype; if(!proto)continue; const original=proto.createBuffer;proto.createBuffer=function(){window._qaBuffers++;return original.apply(this,arguments);}; } });
 const page=await context.newPage();page.setDefaultNavigationTimeout(120000);page.setDefaultTimeout(60000);const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(origin+'/quotations/'+id,{waitUntil:'domcontentloaded'});
 await page.getByRole('button',{name:'Teklifi kaydet',exact:true}).waitFor({timeout:90000});
 await page.getByRole('button',{name:'Finans',exact:true}).click();
 assert.ok(await page.getByRole('link',{name:'Personel',exact:true}).isVisible());
 await page.getByRole('button',{name:'Finans',exact:true}).click();
 assert.ok(!await page.getByRole('link',{name:'Personel',exact:true}).isVisible());
 await page.setViewportSize({width:390,height:844});
 await page.getByRole('button',{name:'Ana menüyü aç',exact:true}).last().click();
 await page.getByRole('dialog').waitFor();
 await page.getByRole('button',{name:'Stok ve tedarik',exact:true}).click();
 assert.ok(await page.getByRole('dialog').getByRole('link',{name:'Depo',exact:true}).isVisible());
 await page.getByRole('button',{name:'Ana menüyü kapat',exact:true}).click();
 assert.equal(await page.getByRole('dialog').count(),0);
 assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
 await page.screenshot({path:'/workspace/artifacts/menus-mobile.png',fullPage:true});
 await page.setViewportSize({width:1440,height:1050});
 console.log('PASS: grouped sidebar and mobile menu; personnel stays accessible; current sales group opens automatically.');
 const choice=page.getByLabel('Kalem 1 ürün seçimi',{exact:true}); await choice.waitFor({timeout:25000});
 console.log('Loaded quote form');await choice.selectOption('giyotin');
 const canvas=page.locator('canvas').first();await canvas.waitFor();
 await page.getByText('3D görünüm yükleniyor…',{exact:true}).waitFor({state:'hidden',timeout:60000});
 await page.getByText('Ürün görünümü hazırlanıyor…',{exact:true}).waitFor({state:'hidden',timeout:60000});
 console.log('3D ready');await page.getByLabel('En (mm)',{exact:true}).fill('3200');
 await page.getByLabel('Yükseklik (mm)',{exact:true}).fill('2800');
 await page.waitForTimeout(1500);
 assert.equal(await page.getByRole('dialog').count(),0);
 const saved=page.waitForResponse(r=>r.url().endsWith('/api/v1/quotations/'+id)&&r.request().method()==='PATCH');
 await page.getByRole('button',{name:'Teklifi kaydet',exact:true}).click();await saved;
 assert.equal(quote.items[0].widthMm,3200);assert.equal(quote.items[0].heightMm,2800);assert.equal(quote.items[0].color,'Antrasit');assert.equal(quote.items[0].unitPrice,24000);assert.equal(quote.items[0].quantity,15);assert.ok(quote.items[0].productVisualization.image);
 await page.screenshot({path:'/workspace/artifacts/quote-inline-desktop.png',fullPage:true});
 await page.reload();await choice.waitFor();assert.equal(await choice.inputValue(),'giyotin');assert.equal(await page.getByLabel('En (mm)',{exact:true}).inputValue(),'3200');
 await page.setViewportSize({width:390,height:844});await page.waitForTimeout(500);assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
 await page.screenshot({path:'/workspace/artifacts/quote-inline-mobile.png',fullPage:true});
 console.log('Mobile and reload passed');await choice.selectOption('wind-piston');
 await page.getByText('Ürün görünümü hazırlanıyor…',{exact:true}).waitFor({state:'hidden',timeout:60000});
 await page.getByLabel('Cam yüksekliği',{exact:true}).evaluate(el=>{Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(el,'100');el.dispatchEvent(new Event('input',{bubbles:true}));el.dispatchEvent(new Event('change',{bubbles:true}));});
 const beforeBuffers=await page.evaluate(()=>window._qaBuffers);
 await page.getByLabel('Özel gövde rengi',{exact:true}).evaluate(el=>{for(let i=0;i<15;i++){Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(el,i%2?'#334455':'#884422');el.dispatchEvent(new Event('input',{bubbles:true}));el.dispatchEvent(new Event('change',{bubbles:true}));}});
 await page.waitForTimeout(1200);
 assert.equal(await page.evaluate(()=>window._qaBuffers),beforeBuffers,'Colour updates must retain GPU geometry');
 console.log('Piston and colour burst passed');await page.screenshot({path:'/workspace/artifacts/piston-high-mobile.png',fullPage:true});
 // Restore the saved quote rather than persisting this inspection change.
 await page.setViewportSize({width:1100,height:1000});await page.goto(origin+'/quotations/'+id+'/print');
 await page.getByRole('heading',{name:'Fiyat teklifi',exact:true}).waitFor();
 assert.ok(!await page.getByText('TİCARİ TEKLİF').count());assert.ok(!await page.getByText('GİZLİ MALİYET').count());
 await page.emulateMedia({media:'print'});await page.screenshot({path:'/workspace/artifacts/quotation-print.png',fullPage:true});
 await page.pdf({path:'/workspace/artifacts/quotation-sample.pdf',format:'A4',printBackground:true,preferCSSPageSize:true,displayHeaderFooter:false});
 await page.emulateMedia({media:'screen'});
 await page.goto(origin+'/new-order');await page.getByLabel('Müşteri / firma adı *').fill('Local QA');
 await page.getByLabel('Kalem 1 ürün seçimi',{exact:true}).selectOption('giyotin');
 await page.getByLabel('En (mm)',{exact:true}).fill('3100');await page.getByLabel('Yükseklik (mm)',{exact:true}).fill('2600');
 await page.getByLabel('Birim fiyat (TRY)').fill('25000');await page.waitForTimeout(1200);
 const submitted=page.waitForResponse(r=>r.url().endsWith('/api/v1/orders')&&r.request().method()==='POST');await page.getByRole('button',{name:'Siparişi Kaydet',exact:true}).click();await submitted;
 assert.ok(!errors.length,errors.join('\n'));
 console.log('PASS: inline product selection, live measures, saved/reloaded quote, unchanged commercial prices, mobile overflow, colour burst, piston controls, print PDF and order form submit. API fixtures only.');
 }catch(e){console.error('Browser errors:',await browser.contexts()[0]?.pages()[0]?.title());writeFileSync('/workspace/artifacts/browser-dom.txt',await browser.contexts()[0]?.pages()[0]?.locator('body').innerText());await browser.contexts()[0]?.pages()[0]?.screenshot({path:'/workspace/artifacts/browser-failure.png',fullPage:true});throw e;}finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
