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
      /Üretim|Optimize|Production|Workflow|الإنتاج|Ekiplerinizi|tek merkezden/i,
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

  test('should display language selector', async ({ page }) => {
    const langButton = page
      .getByRole('button', { name: /Dil|Language|اللغة|Türkçe|English|العربية/i })
      .or(page.locator('button[aria-haspopup="listbox"]').first());
    await expect(langButton).toBeVisible();
  });
});
