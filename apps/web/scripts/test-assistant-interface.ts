/** Real local auth/quote API plus simulated model replies for responsive UI acceptance. No remote AI. */
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { spawn, type ChildProcess } from 'node:child_process';
import { createServer } from 'node:net';
import { existsSync, mkdirSync } from 'node:fs';
import { chromium, type Browser } from '@playwright/test';
import postgres from 'postgres';
import bcrypt from 'bcryptjs';
import { localTestDatabaseURL } from './local-test-database';

async function main() {
  const databaseUrl = localTestDatabaseURL();
  const db = postgres(databaseUrl, { onnotice: () => {} });
  assert.equal((await db`SELECT current_database() AS name`)[0].name, 'renkflow_test');
  const [tenant] = await db`INSERT INTO tenants(name,slug) VALUES('Asistan arayüz testi',${'assistant-ui-' + randomUUID()}) RETURNING id`;
  const email = randomUUID() + '@example.invalid', password = 'Local-Assistant-UI-2026!';
  const [owner] = await db`INSERT INTO users(name,email,password,email_verified) VALUES('Arayüz Testi',${email},${await bcrypt.hash(password, 10)},now()) RETURNING id`;
  await db`INSERT INTO tenant_members(tenant_id,user_id,role) VALUES(${tenant.id},${owner.id},'owner')`;
  await db`INSERT INTO ai_settings(tenant_id,mode,kvkk_ack_at) VALUES(${tenant.id},'assist',now())`;
  await db`INSERT INTO customers(tenant_id,full_name) VALUES(${tenant.id},'Romanya')`;
  const port = await new Promise<number>(resolve => { const server = createServer(); server.listen(0, '127.0.0.1', () => { const address = server.address(); server.close(() => resolve((address as { port: number }).port)); }); });
  const origin = `http://localhost:${port}`;
  let server: ChildProcess | undefined, browser: Browser | undefined;
  let serverOutput = '';
  try {
    server = spawn(process.execPath, ['node_modules/next/dist/bin/next', 'start', '--hostname', '127.0.0.1', '--port', String(port)], {
      env: { ...process.env, DATABASE_URL: databaseUrl, DATABASE_URL_UNPOOLED: databaseUrl, AUTH_SECRET: 'assistant-ui-local-secret-1234567890', NEXTAUTH_SECRET: 'assistant-ui-local-secret-1234567890', AUTH_URL: origin, NEXTAUTH_URL: origin, AUTH_TRUST_HOST: 'true', NEXT_PUBLIC_APP_URL: origin, ALLOW_LOCAL_DATABASE: '1', ALLOW_INSECURE_HTTP: '1', PRIVATE_ACCESS_EMAIL: '', ANTHROPIC_API_KEY: 'synthetic-ui-test-key-never-sent' }, stdio: ['ignore', 'pipe', 'pipe'],
    });
    server.stdout?.on('data', b => { serverOutput += String(b); });
    server.stderr?.on('data', b => { serverOutput += String(b); });
    for (let i = 0; i < 90; i++) { try { if ((await fetch(origin + '/api/health')).ok) break; } catch { /* Starting. */ } await new Promise(resolve => setTimeout(resolve, 500)); }
    const executablePath = process.env.PLAYWRIGHT_CHROMIUM_PATH || (existsSync(chromium.executablePath()) ? chromium.executablePath() : process.platform === 'darwin' ? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' : undefined);
    browser = await chromium.launch({ headless: true, executablePath });
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, colorScheme: 'dark' });
    const page = await context.newPage();
    const errors: string[] = [];
    page.on('pageerror', error => errors.push(error.message));
    // Only provider replies are simulated. Authentication, insights, quote preview/approval and DB are real.
    await page.route('**/api/ai/chat', async route => {
      const body = route.request().postDataJSON();
      if (/teklif/i.test(body.message) && body.mode !== 'proactive') return route.continue();
      return route.fulfill({ json: { response: 'Merhaba. Sipariş, üretim ve stok kayıtlarınızı inceleyebilirim.', model: { label: 'Claude Sonnet 5.5', verifiedResponse: true }, suggestions: [], actions: [], toolsUsed: [] } });
    });
    await page.goto(origin + '/auth/login');
    await page.getByLabel('E-posta adresi').fill(email);
    await page.locator('input[name="password"]').fill(password);
    await page.getByRole('button', { name: 'Çalışma alanına gir', exact: true }).click();
    await page.waitForURL('**/dashboard');
    const necessaryCookies = page.getByRole('button', { name: 'Sadece gerekli', exact: true });
    if (await necessaryCookies.isVisible()) await necessaryCookies.click();
    await page.goto(origin + '/assistant');
    await page.getByRole('heading', { name: 'Nasıl yardımcı olabilirim?' }).waitFor();
    await page.getByText('AI kullanıma hazır', { exact: true }).waitFor();
    mkdirSync('.data', { recursive: true });
    await page.screenshot({ path: '.data/assistant-workspace-dark.png', fullPage: true });
    await page.getByRole('button', { name: 'Sohbeti aç', exact: true }).click();
    const dialog = page.getByRole('dialog', { name: 'RenkFlow Asistan' });
    await dialog.getByRole('textbox', { name: 'Asistana mesaj' }).fill('Merhaba');
    await dialog.getByRole('button', { name: 'Gönder', exact: true }).click();
    await dialog.getByText('Claude Sonnet 5.5 ile yanıtlandı', { exact: true }).waitFor();
    await dialog.getByRole('textbox', { name: 'Asistana mesaj' }).fill("Romanya'ya 10x5 tente teklif 300.000tl üzerinden yüzde 5 iskonto 0 kdv");
    await dialog.getByRole('button', { name: 'Gönder', exact: true }).click();
    await dialog.getByRole('button', { name: 'Onayla', exact: true }).waitFor();
    assert.equal(Number((await db`SELECT count(*) AS n FROM quotations WHERE tenant_id=${tenant.id}`)[0].n), 0);
    await page.screenshot({ path: '.data/assistant-chat-dark.png' });
    await dialog.getByRole('button', { name: 'Onayla', exact: true }).click();
    await dialog.getByText('Taslak oluşturuldu', { exact: false }).waitFor();
    const [quote] = await db`SELECT discount_percent,vat_percent,total_amount FROM quotations WHERE tenant_id=${tenant.id}`;
    assert.deepEqual([Number(quote.discount_percent), Number(quote.vat_percent), Number(quote.total_amount)], [5, 0, 285000]);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.screenshot({ path: '.data/assistant-chat-mobile.png' });
    const bounds = await dialog.boundingBox();
    assert(bounds && bounds.x >= 0 && bounds.x + bounds.width <= 391 && bounds.y >= 0 && bounds.y + bounds.height <= 844);
    await dialog.getByRole('button', { name: 'Kapat', exact: true }).click();
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
    await page.evaluate(() => { localStorage.setItem('theme', 'light'); });
    await page.reload();
    await page.getByRole('heading', { name: 'Nasıl yardımcı olabilirim?' }).waitFor();
    await page.screenshot({ path: '.data/assistant-workspace-light-mobile.png', fullPage: true });
    assert.deepEqual(errors, []);
    const anonymous = await browser.newContext();
    assert.equal((await anonymous.request.post(origin + '/api/ai/chat', { data: { message: 'Merhaba' }, headers: { Origin: origin } })).status(), 401);
    await anonymous.close();
    console.log('PASS: dark/light responsive workspace, model provenance (simulated response), real authenticated chat quote preview -> approval -> persisted 285000 TRY, mobile dialog bounds and no browser errors');
  } catch (error) {
    console.error(serverOutput.slice(-3000));
    throw error;
  } finally {
    await browser?.close();
    server?.kill('SIGTERM');
    await db.end();
  }
  process.exit(0);
}
main().catch(error => { console.error(error); process.exit(1); });
