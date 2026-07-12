# Advanced Mortgage Calculator

A browser-only mortgage planning tool for modelling Canadian mortgages across their full amortization. It generates an auditable payment schedule, supports renewals and one-time lump-sum prepayments, compares locally saved scenarios, and visualizes balances and payment composition.

> This project is a planning aid, not financial advice. Results depend on the assumptions entered and may differ from a lender's calculations, fees, prepayment rules, or rounding.

## Features

- Weekly, bi-weekly, semi-monthly, and monthly payment schedules
- Canadian nominal rates compounded semi-annually
- Interest/principal breakdown for every payment
- Manually entered renewals with new rates, terms, frequencies, and payment strategies
- Dated lump-sum prepayments that reduce principal and can shorten payoff time
- Balance and payment-breakdown charts
- Detailed payment schedule with annual-summary mode
- Multiple create/duplicate/rename/delete scenarios
- Automatic browser-local persistence; no account or backend required

## Tech stack

- Vue 3 and TypeScript
- Vite
- Chart.js and vue-chartjs
- TanStack Table
- Vitest, Vue Test Utils, and jsdom
- Bun for dependency and script management

## Getting started

Prerequisite: a recent [Bun](https://bun.sh/) installation.

```sh
bun install
bun run dev
```

Vite prints the local development URL. Production assets are emitted to `dist/` by:

```sh
bun run build
```

## Quality checks

```sh
bun run test       # run the Vitest suite once
bun run typecheck  # run strict Vue/TypeScript checks
bun run build      # typecheck and create a production build
```

Run the most relevant focused test while iterating, then run the complete test and build commands before handing off a meaningful change.

## Measuring UI performance

The app includes an opt-in browser profiler for investigating input lag. Start the app and open the local URL printed by Vite:

```sh
bun run dev
```

Open the browser's developer tools, select the Console, and enable measurements:

```js
window.__mortgagePerformance.enable()
```

Change a valid mortgage input such as **Mortgage amount**. Each update reports:

- `projection calculation`: pure mortgage schedule and projection generation;
- `balance chart preparation`: creation of the balance-chart dataset;
- `payment chart preparation`: creation of the payment-breakdown dataset;
- `AppShell render function`: root Vue virtual-node construction;
- `payment table render function`: schedule row and cell virtual-node construction;
- `scenario mutation → Vue updated hook`: reactive invalidation, virtual-node construction, and Vue DOM patching;
- `Vue updated hook → first animation frame`: browser work and frame wait after Vue commits the DOM;
- `first → second animation frame`: the final frame interval used to cross a paint opportunity;
- `scenario mutation → next paint`: approximate end-to-end time from the scenario change through the next browser paint.

The mutation-to-next-paint result is the closest built-in measurement of user-visible latency. It deliberately waits for two animation frames, so use it for relative before/after comparisons rather than treating it as a precise breakdown of browser work. Use the browser's Performance panel when layout, paint, scripting, or Chart.js animation must be separated.

The payment schedule keeps the complete projection available to TanStack Table while mounting only the visible fixed-height rows plus a small overscan window. Chart updates are intentionally not animated so live input changes do not schedule continuing canvas work across later frames.

For useful comparisons:

1. Use the same browser, viewport, scenario, input, and build mode.
2. Ignore the first update so browser and JavaScript warm-up do not skew the result.
3. Record several updates and compare the median rather than a single result.
4. Test both a normal monthly scenario and a dense weekly 25- or 30-year scenario.
5. Keep DevTools throttling settings unchanged between runs.

Disable console measurements when finished:

```js
window.__mortgagePerformance.disable()
```

Profiling is disabled by default and does not change mortgage calculations.

## How the model works

The annual interest-rate input is a nominal decimal rate internally (`0.05` means 5%). For the default Canadian convention, the calculator converts the nominal rate compounded semi-annually into an effective rate for the selected payment frequency.

At a high level, the projection:

1. Calculates a regular amortizing payment from the opening balance, rate, frequency, and remaining payments.
2. Advances through ISO calendar dates (`YYYY-MM-DD`) using frequency-specific date rules.
3. Applies a lump sum before interest when it shares a regular payment date.
4. Applies renewal terms at their effective date and recalculates the payment when requested.
5. Rounds schedule-row money to cents and adjusts the final payment so the closing balance does not become negative.
6. Stops at payoff or at the 10,000-row safety limit.

The current product assumptions and longer-form rationale live in [MORTGAGE_CALCULATOR_DESIGN.md](MORTGAGE_CALCULATOR_DESIGN.md). The implementation and tests are authoritative if that design document falls behind.

## Project structure

```text
src/
  app/          application composition and display formatting
  components/   forms, charts, summary cards, and schedule table
  domain/       pure mortgage math, dates, money, types, and chart data
  persistence/  validated localStorage repository
  stores/       scenario lifecycle and derived projection state
  styles/       global theme and layout styles
tests/          domain, store, component, validation, and smoke tests
```

The important dependency direction is `components/app -> store -> domain`. Mortgage calculations belong in pure domain modules rather than Vue components. Projections are derived from saved scenario inputs; generated schedules and chart series are not persisted.

## Local data

Scenarios are stored in browser localStorage under:

```text
mortgage-model:v1:scenarios
```

Invalid stored data is preserved, when possible, under a timestamped `mortgage-model:v1:invalid-backup:*` key before the app creates a default scenario. Clearing site data resets all scenarios. There is currently no cloud sync or import/export.

When changing persisted types, update validation/sanitization and introduce an explicit migration or schema version change. Do not silently reinterpret existing user data.

## Scope

The calculator currently targets CAD mortgage planning. It does not model lender-specific prepayment limits or penalties, property tax, insurance, condo fees, affordability qualification, variable-rate behaviour, or live market rates.

## License

See [LICENSE](LICENSE).
