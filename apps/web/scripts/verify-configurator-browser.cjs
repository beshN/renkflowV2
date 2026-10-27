// Acceptance scenario of the product configurator, against a production build (`npm run build && next start`):
// kiosk → WINMAX size/colour/motor/LED/animation → second product → QR (decoded from the image) → phone →
// edit → quote → database → sales screen → status; idle reset; offline kiosk; phone opening an offline design.
//
// Needs: a fair with code rt2027 (default locale en, campaign "Visit us in Hall 6, Stand A21."), a member
// with crm rights, FAIR_HOSTS containing the kiosk host. Service workers need a secure origin: use https
// or a *.localhost host.
//   CONFIGURATOR_URL=http://configurator.localhost:4318 APP_URL=http://localhost:4318 \
//   DATABASE_URL=postgres://… ADMIN_EMAIL=… ADMIN_PASSWORD=… node scripts/verify-configurator-browser.cjs
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const sharp = require('sharp');
const postgres = require('postgres');
const { QRCodeReader, BinaryBitmap, HybridBinarizer, RGBLuminanceSource } = require('@zxing/library');
const assert = require('node:assert/strict');

const BASE = (process.env.CONFIGURATOR_URL || 'http://configurator.localhost:4318').replace(/\/$/, '');
const KIOSK = `${BASE}/fair/rt2027`;
const ADMIN = (process.env.APP_URL || 'http://localhost:4318').replace(/\/$/, '');
const SHOTS = (process.env.SHOTS_DIR || require('node:os').tmpdir()) + '/configurator-';
const sql = postgres(process.env.DATABASE_URL || 'postgres://postgres:renkflow-local-only@127.0.0.1:55432/renkflow_dev', { onnotice: () => {} });
const step = (m) => console.log('✓', m);

async function decodeQr(page) {
  const src = await page.locator('img[alt="Scan to continue on your phone."]').getAttribute('src');
  let lastError;
  for (const pad of [0, 60, 120]) {
    const { data, info } = await sharp(Buffer.from(src.split(',')[1], 'base64')).extend({ top: pad, bottom: pad, left: pad, right: pad, background: '#ffffff' }).greyscale().raw().toBuffer({ resolveWithObject: true });
    const lum = new Uint8ClampedArray(info.width * info.height);
    for (let i = 0; i < lum.length; i++) lum[i] = data[i * info.channels];
    try {
      return new QRCodeReader().decode(new BinaryBitmap(new HybridBinarizer(new RGBLuminanceSource(lum, info.width, info.height)))).getText();
    } catch (e) { lastError = e; }
  }
  throw lastError;
}
const ready3d = (page) => page.waitForFunction(() => !/Loading 3D view|Preparing the product view|wird geladen/.test(document.body.innerText), null, { timeout: 120000 });

(async () => {
  const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', `--unsafely-treat-insecure-origin-as-secure=${BASE}`] });
  const errors = [];
  const watch = (page, name) => page.on('pageerror', (e) => errors.push(`${name}: ${e}`));

  // ---- Kiosk -------------------------------------------------------------------------------------
  const kioskCtx = await browser.newContext({ viewport: { width: 1920, height: 1080 }, hasTouch: true });
  const kiosk = await kioskCtx.newPage();
  watch(kiosk, 'kiosk');
  await kiosk.goto(KIOSK, { waitUntil: 'networkidle' });
  await kiosk.getByText('Discover, customize and experience our products in 3D.').waitFor();
  await kiosk.getByText('Visit us in Hall 6, Stand A21.').waitFor();
  assert.equal(await kiosk.locator('input[type=email], input[type=tel]').count(), 0, 'kiosk asks for no personal data');
  await kiosk.screenshot({ path: SHOTS + 'k1-welcome.png' });
  step('kiosk welcome with fair campaign, no personal fields');

  await kiosk.getByRole('button', { name: 'Start designing' }).tap();
  await kiosk.getByRole('button', { name: /WINMAX Folding-Arm Awning/ }).tap();
  await kiosk.locator('canvas').first().waitFor();
  await ready3d(kiosk);
  for (let i = 0; i < 10; i++) await kiosk.getByRole('button', { name: 'Width +50 mm' }).tap();
  await kiosk.getByText('6500 mm', { exact: true }).first().waitFor();
  assert.equal(await kiosk.locator('input[type=number]').count(), 0, 'no keyboard fields on the kiosk');
  await kiosk.getByRole('button', { name: 'Frame colour: White' }).tap();
  await kiosk.getByRole('button', { name: 'Fabric colour: Burgundy' }).tap();
  await kiosk.getByLabel('Motor and control').selectOption('remote_wall');
  await kiosk.locator('label', { hasText: /^LED/ }).locator('select').selectOption('white');
  await kiosk.getByRole('button', { name: 'Play or stop the opening animation' }).tap();
  await kiosk.waitForTimeout(2500);
  await kiosk.screenshot({ path: SHOTS + 'k2-configure.png' });
  step('WINMAX: width 6500, white frame, burgundy fabric, remote + wall switch, cool white LED, animation played');

  await kiosk.getByRole('button', { name: 'Add to my list' }).tap();
  await kiosk.getByText('WINMAX Folding-Arm Awning · 6500 × 4000 mm').waitFor({ timeout: 30000 });
  await kiosk.getByRole('button', { name: 'Add another product' }).tap();
  await kiosk.getByRole('button', { name: /^Screens and awnings ?Zip Screen/ }).tap();
  await ready3d(kiosk);
  await kiosk.getByRole('button', { name: 'Add to my list' }).tap();
  await kiosk.getByText(/Zip Screen · 3500 × 2800 mm/).waitFor({ timeout: 30000 });
  await kiosk.screenshot({ path: SHOTS + 'k3-list.png' });
  step('second product added: the visitor has two designs');

  await kiosk.getByRole('button', { name: 'Continue on my phone' }).tap();
  await kiosk.getByRole('heading', { name: 'Scan to continue on your phone.' }).waitFor();
  await kiosk.getByText('Design saved.').waitFor({ timeout: 15000 });
  assert.equal(await kiosk.locator('form, input[type=email]').count(), 0, 'no form next to the QR code');
  await kiosk.screenshot({ path: SHOTS + 'k4-qr.png' });
  const link = await decodeQr(kiosk);
  const token = /\/c\/([A-Za-z0-9_-]{22})#d=/.exec(link)[1];
  console.log('  QR →', link.slice(0, 80) + '…', `(${link.length} chars)`);
  const [design] = await sql`SELECT d.origin, f.code, jsonb_array_length(d.items) n FROM fair_designs d LEFT JOIN fairs f ON f.id = d.fair_id WHERE d.token = ${token}`;
  assert.deepEqual({ ...design }, { origin: 'kiosk', code: 'rt2027', n: 2 });
  step('QR decoded; design stored with fair rt2027 and both products');

  await kiosk.getByRole('button', { name: 'Done — new visitor' }).tap();
  await kiosk.getByText('Discover, customize and experience our products in 3D.').waitFor();
  step('kiosk reset to start');

  // ---- Phone -------------------------------------------------------------------------------------
  const phoneCtx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, locale: 'en-US' });
  const phone = await phoneCtx.newPage();
  watch(phone, 'phone');
  await phone.goto(link, { waitUntil: 'networkidle' });
  await phone.getByRole('heading', { name: 'Your design' }).waitFor();
  for (const text of ['WINMAX Folding-Arm Awning · 6500 × 4000 mm', 'UBESER · remote + wall switch', 'Cool white · 75%', 'Burgundy (#7b2438)', 'White (#e9e9e4)', 'Zip Screen · 3500 × 2800 mm'])
    await phone.getByText(text).first().waitFor();
  assert.equal(await phone.locator('input[type=email]').count(), 0, 'no contact form before the visitor asks for a quote');
  await phone.screenshot({ path: SHOTS + 'p1-overview.png', fullPage: true });
  step('phone shows the same products with every setting; two choices, no form yet');

  await phone.getByRole('button', { name: 'Continue editing' }).tap();
  await phone.getByRole('button', { name: 'Edit: WINMAX Folding-Arm Awning' }).tap();
  await ready3d(phone);
  await phone.getByLabel('Projection (mm)').fill('3500');
  await phone.waitForTimeout(800);
  await phone.getByRole('button', { name: 'Save changes' }).tap();
  await phone.getByText('WINMAX Folding-Arm Awning · 6500 × 3500 mm').waitFor({ timeout: 30000 });
  await phone.getByRole('button', { name: 'Remove: Zip Screen' }).tap();
  await phone.getByText('Saved', { exact: true }).waitFor();
  const [edited] = await sql`SELECT version, items->0->'awning'->>'projectionMm' p, jsonb_array_length(items) n FROM fair_designs WHERE token = ${token}`;
  assert.equal(edited.p, '3500');
  assert.equal(edited.n, 1);
  assert.ok(edited.version > 1);
  step('phone edit saved under the same link (projection 3500, zip removed)');

  await phone.reload({ waitUntil: 'networkidle' });
  await phone.getByText('WINMAX Folding-Arm Awning · 6500 × 3500 mm').waitFor();
  step('reopening the link shows the edited design');

  await phone.getByRole('button', { name: 'Get a price quote' }).tap();
  await phone.getByLabel(/^Full name/).fill('Ada Lovelace');
  await phone.getByLabel(/^E-mail/).fill('ada@example.com');
  await phone.getByLabel(/^Company/).fill('Analytical Engines Ltd');
  await phone.getByLabel(/^Country \/ city/).fill('United Kingdom, London');
  await phone.getByLabel(/^Additional note/).fill('Terrace on the 3rd floor.');
  assert.equal(await phone.getByLabel(/news and offers/).isChecked(), false, 'marketing consent is off by default');
  await phone.getByLabel(/I have read the privacy notice/).check();
  await phone.screenshot({ path: SHOTS + 'p2-quote.png', fullPage: true });
  await phone.getByRole('button', { name: 'Send quote request' }).tap();
  await phone.getByRole('heading', { name: /Thank you/ }).waitFor({ timeout: 30000 });
  const number = (await phone.locator('strong.font-mono').innerText()).trim();
  await phone.screenshot({ path: SHOTS + 'p3-done.png', fullPage: true });
  const emailLine = await phone.getByText(/confirmation/).first().innerText();
  console.log('  confirmation screen:', number, '|', emailLine);
  const [quote] = await sql`
    SELECT q.status, q.email, q.company_name, q.marketing_consent, q.email_status, f.code, q.items->0->'awning'->>'projectionMm' p, l.source, l.lead_number
    FROM fair_quotes q LEFT JOIN fairs f ON f.id = q.fair_id LEFT JOIN leads l ON l.id = q.lead_id WHERE q.number = ${number}`;
  assert.equal(quote.status, 'new');
  assert.equal(quote.code, 'rt2027');
  assert.equal(quote.p, '3500');
  assert.equal(quote.marketing_consent, false);
  assert.equal(quote.source, 'fair');
  console.log('  stored:', JSON.stringify(quote));
  step(`quote ${number} stored with fair, current design, RenkFlow lead ${quote.lead_number}; e-mail status "${quote.email_status}"`);

  // ---- Admin -------------------------------------------------------------------------------------
  const adminCtx = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const admin = await adminCtx.newPage();
  watch(admin, 'admin');
  await admin.goto(ADMIN + '/auth/login', { waitUntil: 'networkidle' });
  await admin.locator('input[name=email]').fill(process.env.ADMIN_EMAIL || 'satis@example.com');
  await admin.locator('input[name=password]').fill(process.env.ADMIN_PASSWORD || '');
  await admin.locator('button[type=submit]').click();
  await admin.waitForURL(/dashboard|leads|onboarding/, { timeout: 60000 });
  await admin.goto(ADMIN + '/leads/fuar', { waitUntil: 'networkidle' });
  await admin.getByText(number).waitFor({ timeout: 30000 });
  await admin.getByText(number).click();
  for (const text of ['ada@example.com', 'Analytical Engines Ltd', 'United Kingdom, London', 'Kumanda + duvar butonu', 'Terrace on the 3rd floor.'])
    await admin.getByText(text).first().waitFor();
  await admin.locator('li').getByText(/R\+T Stuttgart 2027/).first().waitFor();
  await admin.getByLabel('Durum').last().selectOption('reviewing');
  await admin.waitForTimeout(1000);
  await admin.screenshot({ path: SHOTS + 'a1-quotes.png', fullPage: true });
  const [status] = await sql`SELECT status FROM fair_quotes WHERE number = ${number}`;
  assert.equal(status.status, 'reviewing');
  await admin.getByRole('tab', { name: 'Fuarlar' }).click();
  await admin.locator('table').getByText('R+T Stuttgart 2027').waitFor();
  await admin.screenshot({ path: SHOTS + 'a2-fairs.png', fullPage: true });
  step('sales sees the request with every spec, changes status to "İnceleniyor"; fair list with counts');

  // ---- Idle reset (fake clock, on the product list) -----------------------------------------------
  const idleCtx = await browser.newContext({ viewport: { width: 1920, height: 1080 }, hasTouch: true });
  const idle = await idleCtx.newPage();
  await idle.clock.install();
  await idle.goto(KIOSK, { waitUntil: 'networkidle' });
  await idle.getByRole('button', { name: 'Start designing' }).tap();
  await idle.getByRole('heading', { name: 'Choose a product' }).waitFor();
  await idle.clock.fastForward(95_000);
  await idle.getByRole('heading', { name: 'Are you still there?' }).waitFor();
  await idle.clock.fastForward(20_000);
  await idle.getByText('Discover, customize and experience our products in 3D.').waitFor();
  await idleCtx.close();
  step('idle kiosk asks "Are you still there?" after 90 s and resets after 20 s more');

  // ---- Offline kiosk ------------------------------------------------------------------------------
  // The first kiosk page registered the worker and cached the app and 3D code.
  const cached = await kiosk.evaluate(async () => {
    for (let i = 0; i < 40 && !navigator.serviceWorker.controller; i++) await new Promise((r) => setTimeout(r, 250));
    await new Promise((r) => setTimeout(r, 4000));
    const keys = await caches.keys();
    const cache = await caches.open(keys.find((k) => k.startsWith('rf-configurator-')));
    return { controlled: Boolean(navigator.serviceWorker.controller), entries: (await cache.keys()).length };
  });
  console.log('  service worker:', JSON.stringify(cached));
  assert.ok(cached.controlled && cached.entries > 10);
  await kioskCtx.setOffline(true);
  await kiosk.reload({ waitUntil: 'load' });
  await kiosk.getByText('Discover, customize and experience our products in 3D.').waitFor();
  await kiosk.getByText('Offline', { exact: false }).first().waitFor();
  await kiosk.getByRole('button', { name: 'Start designing' }).tap();
  await kiosk.getByRole('button', { name: /Bioclimatic Pergola/ }).tap();
  await kiosk.locator('canvas').first().waitFor();
  await ready3d(kiosk);
  assert.equal(await kiosk.getByText(/could not be loaded|could not start/).count(), 0, '3D works offline');
  for (let i = 0; i < 4; i++) await kiosk.getByRole('button', { name: 'Width +50 mm' }).tap();
  await kiosk.getByRole('button', { name: 'Frame colour: Black' }).tap();
  await kiosk.waitForTimeout(1500);
  await kiosk.screenshot({ path: SHOTS + 'o1-offline-configure.png' });
  await kiosk.getByRole('button', { name: 'Add to my list' }).tap();
  await kiosk.getByText(/Bioclimatic Pergola · 5200 × 4000 mm/).waitFor({ timeout: 30000 });
  await kiosk.getByRole('button', { name: 'Continue on my phone' }).tap();
  await kiosk.getByText(/Offline: the design is inside the QR code/).waitFor();
  await kiosk.getByText(/1 design\(s\) waiting to sync/).waitFor();
  await kiosk.screenshot({ path: SHOTS + 'o2-offline-qr.png' });
  const offlineLink = await decodeQr(kiosk);
  const offlineToken = /\/c\/([A-Za-z0-9_-]{22})#d=/.exec(offlineLink)[1];
  assert.equal((await sql`SELECT 1 FROM fair_designs WHERE token = ${offlineToken}`).length, 0, 'not on the server yet');
  await kiosk.getByRole('button', { name: 'Done — new visitor' }).tap();
  await kiosk.getByText('Discover, customize and experience our products in 3D.').waitFor();
  await kiosk.getByText(/1 design\(s\) waiting to sync/).waitFor();
  step('offline: product chosen, 3D configured, QR made, kiosk reset — queued design kept');

  // The visitor's phone has mobile data while the kiosk is still offline.
  const phone2 = await phoneCtx.newPage();
  watch(phone2, 'phone2');
  await phone2.goto(offlineLink, { waitUntil: 'networkidle' });
  await phone2.getByText(/Bioclimatic Pergola · 5200 × 4000 mm/).first().waitFor();
  await phone2.getByText('Saved', { exact: true }).waitFor({ timeout: 15000 });
  assert.ok(!phone2.url().includes('#d='), 'short link once stored');
  const [claimed] = await sql`SELECT origin, f.code FROM fair_designs d LEFT JOIN fairs f ON f.id = d.fair_id WHERE token = ${offlineToken}`;
  assert.deepEqual({ ...claimed }, { origin: 'kiosk', code: 'rt2027' });
  step('phone opened the offline design from the QR code itself and stored it (fair attributed)');

  await kioskCtx.setOffline(false);
  await kiosk.evaluate(() => window.dispatchEvent(new Event('online')));
  await kiosk.waitForFunction(() => !/waiting to sync/.test(document.body.innerText), null, { timeout: 30000 });
  step('kiosk back online: queue emptied (already stored design confirmed, nothing duplicated)');
  assert.equal((await sql`SELECT count(*)::int n FROM fair_designs WHERE token = ${offlineToken}`)[0].n, 1);

  console.log('page errors:', errors.length ? errors : 'none');
  await browser.close();
  await sql.end();
})().catch(async (e) => {
  console.error('FAIL', e);
  await sql.end();
  process.exit(1);
});
