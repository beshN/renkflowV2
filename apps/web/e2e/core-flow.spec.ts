import { expect, test } from "@playwright/test";
import { PDFDocument } from "pdf-lib";

test.describe("authenticated order to production flow", () => {
  test.skip(!process.env.E2E_EMAIL || !process.env.E2E_PASSWORD, "Dedicated Supabase E2E user is required.");

  test("sign in, create the workspace and upload an order PDF", async ({ page }) => {
    await page.goto("/giris");
    await page.getByLabel("E-posta").fill(process.env.E2E_EMAIL!);
    await page.getByLabel("Parola", { exact: true }).fill(process.env.E2E_PASSWORD!);
    await page.getByRole("button", { name: "Giriş yap" }).click();

    await expect(
      page.getByLabel("Şirket adı").or(page.getByRole("link", { name: /Yeni Sipariş/ })).first(),
    ).toBeVisible();
    if (new URL(page.url()).pathname === "/kurulum") {
      await page.getByLabel("Şirket adı").fill(`RenkFlow E2E ${Date.now()}`);
      await page.getByRole("button", { name: "Çalışma alanını oluştur" }).click();
      await expect(page).toHaveURL(/\/panel(?:\/|$)/);
    }

    await page.goto("/panel/siparisler/yeni");
    await page.getByLabel("Müşteri adı").fill("E2E Müşteri");
    await page.getByLabel("Proje adı").fill("E2E Proje");
    await page.getByRole("button", { name: "Siparişi oluştur" }).click();
    await expect(page).toHaveURL(/\/panel\/siparisler\/[a-f0-9-]+/);
    await expect(page.getByText("PDF yüklenmedi")).toBeVisible();

    const pdf = await PDFDocument.create();
    pdf.addPage([595, 842]);
    const bytes = await pdf.save();
    await page.getByLabel("PDF dosyası").setInputFiles({
      name: "e2e-siparis.pdf",
      mimeType: "application/pdf",
      buffer: Buffer.from(bytes),
    });
    await page.getByRole("button", { name: "PDF yükle ve analiz et" }).click();
    await expect(page.locator("iframe[title='e2e-siparis.pdf']")).toBeVisible({ timeout: 30_000 });
  });

  test("review extracted fields and start production", async ({ page }) => {
    test.skip(!process.env.E2E_REVIEW_ORDER_ID, "A seeded review analysis is required.");

    await page.goto("/giris");
    await page.getByLabel("E-posta").fill(process.env.E2E_EMAIL!);
    await page.getByLabel("Parola", { exact: true }).fill(process.env.E2E_PASSWORD!);
    await page.getByRole("button", { name: "Giriş yap" }).click();
    await expect(page.getByRole("link", { name: /Yeni Sipariş/ }).first()).toBeVisible();

    await page.goto(`/panel/siparisler/${process.env.E2E_REVIEW_ORDER_ID}`);
    await expect(page.getByRole("heading", { name: "Ofis kontrolü" })).toBeVisible();
    await page.getByRole("textbox", { name: /^Müşteri / }).fill("E2E Doğrulanmış Müşteri");
    await page.getByRole("button", { name: "Doğrula ve onayla" }).click();
    await expect(page.getByText("Onaylandı", { exact: true })).toBeVisible();

    await page.goto("/panel/uretim");
    await page.getByRole("button", { name: "Hazırlık aşamasını başlat" }).click();
    await expect(page.getByText("Hazırlık devam ediyor.")).toBeVisible();
  });
});
