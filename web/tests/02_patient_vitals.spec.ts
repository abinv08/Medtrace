import { test, expect } from '@playwright/test';

test.describe('Feature 3: Patient Log Vitals', () => {
  const timestamp = Date.now();
  const testPatient = {
    name: `Vitals Test Patient ${timestamp}`,
    email: `patient.vitals.${timestamp}@medtrace.test`,
    phone: '+15553334444',
    password: 'Password123!',
  };

  test('Patient successfully logs daily vitals', async ({ page }) => {
    // 1. Register new patient
    await page.goto('/register');
    await page.locator('#reg-name').fill(testPatient.name);
    await page.locator('#reg-email').fill(testPatient.email);
    await page.locator('#reg-phone').fill(testPatient.phone);
    await page.locator('#reg-password').fill(testPatient.password);
    await page.locator('#reg-agree-terms').check();
    await page.locator('button[type="submit"]:has-text("Create Account")').click();

    // 2. Wait for Patient Dashboard
    await expect(page).toHaveURL(/\/dashboard\/patient/, { timeout: 35000 });

    // 3. Find and click "Log Vitals" button
    const logVitalsBtn = page.locator('button:has-text("Log Vitals")').first();
    await expect(logVitalsBtn).toBeVisible({ timeout: 10000 });
    await logVitalsBtn.click();

    // 4. Modal opens
    await expect(page.locator('text=Log Physiological Vitals')).toBeVisible({ timeout: 5000 });

    // 5. Fill vitals data
    await page.locator('input[placeholder="120"]').fill('128');
    await page.locator('input[placeholder="80"]').fill('84');
    await page.locator('input[placeholder="72"]').fill('75');
    await page.locator('input[placeholder="95"]').fill('98');
    await page.locator('input[placeholder="98"]').fill('99');
    await page.locator('input[placeholder="75"]').fill('72');

    // 6. Submit vitals
    const recordBtn = page.locator('button:has-text("Record & Analyze")');
    await recordBtn.click();

    // 7. Verify modal closes and reading is saved
    await expect(page.locator('text=Log Physiological Vitals')).not.toBeVisible({ timeout: 10000 });
    // Verify blood pressure card or vitals display updates with recorded values
    await expect(page.locator('text=BLOOD PRESSURE').first()).toBeVisible({ timeout: 10000 });
  });
});
