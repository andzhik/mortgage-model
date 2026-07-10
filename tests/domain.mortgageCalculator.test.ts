import { describe, expect, it } from 'vitest';
import {
  calculateScheduledPayment,
  projectMortgageScenario
} from '../src/domain/mortgageCalculator';
import { compareIsoDates } from '../src/domain/dateMath';
import { getPeriodicRate } from '../src/domain/interestRates';
import { roundMoney } from '../src/domain/money';
import type {
  LumpSumEvent,
  MortgageScenario,
  PaymentFrequency,
  RenewalEvent
} from '../src/domain/mortgageTypes';

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

  it('applies an off-cycle lump sum before payoff as a separate principal reduction row', () => {
    const projection = projectMortgageScenario(
      makeScenario({
        principalAmount: 12_000,
        annualInterestRate: 0,
        amortizationMonths: 12,
        paymentFrequency: 'monthly',
        lumpSums: [{ id: 'lump-1', date: '2026-06-01', amount: 3_000, label: 'Bonus' }]
      })
    );
    const lumpSumRow = projection.schedule.find((row) => row.date === '2026-06-01');

    expect(lumpSumRow).toMatchObject({
      openingBalance: 7_000,
      scheduledPayment: 0,
      scheduledInterestPaid: 0,
      scheduledPrincipalPaid: 0,
      lumpSumPayment: 3_000,
      totalPayment: 3_000,
      totalPrincipalReduction: 3_000,
      closingBalance: 4_000,
      eventType: 'lump-sum',
      notes: ['Lump sum "Bonus" applied']
    });
    expect(projection.summary.regularPaymentAmount).toBe(1_000);
    expect(projection.summary.totalLumpSumsPaid).toBe(3_000);
    expect(projection.summary.finalPaymentDate).toBe('2026-09-10');
    expect(
      projection.chartSeries.paymentBreakdown.find((point) => point.date === '2026-06-01')
    ).toMatchObject({
      scheduledInterestPaid: 0,
      scheduledPrincipalPaid: 0,
      lumpSumPayment: 3_000,
      totalPrincipalReduction: 3_000
    });
    expect(projection.warnings).toEqual([]);
  });

  it('applies same-date lump sums before scheduled payment interest is calculated', () => {
    const projection = projectMortgageScenario(
      makeScenario({
        principalAmount: 12_000,
        annualInterestRate: 0.12,
        amortizationMonths: 12,
        paymentFrequency: 'monthly',
        lumpSums: [{ id: 'lump-1', date: '2026-01-10', amount: 3_000, label: 'Start boost' }]
      })
    );
    const firstRow = projection.schedule[0];
    const periodicRate = getPeriodicRate(0.12, 12);
    const interestOnFullBalance = roundMoney(12_000 * periodicRate);
    const interestOnReducedBalance = roundMoney(9_000 * periodicRate);

    expect(firstRow).toMatchObject({
      date: '2026-01-10',
      openingBalance: 12_000,
      lumpSumPayment: 3_000,
      scheduledInterestPaid: interestOnReducedBalance,
      totalPrincipalReduction: firstRow.scheduledPrincipalPaid + 3_000,
      eventType: 'lump-sum',
      notes: ['Lump sum "Start boost" applied']
    });
    expect(firstRow.scheduledInterestPaid).toBeLessThan(interestOnFullBalance);
    expect(projection.summary.totalLumpSumsPaid).toBe(3_000);
  });

  it('applies multiple lump sums without an artificial count limit', () => {
    const lumpSums = Array.from({ length: 12 }, (_, index) => ({
      id: `lump-${index + 1}`,
      date: `2026-${String(index + 1).padStart(2, '0')}-15`,
      amount: 100,
      label: `Extra ${index + 1}`
    }));
    const projection = projectMortgageScenario(
      makeScenario({
        principalAmount: 24_000,
        annualInterestRate: 0,
        amortizationMonths: 24,
        paymentFrequency: 'monthly',
        lumpSums
      })
    );

    expect(projection.summary.totalLumpSumsPaid).toBe(1_200);
    expect(projection.schedule.filter((row) => row.lumpSumPayment > 0)).toHaveLength(12);
    expect(projection.warnings).toEqual([]);
  });

  it('caps an excessive lump sum at the remaining balance and warns', () => {
    const projection = projectMortgageScenario(
      makeScenario({
        principalAmount: 5_000,
        annualInterestRate: 0,
        amortizationMonths: 12,
        paymentFrequency: 'monthly',
        lumpSums: [{ id: 'lump-too-large', date: '2026-01-10', amount: 10_000 }]
      })
    );

    expect(projection.schedule).toHaveLength(1);
    expect(projection.schedule[0]).toMatchObject({
      openingBalance: 5_000,
      scheduledPayment: 0,
      lumpSumPayment: 5_000,
      closingBalance: 0,
      eventType: 'final-payment'
    });
    expect(projection.summary.totalLumpSumsPaid).toBe(5_000);
    expect(projection.summary.totalPrincipalPaid).toBe(0);
    expect(projection.warnings).toMatchObject([
      {
        code: 'lump-sum-capped',
        eventId: 'lump-too-large',
        date: '2026-01-10',
        severity: 'warning'
      }
    ]);
  });

  it('ignores post-payoff lump sums with a warning', () => {
    const projection = projectMortgageScenario(
      makeScenario({
        principalAmount: 12_000,
        annualInterestRate: 0,
        amortizationMonths: 12,
        paymentFrequency: 'monthly',
        lumpSums: [{ id: 'lump-late', date: '2027-02-10', amount: 1_000 }]
      })
    );

    expect(projection.schedule).toHaveLength(12);
    expect(projection.summary.finalPaymentDate).toBe('2026-12-10');
    expect(projection.summary.totalLumpSumsPaid).toBe(0);
    expect(projection.warnings).toMatchObject([
      {
        code: 'lump-sum-after-payoff',
        eventId: 'lump-late',
        date: '2027-02-10',
        severity: 'warning'
      }
    ]);
  });

  it('shortens payoff while keeping the scheduled payment unchanged until renewal', () => {
    const baseline = projectMortgageScenario(
      makeScenario({
        principalAmount: 250_000,
        annualInterestRate: 0.045,
        amortizationMonths: 300,
        paymentFrequency: 'monthly'
      })
    );
    const withLumpSum = projectMortgageScenario(
      makeScenario({
        principalAmount: 250_000,
        annualInterestRate: 0.045,
        amortizationMonths: 300,
        paymentFrequency: 'monthly',
        lumpSums: [{ id: 'lump-1', date: '2027-01-10', amount: 25_000 }]
      })
    );

    expect(withLumpSum.summary.regularPaymentAmount).toBe(baseline.summary.regularPaymentAmount);
    expect(compareIsoDates(withLumpSum.summary.finalPaymentDate, baseline.summary.finalPaymentDate)).toBeLessThan(0);
    expect(withLumpSum.summary.totalLumpSumsPaid).toBe(25_000);
  });

  it('marks the first payment row in a renewed term', () => {
    const projection = projectMortgageScenario(
      makeScenario({
        principalAmount: 100_000,
        annualInterestRate: 0.04,
        amortizationMonths: 120,
        paymentFrequency: 'monthly',
        termMonths: 12,
        renewals: [
          {
            id: 'renewal-year-2',
            effectiveDate: '2027-01-10',
            termMonths: 24,
            annualInterestRate: 0.04,
            paymentFrequency: 'monthly',
            paymentStrategy: 'recalculate-payment',
            note: 'Second term'
          }
        ]
      })
    );
    const renewalRow = projection.schedule.find((row) => row.date === '2027-01-10');

    expect(renewalRow).toMatchObject({
      periodId: 'renewal-year-2',
      eventType: 'renewal',
      annualInterestRate: 0.04,
      notes: ['Renewal 1 applied', 'Second term']
    });
    expect(projection.chartSeries.renewalMarkers).toEqual([
      {
        date: '2027-01-10',
        label: 'Renewal 1',
        rate: 0.04,
        termMonths: 24
      }
    ]);
  });

  it('recalculates payment when a renewal changes the rate', () => {
    const projection = projectMortgageScenario(
      makeScenario({
        principalAmount: 100_000,
        annualInterestRate: 0.03,
        amortizationMonths: 120,
        paymentFrequency: 'monthly',
        termMonths: 12,
        renewals: [
          {
            id: 'renewal-higher-rate',
            effectiveDate: '2027-01-10',
            termMonths: 24,
            annualInterestRate: 0.08,
            paymentFrequency: 'monthly',
            paymentStrategy: 'recalculate-payment'
          }
        ]
      })
    );
    const preRenewalRow = projection.schedule.find((row) => row.date === '2026-12-10');
    const renewalRow = projection.schedule.find((row) => row.date === '2027-01-10');

    expect(preRenewalRow?.scheduledPayment).toBe(964.75);
    expect(renewalRow?.scheduledPayment).toBeGreaterThan(preRenewalRow?.scheduledPayment ?? 0);
    expect(renewalRow).toMatchObject({
      periodId: 'renewal-higher-rate',
      annualInterestRate: 0.08,
      eventType: 'renewal'
    });
  });

  it('assigns period IDs before and after renewal events', () => {
    const projection = projectMortgageScenario(
      makeScenario({
        principalAmount: 80_000,
        annualInterestRate: 0.04,
        amortizationMonths: 120,
        paymentFrequency: 'monthly',
        termMonths: 12,
        renewals: [
          {
            id: 'renewal-term-2',
            effectiveDate: '2027-01-10',
            termMonths: 36,
            annualInterestRate: 0.045,
            paymentFrequency: 'bi-weekly',
            paymentStrategy: 'recalculate-payment'
          }
        ]
      })
    );
    const initialRows = projection.schedule.filter((row) => row.date < '2027-01-10');
    const renewedRows = projection.schedule.filter((row) => row.date >= '2027-01-10');

    expect(new Set(initialRows.map((row) => row.periodId))).toEqual(new Set(['term-initial']));
    expect(new Set(renewedRows.map((row) => row.periodId))).toEqual(
      new Set(['renewal-term-2'])
    );
    expect(renewedRows[0]).toMatchObject({
      date: '2027-01-10',
      paymentFrequency: 'bi-weekly',
      eventType: 'renewal'
    });
  });

  it('warns and ignores renewal events after payoff', () => {
    const projection = projectMortgageScenario(
      makeScenario({
        principalAmount: 12_000,
        annualInterestRate: 0,
        amortizationMonths: 12,
        paymentFrequency: 'monthly',
        renewals: [
          {
            id: 'renewal-too-late',
            effectiveDate: '2027-02-10',
            termMonths: 12,
            annualInterestRate: 0.05,
            paymentFrequency: 'monthly',
            paymentStrategy: 'recalculate-payment'
          }
        ]
      })
    );

    expect(projection.summary.finalPaymentDate).toBe('2026-12-10');
    expect(projection.chartSeries.renewalMarkers).toEqual([]);
    expect(projection.warnings).toMatchObject([
      {
        code: 'renewal-after-payoff',
        eventId: 'renewal-too-late',
        date: '2027-02-10',
        severity: 'warning'
      }
    ]);
  });

  it('preserves lump-sum-shortened payoff when payment is recalculated at renewal', () => {
    const renewal: RenewalEvent = {
      id: 'renewal-after-lump-sum',
      effectiveDate: '2031-01-10',
      termMonths: 60,
      annualInterestRate: 0.045,
      paymentFrequency: 'monthly',
      paymentStrategy: 'recalculate-payment'
    };
    const baseline = projectMortgageScenario(
      makeScenario({
        principalAmount: 250_000,
        annualInterestRate: 0.045,
        amortizationMonths: 300,
        paymentFrequency: 'monthly',
        renewals: [renewal]
      })
    );
    const withLumpSum = projectMortgageScenario(
      makeScenario({
        principalAmount: 250_000,
        annualInterestRate: 0.045,
        amortizationMonths: 300,
        paymentFrequency: 'monthly',
        lumpSums: [{ id: 'lump-early', date: '2027-01-10', amount: 25_000 }],
        renewals: [renewal]
      })
    );

    expect(compareIsoDates(withLumpSum.summary.finalPaymentDate, baseline.summary.finalPaymentDate)).toBeLessThan(0);
    expect(withLumpSum.summary.totalLumpSumsPaid).toBe(25_000);
    expect(withLumpSum.schedule.find((row) => row.date === '2031-01-10')).toMatchObject({
      periodId: 'renewal-after-lump-sum',
      eventType: 'renewal'
    });
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
