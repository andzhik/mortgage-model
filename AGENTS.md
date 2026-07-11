# AGENTS.md

## Before changing code

- Use Bun (`bun.lock`): `bun run test`, `bun run typecheck`, `bun run build`.
- Read `MORTGAGE_CALCULATOR_DESIGN.md` for product intent, but treat current tests and implementation as authoritative when it is stale.
- Preserve unrelated work in the working tree.

## Architecture

- Keep mortgage math in pure TypeScript under `src/domain/`; it must not depend on Vue, the DOM, or localStorage.
- Components collect input and render results. The store owns scenario mutations and derives projections from inputs.
- Persist scenario inputs only. Never persist schedules, summaries, or chart datasets.
- Reuse `src/domain/mortgageTypes.ts`, date helpers, and money helpers instead of duplicating rules.

## Calculation invariants

Do not change these implicitly:

- Internal rates are decimal nominal annual rates (`0.05` = 5%) using Canadian semi-annual compounding.
- Dates are `YYYY-MM-DD` and are handled in UTC by `dateMath.ts`; avoid local-time `Date` parsing. Semi-monthly payments fall on the 1st and 15th.
- Round monetary schedule values to cents with `money.ts`. Cap the final payment so the balance cannot become negative.
- A same-date lump sum is applied before regular-payment interest. Regular payments remain unchanged after a lump sum until renewal.
- Renewals are explicit events and may change rate, term, frequency, and payment strategy.
- Projection ends at payoff or the 10,000-row safety limit. Preserve warnings for capped or ignored events.

Any change to rate conversion, event ordering, dates, rounding, or payoff logic needs an exact regression test covering representative rows and totals.

## Persistence

The current schema is version 1 at `mortgage-model:v1:scenarios`. If persisted types change:

- update validation and sanitization in `localStorageRepository.ts`;
- preserve compatibility with existing data through parsing/migration or deliberately bump the schema;
- retain the corrupt-data backup behavior.

## Verification and handoff

- Test at the closest layer: domain math in `tests/domain.*`, store behavior in `scenarioStore.test.ts`, and user behavior in `App.*` or component tests.
- For meaningful code changes, run focused tests, then `bun run test` and `bun run build`. Report anything not run.
- Summarize the behavior changed and propose a concise imperative commit message for every meaningful change.
