export type CurrencyCode = 'CAD';

export type PaymentFrequency = 'weekly' | 'bi-weekly' | 'semi-monthly' | 'monthly';

export type PaymentStrategy = 'recalculate-payment' | 'keep-payment-reduce-time';

export type ScheduleEventType = 'regular-payment' | 'lump-sum' | 'renewal' | 'final-payment';

export type MortgageScenario = {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  currency: CurrencyCode;
  startDate: string;
  principalAmount: number;
  amortizationMonths: number;
  initialTerm: MortgageTerm;
  paymentFrequency: PaymentFrequency;
  lumpSums: LumpSumEvent[];
  renewals: RenewalEvent[];
};

export type MortgageTerm = {
  id: string;
  startDate: string;
  termMonths: number;
  annualInterestRate: number;
  paymentFrequency: PaymentFrequency;
  paymentAmount?: number;
  paymentStrategy: PaymentStrategy;
};

export type RenewalEvent = {
  id: string;
  effectiveDate: string;
  termMonths: number;
  annualInterestRate: number;
  paymentFrequency?: PaymentFrequency;
  paymentStrategy: PaymentStrategy;
  note?: string;
};

export type LumpSumEvent = {
  id: string;
  date: string;
  amount: number;
  label?: string;
};

export type PaymentScheduleRow = {
  sequence: number;
  date: string;
  periodId: string;
  openingBalance: number;
  scheduledPayment: number;
  scheduledInterestPaid: number;
  scheduledPrincipalPaid: number;
  lumpSumPayment: number;
  totalPayment: number;
  totalPrincipalReduction: number;
  closingBalance: number;
  annualInterestRate: number;
  paymentFrequency: PaymentFrequency;
  eventType?: ScheduleEventType;
  notes?: string[];
};

export type ProjectionSummary = {
  originalPrincipal: number;
  regularPaymentAmount: number;
  nextPaymentInterestPortion: number;
  nextPaymentPrincipalPortion: number;
  finalPaymentDate: string;
  totalInterestPaid: number;
  totalPrincipalPaid: number;
  totalLumpSumsPaid: number;
  totalPaid: number;
  interestSavedEstimate?: number;
  monthsSavedEstimate?: number;
};

export type ProjectionChartSeries = {
  balanceOverTime: {
    date: string;
    balance: number;
    periodId: string;
  }[];
  paymentBreakdown: {
    date: string;
    scheduledInterestPaid: number;
    scheduledPrincipalPaid: number;
    lumpSumPayment: number;
    totalPrincipalReduction: number;
    periodId: string;
  }[];
  renewalMarkers: {
    date: string;
    label: string;
    rate: number;
    termMonths: number;
  }[];
  termBands: {
    startDate: string;
    endDate: string;
    label: string;
    rate: number;
  }[];
};

export type ProjectionWarning = {
  code: string;
  message: string;
  severity: 'info' | 'warning' | 'error';
  date?: string;
  eventId?: string;
};

export type MortgageProjection = {
  scenarioId: string;
  generatedAt: string;
  summary: ProjectionSummary;
  schedule: PaymentScheduleRow[];
  chartSeries: ProjectionChartSeries;
  warnings: ProjectionWarning[];
};
