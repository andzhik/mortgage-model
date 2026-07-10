import { addMonths, getFirstPaymentDate, getNextPaymentDate } from './dateMath';
import { getPeriodicRate, getZeroInterestPayment, isZeroInterestRate } from './interestRates';
import { clampCentLevelBalance, roundMoney } from './money';
import type {
  MortgageProjection,
  MortgageScenario,
  PaymentFrequency,
  PaymentScheduleRow,
  ProjectionChartSeries,
  ProjectionSummary
} from './mortgageTypes';
import { getPaymentsPerYear } from './paymentFrequency';

const MAX_SCHEDULE_ROWS = 10_000;

export function calculateScheduledPayment(
  balance: number,
  annualInterestRate: number,
  paymentFrequency: PaymentFrequency,
  remainingPayments: number
): number {
  assertNonNegativeFinite(balance, 'Balance');

  if (!Number.isInteger(remainingPayments) || remainingPayments <= 0) {
    throw new Error('Remaining payments must be a positive integer.');
  }

  if (balance === 0) {
    return 0;
  }

  const paymentsPerYear = getPaymentsPerYear(paymentFrequency);
  const periodicRate = getPeriodicRate(annualInterestRate, paymentsPerYear);
  const payment = isZeroInterestRate(periodicRate)
    ? getZeroInterestPayment(balance, remainingPayments)
    : (balance * periodicRate) / (1 - (1 + periodicRate) ** -remainingPayments);

  return roundMoney(payment);
}

export function projectMortgageScenario(scenario: MortgageScenario): MortgageProjection {
  validateScenario(scenario);

  const frequency = scenario.paymentFrequency;
  const paymentsPerYear = getPaymentsPerYear(frequency);
  const totalScheduledPayments = getPaymentCount(scenario.amortizationMonths, paymentsPerYear);
  const periodicRate = getPeriodicRate(scenario.initialTerm.annualInterestRate, paymentsPerYear);
  const regularPaymentAmount = calculateScheduledPayment(
    scenario.principalAmount,
    scenario.initialTerm.annualInterestRate,
    frequency,
    totalScheduledPayments
  );

  const schedule: PaymentScheduleRow[] = [];
  let balance = roundMoney(scenario.principalAmount);
  let paymentDate = getFirstPaymentDate(scenario.startDate, frequency);

  for (
    let index = 0;
    balance > 0 && index < totalScheduledPayments && index < MAX_SCHEDULE_ROWS;
    index += 1
  ) {
    const openingBalance = roundMoney(balance);
    const scheduledInterestPaid = roundMoney(openingBalance * periodicRate);
    const regularPrincipalPaid = Math.max(0, regularPaymentAmount - scheduledInterestPaid);
    const isLastScheduledPayment = index === totalScheduledPayments - 1;
    const scheduledPrincipalPaid = roundMoney(
      isLastScheduledPayment ? openingBalance : Math.min(openingBalance, regularPrincipalPaid)
    );
    const scheduledPayment = roundMoney(scheduledInterestPaid + scheduledPrincipalPaid);
    const closingBalance = clampCentLevelBalance(openingBalance - scheduledPrincipalPaid);
    const isFinalPayment = closingBalance === 0;

    schedule.push({
      sequence: index + 1,
      date: paymentDate,
      periodId: scenario.initialTerm.id,
      openingBalance,
      scheduledPayment,
      scheduledInterestPaid,
      scheduledPrincipalPaid,
      lumpSumPayment: 0,
      totalPayment: scheduledPayment,
      totalPrincipalReduction: scheduledPrincipalPaid,
      closingBalance,
      annualInterestRate: scenario.initialTerm.annualInterestRate,
      paymentFrequency: frequency,
      eventType: isFinalPayment ? 'final-payment' : 'regular-payment',
      notes: isFinalPayment ? ['Mortgage paid off'] : undefined
    });

    balance = closingBalance;

    if (balance > 0) {
      paymentDate = getNextPaymentDate(paymentDate, frequency);
    }
  }

  const summary = createProjectionSummary(scenario, regularPaymentAmount, schedule);
  const chartSeries = createChartSeries(scenario, schedule);

  return {
    scenarioId: scenario.id,
    generatedAt: new Date().toISOString(),
    summary,
    schedule,
    chartSeries,
    warnings: []
  };
}

function createProjectionSummary(
  scenario: MortgageScenario,
  regularPaymentAmount: number,
  schedule: PaymentScheduleRow[]
): ProjectionSummary {
  const nextPayment = schedule[0];
  const totalInterestPaid = roundMoney(
    schedule.reduce((total, row) => total + row.scheduledInterestPaid, 0)
  );
  const totalPrincipalPaid = roundMoney(
    schedule.reduce((total, row) => total + row.scheduledPrincipalPaid, 0)
  );
  const totalLumpSumsPaid = roundMoney(
    schedule.reduce((total, row) => total + row.lumpSumPayment, 0)
  );
  const totalPaid = roundMoney(totalInterestPaid + totalPrincipalPaid + totalLumpSumsPaid);

  return {
    originalPrincipal: roundMoney(scenario.principalAmount),
    regularPaymentAmount,
    nextPaymentInterestPortion: nextPayment?.scheduledInterestPaid ?? 0,
    nextPaymentPrincipalPortion: nextPayment?.scheduledPrincipalPaid ?? 0,
    finalPaymentDate: schedule.at(-1)?.date ?? scenario.startDate,
    totalInterestPaid,
    totalPrincipalPaid,
    totalLumpSumsPaid,
    totalPaid
  };
}

function createChartSeries(
  scenario: MortgageScenario,
  schedule: PaymentScheduleRow[]
): ProjectionChartSeries {
  return {
    balanceOverTime: schedule.map((row) => ({
      date: row.date,
      balance: row.closingBalance,
      periodId: row.periodId
    })),
    paymentBreakdown: schedule.map((row) => ({
      date: row.date,
      scheduledInterestPaid: row.scheduledInterestPaid,
      scheduledPrincipalPaid: row.scheduledPrincipalPaid,
      lumpSumPayment: row.lumpSumPayment,
      totalPrincipalReduction: row.totalPrincipalReduction,
      periodId: row.periodId
    })),
    renewalMarkers: [],
    termBands: [
      {
        startDate: scenario.initialTerm.startDate,
        endDate: addMonths(scenario.initialTerm.startDate, scenario.initialTerm.termMonths),
        label: 'Initial term',
        rate: scenario.initialTerm.annualInterestRate
      }
    ]
  };
}

function getPaymentCount(amortizationMonths: number, paymentsPerYear: number): number {
  const payments = Math.ceil((amortizationMonths / 12) * paymentsPerYear);

  if (!Number.isInteger(payments) || payments <= 0) {
    throw new Error('Amortization must produce at least one scheduled payment.');
  }

  return payments;
}

function validateScenario(scenario: MortgageScenario): void {
  assertNonNegativeFinite(scenario.principalAmount, 'Principal amount');

  if (scenario.principalAmount <= 0) {
    throw new Error('Principal amount must be greater than zero.');
  }

  if (!Number.isInteger(scenario.amortizationMonths) || scenario.amortizationMonths <= 0) {
    throw new Error('Amortization months must be a positive integer.');
  }

  assertNonNegativeFinite(scenario.initialTerm.annualInterestRate, 'Annual interest rate');

  if (!Number.isInteger(scenario.initialTerm.termMonths) || scenario.initialTerm.termMonths <= 0) {
    throw new Error('Initial term months must be a positive integer.');
  }
}

function assertNonNegativeFinite(value: number, label: string): void {
  if (!Number.isFinite(value) || value < 0) {
    throw new Error(`${label} must be a non-negative finite number.`);
  }
}
