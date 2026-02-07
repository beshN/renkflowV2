import { test, expect } from '@playwright/test';

test.describe('Authentication Flow', () => {
  test('should navigate to login page', async ({ page }) => {
    await page.goto('/');
    await page.click('text=Giriş Yap');
    await expect(page).toHaveURL(/auth\/login/);
    await expect(page.locator('h1')).toContainText(/Giriş|Login/i);
  });

  test('should navigate to signup page', async ({ page }) => {
    await page.goto('/');
    await page.click('text=Ücretsiz Başlayın');
    await expect(page).toHaveURL(/signup/);
  });

  test('should display login form elements', async ({ page }) => {
    await page.goto('/auth/login');
    await expect(page.locator('input[type="email"]')).toBeVisible();
    await expect(page.locator('input[type="password"]')).toBeVisible();
    await expect(page.locator('button[type="submit"]')).toBeVisible();
  });
});
