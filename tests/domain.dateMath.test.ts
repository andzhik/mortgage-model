import { describe, expect, it } from 'vitest';
import {
  addDays,
  addMonths,
  generatePaymentDates,
  getFirstPaymentDate,
  getNextPaymentDate
} from '../src/domain/dateMath';

describe('date math utilities', () => {
  it('adds monthly increments while clamping invalid month-end dates', () => {
    expect(addMonths('2026-01-10', 1)).toBe('2026-02-10');
    expect(addMonths('2026-01-31', 1)).toBe('2026-02-28');
    expect(addMonths('2024-01-31', 1)).toBe('2024-02-29');
    expect(getNextPaymentDate('2026-12-15', 'monthly')).toBe('2027-01-15');
  });

  it('adds weekly and bi-weekly payment increments', () => {
    expect(addDays('2026-07-10', 7)).toBe('2026-07-17');
    expect(getNextPaymentDate('2026-07-10', 'weekly')).toBe('2026-07-17');
    expect(getNextPaymentDate('2026-07-10', 'bi-weekly')).toBe('2026-07-24');
  });

  it('generates semi-monthly payments on the 1st and 15th', () => {
    expect(generatePaymentDates('2026-01-01', 'semi-monthly', 5)).toEqual([
      '2026-01-01',
      '2026-01-15',
      '2026-02-01',
      '2026-02-15',
      '2026-03-01'
    ]);
  });

  it('moves the first semi-monthly payment to the next 1st or 15th when needed', () => {
    expect(getFirstPaymentDate('2026-01-02', 'semi-monthly')).toBe('2026-01-15');
    expect(getFirstPaymentDate('2026-01-15', 'semi-monthly')).toBe('2026-01-15');
    expect(getFirstPaymentDate('2026-01-16', 'semi-monthly')).toBe('2026-02-01');
    expect(getFirstPaymentDate('2026-01-31', 'semi-monthly')).toBe('2026-02-01');
  });
});
