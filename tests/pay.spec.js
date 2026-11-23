// Tests for the hourly pay, the tax withholding, and the payment block in the report.
const { test, expect } = require('@playwright/test');

const KEY = 'worklog-v1';

// Open the app with the given saved data. Each test starts with an empty browser.
async function openWith(page, data) {
  await page.goto('index.html');
  if (data) {
    await page.evaluate(([k, d]) => localStorage.setItem(k, JSON.stringify(d)), [KEY, data]);
    await page.reload();
  }
}

// Import a JSON object as a file. Accept the confirm dialog.
async function importObject(page, obj) {
  page.once('dialog', d => d.accept());
  await page.locator('#importFile').setInputFiles({
    name: 'import.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(obj)),
  });
}

const base = { minutes: 360, hourRate: 100, kmCost: 165, expTotal: 35, taxPct: 3, taxScope: 'hours' };

test.describe('payBreakdown', () => {
  test.beforeEach(async ({ page }) => { await page.goto('index.html'); });

  test('tax on hours only', async ({ page }) => {
    const r = await page.evaluate(i => payBreakdown(i), base);
    expect(r).toEqual({ hoursPay: 600, gross: 800, taxBase: 600, tax: 18, net: 782 });
  });

  test('tax on all', async ({ page }) => {
    const r = await page.evaluate(i => payBreakdown(i), { ...base, taxScope: 'all' });
    expect(r).toEqual({ hoursPay: 600, gross: 800, taxBase: 800, tax: 24, net: 776 });
  });

  test('no tax percent', async ({ page }) => {
    const r = await page.evaluate(i => payBreakdown(i), { ...base, taxPct: null });
    expect(r.tax).toBe(0);
    expect(r.net).toBe(800);
  });

  test('rounding to agorot', async ({ page }) => {
    const r = await page.evaluate(i => payBreakdown(i),
      { minutes: 365, hourRate: 100, kmCost: 0, expTotal: 0, taxPct: null, taxScope: 'hours' });
    expect(r.hoursPay).toBe(608.33);
  });
});

test('old data has no pay settings: defaults apply', async ({ page }) => {
  await openWith(page, { shifts: [], trips: [], expenses: [], odo: [], settings: { kmRate: 1.65 } });
  expect(await page.evaluate(() => paySettings())).toEqual({ hourRate: null, taxPct: null, taxScope: 'hours' });
});

test('import sets empty pay settings and keeps existing ones', async ({ page }) => {
  // The import stops when a file has no records, so the file has one shift.
  const file = { app: 'worklog', version: 1, trips: [], expenses: [], odo: [],
    shifts: [{ id: 'test-s-1', date: '2026-11-02', in: '08:00', out: '09:00' }],
    settings: { hourRate: 999, taxPct: 50, taxScope: 'all' } };

  // Empty app: the values from the file are used.
  await openWith(page, null);
  await importObject(page, file);
  await expect.poll(() => page.evaluate(() => paySettings()))
    .toEqual({ hourRate: 999, taxPct: 50, taxScope: 'all' });

  // App with values: the values in the app stay.
  await openWith(page, { shifts: [], trips: [], expenses: [], odo: [],
    settings: { kmRate: null, hourRate: 120, taxPct: 3, taxScope: 'hours' } });
  await importObject(page, file);
  await page.waitForTimeout(300);
  expect(await page.evaluate(() => paySettings())).toEqual({ hourRate: 120, taxPct: 3, taxScope: 'hours' });
});

// Set a number field and fire "change", like a user who leaves the field.
async function setField(page, sel, value) {
  await page.locator(sel).fill(value);
  await page.locator(sel).dispatchEvent('change');
}

test.describe('Hours tab', () => {
  test('shows the month pay', async ({ page }) => {
    await openWith(page, null);
    await page.getByText('שכחת ללחוץ? הזנה ידנית').click();
    await page.locator('#mIn').fill('08:00');
    await page.locator('#mOut').fill('14:05');
    await page.locator('#manualForm button[type="submit"]').click();
    await setField(page, '#hourRate', '100');
    const [pay, rate] = await page.evaluate(() => [money.format(608.33), money.format(100)]);
    await expect(page.locator('#totPay')).toHaveText(pay);
    await expect(page.locator('#totPayLabel')).toContainText(rate);
  });

  test('a bad rate is ignored', async ({ page }) => {
    await openWith(page, null);
    for (const v of ['', '0', '-5']) {
      await setField(page, '#hourRate', '100');
      await setField(page, '#hourRate', v);
      await expect(page.locator('#totPay')).toHaveText('—');
      expect(await page.evaluate(() => paySettings().hourRate)).toBeNull();
    }
  });
});

// Data for one day in the current month: 6:00 hours, 100 km, expense 35.
// Money: hours 600, km 165 (1.65 per km), expenses 35, gross 800.
async function openReport(page, settings, { noShifts = false } = {}) {
  await page.goto('index.html');
  const today = await page.evaluate(() => dateStr(new Date()));
  await openWith(page, {
    shifts: noShifts ? [] : [{ id: 's1', date: today, in: '08:00', out: '14:00' }],
    trips: [{ id: 't1', date: today, from: 'בית', to: 'נגריית בדיקה', km: 100, t: 0 }],
    expenses: [{ id: 'e1', date: today, amount: 35, desc: 'חניה' }],
    odo: [],
    settings: { kmRate: 1.65, hourRate: 100, taxPct: 3, taxScope: 'hours', ...settings },
  });
  await page.locator('.tab[data-tab="report"]').click();
}
const fmt = (page, n) => page.evaluate(v => money.format(v), n);

test.describe('Report payment block', () => {
  test('tax on hours only', async ({ page }) => {
    await openReport(page, {});
    await expect(page.locator('#payBlock .pay-gross')).toContainText(await fmt(page, 800));
    await expect(page.locator('#payBlock .pay-tax')).toContainText(await fmt(page, -18));
    await expect(page.locator('#payBlock .pay-tax')).toContainText('3%');
    await expect(page.locator('#payBlock .pay-net')).toContainText(await fmt(page, 782));
    await expect(page.locator('.sum.total')).toContainText(await fmt(page, 782));
    await expect(page.locator('.sum.total')).toContainText('סה״כ לתשלום');
  });

  test('tax on all', async ({ page }) => {
    await openReport(page, {});
    await page.locator('#taxScope').selectOption('all');
    await expect(page.locator('#payBlock .pay-tax')).toContainText(await fmt(page, -24));
    await expect(page.locator('#payBlock .pay-net')).toContainText(await fmt(page, 776));
  });

  test('no tax percent: no tax line', async ({ page }) => {
    await openReport(page, { taxPct: null });
    await expect(page.locator('#payBlock .pay-tax')).toHaveCount(0);
    await expect(page.locator('#payBlock .pay-net')).toContainText(await fmt(page, 800));
  });

  test('a bad tax percent is ignored', async ({ page }) => {
    await openReport(page, {});
    for (const v of ['150', '-1']) {
      await setField(page, '#taxPct', '3');
      await setField(page, '#taxPct', v);
      expect(await page.evaluate(() => paySettings().taxPct)).toBeNull();
      await expect(page.locator('#payBlock .pay-tax')).toHaveCount(0);
    }
  });

  test('rate but no shifts: zero, no error', async ({ page }) => {
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await openReport(page, {}, { noShifts: true });
    await expect(page.locator('#payBlock .pay-hours')).toContainText(await fmt(page, 0));
    expect(errors).toEqual([]);
  });

  test('no hourly rate', async ({ page }) => {
    await openReport(page, { hourRate: null });
    await expect(page.locator('#payBlock .pay-hours')).toContainText('לא הוזן תעריף');
  });
});

test('report: the tax value is a normal negative money value', async ({ page }) => {
  // A minus sign inside a left-to-right isolate with right-to-left marks shows at the wrong end.
  await openReport(page, {});
  await expect(page.locator('#payBlock .pay-tax td.n')).toHaveText(await fmt(page, -18));
});
