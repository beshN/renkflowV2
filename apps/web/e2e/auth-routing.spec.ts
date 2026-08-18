import { expect, test } from "@playwright/test";

test("protected pages preserve the intended destination", async ({ page }) => {
  await page.goto("/panel/uretim");
  await expect(page).toHaveURL(/\/giris\?next=%2Fpanel%2Furetim$/);
  await expect(page.locator('input[name="next"]')).toHaveValue("/panel/uretim");
});

test("authentication callback cannot redirect to another origin", async ({ request }) => {
  const response = await request.get("/auth/callback?next=https://example.com", { maxRedirects: 0 });
  expect(response.status()).toBe(307);
  expect(response.headers().location).toMatch(/\/giris\?error=callback$/);
});

test("password and invite entry points fail safely", async ({ page }) => {
  await page.goto("/parola-yenile");
  await expect(page.getByLabel("Yeni parola", { exact: true })).toBeVisible();
  await expect(page.getByLabel("Yeni parola tekrar")).toBeVisible();

  await page.goto("/davet");
  await expect(page).toHaveURL(/\/giris$/);
});
