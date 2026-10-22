import { test, expect } from '@playwright/test';

test.describe('Feature 6: Nurses Active Check & Duty Management', () => {
  const timestamp = Date.now();
  const testNurse = {
    name: `Nurse Florence ${timestamp}`,
    email: `nurse.florence.${timestamp}@medtrace.test`,
    phone: '+15557778888',
    password: 'Password123!',
    license: `RN-${timestamp.toString().slice(-6)}`,
  };

  test('Nurse registration and Active Duty status check', async ({ page }) => {
    // 1. Navigate to Register
    await page.goto('/register');
    await expect(page.locator('text=Create Your Account')).toBeVisible();

    // 2. Select "Nurse" role
    const nurseRoleTile = page.locator('div[role="radio"][aria-label*="Nurse"]');
    await nurseRoleTile.click();

    // 3. Fill personal details
    await page.locator('#reg-name').fill(testNurse.name);
    await page.locator('#reg-email').fill(testNurse.email);
    await page.locator('#reg-phone').fill(testNurse.phone);

    // 4. Fill credentials for nurse
    const specField = page.locator('#reg-specialization');
    if (await specField.isVisible()) {
      await specField.click();
      await page.getByRole('option', { name: 'Nursing & Clinical Care' }).click();
    }

    const licenseInput = page.locator('#reg-license');
    if (await licenseInput.isVisible()) {
      await licenseInput.fill(testNurse.license);
    }

    const regDateInput = page.locator('#reg-registered-date');
    if (await regDateInput.isVisible()) {
      await regDateInput.fill('2026-01-01');
    }

    // 5. Fill password & terms
    await page.locator('#reg-password').fill(testNurse.password);
    await page.locator('#reg-agree-terms').check();

    // 6. Submit registration
    await page.locator('button[type="submit"]:has-text("Create Account")').click();

    // 7. Redirect to nurse dashboard
    await expect(page).toHaveURL(/\/dashboard\/nurse/, { timeout: 15000 });

    // 8. Verify Nurse Rounds interface & Active duty status indicators
    await expect(page.locator('text=Nurse rounds')).toBeVisible({ timeout: 10000 });
    await expect(
      page.locator('text=Active duty').or(page.locator('text=Off duty')).or(page.locator('text=Upcoming duty'))
    ).toBeVisible({ timeout: 10000 });

    // 9. Verify Assigned patients / rounds roster section is displayed
    await expect(page.getByRole('heading', { name: 'Assigned patients' })).toBeVisible({ timeout: 10000 });
  });
});
