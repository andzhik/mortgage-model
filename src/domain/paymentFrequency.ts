import type { PaymentFrequency } from './mortgageTypes';

export type PaymentFrequencyMetadata = {
  frequency: PaymentFrequency;
  label: string;
  paymentsPerYear: number;
  dateIncrement: 'weekly' | 'bi-weekly' | 'semi-monthly' | 'monthly';
};

export const PAYMENT_FREQUENCY_METADATA: Record<PaymentFrequency, PaymentFrequencyMetadata> = {
  weekly: {
    frequency: 'weekly',
    label: 'Weekly',
    paymentsPerYear: 52,
    dateIncrement: 'weekly'
  },
  'bi-weekly': {
    frequency: 'bi-weekly',
    label: 'Bi-weekly',
    paymentsPerYear: 26,
    dateIncrement: 'bi-weekly'
  },
  'semi-monthly': {
    frequency: 'semi-monthly',
    label: 'Semi-monthly',
    paymentsPerYear: 24,
    dateIncrement: 'semi-monthly'
  },
  monthly: {
    frequency: 'monthly',
    label: 'Monthly',
    paymentsPerYear: 12,
    dateIncrement: 'monthly'
  }
};

export function getPaymentFrequencyMetadata(
  frequency: PaymentFrequency
): PaymentFrequencyMetadata {
  return PAYMENT_FREQUENCY_METADATA[frequency];
}

export function getPaymentsPerYear(frequency: PaymentFrequency): number {
  return getPaymentFrequencyMetadata(frequency).paymentsPerYear;
}
