import { describe, expect, it } from 'vitest';
import {
  getPeriodicRate,
  getZeroInterestPayment,
  isZeroInterestRate
} from '../src/domain/interestRates';

describe('interest rate utilities', () => {
  it('converts Canadian nominal annual rates to periodic rates using semi-annual compounding by default', () => {
    const periodicRate = getPeriodicRate(0.05, 12);
    const expectedRate = (1 + ((1 + 0.05 / 2) ** 2 - 1)) ** (1 / 12) - 1;

    expect(periodicRate).toBeCloseTo(expectedRate, 12);
  });

  it('supports explicit monthly and simple periodic conversion modes', () => {
    expect(getPeriodicRate(0.06, 12, 'monthly')).toBeCloseTo(0.005, 12);
    expect(getPeriodicRate(0.06, 12, 'simple')).toBeCloseTo(0.005, 12);
  });

  it('treats zero and tiny interest rates as zero', () => {
    expect(isZeroInterestRate(0)).toBe(true);
    expect(isZeroInterestRate(1e-13)).toBe(true);
    expect(isZeroInterestRate(1e-8)).toBe(false);
    expect(getPeriodicRate(0, 26)).toBe(0);
  });

  it('calculates zero-interest payments by evenly dividing balance over remaining payments', () => {
    expect(getZeroInterestPayment(120_000, 240)).toBe(500);
  });
});
