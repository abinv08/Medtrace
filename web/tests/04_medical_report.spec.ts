import { test, expect } from '@playwright/test';
import path from 'path';

test.describe('Feature 5: Medical Report Upload & Analysis', () => {
  const timestamp = Date.now();
  const testPatient = {
    name: `Report Patient ${timestamp}`,
    email: `report.patient.${timestamp}@medtrace.test`,
    phone: '+15556667777',
    password: 'Password123!',
  };

  test('Patient uploads medical report document and triggers analysis', async ({ page }) => {
    // 1. Register fresh Patient
    await page.goto('/register', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('#reg-name')).toBeVisible({ timeout: 15000 });
    await page.locator('#reg-name').fill(testPatient.name);
    await page.locator('#reg-email').fill(testPatient.email);
    await page.locator('#reg-phone').fill(testPatient.phone);
    await page.locator('#reg-password').fill(testPatient.password);
    await page.locator('#reg-agree-terms').check();
    await page.locator('button[type="submit"]:has-text("Create Account")').click();
    await expect(page).toHaveURL(/\/dashboard\/patient/, { timeout: 35000 });

    // 2. Navigate to Medical Report Analysis page from Dashboard
    const reportNavBtn = page.locator('button:has-text("AI Report Analysis")');
    if (await reportNavBtn.isVisible()) {
      await reportNavBtn.click();
    } else {
      await page.goto('/report/analysis');
    }
    await expect(page.locator('text=AI Medical Report Analysis')).toBeVisible({ timeout: 15000 });

    // 3. Upload report file
    const filePath = path.resolve('tests/fixtures/sample_blood_report.pdf');
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles(filePath);

    // 4. Verify file preview shows the uploaded file name
    await expect(page.locator('text=sample_blood_report.pdf')).toBeVisible({ timeout: 5000 });

    // 5. Select Report Type if available
    const reportTypeSelect = page.locator('div[role="combobox"]').or(page.locator('#mui-component-select-reportType')).first();
    if (await reportTypeSelect.isVisible()) {
      await reportTypeSelect.click();
      await page.locator('li:has-text("Lab / Blood Test")').first().click();
    }

    // 6. Click Analyze button
    const analyzeBtn = page.locator('button:has-text("Analyze with AI")');
    await expect(analyzeBtn).toBeEnabled({ timeout: 5000 });
    await analyzeBtn.click();

    // 7. Verify progress / processing begins
    await expect(page.getByRole('button', { name: /Analyzing Report/i })).toBeVisible({ timeout: 15000 });
  });
});
