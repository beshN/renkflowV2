import { expect, test } from "@playwright/test";

test.describe("authenticated order to production flow", () => {
  test.skip(!process.env.E2E_EMAIL || !process.env.E2E_PASSWORD, "Dedicated Supabase E2E user is required.");

  test("sign in, create order and verify the PDF entry point", async ({ page }) => {
    await page.goto("/giris");
    await page.getByLabel("E-posta").fill(process.env.E2E_EMAIL!);
    await page.getByLabel("Parola", { exact: true }).fill(process.env.E2E_PASSWORD!);
    await page.getByRole("button", { name: "Giriş yap" }).click();
    await expect(page).toHaveURL(/\/panel/);

    await page.goto("/panel/siparisler/yeni");
    await page.getByLabel("Müşteri adı").fill("E2E Müşteri");
    await page.getByLabel("Proje adı").fill("E2E Proje");
    await page.getByRole("button", { name: "Siparişi oluştur" }).click();
    await expect(page).toHaveURL(/\/panel\/siparisler\/[a-f0-9-]+/);
    await expect(page.getByText("PDF yüklenmedi")).toBeVisible();
    await expect(page.getByRole("button", { name: "PDF yükle ve analiz et" })).toBeVisible();
  });
});
