import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';
import BalanceChart from '../src/components/BalanceChart.vue';
import PaymentBreakdownChart from '../src/components/PaymentBreakdownChart.vue';
import type { ProjectionChartSeries } from '../src/domain/mortgageTypes';

describe('chart components', () => {
  it('passes prepared datasets to the Chart.js wrappers', () => {
    const chartSeries = makeChartSeries();
    const balanceWrapper = mount(BalanceChart, {
      props: { chartSeries }
    });
    const breakdownWrapper = mount(PaymentBreakdownChart, {
      props: { chartSeries }
    });

    try {
      expect(balanceWrapper.get('[data-chart-kind="line"]').attributes('data-dataset-labels')).toBe(
        'Remaining balance|Lump-sum payments|Renewals'
      );
      expect(
        breakdownWrapper.get('[data-chart-kind="bar"]').attributes('data-dataset-labels')
      ).toBe('Scheduled interest|Scheduled principal|Lump sums');
      expect(balanceWrapper.findAll('.term-band-segment')).toHaveLength(2);
      expect(balanceWrapper.text()).toContain('Initial term');
    } finally {
      balanceWrapper.unmount();
      breakdownWrapper.unmount();
    }
  });
});

function makeChartSeries(): ProjectionChartSeries {
  return {
    balanceOverTime: [
      { date: '2026-01-10', balance: 499_000, periodId: 'term-initial' },
      { date: '2026-02-10', balance: 497_950, periodId: 'term-initial' },
      { date: '2026-03-10', balance: 471_750, periodId: 'renewal-1' }
    ],
    paymentBreakdown: [
      {
        date: '2026-01-10',
        scheduledInterestPaid: 2_000,
        scheduledPrincipalPaid: 1_000,
        lumpSumPayment: 0,
        totalPrincipalReduction: 1_000,
        periodId: 'term-initial'
      },
      {
        date: '2026-02-10',
        scheduledInterestPaid: 1_950,
        scheduledPrincipalPaid: 1_050,
        lumpSumPayment: 25_000,
        totalPrincipalReduction: 26_050,
        periodId: 'term-initial'
      },
      {
        date: '2026-03-10',
        scheduledInterestPaid: 1_850,
        scheduledPrincipalPaid: 1_150,
        lumpSumPayment: 0,
        totalPrincipalReduction: 1_150,
        periodId: 'renewal-1'
      }
    ],
    renewalMarkers: [
      {
        date: '2026-03-10',
        label: 'Renewal 1',
        rate: 0.04,
        termMonths: 36
      }
    ],
    termBands: [
      {
        startDate: '2026-01-10',
        endDate: '2026-03-10',
        label: 'Initial term',
        rate: 0.05
      },
      {
        startDate: '2026-03-10',
        endDate: '2029-03-10',
        label: 'Renewal 1',
        rate: 0.04
      }
    ]
  };
}
