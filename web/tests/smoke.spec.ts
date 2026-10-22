import { test, expect } from '@playwright/test';

test('Smoke test - App loads', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveTitle(/MedTrace/i);
});
