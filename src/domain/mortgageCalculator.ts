import { addMonths, compareIsoDates, getFirstPaymentDate, getNextPaymentDate } from './dateMath';
import { getPeriodicRate, getZeroInterestPayment, isZeroInterestRate } from './interestRates';
import { clampCentLevelBalance, roundMoney } from './money';
import type {
  LumpSumEvent,
  MortgageProjection,
  MortgageScenario,
  PaymentStrategy,
  PaymentFrequency,
  PaymentScheduleRow,
  ProjectionChartSeries,
  ProjectionSummary,
  ProjectionWarning,
  RenewalEvent
} from './mortgageTypes';
import { PAYMENT_FREQUENCY_METADATA, getPaymentsPerYear } from './paymentFrequency';

const MAX_SCHEDULE_ROWS = 10_000;

type AppliedLumpSums = {
  openingBalance: number;
  closingBalance: number;
  appliedAmount: number;
  notes: string[];
};

type ActiveTerm = {
  id: string;
  startDate: string;
  termMonths: number;
  annualInterestRate: number;
  paymentFrequency: PaymentFrequency;
  paymentStrategy: PaymentStrategy;
};

type RenewalMarker = ProjectionChartSeries['renewalMarkers'][number];
type TermBand = ProjectionChartSeries['termBands'][number];

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

  const initialFrequency = scenario.paymentFrequency;
  const paymentsPerYear = getPaymentsPerYear(initialFrequency);
  const totalScheduledPayments = getPaymentCount(scenario.amortizationMonths, paymentsPerYear);
  const initialRegularPaymentAmount = calculateScheduledPayment(
    scenario.principalAmount,
    scenario.initialTerm.annualInterestRate,
    initialFrequency,
    totalScheduledPayments
  );

  const schedule: PaymentScheduleRow[] = [];
  const warnings: ProjectionWarning[] = [];
  const renewalMarkers: RenewalMarker[] = [];
  const termBands: TermBand[] = [
    {
      startDate: scenario.initialTerm.startDate,
      endDate: addMonths(scenario.initialTerm.startDate, scenario.initialTerm.termMonths),
      label: 'Initial term',
      rate: scenario.initialTerm.annualInterestRate
    }
  ];
  const lumpSums = [...scenario.lumpSums].sort((left, right) => {
    const dateComparison = compareIsoDates(left.date, right.date);
    return dateComparison === 0 ? left.id.localeCompare(right.id) : dateComparison;
  });
  const renewals = [...scenario.renewals].sort((left, right) => {
    const dateComparison = compareIsoDates(left.effectiveDate, right.effectiveDate);
    return dateComparison === 0 ? left.id.localeCompare(right.id) : dateComparison;
  });
  let nextLumpSumIndex = 0;
  let nextRenewalIndex = 0;
  let nextSequence = 1;
  let balance = roundMoney(scenario.principalAmount);
  let activeTerm: ActiveTerm = {
    id: scenario.initialTerm.id,
    startDate: scenario.initialTerm.startDate,
    termMonths: scenario.initialTerm.termMonths,
    annualInterestRate: scenario.initialTerm.annualInterestRate,
    paymentFrequency: initialFrequency,
    paymentStrategy: scenario.initialTerm.paymentStrategy
  };
  let regularPaymentAmount = initialRegularPaymentAmount;
  let plannedPaymentsRemaining = totalScheduledPayments;
  let paymentDate = getFirstPaymentDate(scenario.startDate, activeTerm.paymentFrequency);
  let pendingRenewalNotes: string[] = [];

  scheduleLoop: while (balance > 0 && schedule.length < MAX_SCHEDULE_ROWS) {
    while (
      balance > 0 &&
      schedule.length < MAX_SCHEDULE_ROWS &&
      hasEventBeforePayment(renewals, nextRenewalIndex, lumpSums, nextLumpSumIndex, paymentDate)
    ) {
      const nextRenewal = renewals[nextRenewalIndex];
      const nextLumpSum = lumpSums[nextLumpSumIndex];

      if (
        nextRenewal &&
        compareIsoDates(nextRenewal.effectiveDate, paymentDate) < 0 &&
        (!nextLumpSum || compareIsoDates(nextRenewal.effectiveDate, nextLumpSum.date) <= 0)
      ) {
        const renewalResult = applyRenewal({
          renewal: nextRenewal,
          balance,
          activeTerm,
          regularPaymentAmount,
          renewalMarkers,
          termBands
        });

        nextRenewalIndex += 1;
        activeTerm = renewalResult.activeTerm;
        regularPaymentAmount = renewalResult.regularPaymentAmount;
        plannedPaymentsRemaining = renewalResult.plannedPaymentsRemaining;
        pendingRenewalNotes = [...pendingRenewalNotes, ...renewalResult.notes];
        paymentDate = getFirstPaymentDate(
          nextRenewal.effectiveDate,
          renewalResult.activeTerm.paymentFrequency
        );
        continue;
      }

      const lumpSumDate = lumpSums[nextLumpSumIndex].date;
      const appliedLumpSums = applyLumpSumsForDate(
        lumpSums,
        lumpSumDate,
        nextLumpSumIndex,
        balance,
        warnings
      );
      nextLumpSumIndex = appliedLumpSums.nextIndex;

      if (appliedLumpSums.appliedAmount > 0) {
        balance = appliedLumpSums.closingBalance;

        schedule.push({
          sequence: nextSequence,
          date: lumpSumDate,
          periodId: activeTerm.id,
          openingBalance: appliedLumpSums.openingBalance,
          scheduledPayment: 0,
          scheduledInterestPaid: 0,
          scheduledPrincipalPaid: 0,
          lumpSumPayment: appliedLumpSums.appliedAmount,
          totalPayment: appliedLumpSums.appliedAmount,
          totalPrincipalReduction: appliedLumpSums.appliedAmount,
          closingBalance: appliedLumpSums.closingBalance,
          annualInterestRate: activeTerm.annualInterestRate,
          paymentFrequency: activeTerm.paymentFrequency,
          eventType: appliedLumpSums.closingBalance === 0 ? 'final-payment' : 'lump-sum',
          notes:
            appliedLumpSums.closingBalance === 0
              ? [...appliedLumpSums.notes, 'Mortgage paid off']
              : appliedLumpSums.notes
        });
        nextSequence += 1;
      }
    }

    if (balance === 0 || schedule.length >= MAX_SCHEDULE_ROWS) {
      break;
    }

    while (
      nextRenewalIndex < renewals.length &&
      compareIsoDates(renewals[nextRenewalIndex].effectiveDate, paymentDate) <= 0
    ) {
      const renewal = renewals[nextRenewalIndex];
      const renewalResult = applyRenewal({
        renewal,
        balance,
        activeTerm,
        regularPaymentAmount,
        renewalMarkers,
        termBands
      });

      nextRenewalIndex += 1;
      activeTerm = renewalResult.activeTerm;
      regularPaymentAmount = renewalResult.regularPaymentAmount;
      plannedPaymentsRemaining = renewalResult.plannedPaymentsRemaining;
      pendingRenewalNotes = [...pendingRenewalNotes, ...renewalResult.notes];
      paymentDate = getFirstPaymentDate(renewal.effectiveDate, activeTerm.paymentFrequency);

      if (compareIsoDates(renewal.effectiveDate, paymentDate) < 0) {
        continue scheduleLoop;
      }
    }

    const openingBalance = roundMoney(balance);
    const sameDateLumpSums = applyLumpSumsForDate(
      lumpSums,
      paymentDate,
      nextLumpSumIndex,
      balance,
      warnings
    );
    nextLumpSumIndex = sameDateLumpSums.nextIndex;

    const balanceAfterLumpSums = sameDateLumpSums.closingBalance;
    const periodicRate = getPeriodicRate(
      activeTerm.annualInterestRate,
      getPaymentsPerYear(activeTerm.paymentFrequency)
    );
    const scheduledInterestPaid = roundMoney(balanceAfterLumpSums * periodicRate);
    const regularPrincipalPaid = Math.max(0, regularPaymentAmount - scheduledInterestPaid);
    const isLastScheduledPayment = plannedPaymentsRemaining <= 1;
    const scheduledPrincipalPaid = roundMoney(
      balanceAfterLumpSums === 0
        ? 0
        : isLastScheduledPayment
          ? balanceAfterLumpSums
          : Math.min(balanceAfterLumpSums, regularPrincipalPaid)
    );
    const scheduledPayment = roundMoney(scheduledInterestPaid + scheduledPrincipalPaid);
    const closingBalance = clampCentLevelBalance(balanceAfterLumpSums - scheduledPrincipalPaid);
    const isFinalPayment = closingBalance === 0;
    const notes = [...pendingRenewalNotes, ...sameDateLumpSums.notes];
    const isRenewalRow = pendingRenewalNotes.length > 0;
    pendingRenewalNotes = [];

    if (isFinalPayment) {
      notes.push('Mortgage paid off');
    }

    schedule.push({
      sequence: nextSequence,
      date: paymentDate,
      periodId: activeTerm.id,
      openingBalance,
      scheduledPayment,
      scheduledInterestPaid,
      scheduledPrincipalPaid,
      lumpSumPayment: sameDateLumpSums.appliedAmount,
      totalPayment: roundMoney(scheduledPayment + sameDateLumpSums.appliedAmount),
      totalPrincipalReduction: roundMoney(scheduledPrincipalPaid + sameDateLumpSums.appliedAmount),
      closingBalance,
      annualInterestRate: activeTerm.annualInterestRate,
      paymentFrequency: activeTerm.paymentFrequency,
      eventType: isFinalPayment
        ? 'final-payment'
        : isRenewalRow
          ? 'renewal'
        : sameDateLumpSums.appliedAmount > 0
          ? 'lump-sum'
          : 'regular-payment',
      notes: notes.length > 0 ? notes : undefined
    });
    nextSequence += 1;

    balance = closingBalance;
    plannedPaymentsRemaining = Math.max(0, plannedPaymentsRemaining - 1);

    if (balance > 0) {
      paymentDate = getNextPaymentDate(paymentDate, activeTerm.paymentFrequency);
    }
  }

  const summary = createProjectionSummary(scenario, initialRegularPaymentAmount, schedule);
  const chartSeries = createChartSeries(schedule, renewalMarkers, termBands);
  appendIgnoredLumpSumWarnings(lumpSums.slice(nextLumpSumIndex), warnings);
  appendIgnoredRenewalWarnings(renewals.slice(nextRenewalIndex), warnings);

  return {
    scenarioId: scenario.id,
    generatedAt: new Date().toISOString(),
    summary,
    schedule,
    chartSeries,
    warnings
  };
}

function hasEventBeforePayment(
  renewals: RenewalEvent[],
  nextRenewalIndex: number,
  lumpSums: LumpSumEvent[],
  nextLumpSumIndex: number,
  paymentDate: string
): boolean {
  return (
    (nextRenewalIndex < renewals.length &&
      compareIsoDates(renewals[nextRenewalIndex].effectiveDate, paymentDate) < 0) ||
    (nextLumpSumIndex < lumpSums.length &&
      compareIsoDates(lumpSums[nextLumpSumIndex].date, paymentDate) < 0)
  );
}

function applyRenewal({
  renewal,
  balance,
  activeTerm,
  regularPaymentAmount,
  renewalMarkers,
  termBands
}: {
  renewal: RenewalEvent;
  balance: number;
  activeTerm: ActiveTerm;
  regularPaymentAmount: number;
  renewalMarkers: RenewalMarker[];
  termBands: TermBand[];
}): {
  activeTerm: ActiveTerm;
  regularPaymentAmount: number;
  plannedPaymentsRemaining: number;
  notes: string[];
} {
  const paymentFrequency = renewal.paymentFrequency ?? activeTerm.paymentFrequency;
  const plannedPaymentsRemaining = getRenewalPaymentCount(
    balance,
    regularPaymentAmount,
    activeTerm.annualInterestRate,
    activeTerm.paymentFrequency,
    paymentFrequency
  );
  const nextRegularPaymentAmount =
    renewal.paymentStrategy === 'keep-payment-reduce-time'
      ? regularPaymentAmount
      : calculateScheduledPayment(
          balance,
          renewal.annualInterestRate,
          paymentFrequency,
          plannedPaymentsRemaining
        );
  const nextTerm: ActiveTerm = {
    id: renewal.id,
    startDate: renewal.effectiveDate,
    termMonths: renewal.termMonths,
    annualInterestRate: renewal.annualInterestRate,
    paymentFrequency,
    paymentStrategy: renewal.paymentStrategy
  };
  const markerLabel = `Renewal ${renewalMarkers.length + 1}`;

  renewalMarkers.push({
    date: renewal.effectiveDate,
    label: markerLabel,
    rate: renewal.annualInterestRate,
    termMonths: renewal.termMonths
  });
  termBands.push({
    startDate: renewal.effectiveDate,
    endDate: addMonths(renewal.effectiveDate, renewal.termMonths),
    label: markerLabel,
    rate: renewal.annualInterestRate
  });

  return {
    activeTerm: nextTerm,
    regularPaymentAmount: nextRegularPaymentAmount,
    plannedPaymentsRemaining,
    notes: [
      `${markerLabel} applied`,
      ...(renewal.note?.trim() ? [renewal.note.trim()] : [])
    ]
  };
}

function getRenewalPaymentCount(
  balance: number,
  scheduledPayment: number,
  annualInterestRate: number,
  currentFrequency: PaymentFrequency,
  nextFrequency: PaymentFrequency
): number {
  const currentRemainingPayments = estimateRemainingPaymentCount(
    balance,
    scheduledPayment,
    annualInterestRate,
    currentFrequency
  );
  const remainingYears = currentRemainingPayments / getPaymentsPerYear(currentFrequency);

  return Math.max(1, Math.ceil(remainingYears * getPaymentsPerYear(nextFrequency)));
}

function estimateRemainingPaymentCount(
  balance: number,
  scheduledPayment: number,
  annualInterestRate: number,
  paymentFrequency: PaymentFrequency
): number {
  let currentBalance = roundMoney(balance);
  const periodicRate = getPeriodicRate(annualInterestRate, getPaymentsPerYear(paymentFrequency));

  for (let paymentCount = 1; paymentCount <= MAX_SCHEDULE_ROWS; paymentCount += 1) {
    const interestPaid = roundMoney(currentBalance * periodicRate);
    const principalPaid = roundMoney(Math.min(currentBalance, scheduledPayment - interestPaid));

    if (principalPaid <= 0) {
      return MAX_SCHEDULE_ROWS;
    }

    currentBalance = clampCentLevelBalance(currentBalance - principalPaid);

    if (currentBalance === 0) {
      return paymentCount;
    }
  }

  return MAX_SCHEDULE_ROWS;
}

function applyLumpSumsForDate(
  lumpSums: LumpSumEvent[],
  date: string,
  startIndex: number,
  balance: number,
  warnings: ProjectionWarning[]
): AppliedLumpSums & { nextIndex: number } {
  let nextIndex = startIndex;
  let currentBalance = roundMoney(balance);
  const openingBalance = currentBalance;
  let appliedAmount = 0;
  const notes: string[] = [];

  while (nextIndex < lumpSums.length && lumpSums[nextIndex].date === date) {
    const lumpSum = lumpSums[nextIndex];

    if (currentBalance === 0) {
      warnings.push(createIgnoredLumpSumWarning(lumpSum));
      nextIndex += 1;
      continue;
    }

    const requestedAmount = roundMoney(lumpSum.amount);
    const applied = roundMoney(Math.min(requestedAmount, currentBalance));

    if (applied < requestedAmount) {
      warnings.push({
        code: 'lump-sum-capped',
        message: `${describeLumpSum(lumpSum)} was capped at the remaining balance.`,
        severity: 'warning',
        date: lumpSum.date,
        eventId: lumpSum.id
      });
    }

    currentBalance = clampCentLevelBalance(currentBalance - applied);
    appliedAmount = roundMoney(appliedAmount + applied);
    notes.push(`${describeLumpSum(lumpSum)} applied`);
    nextIndex += 1;
  }

  return {
    openingBalance,
    closingBalance: currentBalance,
    appliedAmount,
    notes,
    nextIndex
  };
}

function appendIgnoredLumpSumWarnings(
  lumpSums: LumpSumEvent[],
  warnings: ProjectionWarning[]
): void {
  for (const lumpSum of lumpSums) {
    warnings.push(createIgnoredLumpSumWarning(lumpSum));
  }
}

function createIgnoredLumpSumWarning(lumpSum: LumpSumEvent): ProjectionWarning {
  return {
    code: 'lump-sum-after-payoff',
    message: `${describeLumpSum(lumpSum)} was ignored because the mortgage is already paid off.`,
    severity: 'warning',
    date: lumpSum.date,
    eventId: lumpSum.id
  };
}

function appendIgnoredRenewalWarnings(
  renewals: RenewalEvent[],
  warnings: ProjectionWarning[]
): void {
  for (const renewal of renewals) {
    warnings.push({
      code: 'renewal-after-payoff',
      message: `${describeRenewal(renewal)} was ignored because the mortgage is already paid off.`,
      severity: 'warning',
      date: renewal.effectiveDate,
      eventId: renewal.id
    });
  }
}

function describeLumpSum(lumpSum: LumpSumEvent): string {
  return lumpSum.label?.trim() ? `Lump sum "${lumpSum.label.trim()}"` : 'Lump sum payment';
}

function describeRenewal(renewal: RenewalEvent): string {
  return renewal.note?.trim() ? `Renewal "${renewal.note.trim()}"` : 'Renewal event';
}

function createProjectionSummary(
  scenario: MortgageScenario,
  regularPaymentAmount: number,
  schedule: PaymentScheduleRow[]
): ProjectionSummary {
  const nextPayment = schedule.find((row) => row.scheduledPayment > 0);
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
  schedule: PaymentScheduleRow[],
  renewalMarkers: RenewalMarker[],
  termBands: TermBand[]
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
    renewalMarkers,
    termBands
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

  if (!Object.hasOwn(PAYMENT_FREQUENCY_METADATA, scenario.paymentFrequency)) {
    throw new Error('Payment frequency is required.');
  }

  for (const lumpSum of scenario.lumpSums) {
    compareIsoDates(lumpSum.date, scenario.startDate);
    assertNonNegativeFinite(lumpSum.amount, 'Lump-sum amount');

    if (lumpSum.amount <= 0) {
      throw new Error('Lump-sum amount must be greater than zero.');
    }

    if (compareIsoDates(lumpSum.date, scenario.startDate) < 0) {
      throw new Error('Lump-sum date must be on or after the mortgage start date.');
    }
  }

  const renewalDates = new Set<string>();

  for (const renewal of scenario.renewals) {
    compareIsoDates(renewal.effectiveDate, scenario.startDate);
    assertNonNegativeFinite(renewal.annualInterestRate, 'Renewal annual interest rate');

    if (!Number.isInteger(renewal.termMonths) || renewal.termMonths <= 0) {
      throw new Error('Renewal term months must be a positive integer.');
    }

    if (compareIsoDates(renewal.effectiveDate, scenario.startDate) < 0) {
      throw new Error('Renewal date must be on or after the mortgage start date.');
    }

    if (renewalDates.has(renewal.effectiveDate)) {
      throw new Error('Renewal dates must be unique.');
    }

    renewalDates.add(renewal.effectiveDate);

    if (
      renewal.paymentFrequency !== undefined &&
      !Object.hasOwn(PAYMENT_FREQUENCY_METADATA, renewal.paymentFrequency)
    ) {
      throw new Error('Renewal payment frequency is required.');
    }
  }
}

function assertNonNegativeFinite(value: number, label: string): void {
  if (!Number.isFinite(value) || value < 0) {
    throw new Error(`${label} must be a non-negative finite number.`);
  }
}
