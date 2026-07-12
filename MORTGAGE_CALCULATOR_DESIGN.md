# Advanced Mortgage Calculator Design

## 1. Purpose

Build a browser-only advanced mortgage calculator for Canadian-style mortgage planning.

The app lets a user create multiple local mortgage scenarios, model payments over time, insert lump-sum prepayments, renew mortgage terms with new rates/conditions, and inspect the outcome through charts and a detailed payment schedule.

Initial target stack:

- Vue 3
- Vite
- Bun
- TypeScript
- Chart.js
- Browser local storage

The first version should be fully client-side. No backend, account system, or cloud sync is required.

## 2. Product Goals

- Model a mortgage over its full amortization period.
- Support common Canadian payment frequencies.
- Show how each payment is split between interest and principal.
- Show remaining mortgage balance over time.
- Support lump-sum prepayments on specific dates.
- Support mortgage term renewals, including new interest rates and changed payment conditions.
- Persist multiple independent calculator sessions in the browser.
- Make the calculations transparent enough that a user can audit the schedule.

## 3. Non-Goals for First Version

- No user accounts.
- No server-side storage.
- No lender-specific prepayment penalty calculation.
- No property tax, insurance, condo fees, or affordability qualification logic.
- No automatic import/export to lenders or banks.
- No real-time market rate lookup.
- No mobile app wrapper.

These can be added later without changing the core model if the calculation engine is kept isolated from the UI.

## 4. Key Concepts

### Mortgage Scenario

A saved user workspace containing:

- Principal amount input.
- Initial mortgage terms.
- Payment frequency.
- Full amortization period.
- Renewal events.
- Lump-sum prepayment events.
- Generated amortization/payment schedule.

### Mortgage Amount

The user-specified `amount` means the starting mortgage principal.

### Amortization Period

The full planned payoff duration, commonly 25 or 30 years in Canada, but the UI should allow custom year/month values.

### Current Period / Term

The active mortgage contract duration, commonly 3 or 5 years in Canada.

Important distinction:

- Amortization period is the full repayment timeline.
- Term/current period is the contract period before renewal.

The schedule should model one or more term segments across the amortization.

### Renewal Event

A timestamp in the payment schedule where contract conditions change, such as:

- Interest rate.
- Term length.
- Payment frequency.
- Payment amount strategy.
- Remaining amortization basis.

Renewals should be visually highlighted on the balance chart and represented in the payment table.

### Lump-Sum Prepayment

A one-time payment applied on a specific date, reducing principal. Charts and schedules should recalculate from that date onward.

## 5. Core User Stories

1. As a user, I can create a mortgage scenario with principal amount, amortization, term length, interest rate, and payment frequency.
2. As a user, I can view my projected remaining balance over time.
3. As a user, I can view how much of each payment goes to interest versus principal.
4. As a user, I can inspect a detailed payment schedule in a table.
5. As a user, I can add any number of lump-sum payments on specific dates and immediately see the updated schedule, graphs, and shortened payoff timeline.
6. As a user, I can add a renewal date with a new interest rate and term conditions.
7. As a user, I can save multiple scenarios locally and switch between them from a dropdown.
8. As a user, I can duplicate a scenario to compare variations.
9. As a user, I can delete scenarios I no longer need.

## 6. Product Decisions and Assumptions

Version 1 decisions:

- `amount` means mortgage principal.
- Renewals are manually entered by the user.
- Renewal events can change payment frequency in version 1.
- Semi-monthly payments occur on the 1st and 15th of each month.
- Lump sums reduce principal, keep the regular payment unchanged until renewal, and shorten effective amortization.
- There is no application-level limit on the number of lump-sum payments in version 1. Prepayment rules, annual maximums, and lender-specific caps are deferred.
- The scheduled mortgage payment is a combined payment made up of interest plus principal. The UI must show the combined scheduled payment and the interest/principal split anywhere payment details are shown.

Calculation assumptions:

- Interest rate input is nominal annual rate.
- Canadian fixed mortgages usually compound semi-annually, not in advance.
- Payment dates begin from a user-selected start date.
- User-entered and persisted scenario dates must not be later than `2100-12-31`.
- Lump sums are applied before regular payment interest calculation if they fall on the same payment date.
- Regular payment amount is recalculated at the start of each term using the remaining balance, rate, frequency, and remaining amortization.
- At renewal, payment is recalculated based on remaining balance and remaining amortization.
- Prepayment limits and penalties are not modeled in version 1.

## 7. Resolved and Open Product Decisions

Resolved for version 1:

1. Lump-sum payments are one-time principal reductions, with unlimited entries.
2. Lump-sum payments keep the regular scheduled payment unchanged until renewal and therefore shorten the amortization/payoff period.
3. Prepayment limits, annual maximums, and penalties are not modeled in version 1.
4. The generated schedule stops when the balance reaches zero, even if that is before the original amortization end date.
5. The detailed table shows every payment row by default, with an annual summary toggle as a useful enhancement.
6. Version 1 defaults to Canadian semi-annual compounding.
7. Renewal events include payment frequency, so users can change frequency when renewing.

Still open:

1. Should regular recurring extra payments be added after the first one-time lump-sum workflow is stable?

## 8. Application Structure

Suggested project structure:

```text
src/
  app/
    App.vue
    main.ts
  components/
    ScenarioSelector.vue
    MortgageInputPanel.vue
    RenewalEditor.vue
    LumpSumEditor.vue
    BalanceChart.vue
    PaymentBreakdownChart.vue
    PaymentScheduleTable.vue
    SummaryMetrics.vue
  domain/
    mortgageTypes.ts
    mortgageCalculator.ts
    paymentFrequency.ts
    dateMath.ts
    money.ts
  stores/
    scenarioStore.ts
  persistence/
    localStorageRepository.ts
  styles/
    base.css
    theme.css
```

### Design Principle

Keep mortgage math out of Vue components.

Vue components should collect input and render state. The calculation engine should be pure TypeScript functions so it can be unit-tested thoroughly.

## 9. Data Model

### MortgageScenario

```ts
type MortgageScenario = {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  currency: 'CAD';
  startDate: string;
  principalAmount: number;
  amortizationMonths: number;
  initialTerm: MortgageTerm;
  paymentFrequency: PaymentFrequency;
  lumpSums: LumpSumEvent[];
  renewals: RenewalEvent[];
};
```

### MortgageTerm

```ts
type MortgageTerm = {
  id: string;
  startDate: string;
  termMonths: number;
  annualInterestRate: number;
  paymentFrequency: PaymentFrequency;
  paymentAmount?: number;
  paymentStrategy: PaymentStrategy;
};
```

### RenewalEvent

```ts
type RenewalEvent = {
  id: string;
  effectiveDate: string;
  termMonths: number;
  annualInterestRate: number;
  paymentFrequency?: PaymentFrequency;
  paymentStrategy: PaymentStrategy;
  note?: string;
};
```

### LumpSumEvent

```ts
type LumpSumEvent = {
  id: string;
  date: string;
  amount: number;
  label?: string;
};
```

### PaymentFrequency

```ts
type PaymentFrequency =
  | 'weekly'
  | 'bi-weekly'
  | 'semi-monthly'
  | 'monthly';
```

Potential later expansion:

```ts
type PaymentFrequency =
  | 'weekly'
  | 'accelerated-weekly'
  | 'bi-weekly'
  | 'accelerated-bi-weekly'
  | 'semi-monthly'
  | 'monthly';
```

### PaymentStrategy

```ts
type PaymentStrategy =
  | 'recalculate-payment'
  | 'keep-payment-reduce-time';
```

First version can default to `recalculate-payment` at renewal and `keep-payment-reduce-time` after lump sums.

### PaymentScheduleRow

```ts
type PaymentScheduleRow = {
  sequence: number;
  date: string;
  periodId: string;
  openingBalance: number;
  scheduledPayment: number;
  scheduledInterestPaid: number;
  scheduledPrincipalPaid: number;
  lumpSumPayment: number;
  totalPayment: number;
  totalPrincipalReduction: number;
  closingBalance: number;
  annualInterestRate: number;
  paymentFrequency: PaymentFrequency;
  eventType?: 'regular-payment' | 'lump-sum' | 'renewal' | 'final-payment';
  notes?: string[];
};
```

## 10. Calculation Engine

### Inputs

The calculation engine receives a normalized `MortgageScenario`.

Normalization should:

- Sort lump sums by date.
- Sort renewals by effective date.
- Validate that dates are on or after the mortgage start date.
- Validate that amounts and rates are non-negative.
- Convert amortization years/months to total months.
- Derive term segments from initial term and renewal events.

### Output

The engine returns:

```ts
type MortgageProjection = {
  scenarioId: string;
  generatedAt: string;
  summary: ProjectionSummary;
  schedule: PaymentScheduleRow[];
  chartSeries: ProjectionChartSeries;
  warnings: ProjectionWarning[];
};
```

### ProjectionSummary

```ts
type ProjectionSummary = {
  originalPrincipal: number;
  regularPaymentAmount: number;
  nextPaymentInterestPortion: number;
  nextPaymentPrincipalPortion: number;
  finalPaymentDate: string;
  totalInterestPaid: number;
  totalPrincipalPaid: number;
  totalLumpSumsPaid: number;
  totalPaid: number;
  interestSavedEstimate?: number;
  monthsSavedEstimate?: number;
};
```

### ChartSeries

```ts
type ProjectionChartSeries = {
  balanceOverTime: {
    date: string;
    balance: number;
    periodId: string;
  }[];
  paymentBreakdown: {
    date: string;
    scheduledInterestPaid: number;
    scheduledPrincipalPaid: number;
    lumpSumPayment: number;
    totalPrincipalReduction: number;
    periodId: string;
  }[];
  renewalMarkers: {
    date: string;
    label: string;
    rate: number;
    termMonths: number;
  }[];
  termBands: {
    startDate: string;
    endDate: string;
    label: string;
    rate: number;
  }[];
};
```

## 11. Mortgage Math

### Payment Frequency Periods

Recommended mapping:

| Frequency | Payments per year |
| --- | ---: |
| Weekly | 52 |
| Bi-weekly | 26 |
| Semi-monthly | 24 |
| Monthly | 12 |

Date increments:

- Weekly: add 7 days.
- Bi-weekly: add 14 days.
- Semi-monthly: pay on the 1st and 15th of each month.
- Monthly: add 1 calendar month.

If the mortgage starts after the next scheduled semi-monthly date, the first semi-monthly payment should use the next available 1st or 15th.

### Canadian Periodic Rate

For Canadian fixed-rate mortgages, the nominal annual rate is commonly compounded semi-annually. Convert to an effective periodic payment rate:

```text
effectiveAnnualRate = (1 + nominalAnnualRate / 2) ^ 2 - 1
periodicRate = (1 + effectiveAnnualRate) ^ (1 / paymentsPerYear) - 1
```

Where `nominalAnnualRate` is decimal, for example `0.05` for 5%.

This should be wrapped in a dedicated function:

```ts
function getPeriodicRate(
  annualRate: number,
  paymentsPerYear: number,
  compounding: 'semi-annual' | 'monthly' | 'simple'
): number
```

Version 1 can default to `semi-annual`.

### Payment Amount Formula

For a normal amortizing payment:

```text
payment = balance * periodicRate / (1 - (1 + periodicRate) ^ -remainingPayments)
```

When interest rate is zero:

```text
payment = balance / remainingPayments
```

The final payment should be capped so the balance never goes below zero except for rounding cleanup.

### Payment Row Calculation

For each payment date:

1. Start with opening balance.
2. Apply same-date lump sum before regular payment interest is calculated.
3. Calculate interest for the period.
4. Calculate the scheduled payment's interest portion and principal portion.
5. Track the total principal reduction as scheduled principal plus any lump-sum payment.
6. Update closing balance.
7. If closing balance reaches zero, stop schedule generation.
8. If renewal date is reached, start a new term segment and recalculate the payment.

### Rounding

Money should be rounded to cents at row boundaries.

Recommended:

- Keep internal calculations in decimal dollars.
- Round displayed values to cents.
- Round schedule row values to cents for auditability.
- Apply a final payment adjustment to prevent negative ending balances.

Avoid storing money as formatted strings.

## 12. Renewal Handling

Renewals should be treated as events that split the schedule into term segments.

Renewals are manually entered by the user. The app should not auto-generate future renewal events in version 1.

Example:

```text
2026-08-01 start mortgage, 5-year term, 4.89%
2031-08-01 renewal, 3-year term, 4.25%
2034-08-01 renewal, 5-year term, 4.75%
```

Generated schedule rows should carry `periodId` so charts and tables can group rows by term.

Chart behavior:

- Balance chart: add vertical marker at renewal date.
- Balance chart: add shaded band for each term.
- Payment breakdown chart: optionally color data by term or display renewal markers.
- Table: insert a renewal marker row or badge on first row of renewed term.

## 13. Lump-Sum Handling

The app should allow a user to add:

- Date.
- Amount.
- Optional label.

The app should not impose a count limit on lump-sum entries. Users may add as many one-time lump-sum payments as they want; version 1 only validates dates, positive amounts, payoff timing, and balance caps. Lender rules and maximum allowed prepayment amounts are deferred.

Lump sums should be visible in:

- Input/event editor.
- Payment schedule table.
- Payment breakdown chart.
- Summary metrics.

Validation:

- Date must be on or after start date.
- Amount must be greater than zero.
- Lump sum cannot exceed the remaining balance on its application date, or it should be capped with a warning.
- Lump sums after payoff date should be ignored with a warning.

Recommended first-version behavior:

- Lump sums reduce principal.
- Regular payment amount stays unchanged until renewal.
- Mortgage pays off earlier because the unchanged scheduled payment now pays down the reduced balance faster.
- This matches the expected Canadian-style behavior for this app. Other country- or lender-specific approaches can be added later.

## 14. Local Storage Persistence

Use local storage for scenario persistence.

Storage key:

```text
mortgage-model:v1:scenarios
```

Stored shape:

```ts
type StoredScenarioState = {
  schemaVersion: 1;
  activeScenarioId: string | null;
  scenarios: MortgageScenario[];
};
```

Rules:

- Save after every valid scenario edit.
- Debounce writes to avoid excessive local storage churn.
- Validate and migrate on load.
- If storage is empty, create a default scenario.
- If storage is corrupt, preserve raw invalid data under a backup key before resetting.

Suggested backup key:

```text
mortgage-model:v1:invalid-backup:{timestamp}
```

## 15. State Management

For first version, a small Pinia store or a simple Vue composable is enough.

Recommended:

```ts
useScenarioStore()
```

Responsibilities:

- Load scenarios from local storage.
- Track active scenario.
- Create, duplicate, rename, delete scenarios.
- Update mortgage inputs.
- Add, update, delete lump sums.
- Add, update, delete renewals.
- Expose computed projection result.

The calculation result should be derived state, not persisted.

Persist:

- User inputs.
- Scenario metadata.

Do not persist:

- Generated schedule.
- Chart datasets.
- Summary metrics.

## 16. UI Design

### Main Layout

Desktop:

- Top bar across the full page with scenario selector and primary scenario actions.
- Two-column dashboard below the top bar.
- Main work area on the left, roughly 2/3 page width.
- Control sidebar on the right, roughly 1/3 page width.

Left column, 2/3 width:

- Summary metrics at the top.
- Balance over time chart.
- Payment breakdown chart.
- Payment schedule table.

Right column, 1/3 width:

- Basic mortgage input parameters.
- Mortgage renewal table/editor.
- Lump-sum payment table/editor.
- Projection warnings, if any.

The left column should prioritize reading and analysis. The right column should be the editing surface where the user changes assumptions and events.

Suggested desktop proportions:

```css
.dashboard {
  display: grid;
  grid-template-columns: minmax(0, 2fr) minmax(320px, 1fr);
  gap: 24px;
}
```

The right column should remain wide enough for form controls and compact event tables. On very wide screens, cap the content width so charts and table rows remain readable.

Suggested sections:

1. Scenario selector
2. Summary metrics
3. Balance over time chart
4. Payment breakdown chart
5. Payment schedule table
6. Mortgage inputs
7. Renewal editor
8. Lump-sum editor

Mobile:

- Scenario selector remains at top.
- Columns collapse into a single stack.
- Input and event sections appear before charts so the user can adjust assumptions first.
- Charts stack vertically.
- Table becomes horizontally scrollable.

### Scenario Selector

Controls:

- Dropdown of saved sessions/scenarios.
- New scenario button.
- Duplicate button.
- Rename button.
- Delete button with confirmation.

### Mortgage Input Panel

Inputs:

- Mortgage amount.
- Start date.
- Amortization years/months.
- Current term length: 3 years, 5 years, custom.
- Annual interest rate.
- Payment frequency.

Use numeric inputs with clear units and formatting.

### Event Editors

Lump sums:

- Table/list of existing lump sums.
- Add/edit modal or inline row.
- Date, amount, label.

Renewals:

- Table/list of renewal events.
- Effective date.
- Rate.
- Term length.
- Payment frequency.
- Optional note.

### Summary Metrics

Display:

- Regular payment amount.
- Next scheduled payment interest portion.
- Next scheduled payment principal portion.
- Payoff date.
- Total interest.
- Total principal.
- Total lump sums.
- Total paid.
- Remaining balance at end of current term.
- Interest/principal paid during current term.

### Charts

Use Chart.js with Vue wrapper or direct component wrapper.

Balance chart:

- X axis: date.
- Y axis: remaining balance.
- Line: balance.
- Vertical markers: renewals.
- Shaded regions: terms.
- Optional markers: lump sums.

Payment breakdown chart:

- X axis: date.
- Y axis: dollars.
- Lines or stacked bars:
  - Interest portion.
  - Principal portion.
  - Lump sums.

For many payments, aggregate chart data by month or year while keeping the table at payment-level detail.

### Payment Schedule Table

Columns:

- Payment number.
- Date.
- Opening balance.
- Scheduled payment.
- Scheduled interest portion.
- Scheduled principal portion.
- Lump sum.
- Total payment.
- Total principal reduction.
- Closing balance.
- Rate.
- Term label.
- Event notes.

Features:

- Sort by date/payment number.
- Filter by term.
- Search/filter event rows.
- Toggle all rows vs annual summary.
- Sticky header.
- CSV export can be added later.

Recommended table library:

- Use `@tanstack/vue-table` for the payment schedule.
- Rationale: it is headless, works well with Vue 3 and TypeScript, keeps styling under app control, and supports the needed table behaviors: sorting, filtering, column definitions, row models, sticky-header-friendly markup, and future virtualization.
- If payment rows expand substantially in later versions, pair it with TanStack Virtual rather than changing the table abstraction.

## 17. Chart/Table Interaction

Useful interactions:

- Hovering chart point shows payment details.
- Clicking a chart point scrolls/highlights the matching table row.
- Clicking a renewal marker filters or highlights the corresponding term rows.
- Clicking a table row highlights the corresponding chart point.

Implementation approach:

- Every schedule row has a stable `sequence`.
- Chart points include `sequence`.
- Table rows use `data-sequence`.
- Store `highlightedSequence` in UI state.

## 18. Validation and Warnings

Validation should happen in two layers:

1. Form validation for immediate user feedback.
2. Calculation validation for projection safety.

Examples:

- Mortgage amount must be greater than zero.
- Amortization must be greater than zero.
- Interest rate cannot be negative.
- Payment frequency is required.
- Term length must be greater than zero.
- Renewal date cannot be before mortgage start date.
- Renewal dates should be ordered and unique.
- Lump-sum date cannot be before mortgage start date.
- Lump-sum amount must be greater than zero.

Projection warnings:

- Lump sum ignored because it occurs after payoff.
- Lump sum capped because it exceeds remaining balance.
- Renewal ignored because mortgage is already paid off.
- Payment amount is too small to cover interest, if custom payments are later supported.

## 19. Accessibility

Minimum requirements:

- Keyboard-accessible forms and controls.
- Labels for every input.
- Proper table headers.
- Chart summaries available as text through summary metrics and table data.
- Color choices should not be the only way to distinguish interest/principal/term bands.
- Adequate contrast in light and dark surfaces.

## 20. Styling Direction

The app is a financial planning tool, so it should feel calm, precise, and trustworthy.

Recommended visual style:

- Dense but readable dashboard.
- Neutral background.
- Strong typography hierarchy.
- Clear input grouping.
- Subtle accent colors for interactive elements.
- Use distinct colors for balance, principal, interest, lump sums, and renewal markers.

Avoid:

- Marketing landing-page layout.
- Oversized hero sections.
- Decorative visuals that compete with numbers.
- One-color theme where all charts and controls look similar.

## 21. Performance Considerations

A weekly 30-year mortgage has roughly 1,560 payment rows. This is small enough for normal rendering, but table virtualization may become useful after adding comparisons or long histories.

Recommended:

- Memoize projection results by scenario input hash.
- Aggregate chart data for display if row count gets large.
- Keep full payment schedule available for the table.
- Debounce input changes before recalculating charts if needed.

## 22. Testing Strategy

### Unit Tests

Most important tests should cover `domain/mortgageCalculator.ts`.

Test cases:

- Monthly payment calculation.
- Weekly payment calculation.
- Bi-weekly payment calculation.
- Semi-monthly payment calculation.
- Zero interest mortgage.
- Final payment adjustment.
- Lump sum before payoff.
- Lump sum on regular payment date.
- Lump sum exceeding remaining balance.
- Multiple lump sums with no artificial count limit.
- Lump sum shortens payoff time while keeping the scheduled payment unchanged until renewal.
- Renewal after first term.
- Renewal ignored after payoff.
- Full payoff before original amortization.

### Component Tests

Cover:

- Scenario selection.
- Adding/editing/deleting lump sums.
- Adding/editing/deleting renewals.
- Input validation messages.
- Table renders schedule rows correctly.

### Browser/E2E Tests

Cover:

- Create scenario.
- Change inputs and verify summary updates.
- Add lump sum and verify payoff date/interest changes.
- Add renewal and verify marker appears.
- Reload page and verify local storage restoration.

## 23. Implementation Phases

### Phase 1: Project Foundation

- Scaffold Vue + Vite + TypeScript app using Bun.
- Add linting/formatting.
- Add base styling.
- Add basic layout.
- Add Chart.js dependency.
- Add `@tanstack/vue-table` for the payment schedule.
- Keep the app runnable immediately with a default scenario shell, placeholder summary, placeholder charts, and an empty schedule table.
- Add an initial smoke test so every later phase starts from a runnable baseline.

### Phase 2: Calculation Engine

- Define domain types.
- Implement payment frequency helpers.
- Implement Canadian periodic rate conversion.
- Implement amortization schedule generation.
- Implement lump-sum support.
- Implement renewal support.
- Add unit tests.

### Phase 3: Local Scenario Storage

- Implement local storage repository.
- Implement scenario store/composable.
- Add create/duplicate/delete/rename.
- Add active scenario dropdown.

### Phase 4: Main UI

- Build mortgage input panel.
- Build summary metrics.
- Build lump-sum editor.
- Build renewal editor.
- Build payment schedule table.

### Phase 5: Charts and Interactions

- Build balance chart.
- Build payment breakdown chart.
- Add renewal markers and term bands.
- Add lump-sum markers.
- Add chart/table highlighting.

### Phase 6: Polish

- Add validation states.
- Add warnings panel.
- Improve mobile layout.
- Add formatting utilities.
- Add export/import if desired.

## 24. Suggested Defaults

Default scenario:

- Mortgage amount: `$500,000`
- Start date: today
- Amortization: `25 years`
- Current term: `5 years`
- Interest rate: `5.00%`
- Payment frequency: `monthly`
- No lump sums
- No renewals

Scenario names:

- `Scenario 1`
- `Lower rate`
- `Extra payments`
- `Accelerated payoff`

## 25. Risks

### Mortgage Math Accuracy

Canadian mortgage calculations can vary by lender and product. The app should clearly define its assumptions and keep calculation functions isolated for testing.

### Date Handling

Payment frequencies create subtle date issues, especially monthly month-end starts and semi-monthly 1st/15th schedules. Use dedicated date helpers and test boundary behavior.

### Chart Readability

Payment-level charts can become noisy for weekly/bi-weekly schedules. Aggregation controls may be needed.

### Local Storage Limits

Local storage is enough for typical scenarios, but large saved schedules should not be persisted. Persist inputs only.

## 26. Future Enhancements

- Scenario comparison mode.
- Import/export scenarios as JSON.
- CSV export for payment schedule.
- PDF report generation.
- Accelerated weekly and accelerated bi-weekly payments.
- Country- or lender-specific lump-sum behavior, such as recalculating lower payments instead of shortening amortization.
- Regular extra payment support.
- Variable-rate mortgages.
- Fixed vs variable rate comparison.
- Prepayment privilege tracking.
- Penalty estimation.
- Property tax and insurance planning.
- Mortgage affordability calculator.
- Dark mode.
- Cloud sync.

## 27. Recommended First Build Scope

For the initial working app, build:

- Single active scenario with local storage.
- Scenario dropdown with create/duplicate/delete.
- Core inputs:
  - Principal amount.
  - Start date.
  - Amortization.
  - Term length.
  - Interest rate.
  - Payment frequency.
- Projection summary.
- Balance chart.
- Interest/principal chart.
- Payment schedule table.
- Lump-sum event editor.
- Renewal event editor.

Defer:

- CSV/PDF export.
- Scenario comparison.
- Prepayment penalties.
- Variable rates.
- Regular extra payments.

## 28. Remaining Decisions Before Implementation

These choices are still open:

1. Should regular recurring extra payments be added after the one-time lump-sum workflow is stable?
