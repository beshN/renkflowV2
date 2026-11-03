import { test, expect } from '@playwright/test';

test.describe('Landing Page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('should have correct metadata title', async ({ page }) => {
    await expect(page).toHaveTitle(/RenkFlow/i);
  });

  test('should display hero section', async ({ page }) => {
    const heroHeading = page.locator('h1');
    await expect(heroHeading).toBeVisible();
    await expect(heroHeading).toContainText(
      /Ölçü bir kez girilir.*Teklif, kesim ve sevkiyat ondan çıkar/s,
    );
  });

  test('should open public features page', async ({ page }) => {
    await page.goto('/features');
    await expect(page).toHaveURL(/features/);
    await expect(page.locator('body')).toBeVisible();
  });

  test('should open public pricing page', async ({ page }) => {
    await page.goto('/pricing');
    await expect(page).toHaveURL(/pricing/);
    await expect(page.locator('body')).toBeVisible();
  });

  test('should have working theme toggle', async ({ page }) => {
    const themeButton = page
      .getByLabel(/Temayı Değiştir|Toggle Theme|السمة/i)
      .or(page.locator('button:has(svg.lucide-moon), button:has(svg.lucide-sun)').first());
    await expect(themeButton).toBeVisible();
    await themeButton.click();
    const html = page.locator('html');
    await expect(html).toHaveClass(/dark|light/);
  });

  // The current public header has product navigation, rather than a language selector.
  test('should display public navigation', async ({ page }) => {
    const menu = page.getByRole('navigation', { name: 'Ana menü', exact: true });
    await expect(menu.getByRole('link', { name: 'Özellikler', exact: true })).toHaveAttribute('href', '/features');
    await expect(menu.getByRole('link', { name: 'Fiyatlandırma', exact: true })).toHaveAttribute('href', '/pricing');
  });
});
