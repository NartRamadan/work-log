# Hourly pay and tax withholding – short design

Date: 2026-11-23. Size: small change.

## Intent

The user gives the boss a monthly report and a receipt. Today the report shows hours, km, km refund, and expenses. It does not show money for the hours.
The user wants the report to show the full payment: the pay for the hours before the tax withholding, the withholding, and the amount after the withholding.
The user is not an employee. All hours have the same rate. There is no overtime rate.

## Goals

- The user can set an hourly rate.
- The user can set a tax withholding percent (now 3%).
- The user can select where the withholding applies: "hours only" or "all" (hours + km refund + expenses).
- The report shows the payment block (see the sketch).
- The Hours tab shows the pay for the month, as the Travel tab shows the km refund.

## Non-goals

- No overtime rates.
- No receipt or invoice document.
- No tax ID number in the app or in the repo. The repo is public.

## Approaches

| Approach | Description | Decision |
|---|---|---|
| A. Each setting near its data | Hourly rate in the Hours tab (same as the km rate in the Travel tab). Withholding percent and scope in the Report tab, card "פרטים לדוח". | **Selected by the user.** It matches the current app. It is the smallest change. |
| B. All in "פרטים לדוח" | All three settings in the Report tab. | Not selected. The km rate stays in the Travel tab, so it is not consistent. |
| C. New "Settings" tab | All settings in a new tab, the km rate moves there. | Not selected. A fifth tab and more change for the same result. |

## Design

### Data

New fields in `data.settings`:

| Field | Type | Empty value | Meaning |
|---|---|---|---|
| `hourRate` | number > 0 | `null` | Pay for one hour, in ILS. |
| `taxPct` | number 0–100 | `null` | Tax withholding percent. |
| `taxScope` | `'hours'` or `'all'` | `'hours'` | Where the withholding applies. |

Import: copy a field from the file only when the field is empty in the app. This is the same rule as `kmRate`.

### Hours tab

- A number field "תעריף לשעה" above the month totals.
- A third total box: pay for the month (hours × rate). With no rate: "—" and "הזן תעריף למעלה".

### Report tab, card "פרטים לדוח"

- A number field "ניכוי מס במקור (%)".
- A select "ניכוי על": "שעות בלבד" / "הכל".

### Report sheet

Sketch:

```
 תשלום
 שעות: 140:10 × ₪R לשעה ............. ₪A
 החזר נסיעות ......................... ₪K
 הוצאות .............................. ₪E
 סה״כ לפני ניכוי (סכום לקבלה) ........ ₪A+K+E
 ניכוי מס במקור 3% (על שעות / על הכל) . -₪T
 סה״כ לתשלום ......................... ₪A+K+E−T
```

- T = taxPct% of A (scope "hours"), or of A+K+E (scope "all").
- Round money to 2 decimals (agorot).
- With no hourly rate: the hours line shows "לא הוזן תעריף", and A = 0.
- With no tax percent: no withholding line.
- The "סה״כ להחזר" box in the summary tiles changes to "סה״כ לתשלום" with the same value as the last line.
- The report must still fit one A4 page.
- Money values and ranges must show in the correct order in Hebrew (LTR isolates where needed).

## Tests (Playwright)

- Hours tab: rate 100, one shift of 6:05 → pay ₪608.33.
- Report, scope "hours": known hours, km and expenses → check A, T, and the total.
- Report, scope "all": same data → check T on the full sum.
- No tax percent → no withholding line.

## Left to the builder

- Exact CSS for the payment block (follow the current sheet style).
- Exact text of labels, if the meaning stays the same.
