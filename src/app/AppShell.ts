import {
  createColumnHelper,
  FlexRender,
  getCoreRowModel,
  useVueTable
} from '@tanstack/vue-table';
import { useVirtualizer } from '@tanstack/vue-virtual';
import { computed, defineComponent, h, onUpdated, reactive, ref, watch } from 'vue';
import { formatDate, formatMoney, formatPercent } from './formatters';
import type {
  MortgageScenario,
  PaymentFrequency,
  PaymentStrategy,
  PaymentScheduleRow,
  ProjectionWarning,
  ProjectionSummary,
  RenewalEvent
} from '../domain/mortgageTypes';
import { PAYMENT_FREQUENCY_METADATA } from '../domain/paymentFrequency';
import BalanceChart from '../components/BalanceChart';
import PaymentBreakdownChart from '../components/PaymentBreakdownChart';
import {
  useScenarioStore,
  type LumpSumInputUpdate,
  type MortgageInputUpdate,
  type RenewalInputUpdate
} from '../stores/scenarioStore';
import {
  beginMortgageUiUpdate,
  finishMortgageUiUpdateAfterPaint,
  measureMortgageWork
} from '../performance/uiPerformance';

type ScenarioOption = {
  readonly id: string;
  readonly name: string;
};

function fieldError(id: string, message?: string) {
  return message
    ? h('span', { id, class: 'field-error', role: 'alert' }, message)
    : null;
}

function validationAttributes(id: string, message?: string) {
  return {
    'aria-invalid': message ? 'true' : undefined,
    'aria-describedby': message ? id : undefined
  };
}

function clearErrors(errors: Record<string, string | undefined>): void {
  for (const key of Object.keys(errors)) delete errors[key];
}

const ScenarioBar = defineComponent({
  name: 'ScenarioBar',
  props: {
    scenarios: {
      type: Array as () => readonly ScenarioOption[],
      required: true
    },
    activeScenarioId: {
      type: String as () => string | null,
      required: false,
      default: null
    }
  },
  emits: {
    switchScenario: (_id: string) => true,
    createScenario: () => true,
    duplicateScenario: () => true,
    renameScenario: (_id: string, _name: string) => true,
    deleteScenario: (_id: string) => true
  },
  setup(props, { emit }) {
    function getActiveScenario(): ScenarioOption | undefined {
      return (
        props.scenarios.find((scenario) => scenario.id === props.activeScenarioId) ??
        props.scenarios[0]
      );
    }

    function renameActiveScenario(): void {
      const scenario = getActiveScenario();

      if (!scenario) {
        return;
      }

      const nextName = globalThis.prompt?.('Rename scenario', scenario.name);

      if (nextName !== null && nextName !== undefined) {
        emit('renameScenario', scenario.id, nextName);
      }
    }

    function deleteActiveScenario(): void {
      const scenario = getActiveScenario();

      if (!scenario) {
        return;
      }

      const confirmed = globalThis.confirm?.(`Delete "${scenario.name}"?`) ?? true;

      if (confirmed) {
        emit('deleteScenario', scenario.id);
      }
    }

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
              'aria-label': 'Current scenario',
              value: props.activeScenarioId ?? props.scenarios[0]?.id,
              onChange: (event: Event) =>
                emit('switchScenario', (event.target as HTMLSelectElement).value)
            },
            props.scenarios.map((scenario) =>
              h('option', { key: scenario.id, value: scenario.id }, scenario.name)
            )
          )
        ]),
        h('nav', { class: 'scenario-actions', 'aria-label': 'Scenario actions' }, [
          h('button', { type: 'button', onClick: () => emit('createScenario') }, 'New'),
          h('button', { type: 'button', onClick: () => emit('duplicateScenario') }, 'Duplicate'),
          h('button', { type: 'button', onClick: renameActiveScenario }, 'Rename'),
          h(
            'button',
            { type: 'button', class: 'danger-button', onClick: deleteActiveScenario },
            'Delete'
          )
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
  columnHelper.accessor('periodId', { header: 'Term' }),
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
    const scrollElement = ref<HTMLElement | null>(null);
    const table = useVueTable({
      get data() {
        return props.rows;
      },
      columns: scheduleColumns,
      getCoreRowModel: getCoreRowModel()
    });
    const rowVirtualizer = useVirtualizer(
      computed(() => ({
        count: table.getRowModel().rows.length,
        getScrollElement: () => scrollElement.value,
        estimateSize: () => 45,
        getItemKey: (index: number) =>
          table.getRowModel().rows[index]?.original.sequence ?? index,
        overscan: 10,
        initialRect: { width: 0, height: 420 }
      }))
    );

    return () => {
      return measureMortgageWork('payment table render function', () => {
        const rows = table.getRowModel().rows;
        const virtualRows = rowVirtualizer.value.getVirtualItems();
        const firstVirtualRow = virtualRows[0];
        const lastVirtualRow = virtualRows.at(-1);
        const paddingTop = firstVirtualRow?.start ?? 0;
        const paddingBottom = lastVirtualRow
          ? rowVirtualizer.value.getTotalSize() - lastVirtualRow.end
          : 0;

        return (
        h('section', { class: 'panel schedule-panel', 'aria-labelledby': 'schedule-heading' }, [
        h('div', { class: 'panel-heading' }, [
          h('h2', { id: 'schedule-heading' }, 'Payment schedule'),
          h('span', { class: 'status-pill' }, `${props.rows.length} rows`)
        ]),
        h('div', { ref: scrollElement, class: 'table-scroll' }, [
          h('table', { 'aria-rowcount': rows.length + 1 }, [
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
              rows.length === 0
                ? h('tr', [
                    h(
                      'td',
                      { colspan: scheduleColumns.length, class: 'empty-state' },
                      'No payment schedule rows yet.'
                    )
                  ])
                : [
                    paddingTop > 0
                      ? h('tr', { class: 'virtual-table-spacer', 'aria-hidden': 'true' }, [
                          h('td', {
                            colspan: scheduleColumns.length,
                            style: { height: `${paddingTop}px` }
                          })
                        ])
                      : null,
                    ...virtualRows.map((virtualRow) => {
                      const row = rows[virtualRow.index];

                      return (
                    h(
                      'tr',
                      {
                        key: row.id,
                        'aria-rowindex': virtualRow.index + 2,
                        'data-sequence': row.original.sequence
                      },
                      row.getVisibleCells().map((cell) =>
                        h('td', { key: cell.id }, [
                          h(FlexRender, {
                            render: cell.column.columnDef.cell,
                            props: cell.getContext()
                          })
                        ])
                      )
                    )
                      );
                    }),
                    paddingBottom > 0
                      ? h('tr', { class: 'virtual-table-spacer', 'aria-hidden': 'true' }, [
                          h('td', {
                            colspan: scheduleColumns.length,
                            style: { height: `${paddingBottom}px` }
                          })
                        ])
                      : null
                  ]
            ])
          ])
        ])
        ])
        );
      });
    };
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
      h('section', {
        class: 'panel editor-section',
        'aria-labelledby': 'projection-warnings-heading',
        'aria-live': 'polite'
      }, [
        h('div', { class: 'panel-heading' }, [
          h('h2', { id: 'projection-warnings-heading' }, 'Projection warnings'),
          h('span', { class: 'status-pill' }, props.warnings.length === 0 ? 'Clear' : props.warnings.length)
        ]),
        props.warnings.length === 0
          ? h('div', { class: 'compact-empty-state' }, 'No projection warnings.')
          : h(
              'ul',
              { class: 'warning-list', role: 'list' },
              props.warnings.map((warning) =>
                h('li', {
                  key: `${warning.code}-${warning.eventId ?? warning.date}`,
                  'data-severity': warning.severity
                }, [
                  h('strong', `${warning.severity === 'error' ? 'Error' : 'Warning'} · ${warning.date ? formatDate(warning.date) : 'Projection'}`),
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
    const errors = reactive<Record<string, string | undefined>>({});
    watch(() => props.scenario.id, () => clearErrors(errors));

    function toNumber(event: Event): number {
      const value = Number((event.target as HTMLInputElement).value);
      return Number.isFinite(value) ? value : 0;
    }

    function toText(event: Event): string {
      return (event.target as HTMLInputElement).value;
    }

    function updateStartDate(event: Event): void {
      const startDate = toText(event);

      errors.startDate = startDate ? undefined : 'Start date is required.';
      if (startDate) emit('updateScenario', { startDate });
    }

    function updateAmortization(years: number, months: number): void {
      const totalMonths = years * 12 + months;
      errors.amortization = totalMonths > 0 ? undefined : 'Amortization must be greater than zero.';
      if (totalMonths > 0) emit('updateScenario', { amortizationMonths: totalMonths });
    }

    function updateTerm(years: number, months: number): void {
      const totalMonths = years * 12 + months;
      errors.term = totalMonths > 0 ? undefined : 'Term length must be greater than zero.';
      if (totalMonths > 0) emit('updateScenario', { termMonths: totalMonths });
    }

    function updatePrincipal(event: Event): void {
      const amount = toNumber(event);
      errors.principal = amount > 0 ? undefined : 'Mortgage amount must be greater than zero.';
      if (amount > 0) emit('updateScenario', { principalAmount: amount });
    }

    function updateInterestRate(event: Event): void {
      const rate = toNumber(event);
      errors.interestRate = rate >= 0 ? undefined : 'Interest rate cannot be negative.';
      if (rate >= 0) emit('updateScenario', { annualInterestRate: rate / 100 });
    }

    function updateFrequency(event: Event): void {
      const frequency = toText(event) as PaymentFrequency;
      errors.paymentFrequency = frequency ? undefined : 'Payment frequency is required.';
      if (frequency) emit('updateScenario', { paymentFrequency: frequency });
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
              ...validationAttributes('principal-error', errors.principal),
              onInput: updatePrincipal
            }),
            fieldError('principal-error', errors.principal)
          ]),
          h('label', [
            'Start date',
            h('input', {
              'aria-label': 'Start date',
              type: 'date',
              value: props.scenario.startDate,
              required: true,
              ...validationAttributes('start-date-error', errors.startDate),
              onInput: updateStartDate
            }),
            fieldError('start-date-error', errors.startDate)
          ]),
          h('label', [
            'Amortization years',
            h('input', {
              'aria-label': 'Amortization years',
              type: 'number',
              value: amortizationYears,
              min: '0',
              step: '1',
              ...validationAttributes('amortization-error', errors.amortization),
              onInput: (event: Event) =>
                updateAmortization(Math.max(0, toNumber(event)), amortizationExtraMonths)
            }),
            fieldError('amortization-error', errors.amortization)
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
              ...validationAttributes('amortization-error', errors.amortization),
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
              ...validationAttributes('term-error', errors.term),
              onInput: (event: Event) => updateTerm(Math.max(0, toNumber(event)), termExtraMonths)
            }),
            fieldError('term-error', errors.term)
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
              ...validationAttributes('term-error', errors.term),
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
              ...validationAttributes('interest-rate-error', errors.interestRate),
              onInput: updateInterestRate
            }),
            fieldError('interest-rate-error', errors.interestRate)
          ]),
          h('label', [
            'Payment frequency',
            h(
              'select',
              {
                'aria-label': 'Payment frequency',
                value: props.scenario.paymentFrequency,
                required: true,
                ...validationAttributes('payment-frequency-error', errors.paymentFrequency),
                onChange: updateFrequency
              },
              [h('option', { value: '', disabled: true }, 'Select a frequency'), ...frequencies.map((frequency) =>
                h('option', { key: frequency.frequency, value: frequency.frequency }, frequency.label)
              )]
            ),
            fieldError('payment-frequency-error', errors.paymentFrequency)
          ])
        ])
      ]);
    };
  }
});

const RenewalEditorShell = defineComponent({
  name: 'RenewalEditorShell',
  props: {
    scenario: {
      type: Object as () => MortgageScenario,
      required: true
    }
  },
  emits: {
    addRenewal: () => true,
    updateRenewal: (_id: string, _update: RenewalInputUpdate) => true,
    deleteRenewal: (_id: string) => true
  },
  setup(props, { emit }) {
    const frequencies = Object.values(PAYMENT_FREQUENCY_METADATA);
    const errors = reactive<Record<string, string | undefined>>({});
    watch(() => props.scenario.id, () => clearErrors(errors));
    const paymentStrategies: { strategy: PaymentStrategy; label: string }[] = [
      { strategy: 'recalculate-payment', label: 'Recalculate payment' },
      { strategy: 'keep-payment-reduce-time', label: 'Keep payment, reduce time' }
    ];

    function toNumber(event: Event): number {
      const value = Number((event.target as HTMLInputElement).value);
      return Number.isFinite(value) ? value : 0;
    }

    function toText(event: Event): string {
      return (event.target as HTMLInputElement).value;
    }

    function updateTerm(renewal: RenewalEvent, years: number, months: number): void {
      const totalMonths = years * 12 + months;
      const key = `${renewal.id}-term`;
      errors[key] = totalMonths > 0 ? undefined : 'Term length must be greater than zero.';
      if (totalMonths > 0) emit('updateRenewal', renewal.id, { termMonths: totalMonths });
    }

    function updateDate(renewal: RenewalEvent, event: Event): void {
      const date = toText(event);
      const duplicate = props.scenario.renewals.some(
        (candidate) => candidate.id !== renewal.id && candidate.effectiveDate === date
      );
      const message = !date
        ? 'Renewal date is required.'
        : date < props.scenario.startDate
          ? 'Renewal date must be on or after the mortgage start date.'
          : duplicate
            ? 'Renewal dates must be unique.'
            : undefined;
      errors[`${renewal.id}-date`] = message;
      if (!message) emit('updateRenewal', renewal.id, { effectiveDate: date });
    }

    function updateRate(renewal: RenewalEvent, event: Event): void {
      const rate = toNumber(event);
      const key = `${renewal.id}-rate`;
      errors[key] = rate >= 0 ? undefined : 'Interest rate cannot be negative.';
      if (rate >= 0) emit('updateRenewal', renewal.id, { annualInterestRate: rate / 100 });
    }

    function updateFrequency(renewal: RenewalEvent, event: Event): void {
      const frequency = toText(event) as PaymentFrequency;
      const key = `${renewal.id}-frequency`;
      errors[key] = frequency ? undefined : 'Payment frequency is required.';
      if (frequency) emit('updateRenewal', renewal.id, { paymentFrequency: frequency });
    }

    return () =>
      h('section', { class: 'panel editor-section', 'aria-labelledby': 'renewal-editor-heading' }, [
        h('div', { class: 'panel-heading' }, [
          h('h2', { id: 'renewal-editor-heading' }, 'Renewals'),
          h('button', { type: 'button', onClick: () => emit('addRenewal') }, 'Add renewal')
        ]),
        props.scenario.renewals.length === 0
          ? h('div', { class: 'compact-empty-state' }, 'No renewal events yet.')
          : h(
              'div',
              { class: 'event-list' },
              props.scenario.renewals.map((renewal, index) => {
                const termYears = Math.floor(renewal.termMonths / 12);
                const termExtraMonths = renewal.termMonths % 12;
                const dateErrorId = `${renewal.id}-date-error`;
                const rateErrorId = `${renewal.id}-rate-error`;
                const termErrorId = `${renewal.id}-term-error`;
                const frequencyErrorId = `${renewal.id}-frequency-error`;

                return h('div', { class: 'event-row renewal-row', key: renewal.id }, [
                  h('label', [
                    'Effective date',
                    h('input', {
                      'aria-label': `Renewal effective date ${index + 1}`,
                      type: 'date',
                      value: renewal.effectiveDate,
                      min: props.scenario.startDate,
                      required: true,
                      ...validationAttributes(dateErrorId, errors[`${renewal.id}-date`]),
                      onInput: (event: Event) => updateDate(renewal, event)
                    }),
                    fieldError(dateErrorId, errors[`${renewal.id}-date`])
                  ]),
                  h('label', [
                    'Annual interest rate',
                    h('input', {
                      'aria-label': `Renewal annual interest rate ${index + 1}`,
                      type: 'number',
                      value: renewal.annualInterestRate * 100,
                      min: '0',
                      step: '0.01',
                      ...validationAttributes(rateErrorId, errors[`${renewal.id}-rate`]),
                      onInput: (event: Event) => updateRate(renewal, event)
                    }),
                    fieldError(rateErrorId, errors[`${renewal.id}-rate`])
                  ]),
                  h('label', [
                    'Term years',
                    h('input', {
                      'aria-label': `Renewal term years ${index + 1}`,
                      type: 'number',
                      value: termYears,
                      min: '0',
                      step: '1',
                      ...validationAttributes(termErrorId, errors[`${renewal.id}-term`]),
                      onInput: (event: Event) =>
                        updateTerm(renewal, Math.max(0, toNumber(event)), termExtraMonths)
                    }),
                    fieldError(termErrorId, errors[`${renewal.id}-term`])
                  ]),
                  h('label', [
                    'Term months',
                    h('input', {
                      'aria-label': `Renewal term months ${index + 1}`,
                      type: 'number',
                      value: termExtraMonths,
                      min: '0',
                      max: '11',
                      step: '1',
                      ...validationAttributes(termErrorId, errors[`${renewal.id}-term`]),
                      onInput: (event: Event) =>
                        updateTerm(renewal, termYears, Math.min(11, Math.max(0, toNumber(event))))
                    })
                  ]),
                  h('label', [
                    'Payment frequency',
                    h(
                      'select',
                      {
                        'aria-label': `Renewal payment frequency ${index + 1}`,
                        value: renewal.paymentFrequency ?? props.scenario.paymentFrequency,
                        required: true,
                        ...validationAttributes(frequencyErrorId, errors[`${renewal.id}-frequency`]),
                        onChange: (event: Event) => updateFrequency(renewal, event)
                      },
                      [h('option', { value: '', disabled: true }, 'Select a frequency'), ...frequencies.map((frequency) =>
                        h(
                          'option',
                          { key: frequency.frequency, value: frequency.frequency },
                          frequency.label
                        )
                      )]
                    ),
                    fieldError(frequencyErrorId, errors[`${renewal.id}-frequency`])
                  ]),
                  h('label', [
                    'Payment strategy',
                    h(
                      'select',
                      {
                        'aria-label': `Renewal payment strategy ${index + 1}`,
                        value: renewal.paymentStrategy,
                        onChange: (event: Event) =>
                          emit('updateRenewal', renewal.id, {
                            paymentStrategy: toText(event) as PaymentStrategy
                          })
                      },
                      paymentStrategies.map((strategy) =>
                        h('option', { key: strategy.strategy, value: strategy.strategy }, strategy.label)
                      )
                    )
                  ]),
                  h('label', { class: 'event-row-wide' }, [
                    'Note',
                    h('input', {
                      'aria-label': `Renewal note ${index + 1}`,
                      type: 'text',
                      value: renewal.note ?? '',
                      onInput: (event: Event) =>
                        emit('updateRenewal', renewal.id, { note: toText(event) })
                    })
                  ]),
                  h(
                    'button',
                    {
                      type: 'button',
                      class: 'danger-button event-delete-button',
                      'aria-label': `Delete renewal ${index + 1}`,
                      onClick: () => emit('deleteRenewal', renewal.id)
                    },
                    'Delete'
                  )
                ]);
              })
            )
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
    const errors = reactive<Record<string, string | undefined>>({});
    watch(() => props.scenario.id, () => clearErrors(errors));

    function toNumber(event: Event): number {
      const value = Number((event.target as HTMLInputElement).value);
      return Number.isFinite(value) ? value : 0;
    }

    function toText(event: Event): string {
      return (event.target as HTMLInputElement).value;
    }

    function updateDate(id: string, event: Event): void {
      const date = toText(event);
      const message = !date
        ? 'Lump-sum date is required.'
        : date < props.scenario.startDate
          ? 'Lump-sum date must be on or after the mortgage start date.'
          : undefined;
      errors[`${id}-date`] = message;
      if (!message) emit('updateLumpSum', id, { date });
    }

    function updateAmount(id: string, event: Event): void {
      const amount = toNumber(event);
      const message = amount > 0 ? undefined : 'Lump-sum amount must be greater than zero.';
      errors[`${id}-amount`] = message;
      if (!message) emit('updateLumpSum', id, { amount });
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
              props.scenario.lumpSums.map((lumpSum, index) => {
                const dateErrorId = `${lumpSum.id}-date-error`;
                const amountErrorId = `${lumpSum.id}-amount-error`;
                return h('div', { class: 'event-row', key: lumpSum.id }, [
                  h('label', [
                    'Date',
                    h('input', {
                      'aria-label': `Lump sum date ${index + 1}`,
                      type: 'date',
                      value: lumpSum.date,
                      min: props.scenario.startDate,
                      required: true,
                      ...validationAttributes(dateErrorId, errors[`${lumpSum.id}-date`]),
                      onInput: (event: Event) => updateDate(lumpSum.id, event)
                    }),
                    fieldError(dateErrorId, errors[`${lumpSum.id}-date`])
                  ]),
                  h('label', [
                    'Amount',
                    h('input', {
                      'aria-label': `Lump sum amount ${index + 1}`,
                      type: 'number',
                      value: lumpSum.amount,
                      min: '1',
                      step: '100',
                      ...validationAttributes(amountErrorId, errors[`${lumpSum.id}-amount`]),
                      onInput: (event: Event) => updateAmount(lumpSum.id, event)
                    }),
                    fieldError(amountErrorId, errors[`${lumpSum.id}-amount`])
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
                ]);
              })
            )
      ]);
  }
});

export default defineComponent({
  name: 'AppShell',
  setup() {
    const store = useScenarioStore();

    watch(store.activeScenario, beginMortgageUiUpdate, { deep: true, flush: 'sync' });
    onUpdated(finishMortgageUiUpdateAfterPaint);

    return () => measureMortgageWork('AppShell render function', () => {
      const scenario = store.activeScenario.value;
      const projection = store.projection.value;

      return h('div', { class: 'app-shell' }, [
        h(ScenarioBar, {
          scenarios: store.state.scenarios,
          activeScenarioId: store.state.activeScenarioId,
          onSwitchScenario: store.switchActiveScenario,
          onCreateScenario: store.createScenario,
          onDuplicateScenario: store.duplicateActiveScenario,
          onRenameScenario: store.renameScenario,
          onDeleteScenario: store.deleteScenario
        }),
        h('main', { class: 'dashboard', 'aria-label': 'Mortgage calculator dashboard' }, [
          h('section', { class: 'analysis-area', 'aria-labelledby': 'analysis-heading' }, [
            h('div', { class: 'section-heading' }, [
              h('div', [
                h('p', { class: 'eyebrow' }, 'Analysis'),
                h('h1', { id: 'analysis-heading' }, 'Mortgage projection')
              ]),
              h('span', { class: 'status-pill' }, `${projection.schedule.length} payments`)
            ]),
            h(SummaryMetrics, { summary: projection.summary }),
            h('div', { class: 'chart-grid', 'aria-label': 'Projection charts' }, [
              h(BalanceChart, { chartSeries: projection.chartSeries }),
              h(PaymentBreakdownChart, { chartSeries: projection.chartSeries })
            ]),
            h(PaymentScheduleTable, { rows: projection.schedule })
          ]),
          h('aside', { class: 'editing-panel', 'aria-label': 'Scenario editing panel' }, [
            h(MortgageInputs, {
              scenario,
              onUpdateScenario: store.updateScenario
            }),
            h(RenewalEditorShell, {
              scenario,
              onAddRenewal: store.addRenewal,
              onUpdateRenewal: store.updateRenewal,
              onDeleteRenewal: store.deleteRenewal
            }),
            h(LumpSumEditorShell, {
              scenario,
              onAddLumpSum: store.addLumpSum,
              onUpdateLumpSum: store.updateLumpSum,
              onDeleteLumpSum: store.deleteLumpSum
            }),
            h(ProjectionWarningsPanel, { warnings: projection.warnings })
          ])
        ])
      ]);
    });
  }
});
