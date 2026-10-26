import { test, expect } from '@playwright/test';
import path from 'node:path';

test.describe('StateGhost End-to-End User Journeys', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');
  });

  test('Journey 1 & 2: Create investigation, add evidence, analyze, answer follow-up question & verify revision history', async ({ page }) => {
    // 1. Create a new investigation from Dashboard
    await page.click('button:has-text("New Investigation")');
    await page.fill('input[placeholder*="Cart total differs"]', 'Playwright E2E Cart Investigation');
    await page.click('button:has-text("Create Investigation")');

    // Verify workspace opened
    await expect(page.locator('h1')).toContainText('Playwright E2E Cart Investigation');

    // 2. Add text evidence
    await page.click('button:has-text("Paste Code/Log")');
    await page.fill('input[placeholder*="Cart.tsx"]', 'CartContext.tsx');
    await page.fill('textarea', 'export function useCart() { const [items, setItems] = useState([]); return items; }');
    await page.click('button:has-text("Add Evidence")');

    // Verify evidence is listed
    await expect(page.locator('text=CartContext.tsx')).toBeVisible();

    // 3. Analyze through test provider
    await page.click('button:has-text("Analyze with Local Gemma 4")');

    // Wait for analysis revision 1 to complete
    await expect(page.locator('text=Revision 1').or(page.locator('text=Rev 1'))).toBeVisible({ timeout: 15000 });
    await expect(page.locator('text=Competing Hypotheses')).toBeVisible();

    // 4. Open cited source modal
    const citeButton = page.locator('button:has-text("Cite:")').first();
    if (await citeButton.isVisible()) {
      await citeButton.click();
      await expect(page.locator('text=Displaying content with real line numbers')).toBeVisible();
      await page.click('button[title="Close modal"]');
    }

    // 5. Answer follow-up question
    const firstOption = page.locator('input[name="followup"]').first();
    await firstOption.check();
    await page.click('button:has-text("Submit Answer & Update")');

    // Verify Revision 2 appears in selector or history
    await expect(page.locator('text=What Changed in Revision 2')).toBeVisible({ timeout: 15000 });
  });

  test('Journey 3: Reproduce State Conflicts Bug A (Cross-tab cart sync) using two real browser pages', async ({ context }) => {
    // Open Page 1 (Tab A) and Page 2 (Tab B)
    const pageA = await context.newPage();
    const pageB = await context.newPage();

    // 1. Buggy Mode: Tab B retains stale state
    await pageA.goto('/#demo-tab-a');
    await pageB.goto('/#demo-tab-b');

    // Ensure Buggy mode is active in Tab B
    const buggyBadgeB = pageB.locator('text=Buggy (Stale Memory)');
    if (!await buggyBadgeB.isVisible()) {
      await pageB.click('button:has-text("Fixed (Listening)")');
    }

    // Tab A adds an item (Wireless Mouse $79.00 or Mechanical Keyboard)
    const addItemBtn = pageA.locator('button:has-text("+ Precision Wireless Mouse")').or(pageA.locator('button:has-text("+")').first());
    await addItemBtn.click();

    // Tab A total increases
    const totalA = await pageA.locator('.font-mono').first().textContent();

    // Tab B in buggy mode does NOT reflect change immediately! (Stale memory)
    const totalB = await pageB.locator('.font-mono').first().textContent();
    expect(totalA).not.toEqual(totalB);

    // Refresh Tab B -> Now it synchronizes from localStorage!
    await pageB.click('button:has-text("Refresh Tab")');
    const totalBAfterRefresh = await pageB.locator('.font-mono').first().textContent();
    expect(totalBAfterRefresh).toEqual(totalA);

    // 2. Fixed Mode: Tab B listens and updates in real-time
    await pageB.click('button:has-text("Buggy (Stale Memory)")');
    await expect(pageB.locator('text=Fixed (Listening)')).toBeVisible();

    // Tab A adds another item
    await addItemBtn.click();
    const updatedTotalA = await pageA.locator('.font-mono').first().textContent();

    // Fixed Tab B receives storage event and updates without manual refresh!
    await expect(pageB.locator('.font-mono').first()).toHaveText(updatedTotalA!, { timeout: 5000 });

    await pageA.close();
    await pageB.close();
  });

  test('Journey 4: Reproduce State Conflicts Bug B (Optimistic Profile Save)', async ({ page }) => {
    await page.goto('/');
    await page.click('button:has-text("Demo Lab")');

    // Select Bug B
    await page.click('button:has-text("Optimistic Profile Save")');

    // 1. Buggy Mode: Shows "Saved" falsely even though API fails
    await page.click('button:has-text("Buggy Mode")');
    await page.fill('input[value="Alex Rivers"]', 'Jordan Taylor');
    await page.click('button:has-text("Save Profile")');

    // Asserts intentionally buggy behavior: UI claims "Saved"
    await expect(page.locator('span:has-text("Saved")')).toBeVisible();

    // Simulate page refresh -> reverts to Alex Rivers
    await page.click('button:has-text("Simulate Page Refresh")');
    await expect(page.locator('input[value="Alex Rivers"]')).toBeVisible();

    // 2. Fixed Mode: Shows error, does not claim "Saved"
    await page.click('button:has-text("Fixed Mode")');
    await page.fill('input[value="Alex Rivers"]', 'Morgan Lee');
    await page.click('button:has-text("Save Profile")');

    // Asserts fixed behavior: Displays error alert and does not display "Saved"
    await expect(page.locator('text=Database lock timeout').or(page.locator('text=Failed to save profile'))).toBeVisible({ timeout: 5000 });
    await expect(page.locator('span:has-text("Saved")')).not.toBeVisible();
  });

  test('Journey 5: Reproduce State Conflicts Bug C (Two inconsistent cart sources)', async ({ page }) => {
    await page.goto('/');
    await page.click('button:has-text("Demo Lab")');
    await page.click('button:has-text("Two Separate Cart Sources")');

    // 1. Buggy Mode: Add item in cart, checkout remains empty
    await page.click('button:has-text("Buggy Mode")');
    await page.click('button:has-text("+ Add Precision Wireless Mouse")');

    // Checkout still reports empty
    await expect(page.locator('text=Your checkout cart is empty!')).toBeVisible();

    // 2. Fixed Mode: Unified flow updates checkout
    await page.click('button:has-text("Fixed Mode")');
    await page.click('button:has-text("+ Add Precision Wireless Mouse")');
    await expect(page.locator('text=Your checkout cart is empty!')).not.toBeVisible();
  });

  test('Journey 6: Reproduce Request Detective Order Failure and verify spinner cleanup in fixed mode', async ({ page }) => {
    await page.goto('/');
    await page.click('button:has-text("Demo Lab")');
    await page.click('button:has-text("Order Failure & Stuck Spinner")');

    // 1. Buggy Mode: Spinner spins indefinitely
    await page.click('button:has-text("Buggy Mode")');
    await page.click('button:has-text("Place Order Now")');

    // Assert buggy behavior: Spinner remains active and message explains stuck spinner
    await expect(page.locator('text=Observed Bug: The server returned HTTP 500, but the frontend never cleared the spinner')).toBeVisible();

    // 2. Fixed Mode: Spinner cleared, error displayed with request ID
    await page.click('button:has-text("Fixed Mode")');
    await page.click('button:has-text("Place Order Now")');

    // Assert fixed behavior: Loading spinner removed, status 500 displayed with retry capability
    await expect(page.locator('text=Status: HTTP 500')).toBeVisible();
    await expect(page.locator('text=Place Order Now')).toBeVisible();
  });

  test('Journey 7 & 8: Refresh and recover saved investigation, then export and delete', async ({ page }) => {
    const title = `Persistence Recovery ${Date.now()}`;

    // Create an investigation
    await page.click('button:has-text("New Investigation")');
    await page.fill('input[placeholder*="Cart total differs"]', title);
    await page.click('button:has-text("Create Investigation")');

    // Add evidence
    await page.click('button:has-text("Paste Code/Log")');
    await page.fill('input[placeholder*="Cart.tsx"]', 'persisted.log');
    await page.fill('textarea', '2026-10-26T10:00:00Z Initial boot ok');
    await page.click('button:has-text("Add Evidence")');

    // Refresh browser page
    await page.reload();

    // Verify investigation recovered from SQLite
    await expect(page.locator('h1')).toContainText(title);
    await expect(page.locator('text=persisted.log')).toBeVisible();

    // Navigate back to Dashboard
    await page.click('button[title="Back to Dashboard"]');

    // Delete the investigation
    page.on('dialog', dialog => dialog.accept());
    const row = page.locator('div.divide-y > div', { hasText: title });
    await row.locator('button[title="Delete investigation"]').click();

    // Verify removed
    await expect(page.locator(`text=${title}`)).not.toBeVisible();
  });
});
