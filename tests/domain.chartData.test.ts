import { describe, expect, it } from 'vitest';
import {
  chooseChartGranularity,
  prepareBalanceChart,
  preparePaymentBreakdownChart
} from '../src/domain/chartData';
import { projectMortgageScenario } from '../src/domain/mortgageCalculator';
import type {
  LumpSumEvent,
  MortgageScenario,
  PaymentFrequency,
  RenewalEvent
} from '../src/domain/mortgageTypes';

describe('chart data preparation', () => {
  it('keeps short projections at payment level with distinct balance marker datasets', () => {
    const projection = projectMortgageScenario(
      makeScenario({
        principalAmount: 12_000,
        annualInterestRate: 0,
        amortizationMonths: 12,
        paymentFrequency: 'monthly',
        lumpSums: [{ id: 'lump-1', date: '2026-06-10', amount: 1_000, label: 'Bonus' }],
        renewals: [
          {
            id: 'renewal-1',
            effectiveDate: '2026-07-10',
            termMonths: 12,
            annualInterestRate: 0.01,
            paymentFrequency: 'monthly',
            paymentStrategy: 'recalculate-payment'
          }
        ]
      })
    );
    const chart = prepareBalanceChart(projection.chartSeries);

    expect(chart.granularity).toBe('payment');
    expect(chart.data.labels).toContain('2026-06-10');
    expect(chart.data.datasets.map((dataset) => dataset.label)).toEqual([
      'Remaining balance',
      'Lump-sum payments',
      'Renewals'
    ]);
    expect(chart.lumpSumMarkerCount).toBe(1);
    expect(chart.renewalMarkerCount).toBe(1);
    expect(chart.termBands.map((band) => band.label)).toEqual(['Initial term', 'Renewal 1']);
  });

  it('renders regular-payment principal and interest as line datasets without lump sums', () => {
    const projection = projectMortgageScenario(
      makeScenario({
        principalAmount: 500_000,
        annualInterestRate: 0.05,
        amortizationMonths: 300,
        paymentFrequency: 'monthly',
        lumpSums: [{ id: 'lump-1', date: '2027-01-15', amount: 25_000 }]
      })
    );
    const chart = preparePaymentBreakdownChart(projection.chartSeries);
    const [principalDataset, interestDataset] = chart.data.datasets;

    expect(chart.granularity).toBe('payment');
    expect(chart.data.labels).toHaveLength(chart.sourcePointCount);
    expect(chart.data.datasets.map((dataset) => dataset.label)).toEqual([
      'Payment to principal',
      'Interest'
    ]);
    expect(principalDataset.borderColor).toBe('#2563eb');
    expect(interestDataset.borderColor).toBe('#dc2626');
    expect(sumDataset(interestDataset.data)).toBe(projection.summary.totalInterestPaid);
    expect(sumDataset(principalDataset.data)).toBe(projection.summary.totalPrincipalPaid);
    expect(chart.data.labels).not.toContain('2027-01-15');
    expect(chart.sourcePointCount).toBe(
      projection.chartSeries.paymentBreakdown.filter(
        (point) => point.scheduledInterestPaid > 0 || point.scheduledPrincipalPaid > 0
      ).length
    );
  });

  it('keeps every bi-weekly payment as a distinct payment breakdown point', () => {
    const projection = projectMortgageScenario(
      makeScenario({
        principalAmount: 250_000,
        annualInterestRate: 0.045,
        amortizationMonths: 300,
        paymentFrequency: 'bi-weekly'
      })
    );
    const regularPayments = projection.chartSeries.paymentBreakdown.filter(
      (point) => point.scheduledInterestPaid > 0 || point.scheduledPrincipalPaid > 0
    );
    const breakdownChart = preparePaymentBreakdownChart(projection.chartSeries);

    expect(breakdownChart.granularity).toBe('payment');
    expect(breakdownChart.data.labels).toEqual(regularPayments.map((point) => point.date));
    expect(breakdownChart.data.datasets[0]?.data).toEqual(
      regularPayments.map((point) => point.scheduledPrincipalPaid)
    );
    expect(breakdownChart.data.datasets[1]?.data).toEqual(
      regularPayments.map((point) => point.scheduledInterestPaid)
    );
  });

  it('uses yearly aggregation for dense weekly balance projections', () => {
    const projection = projectMortgageScenario(
      makeScenario({
        principalAmount: 250_000,
        annualInterestRate: 0.045,
        amortizationMonths: 300,
        paymentFrequency: 'weekly'
      })
    );
    const balanceChart = prepareBalanceChart(projection.chartSeries);

    expect(chooseChartGranularity(projection.schedule.length)).toBe('year');
    expect(balanceChart.granularity).toBe('year');
    expect(balanceChart.data.labels?.length).toBeLessThan(projection.schedule.length);
  });

  it('places renewal markers on the next displayed balance bucket when dates do not align', () => {
    const projection = projectMortgageScenario(
      makeScenario({
        principalAmount: 100_000,
        annualInterestRate: 0.04,
        amortizationMonths: 120,
        paymentFrequency: 'semi-monthly',
        renewals: [
          {
            id: 'off-cycle-renewal',
            effectiveDate: '2026-07-07',
            termMonths: 24,
            annualInterestRate: 0.05,
            paymentFrequency: 'semi-monthly',
            paymentStrategy: 'recalculate-payment'
          }
        ]
      })
    );
    const renewalRow = projection.schedule.find((row) => row.eventType === 'renewal');
    const chart = prepareBalanceChart(projection.chartSeries, 'payment');
    const renewalDataset = chart.data.datasets.find((dataset) => dataset.label === 'Renewals');

    expect(renewalRow?.date).toBe('2026-07-15');
    expect(chart.renewalMarkerCount).toBe(1);
    expect(renewalDataset?.data.some((value) => typeof value === 'number')).toBe(true);
  });
});

type ScenarioOverrides = {
  startDate?: string;
  principalAmount: number;
  annualInterestRate: number;
  amortizationMonths: number;
  paymentFrequency: PaymentFrequency;
  termMonths?: number;
  lumpSums?: LumpSumEvent[];
  renewals?: RenewalEvent[];
};

function makeScenario(overrides: ScenarioOverrides): MortgageScenario {
  const paymentFrequency = overrides.paymentFrequency;
  const startDate = overrides.startDate ?? '2026-01-10';

  return {
    id: 'scenario-test',
    name: 'Test scenario',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    currency: 'CAD',
    startDate,
    principalAmount: overrides.principalAmount,
    amortizationMonths: overrides.amortizationMonths,
    paymentFrequency,
    initialTerm: {
      id: 'term-initial',
      startDate,
      termMonths: overrides.termMonths ?? 60,
      annualInterestRate: overrides.annualInterestRate,
      paymentFrequency,
      paymentStrategy: 'recalculate-payment'
    },
    lumpSums: overrides.lumpSums ?? [],
    renewals: overrides.renewals ?? []
  };
}

function sumDataset(data: unknown): number {
  if (!Array.isArray(data)) {
    return 0;
  }

  return Math.round(
    data.reduce((total, value) => total + (typeof value === 'number' ? value : 0), 0) * 100
  ) / 100;
}
