export type CompoundingFrequency = 'semi-annual' | 'monthly' | 'simple';

const ZERO_RATE_EPSILON = 1e-12;

export function isZeroInterestRate(rate: number, epsilon = ZERO_RATE_EPSILON): boolean {
  return Math.abs(rate) <= epsilon;
}

export function getPeriodicRate(
  annualRate: number,
  paymentsPerYear: number,
  compounding: CompoundingFrequency = 'semi-annual'
): number {
  if (!Number.isFinite(annualRate) || annualRate < 0) {
    throw new Error('Annual interest rate must be a non-negative finite number.');
  }

  if (!Number.isFinite(paymentsPerYear) || paymentsPerYear <= 0) {
    throw new Error('Payments per year must be greater than zero.');
  }

  if (isZeroInterestRate(annualRate)) {
    return 0;
  }

  if (compounding === 'simple') {
    return annualRate / paymentsPerYear;
  }

  const effectiveAnnualRate =
    compounding === 'semi-annual'
      ? (1 + annualRate / 2) ** 2 - 1
      : (1 + annualRate / 12) ** 12 - 1;

  return (1 + effectiveAnnualRate) ** (1 / paymentsPerYear) - 1;
}

export function getZeroInterestPayment(balance: number, remainingPayments: number): number {
  if (!Number.isFinite(balance) || balance < 0) {
    throw new Error('Balance must be a non-negative finite number.');
  }

  if (!Number.isInteger(remainingPayments) || remainingPayments <= 0) {
    throw new Error('Remaining payments must be a positive integer.');
  }

  return balance / remainingPayments;
}
