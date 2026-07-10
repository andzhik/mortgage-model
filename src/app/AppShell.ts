import {
  createColumnHelper,
  FlexRender,
  getCoreRowModel,
  useVueTable
} from '@tanstack/vue-table';
import { computed, defineComponent, h, reactive } from 'vue';
import { formatDate, formatMoney, formatPercent } from './formatters';
import { projectMortgageScenario } from '../domain/mortgageCalculator';
import type {
  LumpSumEvent,
  MortgageProjection,
  MortgageScenario,
  PaymentFrequency,
  PaymentScheduleRow,
  ProjectionChartSeries,
  ProjectionWarning,
  ProjectionSummary
} from '../domain/mortgageTypes';
import { PAYMENT_FREQUENCY_METADATA } from '../domain/paymentFrequency';

export type MortgageInputUpdate = Partial<{
  principalAmount: number;
  startDate: string;
  amortizationMonths: number;
  termMonths: number;
  annualInterestRate: number;
  paymentFrequency: PaymentFrequency;
}>;

export type LumpSumInputUpdate = Partial<{
  date: string;
  amount: number;
  label: string;
}>;

const today = new Date().toISOString().slice(0, 10);
let nextLumpSumId = 1;

function makeDefaultScenario(): MortgageScenario {
  return {
    id: 'scenario-1',
    name: 'Scenario 1',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    currency: 'CAD',
    startDate: today,
    principalAmount: 500_000,
    amortizationMonths: 25 * 12,
    paymentFrequency: 'monthly',
    initialTerm: {
      id: 'term-initial',
      startDate: today,
      termMonths: 5 * 12,
      annualInterestRate: 0.05,
      paymentFrequency: 'monthly',
      paymentStrategy: 'recalculate-payment'
    },
    lumpSums: [],
    renewals: []
  };
}

const ScenarioBar = defineComponent({
  name: 'ScenarioBar',
  props: {
    scenarioName: {
      type: String,
      required: true
    }
  },
  setup(props) {
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
            [h('option', props.scenarioName)]
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
  props: {
    summary: {
      type: Object as () => ProjectionSummary,
      required: true
    }
  },
  setup(props) {
    const metrics = computed(() => [
      { label: 'Regular payment', value: formatMoney(props.summary.regularPaymentAmount) },
      { label: 'Next interest', value: formatMoney(props.summary.nextPaymentInterestPortion) },
      { label: 'Next principal', value: formatMoney(props.summary.nextPaymentPrincipalPortion) },
      { label: 'Payoff date', value: formatDate(props.summary.finalPaymentDate) },
      { label: 'Total interest', value: formatMoney(props.summary.totalInterestPaid) },
      { label: 'Total principal', value: formatMoney(props.summary.totalPrincipalPaid) },
      { label: 'Total lump sums', value: formatMoney(props.summary.totalLumpSumsPaid) },
      { label: 'Total paid', value: formatMoney(props.summary.totalPaid) }
    ]);

    return () =>
      h('section', { class: 'panel', 'aria-labelledby': 'summary-heading' }, [
        h('div', { class: 'panel-heading' }, [
          h('h2', { id: 'summary-heading' }, 'Summary metrics'),
          h('span', { class: 'status-pill' }, 'Projected')
        ]),
        h(
          'dl',
          { class: 'metric-grid' },
          metrics.value.map((metric) =>
            h('div', { class: 'metric', key: metric.label }, [
              h('dt', metric.label),
              h('dd', metric.value)
            ])
          )
        )
      ]);
  }
});

const BalanceChart = defineComponent({
  name: 'BalanceChart',
  props: {
    series: {
      type: Array as () => ProjectionChartSeries['balanceOverTime'],
      required: true
    }
  },
  setup(props) {
    return () => {
      const firstPoint = props.series[0];
      const lastPoint = props.series.at(-1);

      return h('section', { class: 'panel chart-panel', 'aria-labelledby': 'balance-chart-heading' }, [
        h('div', { class: 'panel-heading' }, [
          h('h2', { id: 'balance-chart-heading' }, 'Balance over time'),
          h('span', { class: 'status-pill' }, `${props.series.length} points`)
        ]),
        h(
          'div',
          {
            class: 'chart-placeholder',
            role: 'img',
            'aria-label': 'Balance projection preview'
          },
          [
            h('div', { class: 'chart-line chart-line-balance' }),
            firstPoint && lastPoint
              ? h(
                  'span',
                  `${firstPoint.date} balance ${formatMoney(firstPoint.balance)} to ${lastPoint.date} balance ${formatMoney(lastPoint.balance)}.`
                )
              : null
          ]
        )
      ]);
    };
  }
});

const PaymentBreakdownChart = defineComponent({
  name: 'PaymentBreakdownChart',
  props: {
    series: {
      type: Array as () => ProjectionChartSeries['paymentBreakdown'],
      required: true
    }
  },
  setup(props) {
    return () => {
      const firstPoint = props.series[0];

      return h(
        'section',
        { class: 'panel chart-panel', 'aria-labelledby': 'breakdown-chart-heading' },
        [
          h('div', { class: 'panel-heading' }, [
            h('h2', { id: 'breakdown-chart-heading' }, 'Payment breakdown'),
            h('span', { class: 'status-pill' }, 'Projected')
          ]),
          h(
            'div',
            {
              class: 'chart-placeholder bar-placeholder',
              role: 'img',
              'aria-label': 'Payment breakdown preview'
            },
            [
              h('div', { class: 'bar-set', 'aria-hidden': 'true' }, [
                h('span', { class: 'bar interest' }),
                h('span', { class: 'bar principal' }),
                h('span', { class: 'bar lump-sum' })
              ]),
              firstPoint
                ? h(
                    'span',
                    `First payment: ${formatMoney(firstPoint.scheduledInterestPaid)} interest, ${formatMoney(firstPoint.scheduledPrincipalPaid)} principal, ${formatMoney(firstPoint.lumpSumPayment)} lump sum.`
                  )
                : null
            ]
          )
        ]
      );
    };
  }
});

const columnHelper = createColumnHelper<PaymentScheduleRow>();
const scheduleColumns = [
  columnHelper.accessor('sequence', { header: '#' }),
  columnHelper.accessor('date', { header: 'Date' }),
  columnHelper.accessor('openingBalance', {
    header: 'Opening balance',
    cell: (info) => formatMoney(info.getValue())
  }),
  columnHelper.accessor('scheduledPayment', {
    header: 'Scheduled payment',
    cell: (info) => formatMoney(info.getValue())
  }),
  columnHelper.accessor('scheduledInterestPaid', {
    header: 'Interest portion',
    cell: (info) => formatMoney(info.getValue())
  }),
  columnHelper.accessor('scheduledPrincipalPaid', {
    header: 'Principal portion',
    cell: (info) => formatMoney(info.getValue())
  }),
  columnHelper.accessor('lumpSumPayment', {
    header: 'Lump sum',
    cell: (info) => formatMoney(info.getValue())
  }),
  columnHelper.accessor('totalPayment', {
    header: 'Total payment',
    cell: (info) => formatMoney(info.getValue())
  }),
  columnHelper.accessor('totalPrincipalReduction', {
    header: 'Principal reduction',
    cell: (info) => formatMoney(info.getValue())
  }),
  columnHelper.accessor('closingBalance', {
    header: 'Closing balance',
    cell: (info) => formatMoney(info.getValue())
  }),
  columnHelper.accessor('annualInterestRate', {
    header: 'Rate',
    cell: (info) => formatPercent(info.getValue())
  }),
  columnHelper.accessor((row) => row.notes?.join(', ') ?? row.eventType ?? '', {
    id: 'eventNotes',
    header: 'Event notes'
  })
];

const PaymentScheduleTable = defineComponent({
  name: 'PaymentScheduleTable',
  props: {
    rows: {
      type: Array as () => PaymentScheduleRow[],
      required: true
    }
  },
  setup(props) {
    const table = useVueTable({
      get data() {
        return props.rows;
      },
      columns: scheduleColumns,
      getCoreRowModel: getCoreRowModel()
    });

    return () =>
      h('section', { class: 'panel schedule-panel', 'aria-labelledby': 'schedule-heading' }, [
        h('div', { class: 'panel-heading' }, [
          h('h2', { id: 'schedule-heading' }, 'Payment schedule'),
          h('span', { class: 'status-pill' }, `${props.rows.length} rows`)
        ]),
        h('div', { class: 'table-scroll' }, [
          h('table', [
            h(
              'thead',
              table.getHeaderGroups().map((headerGroup) =>
                h(
                  'tr',
                  { key: headerGroup.id },
                  headerGroup.headers.map((header) =>
                    h('th', { key: header.id, scope: 'col' }, [
                      header.isPlaceholder
                        ? null
                        : h(FlexRender, {
                            render: header.column.columnDef.header,
                            props: header.getContext()
                          })
                    ])
                  )
                )
              )
            ),
            h('tbody', [
              table.getRowModel().rows.length === 0
                ? h('tr', [
                    h(
                      'td',
                      { colspan: scheduleColumns.length, class: 'empty-state' },
                      'No payment schedule rows yet.'
                    )
                  ])
                : table.getRowModel().rows.map((row) =>
                    h(
                      'tr',
                      { key: row.id, 'data-sequence': row.original.sequence },
                      row.getVisibleCells().map((cell) =>
                        h('td', { key: cell.id }, [
                          h(FlexRender, {
                            render: cell.column.columnDef.cell,
                            props: cell.getContext()
                          })
                        ])
                      )
                    )
                  )
            ])
          ])
        ])
      ]);
  }
});

const ProjectionWarningsPanel = defineComponent({
  name: 'ProjectionWarningsPanel',
  props: {
    warnings: {
      type: Array as () => ProjectionWarning[],
      required: true
    }
  },
  setup(props) {
    return () =>
      h('section', { class: 'panel editor-section', 'aria-labelledby': 'projection-warnings-heading' }, [
        h('div', { class: 'panel-heading' }, [
          h('h2', { id: 'projection-warnings-heading' }, 'Projection warnings'),
          h('span', { class: 'status-pill' }, props.warnings.length === 0 ? 'Clear' : props.warnings.length)
        ]),
        props.warnings.length === 0
          ? h('div', { class: 'compact-empty-state' }, 'No projection warnings.')
          : h(
              'ul',
              { class: 'warning-list' },
              props.warnings.map((warning) =>
                h('li', { key: `${warning.code}-${warning.eventId ?? warning.date}` }, [
                  h('strong', warning.date ? formatDate(warning.date) : 'Projection'),
                  h('span', warning.message)
                ])
              )
            )
      ]);
  }
});

const MortgageInputs = defineComponent({
  name: 'MortgageInputs',
  props: {
    scenario: {
      type: Object as () => MortgageScenario,
      required: true
    }
  },
  emits: {
    updateScenario: (_update: MortgageInputUpdate) => true
  },
  setup(props, { emit }) {
    const frequencies = Object.values(PAYMENT_FREQUENCY_METADATA);

    function toNumber(event: Event): number {
      const value = Number((event.target as HTMLInputElement).value);
      return Number.isFinite(value) ? value : 0;
    }

    function toText(event: Event): string {
      return (event.target as HTMLInputElement).value;
    }

    function updateStartDate(event: Event): void {
      const startDate = toText(event);

      if (startDate) {
        emit('updateScenario', { startDate });
      }
    }

    function updateAmortization(years: number, months: number): void {
      emit('updateScenario', {
        amortizationMonths: Math.max(1, years * 12 + months)
      });
    }

    function updateTerm(years: number, months: number): void {
      emit('updateScenario', {
        termMonths: Math.max(1, years * 12 + months)
      });
    }

    return () => {
      const amortizationYears = Math.floor(props.scenario.amortizationMonths / 12);
      const amortizationExtraMonths = props.scenario.amortizationMonths % 12;
      const termYears = Math.floor(props.scenario.initialTerm.termMonths / 12);
      const termExtraMonths = props.scenario.initialTerm.termMonths % 12;
      const annualInterestRatePercent = props.scenario.initialTerm.annualInterestRate * 100;

      return h('section', { class: 'panel editor-section', 'aria-labelledby': 'mortgage-inputs-heading' }, [
        h('div', { class: 'panel-heading' }, [
          h('h2', { id: 'mortgage-inputs-heading' }, 'Mortgage inputs'),
          h('span', { class: 'status-pill' }, 'Live')
        ]),
        h('form', { class: 'input-grid', onSubmit: (event: Event) => event.preventDefault() }, [
          h('label', [
            'Mortgage amount',
            h('input', {
              'aria-label': 'Mortgage amount',
              type: 'number',
              value: props.scenario.principalAmount,
              min: '1',
              step: '1000',
              onInput: (event: Event) =>
                emit('updateScenario', { principalAmount: Math.max(1, toNumber(event)) })
            })
          ]),
          h('label', [
            'Start date',
            h('input', {
              'aria-label': 'Start date',
              type: 'date',
              value: props.scenario.startDate,
              onInput: updateStartDate
            })
          ]),
          h('label', [
            'Amortization years',
            h('input', {
              'aria-label': 'Amortization years',
              type: 'number',
              value: amortizationYears,
              min: '0',
              step: '1',
              onInput: (event: Event) =>
                updateAmortization(Math.max(0, toNumber(event)), amortizationExtraMonths)
            })
          ]),
          h('label', [
            'Amortization months',
            h('input', {
              'aria-label': 'Amortization months',
              type: 'number',
              value: amortizationExtraMonths,
              min: '0',
              max: '11',
              step: '1',
              onInput: (event: Event) =>
                updateAmortization(amortizationYears, Math.min(11, Math.max(0, toNumber(event))))
            })
          ]),
          h('label', [
            'Term years',
            h('input', {
              'aria-label': 'Term years',
              type: 'number',
              value: termYears,
              min: '0',
              step: '1',
              onInput: (event: Event) => updateTerm(Math.max(0, toNumber(event)), termExtraMonths)
            })
          ]),
          h('label', [
            'Term months',
            h('input', {
              'aria-label': 'Term months',
              type: 'number',
              value: termExtraMonths,
              min: '0',
              max: '11',
              step: '1',
              onInput: (event: Event) =>
                updateTerm(termYears, Math.min(11, Math.max(0, toNumber(event))))
            })
          ]),
          h('label', [
            'Annual interest rate',
            h('input', {
              'aria-label': 'Annual interest rate',
              type: 'number',
              value: annualInterestRatePercent,
              min: '0',
              step: '0.01',
              onInput: (event: Event) =>
                emit('updateScenario', {
                  annualInterestRate: Math.max(0, toNumber(event)) / 100
                })
            })
          ]),
          h('label', [
            'Payment frequency',
            h(
              'select',
              {
                'aria-label': 'Payment frequency',
                value: props.scenario.paymentFrequency,
                onChange: (event: Event) =>
                  emit('updateScenario', { paymentFrequency: toText(event) as PaymentFrequency })
              },
              frequencies.map((frequency) =>
                h('option', { key: frequency.frequency, value: frequency.frequency }, frequency.label)
              )
            )
          ])
        ])
      ]);
    };
  }
});

function panelHeading(title: string, action?: string) {
  return h('div', { class: 'panel-heading' }, [
    h('h2', title),
    action ? h('button', { type: 'button' }, action) : null
  ]);
}

const RenewalEditorShell = defineComponent({
  name: 'RenewalEditorShell',
  setup() {
    return () =>
      h('section', { class: 'panel editor-section', 'aria-labelledby': 'renewal-editor-heading' }, [
        panelHeading('Renewals', 'Add renewal'),
        h('div', { class: 'compact-empty-state' }, 'No renewal events yet.')
      ]);
  }
});

const LumpSumEditorShell = defineComponent({
  name: 'LumpSumEditorShell',
  props: {
    scenario: {
      type: Object as () => MortgageScenario,
      required: true
    }
  },
  emits: {
    addLumpSum: () => true,
    updateLumpSum: (_id: string, _update: LumpSumInputUpdate) => true,
    deleteLumpSum: (_id: string) => true
  },
  setup(props, { emit }) {
    function toNumber(event: Event): number {
      const value = Number((event.target as HTMLInputElement).value);
      return Number.isFinite(value) ? value : 0;
    }

    function toText(event: Event): string {
      return (event.target as HTMLInputElement).value;
    }

    return () =>
      h('section', { class: 'panel editor-section', 'aria-labelledby': 'lump-sum-editor-heading' }, [
        h('div', { class: 'panel-heading' }, [
          h('h2', { id: 'lump-sum-editor-heading' }, 'Lump sums'),
          h('button', { type: 'button', onClick: () => emit('addLumpSum') }, 'Add lump sum')
        ]),
        props.scenario.lumpSums.length === 0
          ? h('div', { class: 'compact-empty-state' }, 'No lump-sum payments yet.')
          : h(
              'div',
              { class: 'event-list' },
              props.scenario.lumpSums.map((lumpSum, index) =>
                h('div', { class: 'event-row', key: lumpSum.id }, [
                  h('label', [
                    'Date',
                    h('input', {
                      'aria-label': `Lump sum date ${index + 1}`,
                      type: 'date',
                      value: lumpSum.date,
                      min: props.scenario.startDate,
                      onInput: (event: Event) =>
                        emit('updateLumpSum', lumpSum.id, { date: toText(event) })
                    })
                  ]),
                  h('label', [
                    'Amount',
                    h('input', {
                      'aria-label': `Lump sum amount ${index + 1}`,
                      type: 'number',
                      value: lumpSum.amount,
                      min: '1',
                      step: '100',
                      onInput: (event: Event) =>
                        emit('updateLumpSum', lumpSum.id, { amount: toNumber(event) })
                    })
                  ]),
                  h('label', [
                    'Label',
                    h('input', {
                      'aria-label': `Lump sum label ${index + 1}`,
                      type: 'text',
                      value: lumpSum.label ?? '',
                      onInput: (event: Event) =>
                        emit('updateLumpSum', lumpSum.id, { label: toText(event) })
                    })
                  ]),
                  h(
                    'button',
                    {
                      type: 'button',
                      class: 'danger-button event-delete-button',
                      'aria-label': `Delete lump sum ${index + 1}`,
                      onClick: () => emit('deleteLumpSum', lumpSum.id)
                    },
                    'Delete'
                  )
                ])
              )
            )
      ]);
  }
});

export default defineComponent({
  name: 'AppShell',
  setup() {
    const scenario = reactive<MortgageScenario>(makeDefaultScenario());
    const projection = computed<MortgageProjection>(() => projectMortgageScenario(scenario));

    function updateScenario(update: MortgageInputUpdate): void {
      if (update.principalAmount !== undefined) {
        scenario.principalAmount = update.principalAmount;
      }

      if (update.startDate !== undefined) {
        const startDate = update.startDate;
        scenario.startDate = startDate;
        scenario.initialTerm.startDate = startDate;
        scenario.lumpSums = scenario.lumpSums.map((lumpSum) => ({
          ...lumpSum,
          date: lumpSum.date < startDate ? startDate : lumpSum.date
        }));
      }

      if (update.amortizationMonths !== undefined) {
        scenario.amortizationMonths = update.amortizationMonths;
      }

      if (update.termMonths !== undefined) {
        scenario.initialTerm.termMonths = update.termMonths;
      }

      if (update.annualInterestRate !== undefined) {
        scenario.initialTerm.annualInterestRate = update.annualInterestRate;
      }

      if (update.paymentFrequency !== undefined) {
        scenario.paymentFrequency = update.paymentFrequency;
        scenario.initialTerm.paymentFrequency = update.paymentFrequency;
      }

      scenario.updatedAt = new Date().toISOString();
    }

    function touchScenario(): void {
      scenario.updatedAt = new Date().toISOString();
    }

    function addLumpSum(): void {
      scenario.lumpSums.push({
        id: `lump-sum-${Date.now()}-${nextLumpSumId}`,
        date: scenario.startDate,
        amount: 1_000,
        label: undefined
      });
      nextLumpSumId += 1;
      touchScenario();
    }

    function updateLumpSum(id: string, update: LumpSumInputUpdate): void {
      const lumpSum = scenario.lumpSums.find((candidate) => candidate.id === id);

      if (!lumpSum) {
        return;
      }

      if (update.date !== undefined && update.date) {
        lumpSum.date = update.date < scenario.startDate ? scenario.startDate : update.date;
      }

      if (update.amount !== undefined) {
        lumpSum.amount = Math.max(1, update.amount);
      }

      if (update.label !== undefined) {
        const label = update.label.trim();
        lumpSum.label = label.length > 0 ? label : undefined;
      }

      touchScenario();
    }

    function deleteLumpSum(id: string): void {
      scenario.lumpSums = scenario.lumpSums.filter((lumpSum: LumpSumEvent) => lumpSum.id !== id);
      touchScenario();
    }

    return () =>
      h('div', { class: 'app-shell' }, [
        h(ScenarioBar, { scenarioName: scenario.name }),
        h('main', { class: 'dashboard', 'aria-label': 'Mortgage calculator dashboard' }, [
          h('section', { class: 'analysis-area', 'aria-labelledby': 'analysis-heading' }, [
            h('div', { class: 'section-heading' }, [
              h('div', [
                h('p', { class: 'eyebrow' }, 'Analysis'),
                h('h1', { id: 'analysis-heading' }, 'Mortgage projection')
              ]),
              h('span', { class: 'status-pill' }, `${projection.value.schedule.length} payments`)
            ]),
            h(SummaryMetrics, { summary: projection.value.summary }),
            h('div', { class: 'chart-grid', 'aria-label': 'Projection charts' }, [
              h(BalanceChart, { series: projection.value.chartSeries.balanceOverTime }),
              h(PaymentBreakdownChart, { series: projection.value.chartSeries.paymentBreakdown })
            ]),
            h(PaymentScheduleTable, { rows: projection.value.schedule })
          ]),
          h('aside', { class: 'editing-panel', 'aria-label': 'Scenario editing panel' }, [
            h(MortgageInputs, {
              scenario,
              onUpdateScenario: updateScenario
            }),
            h(RenewalEditorShell),
            h(LumpSumEditorShell, {
              scenario,
              onAddLumpSum: addLumpSum,
              onUpdateLumpSum: updateLumpSum,
              onDeleteLumpSum: deleteLumpSum
            }),
            h(ProjectionWarningsPanel, { warnings: projection.value.warnings })
          ])
        ])
      ]);
  }
});
