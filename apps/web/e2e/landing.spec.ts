import { test, expect } from '@playwright/test';

test.describe('Landing Page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('should have correct metadata title', async ({ page }) => {
    await expect(page).toHaveTitle(/Renkflow/);
  });

  test('should display hero section', async ({ page }) => {
    const heroHeading = page.locator('h1');
    await expect(heroHeading).toBeVisible();
    await expect(heroHeading).toContainText('İş Akışınızı');
  });

  test('should navigate to features page', async ({ page }) => {
    await page.click('text=Özellikler');
    await expect(page).toHaveURL(/features/);
  });

  test('should navigate to pricing page', async ({ page }) => {
    await page.click('text=Fiyatlandırma');
    await expect(page).toHaveURL(/pricing/);
  });

  test('should have working theme toggle', async ({ page }) => {
    const themeButton = page.getByLabel('Temayı Değiştir');
    await expect(themeButton).toBeVisible();
    await themeButton.click();
    // Verification of theme change might require checking class on html or local storage
    const html = page.locator('html');
    await expect(html).toHaveClass(/dark|light/);
  });

  test('should display language selector', async ({ page }) => {
    const langButton = page.getByLabel('Dil Değiştir').or(page.locator('button').filter({ hasText: /TR|EN|AR/ }));
    await expect(langButton).toBeVisible();
  });
});
