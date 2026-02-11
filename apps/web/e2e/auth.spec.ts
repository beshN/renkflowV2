import { test, expect } from '@playwright/test';

test.describe('Authentication Flow', () => {
  test('should navigate to login page', async ({ page }) => {
    await page.goto('/');
    await page.locator('a[href="/auth/login"]').first().click();
    await expect(page).toHaveURL(/auth\/login/);
    await expect(page.locator('input[type="email"]')).toBeVisible();
  });

  test('should navigate to signup page', async ({ page }) => {
    await page.goto('/');
    await page.locator('a[href="/signup"]').first().click();
    await expect(page).toHaveURL(/signup/);
    await expect(page.locator('input[type="email"]')).toBeVisible();
  });

  test('should display login form elements', async ({ page }) => {
    await page.goto('/auth/login');
    await expect(page.locator('input[type="email"]')).toBeVisible();
    await expect(page.locator('input[type="password"]')).toBeVisible();
    await expect(page.locator('button[type="submit"]')).toBeVisible();
  });
});
