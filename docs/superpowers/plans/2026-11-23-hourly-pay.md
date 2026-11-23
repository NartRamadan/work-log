# Hourly Pay and Tax Withholding Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an hourly rate, a tax withholding percent and scope, and a payment block in the monthly report.

**Architecture:** All code stays in the single file `index.html`. One pure function computes the money. The Hours tab and the report call it. Settings live in `data.settings`, the same as `kmRate`.

**Tech Stack:** Plain HTML/CSS/JavaScript. Tests: `@playwright/test` with the installed Google Chrome (`npm test`).

**Spec:** `docs/superpowers/specs/2026-11-23-hourly-pay-design.md`

## Global Constraints

- One file: `index.html`. No new libraries.
- New settings: `hourRate` (number > 0 or `null`), `taxPct` (number 0–100 or `null`), `taxScope` (`'hours'` or `'all'`, default `'hours'`).
- Money rounds to 2 decimals. Format money only with the existing `money.format`.
- Old saved data has no new fields. `load()` replaces `settings` as one object, so read new fields with a default (`?? null`, `?? 'hours'`).
- Labels in Hebrew. Code comments in Hebrew (match the file). Commit messages in English, ASD-STE100.
- Hidden characters: write `\u2066` / `\u2069` only as escape text, and write them with Python, not Edit/Write.
- No tax ID number anywhere in the repo.
- The report must still fit one A4 page (the existing `fitForPrint` zoom does this; check by hand).

## Review Focus

1. Old data with no `hourRate`/`taxPct`/`taxScope` → app works, no hours pay, scope "hours". (Test in Task 1.)
2. Hourly rate field cleared, `0`, or negative → stored as `null`, box shows "—". (Test in Task 2.)
3. Tax percent below 0 or above 100 → stored as `null`, no withholding line. (Test in Task 3.)
4. Import file has `hourRate`/`taxPct` and the app already has values → app values stay. (Test in Task 1.)
5. Rate set but no shifts in the month → payment block shows ₪0 lines, no error. (Test in Task 3.)

---

### Task 1: Money function, settings defaults, import

**Files:**
- Modify: `index.html` – `emptyData()` (~line 590), new function near `fmtDur` (~line 615), import block (~lines 1569–1575)
- Create: `tests/pay.spec.js`

**Interfaces:**
- Produces: `payBreakdown({ minutes, hourRate, kmCost, expTotal, taxPct, taxScope }) -> { hoursPay, gross, taxBase, tax, net }`. All values are numbers rounded to 2 decimals. `hourRate`/`taxPct` may be `null` (treated as 0).
- Produces: `round2(n) -> number`.
- Produces: `paySettings() -> { hourRate, taxPct, taxScope }` with defaults applied.

- [ ] **Step 1: Write failing tests in `tests/pay.spec.js`**
  - `payBreakdown: hours only` – `{minutes: 360, hourRate: 100, kmCost: 165, expTotal: 35, taxPct: 3, taxScope: 'hours'}` → `hoursPay 600, gross 800, taxBase 600, tax 18, net 782`.
  - `payBreakdown: all` – same input, `taxScope: 'all'` → `taxBase 800, tax 24, net 776`.
  - `payBreakdown: no tax` – `taxPct: null` → `tax 0, net 800`.
  - `payBreakdown: rounding` – `{minutes: 365, hourRate: 100, kmCost: 0, expTotal: 0, taxPct: null}` → `hoursPay 608.33`.
  - `old data has no pay settings` – seed `localStorage['worklog-v1']` with `settings: { kmRate: 1.65 }`, reload, `paySettings()` → `{ hourRate: null, taxPct: null, taxScope: 'hours' }`.
  - `import keeps existing pay settings` – seed `hourRate: 120, taxPct: 3`; import a file with `settings: { hourRate: 999, taxPct: 50 }`; `paySettings()` keeps 120 and 3. Import into empty app sets them.
  - Call app functions with `page.evaluate(() => payBreakdown({...}))` (top-level `const` is visible to `evaluate`). Accept the import `confirm` with `page.on('dialog', d => d.accept())`.

- [ ] **Step 2: Run `npm test`** – Expected: the new tests FAIL (`payBreakdown is not defined`).

- [ ] **Step 3: Implement** `round2`, `paySettings`, `payBreakdown` near `fmtDur`. Add `hourRate: null, taxPct: null, taxScope: 'hours'` to `emptyData().settings`. In import: copy `hourRate` (with `posNum`) and `taxPct` (number 0–100) only when the app value is `null`; copy `taxScope` only if it is `'hours'` or `'all'` and the app has no `taxScope`.
  - `taxBase = taxScope === 'all' ? gross : hoursPay`; `tax = round2(taxBase * taxPct / 100)`; `net = round2(gross - tax)`.

- [ ] **Step 4: Run `npm test`** – Expected: all PASS.

- [ ] **Step 5: Commit** – `git add index.html tests/pay.spec.js` – message: `Add pay calculation and pay settings with import support`.

### Task 2: Hours tab – hourly rate field and month pay box

**Files:**
- Modify: `index.html` – Hours panel markup (~lines 411–418), `renderShifts()` (~line 742), rate handlers (~line 768)
- Test: `tests/pay.spec.js`

**Interfaces:**
- Consumes: `payBreakdown`, `paySettings`, `round2` (Task 1).
- Produces: elements `#hourRate` (input), `#totPay` (value), `#totPayLabel` (label).

- [ ] **Step 1: Write failing tests**
  - `hours tab shows month pay` – manual shift today 08:00–14:05, type `100` in `#hourRate` and fire `change` → `#totPay` equals `money.format(608.33)`, `#totPayLabel` contains `money.format(100)`.
  - `hours tab: bad rate is ignored` – for each of `''`, `'0'`, `'-5'`: fill and fire `change` → `#totPay` is `—`, `paySettings().hourRate` is `null`.

- [ ] **Step 2: Run `npm test`** – Expected: new tests FAIL (`#hourRate` not found).

- [ ] **Step 3: Implement**
  - Markup: inside the "משמרות" card, above `.totals`, a `.rate-row` with `<input type="number" id="hourRate" min="0" step="0.01" inputmode="decimal" placeholder="לדוגמה 80">` and `<span>₪ לשעה</span>`. A third `.total-box` with `<b id="totPay">—</b><span id="totPayLabel">הזן תעריף למעלה</span>`.
  - Handler like `kmRate`: `v > 0 ? v : null`, `save()`, `renderShifts()`, `renderReport()`.
  - In `renderShifts()`: set `#totPay` to `money.format(hoursPay)` or `—`; label `לפי ${money.format(rate)} לשעה` or `הזן תעריף למעלה`.

- [ ] **Step 4: Run `npm test`** – Expected: all PASS.

- [ ] **Step 5: Commit** – message: `Add hourly rate field and month pay to the Hours tab`.

### Task 3: Report – tax settings and payment block

**Files:**
- Modify: `index.html` – "פרטים לדוח" card (~lines 546–560), report settings handlers (~line 1255), `renderReport()` sum tiles and new block (~lines 1424–1446), CSS near `.calc` / `.sum`
- Test: `tests/pay.spec.js`

**Interfaces:**
- Consumes: `payBreakdown`, `paySettings` (Task 1), `#hourRate` (Task 2).
- Produces: elements `#taxPct` (input), `#taxScope` (select, values `hours` / `all`), `#payBlock` (block in the sheet) with rows `.pay-hours`, `.pay-km`, `.pay-exp`, `.pay-gross`, `.pay-tax`, `.pay-net`.

- [ ] **Step 1: Write failing tests** (seed `localStorage` with today's month: one shift 08:00–14:00, one trip 100 km, one expense ₪35, `kmRate 1.65`, `hourRate 100`; open the "דוח" tab)
  - `report: tax on hours only` – `taxPct 3`, scope `hours` → `.pay-gross` has `money.format(800)`, `.pay-tax` has `money.format(18)` and `3%`, `.pay-net` has `money.format(782)`; the total tile `.sum.total` has `money.format(782)` and text `סה״כ לתשלום`.
  - `report: tax on all` – select `all` in `#taxScope` → `.pay-tax` has `money.format(24)`, `.pay-net` has `money.format(776)`.
  - `report: no tax percent` – `taxPct` empty → `.pay-tax` count 0, `.pay-net` has `money.format(800)`.
  - `report: bad tax percent is ignored` – fill `#taxPct` with `150`, then `-1` → `paySettings().taxPct` is `null`, `.pay-tax` count 0.
  - `report: rate but no shifts` – seed no shifts → `.pay-hours` has `money.format(0)`, no page error (`page.on('pageerror')` collects nothing).
  - `report: no hourly rate` – `hourRate null` → `.pay-hours` contains `לא הוזן תעריף`.

- [ ] **Step 2: Run `npm test`** – Expected: new tests FAIL (`#taxPct` not found).

- [ ] **Step 3: Implement**
  - "פרטים לדוח": `<input type="number" id="taxPct" min="0" max="100" step="0.1" inputmode="decimal" placeholder="לדוגמה 3">` with label `ניכוי מס במקור (%)`; `<select id="taxScope">` with `<option value="hours">שעות בלבד</option><option value="all">הכל (שעות, נסיעות, הוצאות)</option>` and label `ניכוי על`. Handlers: `taxPct` accepts `0 < v <= 100` else `null`; `save()`; `renderReport()`.
  - In `renderReport()`: call `payBreakdown`. Add `#payBlock` (heading `<h4>תשלום</h4>`) after the expenses table and before `.sign`, with rows in this order and copy:
    - `.pay-hours`: `שעות: ${fmtDur(totMin)} × ${money.format(rate)} לשעה` → `hoursPay`; or `שעות: לא הוזן תעריף לשעה` → `—`.
    - `.pay-km`: `החזר נסיעות` → `kmCost`.
    - `.pay-exp`: `הוצאות` → `expTotal`.
    - `.pay-gross`: `סה״כ לפני ניכוי (סכום לקבלה)` → `gross`.
    - `.pay-tax` (only when `taxPct`): `ניכוי מס במקור ${taxPct}% (על שעות בלבד | על הכל)` → `-` + `money.format(tax)`.
    - `.pay-net`: `סה״כ לתשלום` → `net`.
  - The last sum tile: value `money.format(net)`, label `סה״כ לתשלום`.
  - Style: a two-column table like the existing tables; `.pay-net` bold with `--p-accent`. Wrap the hours line (duration × rate) in LTR isolate marks `\u2066 … \u2069` (write with Python).

- [ ] **Step 4: Run `npm test`** – Expected: all PASS (including `shifts.spec.js`).

- [ ] **Step 5: Manual check** – with the real export from Downloads imported into a test browser, open "דוח", run print emulation (`page.emulateMedia({ media: 'print' })` after `fitForPrint()`), take a screenshot. Check: one page, numbers not reversed.

- [ ] **Step 6: Commit** – message: `Add tax withholding settings and payment block to the report`.

### Task 4: Docs, review, merge

- [ ] Add to `C:\dev\ai-learning\GLOSSARY.md`: `ניכוי מס במקור (tax withholding)`, `תעריף לשעה (hourly rate)`.
- [ ] Push branch `hourly-pay`, open a Pull request with `gh`, run `/code-review`, fix confirmed findings, run `npm test`.
- [ ] Run `/security-review` (CLAUDE.md rule).
- [ ] Ask the user to approve the merge. Do not merge without approval.
