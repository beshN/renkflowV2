import { expect, test } from "@playwright/test";

test("landing and health endpoint are operational", async ({ page, request }) => {
  const pageResponse = await page.goto("/");
  expect(pageResponse?.status()).toBe(200);
  expect(pageResponse?.headers()["content-security-policy"]).toContain("frame-ancestors 'none'");
  expect(pageResponse?.headers()["x-content-type-options"]).toBe("nosniff");
  await expect(page.getByRole("heading", { name: /Üretim operasyonunuz/ })).toBeVisible();
  await expect(page.getByRole("heading", { name: /Eski kapsam, daha sağlam bir temel/ })).toBeVisible();
  await expect(page.getByAltText("RenkFlow").first()).toBeVisible();

  const response = await request.get("/api/health");
  expect(response.status()).toBe(200);
  await expect(response.json()).resolves.toMatchObject({ status: "ok", service: "renkflow-web" });
});

test("auth entry points render", async ({ page }) => {
  await page.goto("/giris");
  await expect(page.getByRole("heading", { name: "Tekrar hoş geldiniz." })).toBeVisible();
  await page.goto("/kayit");
  await expect(page.getByRole("heading", { name: /Şirketinizi RenkFlow/ })).toBeVisible();
});
