import { describe, expect, it } from 'vitest';
import { getPaymentFrequencyMetadata, getPaymentsPerYear } from '../src/domain/paymentFrequency';

describe('payment frequency metadata', () => {
  it('maps supported payment frequencies to Canadian payments per year', () => {
    expect(getPaymentsPerYear('weekly')).toBe(52);
    expect(getPaymentsPerYear('bi-weekly')).toBe(26);
    expect(getPaymentsPerYear('semi-monthly')).toBe(24);
    expect(getPaymentsPerYear('monthly')).toBe(12);
  });

  it('exposes labels and date increment metadata for each frequency', () => {
    expect(getPaymentFrequencyMetadata('weekly')).toMatchObject({
      label: 'Weekly',
      dateIncrement: 'weekly'
    });
    expect(getPaymentFrequencyMetadata('bi-weekly')).toMatchObject({
      label: 'Bi-weekly',
      dateIncrement: 'bi-weekly'
    });
    expect(getPaymentFrequencyMetadata('semi-monthly')).toMatchObject({
      label: 'Semi-monthly',
      dateIncrement: 'semi-monthly'
    });
    expect(getPaymentFrequencyMetadata('monthly')).toMatchObject({
      label: 'Monthly',
      dateIncrement: 'monthly'
    });
  });
});
