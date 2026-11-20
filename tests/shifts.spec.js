// Tests for the manual shift form in the Hours tab.
const { test, expect } = require('@playwright/test');

// Unicode direction marks. The app puts each time range between these marks.
// They keep the range in left-to-right order inside Hebrew text.
const LRI = '\u2066';
const PDI = '\u2069';

test('manual shift: saves the shift, shows the total, and keeps the time range in order', async ({ page }) => {
  // Each test starts with an empty browser, so the app has no data.
  await page.goto('index.html');

  // Open the manual form.
  await page.getByText('שכחת ללחוץ? הזנה ידנית').click();

  // Enter one shift: 19/11/2026, 08:30 to 16:20.
  await page.locator('#mDate').fill('2026-11-19');
  await page.locator('#mIn').fill('08:30');
  await page.locator('#mOut').fill('16:20');
  await page.locator('#manualForm button[type="submit"]').click();

  // The message shows the range between direction marks, and the duration.
  await expect(page.locator('#mMsg')).toContainText(`${LRI}08:30–16:20${PDI}`);
  await expect(page.locator('#mMsg')).toContainText('7:50');

  // The month totals show 7:50 hours and 1 work day.
  await expect(page.locator('#totHours')).toHaveText('7:50');
  await expect(page.locator('#totDays')).toHaveText('1');

  // The shift list has exactly one shift, with the range in the correct order.
  const rows = page.locator('#shiftList li');
  await expect(rows).toHaveCount(1);
  await expect(rows.first()).toContainText(`${LRI}08:30–16:20${PDI}`);
  await expect(rows.first().locator('.li-num')).toHaveText('7:50');
});
