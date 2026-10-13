/** Real browser verification against isolated local test fixtures only. */
const { chromium } = require("playwright"),
  { spawn, execFileSync } = require("node:child_process"),
  fs = require("node:fs"),
  assert = require("node:assert/strict"),
  sharp = require("sharp");
const {
  RGBLuminanceSource,
  HybridBinarizer,
  BinaryBitmap,
  MultiFormatReader,
  DecodeHintType,
  BarcodeFormat,
} = require("@zxing/library");
const newShelfCode = "BROWSER-" + Date.now().toString(36);
const fixture = JSON.parse(
    fs.readFileSync(".data/warehouse-test-fixture.json"),
  ),
  origin = "http://127.0.0.1:3001";
async function decode(png, format) {
  const { data, info } = await sharp(png)
    .flatten({ background: "#fff" })
    .toColourspace("b-w")
    .raw()
    .toBuffer({ resolveWithObject: true });
  return new MultiFormatReader()
    .decode(
      new BinaryBitmap(
        new HybridBinarizer(
          new RGBLuminanceSource(
            new Uint8ClampedArray(data),
            info.width,
            info.height,
          ),
        ),
      ),
      new Map([
        [DecodeHintType.TRY_HARDER, true],
        [
          DecodeHintType.POSSIBLE_FORMATS,
          format ? [format] : [BarcodeFormat.CODE_128, BarcodeFormat.QR_CODE],
        ],
      ]),
    )
    .getText();
}
(async () => {
  let server, browser, page;
  try {
    try {
      await fetch(origin + "/api/health", { signal: AbortSignal.timeout(500) });
      throw Error("Test port already in use");
    } catch (e) {
      if (e.message === "Test port already in use") throw e;
    }
    const log = fs.openSync(".data/warehouse-browser-server.log", "w", 0o600);
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
          AUTH_SECRET: "warehouse-integration-local-test-secret-1234567890",
          NEXTAUTH_SECRET: "warehouse-integration-local-test-secret-1234567890",
          AUTH_URL: origin,
          NEXTAUTH_URL: origin,
          ALLOW_LOCAL_DATABASE: "1",
          ALLOW_INSECURE_HTTP: "1",
          NATIVE_INVENTORY_ENABLED: "1",
          OPENAI_API_KEY: "",
          ANTHROPIC_API_KEY: "",
          RESEND_API_KEY: "",
          WHATSAPP_ACCESS_TOKEN: "",
        },
        stdio: ["ignore", log, log],
      },
    );
    for (let i = 0; i < 60; i++) {
      try {
        if ((await fetch(origin + "/api/health")).ok) break;
      } catch {}
      await new Promise((r) => setTimeout(r, 500));
    }
    browser = await chromium.launch({
      headless: true,
      executablePath:
        "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    });
    const context = await browser.newContext({
        viewport: { width: 1440, height: 1000 },
        deviceScaleFactor: 3,
      }),
      errors = [],
      failed = [];
    page = await context.newPage();
    page.setDefaultTimeout(15000);
    page.setDefaultNavigationTimeout(30000);
    page.on("pageerror", (e) => errors.push(e.message));
    page.on("response", (r) => {
      if (r.url().startsWith(origin) && r.status() >= 500)
        failed.push(new URL(r.url()).pathname + ":" + r.status());
    });
    await page.goto(origin + "/auth/login");
    await page.getByLabel("E-posta adresi").fill(fixture.ownerEmail);
    await page.locator('input[name="password"]').fill(fixture.password);
    await page
      .getByRole("button", { name: "Çalışma alanına gir", exact: true })
      .click();
    await page.waitForURL("**/dashboard");
    const get = async () => {
      const r = await context.request.get(origin + "/api/v1/warehouse");
      assert.equal(r.status(), 200);
      return (await r.json()).data;
    };
    let data = await get(),
      initial = Number(
        data.balances.find(
          (b) => b.item_id === fixture.partId && b.location_id === fixture.aId,
        ).quantity,
      );
    await page.goto(origin + "/warehouse");
    await page
      .getByRole("heading", { name: "Her malzeme doğru yerde." })
      .waitFor();
    await page.waitForTimeout(300);
    console.log(
      "Desktop layout",
      await page.evaluate(() => ({
        page: document.querySelector(".rf-page").getBoundingClientRect().x,
        main: document
          .getElementById("workspace-content")
          .getBoundingClientRect().x,
        header: document
          .querySelector(".rf-workspace-header")
          .getBoundingClientRect().x,
        parentMargin: getComputedStyle(
          document.getElementById("workspace-content").parentElement,
        ).marginLeft,
      })),
    );
    await page.screenshot({
      path: ".data/warehouse-desktop.png",
      fullPage: true,
    });
    await page.getByRole("button", { name: "Yeni raf", exact: true }).click();
    await page
      .getByLabel("Depo", { exact: true })
      .selectOption(
        data.locations.find((l) => l.id === fixture.aId).warehouse_id,
      );
    await page.getByLabel("Raf kodu").fill(newShelfCode);
    await page.getByLabel("Raf adı").fill("Browser verified shelf");
    await page.getByRole("button", { name: "Rafı oluştur" }).click();
    await page
      .getByRole("status")
      .filter({ hasText: "Yeni raf oluşturuldu" })
      .waitFor();
    assert.equal(
      (await get()).locations.filter(
        (l) => l.code === newShelfCode.toUpperCase(),
      ).length,
      1,
    );
    console.log("PASS: signed-in warehouse overview and real shelf creation");
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(origin + "/warehouse/scan?code=" + fixture.locationCode);
    await page.getByRole("heading", { name: "A-01", exact: true }).waitFor();
    await page
      .getByRole("button", { name: "Raf transferi", exact: true })
      .click();
    await page
      .getByLabel("Malzeme", { exact: true })
      .selectOption(fixture.partId);
    await page
      .getByLabel("Kaynak raf", { exact: true })
      .selectOption(fixture.aId);
    await page
      .getByLabel("Hedef raf", { exact: true })
      .selectOption(fixture.bId);
    await page.getByLabel(/Taşınacak miktar/).fill("5");
    await page.getByLabel("Transfer notu").fill("Mobile browser transfer");
    await page.getByRole("button", { name: "Transferi onayla" }).click();
    await page
      .getByRole("status")
      .filter({ hasText: "Transfer kaydedildi" })
      .waitFor();
    data = await get();
    assert.equal(
      Number(
        data.balances.find(
          (b) => b.item_id === fixture.partId && b.location_id === fixture.aId,
        ).quantity,
      ),
      initial - 5,
    );
    await page
      .getByRole("button", { name: "Stok sayımı", exact: true })
      .click();
    await page.getByLabel(/Sayılan miktar/).fill(String(initial - 6));
    await page.getByLabel("Sayım gerekçesi").fill("Browser physical recount");
    await page.getByRole("button", { name: "Sayıma gönder" }).click();
    await page
      .getByRole("status")
      .filter({ hasText: "yönetici incelemesine" })
      .waitFor();
    data = await get();
    const count = data.counts.find(
      (c) => c.reason === "Browser physical recount",
    );
    assert.equal(count.status, "pending");
    assert.equal(
      Number(
        data.balances.find(
          (b) => b.item_id === fixture.partId && b.location_id === fixture.aId,
        ).quantity,
      ),
      initial - 5,
    );
    await page.goto(origin + "/warehouse");
    await page.getByRole("button", { name: /Sayım & kontrol/ }).click();
    await page
      .getByLabel("İnceleme notu " + count.id)
      .fill("Verified browser recount");
    const card = page
      .locator("article")
      .filter({ has: page.getByLabel("İnceleme notu " + count.id) });
    await card.getByRole("button", { name: "Sayımı onayla" }).click();
    await page
      .getByRole("status")
      .filter({ hasText: "Sayım onaylandı" })
      .waitFor();
    assert.equal(
      (await get()).counts.find((c) => c.id === count.id).status,
      "approved",
    );
    console.log(
      "PASS: mobile transfer with real ledger persistence, pending count and manager approval",
    );
    await page.goto(
      origin + "/warehouse/labels?kind=location&id=" + fixture.aId,
    );
    await page.getByRole("button", { name: "Baskı listesine ekle" }).click();
    await page.locator(".rf-factory-label img").waitFor();
    await page.getByRole("button", { name: "1 etiket yazdır" }).waitFor();
    await page.waitForFunction(
      () =>
        !Array.from(document.querySelectorAll("button")).find((b) =>
          b.textContent.includes("1 etiket yazdır"),
        )?.disabled,
    );
    const labelCode = await page.locator(".rf-label-human").textContent(),
      qr = await page.locator(".rf-factory-label img").screenshot(),
      bar = await page.locator(".rf-label-barcode").screenshot();
    fs.writeFileSync(".data/rendered-barcode.png", bar);
    fs.writeFileSync(".data/rendered-qr.png", qr);
    assert.equal(await decode(bar), labelCode);
    assert.ok((await decode(qr)).endsWith("/warehouse/scan?code=" + labelCode));
    await page.evaluate(() => {
      window.print = () => {
        window.__printCalls = (window.__printCalls || 0) + 1;
      };
    });
    await page.getByRole("button", { name: "1 etiket yazdır" }).click();
    await page.waitForFunction(() => window.__printCalls === 1);
    await page.getByLabel("Baskı düzeni").selectOption("100x70");
    await page.emulateMedia({ media: "print" });
    await page.pdf({
      path: ".data/warehouse-label-100x70.pdf",
      preferCSSPageSize: true,
      printBackground: true,
    });
    assert.match(
      execFileSync("pdfinfo", [".data/warehouse-label-100x70.pdf"], {
        encoding: "utf8",
      }),
      /Pages:\s+1\b/,
    );
    const printWidth = await page
      .locator(".rf-factory-label")
      .evaluate((e) => e.getBoundingClientRect().width);
    assert.ok(Math.abs(printWidth - (100 * 96) / 25.4) < 1);
    execFileSync("pdftoppm", [
      "-r",
      "203",
      "-png",
      "-singlefile",
      ".data/warehouse-label-100x70.pdf",
      ".data/warehouse-print-203dpi",
    ]);
    const printed = fs.readFileSync(".data/warehouse-print-203dpi.png");
    assert.equal(await decode(printed, BarcodeFormat.CODE_128), labelCode);
    assert.ok(
      (await decode(printed, BarcodeFormat.QR_CODE)).endsWith(
        "/warehouse/scan?code=" + labelCode,
      ),
    );
    await page.emulateMedia({ media: "screen" });
    await page.getByLabel("Baskı düzeni").selectOption("80x50");
    await page.emulateMedia({ media: "print" });
    await page.pdf({
      path: ".data/warehouse-label-80x50.pdf",
      preferCSSPageSize: true,
      printBackground: true,
    });
    assert.match(
      execFileSync("pdfinfo", [".data/warehouse-label-80x50.pdf"], {
        encoding: "utf8",
      }),
      /Pages:\s+1\b/,
    );
    const compactWidth = await page
      .locator(".rf-factory-label")
      .evaluate((e) => e.getBoundingClientRect().width);
    assert.ok(Math.abs(compactWidth - (80 * 96) / 25.4) < 1);
    await page.emulateMedia({ media: "screen" });
    await page.getByLabel("Her etiketten kopya").fill("2");
    await page.waitForFunction(
      () => document.querySelectorAll(".rf-factory-label img").length === 2,
    );
    await page.emulateMedia({ media: "print" });
    await page.pdf({
      path: ".data/warehouse-label-two-copies.pdf",
      preferCSSPageSize: true,
      printBackground: true,
    });
    assert.match(
      execFileSync("pdfinfo", [".data/warehouse-label-two-copies.pdf"], {
        encoding: "utf8",
      }),
      /Pages:\s+2\b/,
    );
    await page.emulateMedia({ media: "screen" });
    await page.getByLabel("Baskı düzeni").selectOption("a4");
    await page.emulateMedia({ media: "print" });
    await page.pdf({
      path: ".data/warehouse-label-a4.pdf",
      preferCSSPageSize: true,
      printBackground: true,
    });
    assert.match(
      execFileSync("pdfinfo", [".data/warehouse-label-a4.pdf"], {
        encoding: "utf8",
      }),
      /Pages:\s+1\b/,
    );
    await page.emulateMedia({ media: "screen" });
    console.log(
      "PASS: printed QR and Code 128 decode to same identity; 100x70 and 80x50 thermal PDF dimensions",
    );
    for (const path of [
      "/dashboard",
      "/warehouse",
      "/warehouse/scan",
      "/warehouse/labels",
      "/inventory",
      "/factory",
      "/production",
    ]) {
      await page.goto(origin + path);
      await page.waitForTimeout(700);
      assert.equal(
        await page.evaluate(
          () => document.documentElement.scrollWidth > innerWidth + 1,
        ),
        false,
        path + " mobile overflow",
      );
    }
    await page.goto(origin + "/warehouse/scan");
    await page.getByRole("button", { name: "Kamerayla okut" }).click();
    await page
      .getByRole("alert")
      .filter({ hasText: /Kamera/ })
      .waitFor();
    assert.ok(await page.getByLabel("Etiket veya barkod kodu").isEnabled());
    await context.setOffline(true);
    await page.getByRole("button", { name: "Raf transferi" }).click();
    await page
      .getByRole("status")
      .filter({ hasText: "Çevrim dışısınız" })
      .waitFor();
    assert.ok(
      await page.getByRole("button", { name: "Transferi onayla" }).isDisabled(),
    );
    await context.setOffline(false);
    await page.screenshot({
      path: ".data/warehouse-mobile.png",
      fullPage: true,
    });
    const anonymous = await browser.newContext();
    assert.equal(
      (await anonymous.request.get(origin + "/api/v1/warehouse")).status(),
      401,
    );
    await anonymous.close();
    assert.deepEqual(errors, []);
    assert.deepEqual(failed, []);
    console.log(
      "PASS: mobile pages, camera-denied fallback, offline write protection, anonymous rejection; no 5xx/browser exceptions",
    );
  } catch (e) {
    if (page) {
      fs.writeFileSync(
        ".data/warehouse-browser-failure.txt",
        (await page.locator("body").innerText()).slice(0, 18000),
        { mode: 0o600 },
      );
      await page
        .screenshot({
          path: ".data/warehouse-browser-failure.png",
          fullPage: true,
        })
        .catch(() => {});
    }
    console.error(e);
    process.exitCode = 1;
  } finally {
    await browser?.close();
    server?.kill();
  }
})();
