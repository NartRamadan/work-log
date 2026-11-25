// Tests for the import: records that are already in the app must not come in again.
const { test, expect } = require('@playwright/test');

const KEY = 'worklog-v1';

// Open the app with the given saved data. Each test starts with an empty browser.
async function openWith(page, data) {
  await page.goto('index.html');
  await page.evaluate(([k, d]) => localStorage.setItem(k, JSON.stringify(d)), [KEY, data]);
  await page.reload();
}

// Import a JSON object as a file. Accept the confirm dialog. Return the dialog text and the end message.
async function importObject(page, obj) {
  let dialog = '';
  page.once('dialog', d => { dialog = d.message(); d.accept(); });
  await page.locator('#importFile').setInputFiles({
    name: 'import.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(obj)),
  });
  await expect(page.locator('#dMsg')).not.toHaveText('');
  return { dialog, msg: await page.locator('#dMsg').textContent() };
}

const saved = () => JSON.parse(localStorage.getItem('worklog-v1'));
const empty = { shifts: [], trips: [], expenses: [], odo: [], settings: {} };
const file = parts => ({ app: 'worklog', version: 1, shifts: [], trips: [], expenses: [], odo: [], ...parts });

// The phone has the day with its own ids. A file from the computer has the same day with other ids.
const phoneDay = {
  ...empty,
  shifts: [{ id: 'phone-s1', date: '2026-11-22', in: '08:25', out: '17:30' }],
  trips: [
    { id: 'phone-t1', date: '2026-11-22', from: 'בית', to: 'אקספורדיה', km: 52.6, t: 1 },
    { id: 'phone-t2', date: '2026-11-22', from: 'אקספורדיה', to: 'בית', km: 52.6, t: 2 },
  ],
  expenses: [{ id: 'phone-e1', date: '2026-11-22', amount: 18, desc: 'חניה' }],
};

test('import skips records with the same content and another id', async ({ page }) => {
  await openWith(page, phoneDay);
  const r = await importObject(page, file({
    shifts: [
      { id: 'pc-s1', date: '2026-11-22', in: '08:25', out: '17:30' },
      { id: 'pc-s2', date: '2026-11-24', in: '08:15', out: '18:20' },
    ],
    trips: [
      { id: 'pc-t1', date: '2026-11-22', from: 'בית', to: 'אקספורדיה', km: 52.6, t: 0 },
      { id: 'pc-t2', date: '2026-11-22', from: 'אקספורדיה', to: 'בית', km: 52.6, t: 1 },
    ],
    expenses: [{ id: 'pc-e1', date: '2026-11-22', amount: 18, desc: 'חניה' }],
  }));

  expect(r.dialog).toContain('משמרות: 1');
  expect(r.dialog).toContain('קטעי נסיעה: 0');
  expect(r.dialog).toContain('הוצאות: 0');
  const d = await page.evaluate(saved);
  expect(d.shifts.map(s => s.date).sort()).toEqual(['2026-11-22', '2026-11-24']);
  expect(d.trips).toHaveLength(2);
  expect(d.expenses).toHaveLength(1);
});

test('import adds a shift on the same day with other hours', async ({ page }) => {
  await openWith(page, phoneDay);
  const r = await importObject(page, file({
    shifts: [{ id: 'pc-s1', date: '2026-11-22', in: '18:00', out: '20:00' }],
  }));
  expect(r.dialog).toContain('משמרות: 1');
  expect((await page.evaluate(saved)).shifts).toHaveLength(2);
});

test('import counts same trips: it adds only the ones that are not in the app', async ({ page }) => {
  // The app has one trip home -> Expordia. The file has the same trip two times on that day.
  await openWith(page, { ...empty, trips: [phoneDay.trips[0]] });
  const r = await importObject(page, file({
    trips: [
      { id: 'pc-t1', date: '2026-11-22', from: 'בית', to: 'אקספורדיה', km: 52.6, t: 0 },
      { id: 'pc-t2', date: '2026-11-22', from: 'בית', to: 'אקספורדיה', km: 52.6, t: 1 },
    ],
  }));
  expect(r.dialog).toContain('קטעי נסיעה: 1');
  expect((await page.evaluate(saved)).trips).toHaveLength(2);
});

test('import adds a new same trip when the file also has the app trip with its id', async ({ page }) => {
  // The app has trip phone-t1. The file has a new same trip first, then phone-t1.
  await openWith(page, { ...empty, trips: [phoneDay.trips[0]] });
  const r = await importObject(page, file({
    trips: [
      { id: 'pc-t9', date: '2026-11-22', from: 'בית', to: 'אקספורדיה', km: 52.6, t: 0 },
      phoneDay.trips[0],
    ],
  }));
  expect(r.dialog).toContain('קטעי נסיעה: 1');
  expect((await page.evaluate(saved)).trips).toHaveLength(2);
});

test('import keeps one odometer record for each day', async ({ page }) => {
  const odo = { id: 'phone-o1', date: '2026-11-22', start: 72040, end: null };
  await openWith(page, { ...empty, odo: [odo] });
  const r = await importObject(page, file({
    shifts: [{ id: 'pc-s9', date: '2026-11-25', in: '08:00', out: '16:00' }],
    odo: [
      odo,
      { id: 'pc-o1', date: '2026-11-22', start: 72040, end: 72146 },
      { id: 'pc-o2', date: '2026-11-25', start: 72300, end: null },
      { id: 'pc-o3', date: '2026-11-25', start: 72301, end: null },
    ],
  }));
  expect(r.dialog).toContain('ימים עם מד אוץ: 1');
  const d = await page.evaluate(saved);
  expect(d.odo.map(o => o.date).sort()).toEqual(['2026-11-22', '2026-11-25']);
});

test('import puts the km from the file on a same trip without km', async ({ page }) => {
  await openWith(page, { ...empty, trips: [{ ...phoneDay.trips[0], km: null }] });
  const r = await importObject(page, file({
    trips: [{ id: 'pc-t1', date: '2026-11-22', from: 'בית', to: 'אקספורדיה', km: 52.6, t: 0 }],
  }));
  expect(r.dialog).toContain('קטעי נסיעה: 0');
  expect(r.dialog).toContain('רשומות קיימות שיתעדכנו: 1');
  const d = await page.evaluate(saved);
  expect(d.trips).toEqual([{ ...phoneDay.trips[0], km: 52.6 }]);
});

test('import closes an open shift with the same day and the same start', async ({ page }) => {
  await openWith(page, { ...empty, shifts: [{ id: 'phone-s1', date: '2026-11-22', in: '08:25', out: null }] });
  const r = await importObject(page, file({
    shifts: [{ id: 'pc-s1', date: '2026-11-22', in: '08:25', out: '17:30' }],
  }));
  expect(r.dialog).toContain('משמרות: 0');
  expect(r.dialog).toContain('רשומות קיימות שיתעדכנו: 1');
  const d = await page.evaluate(saved);
  expect(d.shifts).toHaveLength(1);
  expect(d.shifts[0]).toMatchObject({ id: 'phone-s1', out: '17:30' });
});

test('import completes a missing odometer reading of the same day', async ({ page }) => {
  await openWith(page, { ...empty, odo: [{ id: 'phone-o1', date: '2026-11-22', start: 72040, end: null }] });
  const r = await importObject(page, file({
    odo: [{ id: 'pc-o1', date: '2026-11-22', start: 72040, end: 72146 }],
  }));
  expect(r.dialog).toContain('רשומות קיימות שיתעדכנו: 1');
  expect((await page.evaluate(saved)).odo).toEqual([{ id: 'phone-o1', date: '2026-11-22', start: 72040, end: 72146 }]);
});

test('import does not use an odometer reading that makes the day wrong', async ({ page }) => {
  // The end must be more than the start. The app keeps its reading.
  await openWith(page, { ...empty, odo: [{ id: 'phone-o1', date: '2026-11-22', start: 72040, end: null }] });
  const r = await importObject(page, file({
    odo: [{ id: 'pc-o1', date: '2026-11-22', start: null, end: 72000 }],
  }));
  expect(r.msg).toContain('אין בקובץ רשומות חדשות');
  expect((await page.evaluate(saved)).odo[0].end).toBeNull();
});

test('import adds one shift when the file has the same shift two times', async ({ page }) => {
  await openWith(page, empty);
  const s = { date: '2026-11-24', in: '08:15', out: '18:20' };
  const r = await importObject(page, file({ shifts: [{ id: 'a', ...s }, { id: 'b', ...s }] }));
  expect(r.dialog).toContain('משמרות: 1');
  expect((await page.evaluate(saved)).shifts).toHaveLength(1);
});

test('an invalid record in the file does not hide a same app record', async ({ page }) => {
  // The file has phone-t1 with km 0 (invalid) and a same trip with another id.
  await openWith(page, { ...empty, trips: [phoneDay.trips[0]] });
  const r = await importObject(page, file({
    trips: [
      { ...phoneDay.trips[0], km: 0 },
      { id: 'pc-t1', date: '2026-11-22', from: 'בית', to: 'אקספורדיה', km: 52.6, t: 0 },
    ],
  }));
  expect(r.msg).toContain('אין בקובץ רשומות חדשות');
  expect((await page.evaluate(saved)).trips).toHaveLength(1);
});

test('a broken record in the app does not stop the import', async ({ page }) => {
  await openWith(page, { ...empty, trips: [{ id: 'old', date: '2026-11-01', to: 'בית' }] });
  const r = await importObject(page, file({
    shifts: [{ id: 'pc-s1', date: '2026-11-22', in: '08:25', out: '17:30' }],
  }));
  expect(r.dialog).toContain('משמרות: 1');
});

test('import of a file with only known records shows a message and adds nothing', async ({ page }) => {
  await openWith(page, phoneDay);
  const r = await importObject(page, file({
    shifts: [{ id: 'pc-s1', date: '2026-11-22', in: '08:25', out: '17:30' }],
  }));
  expect(r.dialog).toBe('');
  expect(r.msg).toContain('אין בקובץ רשומות חדשות');
  expect((await page.evaluate(saved)).shifts).toHaveLength(1);
});
