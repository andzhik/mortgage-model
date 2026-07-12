# UI Performance Fix: Discussion and Decision Plan

## Status

Partially implemented. Browser phase measurements confirmed that full-table DOM patching and post-update browser work dominated input latency. Fixed-height row virtualization and animation-free Chart.js updates are now implemented; chart rebucketing and projection-display debouncing remain pending measurement rather than being assumed necessary.

## Decisions recorded

- Table rows may use a fixed height. Long content may be truncated or moved into an explicit detail interaction.
- Long-term charts should use six two-month buckets per year. A 25-year projection therefore has approximately 150 ordinary buckets.
- The payment-breakdown reduction semantics remain undecided and are outside the initial decision for now.
- Projection display updates may be debounced by 150 ms. This is an initial tuning value, not a permanent product invariant.
- Performance acceptance is targeted at a good contemporary desktop.
- An annual-summary table mode is not part of this performance change.
- The requested lump-sum chart behavior needs one clarification: whether to remove the lump-sum dataset from the payment breakdown chart entirely, or merely avoid preserving lump sums as exact-date markers when ordinary points are bucketed.

## Problem statement

Every valid input event currently recalculates the projection and sends new schedule and chart arrays through the UI. The calculation itself is inexpensive for a normal scenario; the expensive work is rebuilding the full payment table and updating both Chart.js charts.

The default 25-year monthly scenario produces roughly:

- 300 schedule rows;
- 3,900 table cells across 13 columns, plus cell-rendering components;
- 300 source points for each chart before display preparation.

Weekly schedules can grow to roughly 1,300-1,560 rows, making the table cost substantially worse.

## Proposed direction

### 1. Virtualize the payment table

“Virtual table” or “virtualized table” is current terminology. The implementation should keep the complete schedule in memory for auditability, calculations, filtering, and future export, but mount only the visible rows plus a small overscan buffer.

The existing table uses TanStack Table, and the product design already recommends pairing it with TanStack Virtual if virtualization becomes necessary. This avoids replacing the table abstraction.

Recommended initial behavior:

- Keep the existing 420 px scroll viewport and sticky header.
- Virtualize rows, not cells or columns.
- Render visible rows plus approximately 8-15 rows above and below the viewport; tune this from measured scroll behavior rather than using “several pages” as a fixed rule.
- Use a fixed row height.
- Preserve the complete payment-level schedule and all existing columns.
- Preserve stable row identity using a schedule-specific key, preferably sequence plus an event discriminator if sequence is not unique for event-only rows.
- Preserve keyboard and screen-reader usability, including meaningful row position/count semantics.
- Keep event rows, renewal indicators, and lump sums indistinguishable in behavior from ordinary rows.

#### Challenge to the idea

Virtualization solves mounted-DOM volume, but it does not stop projection recalculation or chart updates. It should greatly reduce the largest rendering cost, yet it may not fully eliminate typing latency on slower devices.

“Several pages around” may be excessive. Overscan measured in rows is easier to tune and normally needs only enough content to cover a fast wheel or trackpad movement. Large overscan partially recreates the original problem.

Virtualized semantic tables are also more delicate than virtualized lists. Row height, spacer elements, sticky headers, browser table layout, focus retention, and accessibility must be tested explicitly. Fixed-height rows make the implementation much safer; wrapped event notes create variable-height rows and complicate scroll measurement.

### 2. Reduce chart display density

The application already reduces chart density:

- up to 180 source points: payment-level display;
- 181-900 source points: monthly buckets;
- more than 900 source points: yearly buckets.

Consequently, a standard 25-year monthly mortgage still displays approximately 300 monthly chart buckets. A weekly 25-year schedule is already reduced to approximately 25 yearly buckets.

The two charts require different reduction semantics:

- **Balance line:** sampling is appropriate. Each displayed point should normally be the closing balance at the end of the selected time bucket.
- **Payment breakdown bars:** sampling is not appropriate because it would discard payments. Interest, principal, and lump sums must be summed over the selected bucket so a bar retains a meaningful total.

Recorded target:

- Use six two-month calendar buckets per year for long-term projections.
- A 25-year projection should therefore contain approximately 150 ordinary buckets; a 30-year projection should contain approximately 180.
- The cutoff between detailed short-schedule display and two-month bucketing remains to be selected during implementation.
- Always preserve the first and payoff points for the balance line.
- Always preserve or explicitly mark renewals and lump sums, even if they occur between ordinary sampled points.
- Keep full-precision schedule data unchanged; sparsity applies only to prepared chart datasets.

For a short mortgage, payment-level or monthly detail may remain useful. This is the unresolved meaning behind the question about retaining payment-level detail: for example, should a six-month mortgage show its six individual monthly payments, or compress them into three two-month points? The recommendation is to retain detail for short schedules and apply two-month buckets only after a selected duration or point-count threshold.

#### Challenge to the idea

Fewer points will reduce Chart.js work, but 300 points is not inherently large. Dataset replacement, chart animation, and rebuilding both charts on every input event may matter as much as point count. We should measure chart update time before claiming downsampling alone fixes the chart portion.

The phrase “shape of the graph” is clear for the balance line but ambiguous for the payment breakdown bars. Binning two months of payments changes the bar magnitude relative to a monthly chart. Tooltips and axis labels must make the bucket period explicit so users do not interpret a two-month total as one payment or one month.

Naive every-Nth-point sampling can hide lump sums, renewal discontinuities, the exact payoff, or local changes around an event. Calendar bucketing with explicit event markers is safer and easier to explain.

## Additional question: input update policy

Table virtualization and chart sparsity reduce the work performed by each update. They do not address how often updates occur: numeric fields currently commit on every input event, including intermediate values while a user types.

Possible policies:

1. **Keep immediate updates.** Preferred starting point if virtualization and chart work bring interactions comfortably within the frame budget.
2. **Debounce projection display only.** Keep the input responsive, then refresh projections after a short idle period (for example 100-200 ms). This improves typing but makes results momentarily trail the input.
3. **Commit on blur/Enter.** Lowest update frequency, but it weakens the current live-calculator behavior and is not recommended unless deliberately chosen as a product change.

Use a 150 ms projection-display debounce initially. The input's own visible value and validation should remain immediate; the summary, charts, and table may trail by at most the debounce interval. This value should be tuned after measuring the optimized production build.

## Measurements collected so far

### Browser measurements before virtualization

For a default 300-row monthly schedule, one representative input update reported:

| Phase | Result |
| --- | ---: |
| Pure projection | 1.20 ms |
| Payment-table render function | 40.90 ms |
| Scenario mutation to Vue updated hook | 301.40 ms |
| Vue updated hook to first animation frame | 138.30 ms |
| First to second animation frame | 190.00 ms |
| Scenario mutation to next-paint checkpoint | 629.70 ms |

The gap between virtual-node construction and the Vue updated hook strongly implicated DOM patching of the full table. Delayed animation-frame callbacks also justified disabling Chart.js animation for live projection changes. These phase measurements are elapsed-time boundaries, not a claim that the final 190 ms was exclusively paint work.

These are isolated Bun timings on the current development machine, not browser interaction or paint measurements:

| Scenario/work | Result |
| --- | ---: |
| 1,000 default monthly mortgage projections | 421.35 ms total |
| Average pure projection | 0.4213 ms |
| Default monthly schedule size | 300 rows |
| Approximate current table body size | 3,900 cells |
| Monthly: prepare both chart datasets | 0.1759 ms average |
| Monthly: current displayed chart buckets | 300 per chart |
| Weekly: schedule size | 1,300 rows |
| Weekly: prepare both chart datasets | 0.3848 ms average |
| Weekly: current displayed chart buckets | 25 per chart |

Interpretation:

- Pure mortgage calculation and data preparation are both comfortably below one millisecond in these isolated tests.
- These numbers do not include Vue rendering, TanStack cell components, Chart.js dataset updates/animation, browser layout, or paint.
- The strongest current evidence still points to mounted table DOM and Chart.js updates rather than mortgage math.
- A browser performance trace and input-latency measurement remain required for defensible before/after UI numbers.

### Running browser timings

In a development build, open the browser console and run:

```js
window.__mortgagePerformance.enable()
```

Then change a mortgage input. The console reports projection calculation, chart-data preparation, root and payment-table render-function work, and approximate scenario-mutation-to-next-paint latency. Disable logging with:

```js
window.__mortgagePerformance.disable()
```

The next-paint measurement includes two animation frames so it is useful for relative before/after comparisons, but it is not a substitute for a browser Performance trace. Keep DevTools conditions and the tested scenario consistent when comparing runs.

## Proposed implementation sequence

1. Add a repeatable performance scenario for monthly and weekly 25-30 year schedules.
2. Record baseline input latency, mounted row/cell count, and chart update time in a production build.
3. Add row virtualization while preserving the existing table API and full schedule. **Completed.**
4. Verify scrolling, sticky headers, focus behavior, event rows, and accessibility.
5. Replace the current point-count thresholds with two-month calendar bucketing for long projections.
6. Preserve first/payoff points and explicit lump-sum/renewal markers.
7. Verify payment-breakdown bucket totals against full schedule totals.
8. Re-profile input latency and chart/table work. **Next step.**
9. Tune the initial 150 ms projection-display debounce from measured interaction behavior.

## Acceptance criteria

- Changing any valid mortgage input remains visibly responsive in a production build.
- Only visible schedule rows plus the agreed overscan are mounted.
- Fast scrolling does not reveal blank gaps or obvious row replacement flashes.
- The full schedule remains available and mathematically unchanged.
- Schedule row values, ordering, event warnings, and payoff behavior are unchanged.
- Balance charts retain the first point, final payoff, renewals, and lump-sum events.
- Payment-breakdown bucket totals equal the corresponding full schedule totals, within existing cent-rounding rules.
- Chart tooltips state the represented period clearly.
- Existing domain, store, and UI tests pass; focused tests cover virtualization behavior and chart bucketing.
- Performance is compared before and after using the same scenarios and build mode.

## Decisions needed

1. For the payment breakdown chart, should reduced buckets eventually show totals per displayed period or average payment composition? This decision is explicitly deferred.
2. Does “remove lump-sum markers from the payments” mean removing the **Lump sums dataset from the payment breakdown chart entirely**, or retaining its bucket total while removing any separate exact-date marker?
3. At what threshold should the chart switch to two-month buckets? For example, should projections of two years or less retain payment/month detail?

## Recommendation pending answers

Proceed with fixed-row TanStack Virtual virtualization, two-month calendar buckets for long projections, and a 150 ms projection-display debounce. The payment-breakdown reduction rule and exact lump-sum chart behavior must be resolved before modifying that chart. Retain full schedule data and exact calculation behavior.
