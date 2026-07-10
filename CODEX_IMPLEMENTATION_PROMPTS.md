# Codex Implementation Prompts

Use these prompts sequentially. Each prompt is intentionally small enough to leave the app runnable, testable, and easy to review before moving on.

General instruction to include with every prompt:

```text
Work in this repo. Keep the app runnable after this step. Prefer small, idiomatic Vue 3 + Vite + TypeScript changes. Keep mortgage math in pure domain functions, not Vue components. Add or update focused tests for the behavior introduced in this step, then run the relevant tests and tell me exactly what passed or failed.
```

## Prompt 1: Bootstrap a Runnable App Shell

```text
Scaffold the project as a Vue 3 + Vite + TypeScript app using Bun. Add Vitest, Vue Test Utils, jsdom, Chart.js, vue-chartjs, and @tanstack/vue-table. Create the initial app layout from MORTGAGE_CALCULATOR_DESIGN.md: top scenario bar, main analysis area, right-side editing panel, summary metric placeholders, chart placeholders, and an empty payment schedule table placeholder.

Make this first slice runnable immediately with `bun run dev`. Add a basic smoke test that mounts the app and verifies the main dashboard regions render. Add package scripts for dev, build, test, and typecheck. Do not implement mortgage math yet.
```

Acceptance check:

- `bun run dev` starts the app.
- `bun test` passes the initial smoke test.
- The first screen is the actual calculator dashboard shell, not a landing page.

## Prompt 2: Add Domain Types and Utility Functions

```text
Add the domain model types described in MORTGAGE_CALCULATOR_DESIGN.md. Include MortgageScenario, MortgageTerm, RenewalEvent, LumpSumEvent, PaymentFrequency, PaymentStrategy, PaymentScheduleRow, MortgageProjection, ProjectionSummary, and ProjectionChartSeries.

Add pure utility modules for money rounding, date math, payment frequency metadata, payment date generation, and Canadian periodic rate conversion. Version 1 should default to semi-annual Canadian compounding. Add unit tests for frequency mappings, periodic rate conversion, zero-interest handling helpers, monthly date increments, weekly/bi-weekly increments, and semi-monthly 1st/15th behavior.
```

Acceptance check:

- Domain modules have no Vue imports.
- Utility tests pass with `bun test`.
- The app still runs and shows the shell.

## Prompt 3: Implement the Basic Mortgage Calculator

```text
Implement the pure mortgage projection engine for a single scenario without lump sums or renewals first. It should calculate scheduled payment amount, payment rows, opening/closing balances, scheduled interest portion, scheduled principal portion, total principal reduction, payoff date, total interest, total principal, and chart series.

Use Canadian semi-annual compounding by default. Cap the final payment so the balance does not go below zero except for cent-level cleanup. Add unit tests for monthly, weekly, bi-weekly, semi-monthly, zero-interest, and final-payment-adjustment cases.
```

Acceptance check:

- A default scenario can produce a full schedule.
- Scheduled payment, interest portion, and principal portion are separate fields.
- Unit tests cover the core amortization loop.

## Prompt 4: Wire the Calculator Into the UI Early

```text
Connect the default scenario to the calculator and render real projection output in the dashboard. Build a basic mortgage input panel for principal amount, start date, amortization years/months, term length, annual interest rate, and payment frequency.

Render summary metrics including regular payment amount, next scheduled interest portion, next scheduled principal portion, payoff date, total interest, total principal, and total paid. Build the first PaymentScheduleTable using @tanstack/vue-table with columns for date, opening balance, scheduled payment, scheduled interest portion, scheduled principal portion, lump sum, total payment, total principal reduction, closing balance, rate, and event notes.

Add tests that changing core inputs updates the projection summary.
```

Acceptance check:

- The UI is useful enough to verify mortgage math manually.
- The scheduled payment and its interest/principal split are visible.
- The payment table uses @tanstack/vue-table.

## Prompt 5: Add Unlimited Lump-Sum Payments

```text
Implement lump-sum prepayments end to end. The app should allow adding, editing, and deleting unlimited one-time lump-sum payments with date, amount, and optional label. There should be no artificial count limit.

Projection behavior: apply same-date lump sums before scheduled payment interest is calculated, reduce principal, keep the regular scheduled payment unchanged until renewal, and shorten the payoff timeline. Lump sums after payoff should be ignored with a warning. Lump sums above the remaining balance should be capped with a warning.

Update the schedule, summary metrics, chart series, and table rows so lump sums are visible separately from scheduled principal. Add unit tests for a lump sum before payoff, a lump sum on a regular payment date, multiple lump sums, excessive lump sums, ignored post-payoff lump sums, and proof that lump sums shorten payoff while keeping the scheduled payment unchanged.
```

Acceptance check:

- Adding a lump sum immediately changes the payoff date earlier.
- Scheduled payment remains unchanged until renewal.
- Lump sum, scheduled principal, scheduled interest, and total principal reduction are all visible.

## Prompt 6: Add Renewal Events

```text
Implement manual renewal events. Users can add, edit, and delete renewal events with effective date, term length, annual interest rate, payment frequency, payment strategy, and note.

Projection behavior: renewals split the schedule into term segments, recalculate scheduled payment at renewal based on remaining balance, new rate, frequency, and remaining amortization, and preserve the shortened payoff behavior caused by prior lump sums. Renewal rows or first rows in a renewed term should be clearly marked in the schedule. Add projection warnings for renewals after payoff.

Add unit tests for renewal after the first term, rate changes, payment recalculation, term IDs on rows, and renewal ignored after payoff.
```

Acceptance check:

- Renewal changes are visible in the schedule and summary.
- Term labels/period IDs make it clear which rows belong to which term.
- Existing lump-sum behavior still passes tests.

## Prompt 7: Add Local Scenario Storage

```text
Implement local scenario persistence using the storage shape in MORTGAGE_CALCULATOR_DESIGN.md. Add a small scenario store or composable that loads scenarios, tracks the active scenario, creates a default scenario, creates new scenarios, duplicates, renames, deletes, and saves valid edits.

Persist user inputs only, not generated schedules or chart data. Debounce writes. If local storage data is corrupt, preserve the raw invalid data under a timestamped backup key and reset to a default scenario.

Add component/store tests for create, duplicate, rename, delete, active scenario switching, persistence restore, and corrupt-storage recovery.
```

Acceptance check:

- Reloading the page restores scenarios.
- Scenario actions work without breaking the calculator.
- Derived projection data is not persisted.

## Prompt 8: Add Charts

```text
Build the balance-over-time chart and payment-breakdown chart with Chart.js/vue-chartjs. Use projection chart series from the domain layer. Balance chart should show remaining balance, renewal markers, term bands if practical, and lump-sum markers. Payment breakdown chart should show scheduled interest, scheduled principal, and lump sums as distinct values.

Aggregate chart data by month or year if needed for readability, but keep payment-level detail in the table. Add tests for chart data preparation functions and at least one component test that verifies chart components receive the expected datasets.
```

Acceptance check:

- Charts render from real projection data.
- Interest, principal, and lump sums use distinct colors/series.
- Table data remains payment-level.

## Prompt 9: Validation, Warnings, and Responsive Polish

```text
Add form validation and projection warnings described in MORTGAGE_CALCULATOR_DESIGN.md. Validate positive mortgage amount, positive amortization, non-negative interest rate, required payment frequency, positive term length, renewal dates on/after start date, unique renewal dates, lump-sum dates on/after start date, and positive lump-sum amounts.

Improve responsive layout: desktop two-column dashboard, mobile single-column flow with inputs before charts, horizontally scrollable table, sticky table header, and accessible labels. Keep the visual style calm, dense, readable, and finance-focused.

Add tests for validation messages and warning rendering.
```

Acceptance check:

- Invalid inputs are visible before they cause bad projections.
- Mobile layout is usable.
- Accessibility basics are present: labels, keyboard controls, table headers, and non-color-only distinctions.

## Prompt 10: Final Regression and Hardening

```text
Run a full implementation review against MORTGAGE_CALCULATOR_DESIGN.md and this prompt document. Fix gaps in the first-build scope. Add any missing high-value tests around mortgage math, lump-sum payoff shortening, renewal recalculation, and persistence.

Run the full verification set: install/build if needed, `bun test`, `bun run typecheck`, and `bun run build`. Start the dev server and provide the local URL. Summarize what changed, what passed, and any remaining limitations.
```

Acceptance check:

- App builds.
- Tests pass.
- The app is runnable locally and ready for manual UI/math review.
