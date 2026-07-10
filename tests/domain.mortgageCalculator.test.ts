import { describe, expect, it } from 'vitest';
import {
  calculateScheduledPayment,
  projectMortgageScenario
} from '../src/domain/mortgageCalculator';
import type { MortgageScenario, PaymentFrequency } from '../src/domain/mortgageTypes';

describe('mortgage calculator', () => {
  it('projects a monthly Canadian mortgage with payment split, summary, and chart series', () => {
    const projection = projectMortgageScenario(
      makeScenario({
        principalAmount: 500_000,
        annualInterestRate: 0.05,
        amortizationMonths: 300,
        paymentFrequency: 'monthly'
      })
    );
    const firstRow = projection.schedule[0];
    const finalRow = projection.schedule.at(-1);

    expect(projection.schedule).toHaveLength(300);
    expect(projection.summary.regularPaymentAmount).toBe(2908.02);
    expect(firstRow).toMatchObject({
      sequence: 1,
      date: '2026-01-10',
      openingBalance: 500_000,
      scheduledPayment: 2908.02,
      scheduledInterestPaid: 2061.96,
      scheduledPrincipalPaid: 846.06,
      lumpSumPayment: 0,
      totalPayment: 2908.02,
      totalPrincipalReduction: 846.06,
      closingBalance: 499_153.94,
      eventType: 'regular-payment'
    });
    expect(finalRow).toMatchObject({
      date: '2050-12-10',
      closingBalance: 0,
      eventType: 'final-payment'
    });
    expect(projection.summary).toMatchObject({
      originalPrincipal: 500_000,
      nextPaymentInterestPortion: 2061.96,
      nextPaymentPrincipalPortion: 846.06,
      finalPaymentDate: '2050-12-10',
      totalPrincipalPaid: 500_000,
      totalLumpSumsPaid: 0
    });
    expect(projection.summary.totalPaid).toBe(
      projection.summary.totalInterestPaid + projection.summary.totalPrincipalPaid
    );
    expect(projection.chartSeries.balanceOverTime).toHaveLength(projection.schedule.length);
    expect(projection.chartSeries.paymentBreakdown[0]).toMatchObject({
      date: '2026-01-10',
      scheduledInterestPaid: 2061.96,
      scheduledPrincipalPaid: 846.06,
      lumpSumPayment: 0,
      totalPrincipalReduction: 846.06
    });
    expect(projection.chartSeries.renewalMarkers).toEqual([]);
  });

  it('calculates weekly payments and rows', () => {
    const projection = projectMortgageScenario(
      makeScenario({
        principalAmount: 250_000,
        annualInterestRate: 0.045,
        amortizationMonths: 300,
        paymentFrequency: 'weekly'
      })
    );

    expect(projection.schedule).toHaveLength(1300);
    expect(projection.summary.regularPaymentAmount).toBe(
      calculateScheduledPayment(250_000, 0.045, 'weekly', 1300)
    );
    expect(projection.schedule[0]).toMatchObject({
      date: '2026-01-10',
      openingBalance: 250_000,
      paymentFrequency: 'weekly'
    });
    expect(projection.schedule[1].date).toBe('2026-01-17');
    expect(projection.schedule.at(-1)?.closingBalance).toBe(0);
  });

  it('calculates bi-weekly payments and rows', () => {
    const projection = projectMortgageScenario(
      makeScenario({
        principalAmount: 250_000,
        annualInterestRate: 0.045,
        amortizationMonths: 300,
        paymentFrequency: 'bi-weekly'
      })
    );

    expect(projection.schedule).toHaveLength(650);
    expect(projection.summary.regularPaymentAmount).toBe(
      calculateScheduledPayment(250_000, 0.045, 'bi-weekly', 650)
    );
    expect(projection.schedule[1].date).toBe('2026-01-24');
    expect(projection.schedule.at(-1)?.closingBalance).toBe(0);
  });

  it('calculates semi-monthly payments on the next 1st or 15th schedule', () => {
    const projection = projectMortgageScenario(
      makeScenario({
        startDate: '2026-01-16',
        principalAmount: 250_000,
        annualInterestRate: 0.045,
        amortizationMonths: 300,
        paymentFrequency: 'semi-monthly'
      })
    );

    expect(projection.schedule).toHaveLength(600);
    expect(projection.summary.regularPaymentAmount).toBe(
      calculateScheduledPayment(250_000, 0.045, 'semi-monthly', 600)
    );
    expect(projection.schedule.slice(0, 4).map((row) => row.date)).toEqual([
      '2026-02-01',
      '2026-02-15',
      '2026-03-01',
      '2026-03-15'
    ]);
    expect(projection.schedule.at(-1)?.closingBalance).toBe(0);
  });

  it('handles zero-interest mortgages with principal-only payments', () => {
    const projection = projectMortgageScenario(
      makeScenario({
        principalAmount: 12_000,
        annualInterestRate: 0,
        amortizationMonths: 12,
        paymentFrequency: 'monthly'
      })
    );

    expect(projection.summary.regularPaymentAmount).toBe(1000);
    expect(projection.summary.totalInterestPaid).toBe(0);
    expect(projection.summary.totalPrincipalPaid).toBe(12_000);
    expect(projection.schedule).toHaveLength(12);
    expect(projection.schedule[0]).toMatchObject({
      scheduledPayment: 1000,
      scheduledInterestPaid: 0,
      scheduledPrincipalPaid: 1000,
      closingBalance: 11_000
    });
    expect(projection.schedule.at(-1)?.closingBalance).toBe(0);
  });

  it('adjusts the final payment to avoid leaving rounded cents or overpaying principal', () => {
    const projection = projectMortgageScenario(
      makeScenario({
        principalAmount: 1_000,
        annualInterestRate: 0,
        amortizationMonths: 12,
        paymentFrequency: 'monthly'
      })
    );
    const finalRow = projection.schedule.at(-1);

    expect(projection.summary.regularPaymentAmount).toBe(83.33);
    expect(finalRow).toMatchObject({
      openingBalance: 83.37,
      scheduledPayment: 83.37,
      scheduledInterestPaid: 0,
      scheduledPrincipalPaid: 83.37,
      closingBalance: 0,
      eventType: 'final-payment'
    });
    expect(projection.summary.totalPrincipalPaid).toBe(1_000);
    expect(projection.summary.totalPaid).toBe(1_000);
  });

  it('caps a non-zero-interest final principal payment at the remaining balance', () => {
    const projection = projectMortgageScenario(
      makeScenario({
        principalAmount: 1_000,
        annualInterestRate: 0.05,
        amortizationMonths: 12,
        paymentFrequency: 'monthly'
      })
    );
    const finalRow = projection.schedule.at(-1);

    expect(projection.summary.regularPaymentAmount).toBe(85.58);
    expect(finalRow).toMatchObject({
      openingBalance: 85.27,
      scheduledPayment: 85.62,
      scheduledInterestPaid: 0.35,
      scheduledPrincipalPaid: 85.27,
      closingBalance: 0,
      eventType: 'final-payment'
    });
    expect(finalRow?.scheduledPrincipalPaid).toBe(finalRow?.openingBalance);
    expect(projection.summary.totalPrincipalPaid).toBe(1_000);
  });
});

type ScenarioOverrides = {
  startDate?: string;
  principalAmount: number;
  annualInterestRate: number;
  amortizationMonths: number;
  paymentFrequency: PaymentFrequency;
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
      termMonths: 60,
      annualInterestRate: overrides.annualInterestRate,
      paymentFrequency,
      paymentStrategy: 'recalculate-payment'
    },
    lumpSums: [],
    renewals: []
  };
}
