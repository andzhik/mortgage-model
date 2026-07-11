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
