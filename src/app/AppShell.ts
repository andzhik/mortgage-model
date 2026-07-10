import { defineComponent, h } from 'vue';

const metrics = [
  ['Regular payment', '$0.00'],
  ['Next interest', '$0.00'],
  ['Next principal', '$0.00'],
  ['Payoff date', 'Not calculated'],
  ['Total interest', '$0.00'],
  ['Total principal', '$0.00'],
  ['Total paid', '$0.00'],
  ['End of term balance', '$0.00']
];

const scheduleColumns = [
  '#',
  'Date',
  'Opening balance',
  'Scheduled payment',
  'Interest',
  'Principal',
  'Lump sum',
  'Total payment',
  'Closing balance'
];

function panelHeading(title: string, pill?: string, action?: string) {
  return h('div', { class: 'panel-heading' }, [
    h('h2', title),
    action
      ? h('button', { type: 'button' }, action)
      : pill
        ? h('span', { class: 'status-pill' }, pill)
        : null
  ]);
}

const ScenarioBar = defineComponent({
  name: 'ScenarioBar',
  setup() {
    return () =>
      h('header', { class: 'scenario-bar', 'aria-label': 'Scenario controls' }, [
        h('div', [
          h('p', { class: 'eyebrow' }, 'Scenario'),
          h('label', { class: 'sr-only', for: 'scenario-select' }, 'Current scenario'),
          h(
            'select',
            {
              id: 'scenario-select',
              class: 'scenario-select',
              'aria-label': 'Current scenario'
            },
            [h('option', 'Scenario 1')]
          )
        ]),
        h('nav', { class: 'scenario-actions', 'aria-label': 'Scenario actions' }, [
          h('button', { type: 'button' }, 'New'),
          h('button', { type: 'button' }, 'Duplicate'),
          h('button', { type: 'button' }, 'Rename'),
          h('button', { type: 'button', class: 'danger-button' }, 'Delete')
        ])
      ]);
  }
});

const SummaryMetrics = defineComponent({
  name: 'SummaryMetrics',
  setup() {
    return () =>
      h('section', { class: 'panel', 'aria-labelledby': 'summary-heading' }, [
        h('div', { class: 'panel-heading' }, [
          h('h2', { id: 'summary-heading' }, 'Summary metrics'),
          h('span', { class: 'status-pill' }, 'Placeholder')
        ]),
        h(
          'dl',
          { class: 'metric-grid' },
          metrics.map(([label, value]) =>
            h('div', { class: 'metric', key: label }, [h('dt', label), h('dd', value)])
          )
        )
      ]);
  }
});

const BalanceChart = defineComponent({
  name: 'BalanceChart',
  setup() {
    return () =>
      h('section', { class: 'panel chart-panel', 'aria-labelledby': 'balance-chart-heading' }, [
        h('div', { class: 'panel-heading' }, [
          h('h2', { id: 'balance-chart-heading' }, 'Balance over time'),
          h('span', { class: 'status-pill' }, 'Chart placeholder')
        ]),
        h(
          'div',
          {
            class: 'chart-placeholder',
            role: 'img',
            'aria-label': 'Balance chart placeholder'
          },
          [
            h('div', { class: 'chart-line chart-line-balance' }),
            h('span', 'Balance data will appear here after projection math is added.')
          ]
        )
      ]);
  }
});

const PaymentBreakdownChart = defineComponent({
  name: 'PaymentBreakdownChart',
  setup() {
    return () =>
      h('section', { class: 'panel chart-panel', 'aria-labelledby': 'breakdown-chart-heading' }, [
        h('div', { class: 'panel-heading' }, [
          h('h2', { id: 'breakdown-chart-heading' }, 'Payment breakdown'),
          h('span', { class: 'status-pill' }, 'Chart placeholder')
        ]),
        h(
          'div',
          {
            class: 'chart-placeholder bar-placeholder',
            role: 'img',
            'aria-label': 'Payment breakdown chart placeholder'
          },
          [
            h('div', { class: 'bar-set', 'aria-hidden': 'true' }, [
              h('span', { class: 'bar interest' }),
              h('span', { class: 'bar principal' }),
              h('span', { class: 'bar lump-sum' })
            ]),
            h('span', 'Interest, principal, and lump sums will be charted here.')
          ]
        )
      ]);
  }
});

const PaymentScheduleTable = defineComponent({
  name: 'PaymentScheduleTable',
  setup() {
    return () =>
      h('section', { class: 'panel schedule-panel', 'aria-labelledby': 'schedule-heading' }, [
        h('div', { class: 'panel-heading' }, [
          h('h2', { id: 'schedule-heading' }, 'Payment schedule'),
          h('span', { class: 'status-pill' }, 'Empty')
        ]),
        h('div', { class: 'table-scroll' }, [
          h('table', [
            h('thead', [
              h(
                'tr',
                scheduleColumns.map((column) => h('th', { scope: 'col', key: column }, column))
              )
            ]),
            h('tbody', [
              h('tr', [
                h(
                  'td',
                  { colspan: scheduleColumns.length, class: 'empty-state' },
                  'No payment schedule rows yet.'
                )
              ])
            ])
          ])
        ])
      ]);
  }
});

const MortgageInputs = defineComponent({
  name: 'MortgageInputs',
  setup() {
    return () =>
      h('section', { class: 'panel editor-section', 'aria-labelledby': 'mortgage-inputs-heading' }, [
        h('div', { class: 'panel-heading' }, [
          h('h2', { id: 'mortgage-inputs-heading' }, 'Mortgage inputs'),
          h('span', { class: 'status-pill' }, 'Draft')
        ]),
        h('form', { class: 'input-grid' }, [
          h('label', ['Mortgage amount', h('input', { type: 'number', value: '500000', min: '0', step: '1000' })]),
          h('label', ['Start date', h('input', { type: 'date', value: '2026-07-08' })]),
          h('label', ['Amortization years', h('input', { type: 'number', value: '25', min: '0', step: '1' })]),
          h('label', [
            'Amortization months',
            h('input', { type: 'number', value: '0', min: '0', max: '11', step: '1' })
          ]),
          h('label', [
            'Current term',
            h('select', [h('option', '5 years'), h('option', '3 years'), h('option', 'Custom')])
          ]),
          h('label', ['Annual interest rate', h('input', { type: 'number', value: '5.00', min: '0', step: '0.01' })]),
          h('label', [
            'Payment frequency',
            h('select', [
              h('option', 'Monthly'),
              h('option', 'Semi-monthly'),
              h('option', 'Bi-weekly'),
              h('option', 'Weekly')
            ])
          ])
        ])
      ]);
  }
});

const RenewalEditorShell = defineComponent({
  name: 'RenewalEditorShell',
  setup() {
    return () =>
      h('section', { class: 'panel editor-section', 'aria-labelledby': 'renewal-editor-heading' }, [
        panelHeading('Renewals', undefined, 'Add renewal'),
        h('div', { class: 'compact-empty-state' }, 'No renewal events yet.')
      ]);
  }
});

const LumpSumEditorShell = defineComponent({
  name: 'LumpSumEditorShell',
  setup() {
    return () =>
      h('section', { class: 'panel editor-section', 'aria-labelledby': 'lump-sum-editor-heading' }, [
        panelHeading('Lump sums', undefined, 'Add lump sum'),
        h('div', { class: 'compact-empty-state' }, 'No lump-sum payments yet.')
      ]);
  }
});

export default defineComponent({
  name: 'AppShell',
  setup() {
    return () =>
      h('div', { class: 'app-shell' }, [
        h(ScenarioBar),
        h('main', { class: 'dashboard', 'aria-label': 'Mortgage calculator dashboard' }, [
          h('section', { class: 'analysis-area', 'aria-labelledby': 'analysis-heading' }, [
            h('div', { class: 'section-heading' }, [
              h('p', { class: 'eyebrow' }, 'Analysis'),
              h('h1', { id: 'analysis-heading' }, 'Mortgage projection')
            ]),
            h(SummaryMetrics),
            h('div', { class: 'chart-grid', 'aria-label': 'Projection charts' }, [
              h(BalanceChart),
              h(PaymentBreakdownChart)
            ]),
            h(PaymentScheduleTable)
          ]),
          h('aside', { class: 'editing-panel', 'aria-label': 'Scenario editing panel' }, [
            h(MortgageInputs),
            h(RenewalEditorShell),
            h(LumpSumEditorShell)
          ])
        ])
      ]);
  }
});
