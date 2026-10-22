import { test, expect } from '@playwright/test';

test.describe('Feature 1 & 2: Registration and Login', () => {
  const timestamp = Date.now();
  const testUser = {
    name: `Test Patient ${timestamp}`,
    email: `playwright.patient.${timestamp}@medtrace.test`,
    phone: '+15552345678',
    password: 'Password123!',
  };

  test('Registration - Successfully registers a new patient', async ({ page }) => {
    await page.goto('/register');
    await expect(page.locator('text=Create Your Account')).toBeVisible();

    // Fill registration form
    await page.locator('#reg-name').fill(testUser.name);
    await page.locator('#reg-email').fill(testUser.email);
    await page.locator('#reg-phone').fill(testUser.phone);
    await page.locator('#reg-password').fill(testUser.password);

    // Ensure role is Patient
    const patientRoleTile = page.locator('div[role="radio"][aria-label*="Patient"]');
    if (await patientRoleTile.isVisible()) {
      await patientRoleTile.click();
    }

    // Agree to terms checkbox
    await page.locator('#reg-agree-terms').check();

    // Submit form
    await page.locator('button[type="submit"]:has-text("Create Account")').click();

    // Expect successful redirect to patient dashboard
    await expect(page).toHaveURL(/\/dashboard\/patient/, { timeout: 15000 });
    await expect(page.locator('text=Patient Workspace').or(page.locator('text=Welcome to MedTrace')).or(page.locator('text=Health Trends'))).toBeVisible({ timeout: 15000 });
  });

  test('Login - Successfully authenticates existing patient', async ({ page }) => {
    await page.goto('/login');
    await expect(page.getByRole('heading', { name: 'Sign In' })).toBeVisible();

    // Fill credentials
    await page.locator('#login-email').fill(testUser.email);
    await page.locator('#login-password').fill(testUser.password);

    // Click submit
    await page.locator('button[type="submit"]:has-text("Sign In to MedTrace")').click();

    // Expect redirect to patient dashboard
    await expect(page).toHaveURL(/\/dashboard\/patient/, { timeout: 15000 });
    await expect(page.getByRole('button', { name: /Sign Out/i })).toBeVisible({ timeout: 15000 });
  });
});
