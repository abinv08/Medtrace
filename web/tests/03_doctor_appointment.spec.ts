import { test, expect } from '@playwright/test';

test.describe('Feature 4: Doctor Appointment Booking', () => {
  const timestamp = Date.now();
  const testPatient = {
    name: `Apt Patient ${timestamp}`,
    email: `apt.patient.${timestamp}@medtrace.test`,
    phone: '+15554445555',
    password: 'Password123!',
  };

  test('Patient books an appointment with doctor', async ({ page }) => {
    // 1. Register new patient
    await page.goto('/register');
    await page.locator('#reg-name').fill(testPatient.name);
    await page.locator('#reg-email').fill(testPatient.email);
    await page.locator('#reg-phone').fill(testPatient.phone);
    await page.locator('#reg-password').fill(testPatient.password);
    await page.locator('#reg-agree-terms').check();
    await page.locator('button[type="submit"]:has-text("Create Account")').click();

    // 2. Wait for patient dashboard
    await expect(page).toHaveURL(/\/dashboard\/patient/, { timeout: 35000 });

    // 3. Click "Book Appointment" button
    const bookBtn = page.locator('button:has-text("Book Appointment")');
    await expect(bookBtn).toBeVisible({ timeout: 10000 });
    await bookBtn.click();

    // 4. Modal opens
    await expect(page.locator('text=Book Clinical Consultation')).toBeVisible({ timeout: 5000 });

    // 5. Select doctor if needed or pick a slot
    const slotChip = page.locator('text=10:30 AM').or(page.locator('text=02:00 PM')).first();
    if (await slotChip.isVisible()) {
      await slotChip.click();
    }

    // 6. Enter reason for visit
    const reasonInput = page.locator('textarea[placeholder*="Describe symptoms"]');
    await reasonInput.fill('Routine quarterly cardiovascular checkup and vitals assessment.');

    // 7. Click Confirm Booking
    const confirmBtn = page.locator('button:has-text("Confirm Booking")');
    await confirmBtn.click();

    // 8. Verify modal closes
    await expect(page.locator('text=Book Clinical Consultation')).not.toBeVisible({ timeout: 10000 });

    // 9. Verify toast or confirmation
    await expect(
      page.locator('text=Appointment booked').or(page.locator('text=Upcoming Appointments')).or(page.locator('text=Dr. Alexander Wright'))
    ).toBeVisible({ timeout: 10000 });
  });
});
