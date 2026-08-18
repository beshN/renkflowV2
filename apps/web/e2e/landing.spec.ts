import { expect, test } from "@playwright/test";

test("landing and health endpoint are operational", async ({ page, request }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: /Sipariş PDF/ })).toBeVisible();
  await expect(page.getByText("Daha küçük kapsam.")).toBeVisible();

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
