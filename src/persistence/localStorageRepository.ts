import type {
  LumpSumEvent,
  MortgageScenario,
  MortgageTerm,
  PaymentFrequency,
  PaymentStrategy,
  RenewalEvent
} from '../domain/mortgageTypes';
import { isSupportedIsoDate } from '../domain/dateMath';

export const SCENARIO_STORAGE_KEY = 'mortgage-model:v1:scenarios';
export const INVALID_BACKUP_KEY_PREFIX = 'mortgage-model:v1:invalid-backup:';

export type StoredScenarioState = {
  schemaVersion: 1;
  activeScenarioId: string | null;
  scenarios: MortgageScenario[];
};

export type ScenarioStorage = Pick<Storage, 'getItem' | 'setItem'>;

export type ScenarioLoadResult =
  | { status: 'empty' }
  | { status: 'loaded'; state: StoredScenarioState }
  | { status: 'corrupt'; backupKey: string | null };

export type ScenarioRepository = {
  load: () => ScenarioLoadResult;
  save: (state: StoredScenarioState) => void;
};

const paymentFrequencies: PaymentFrequency[] = ['weekly', 'bi-weekly', 'semi-monthly', 'monthly'];
const paymentStrategies: PaymentStrategy[] = ['recalculate-payment', 'keep-payment-reduce-time'];

export function createLocalStorageRepository(
  storage: ScenarioStorage | null = getBrowserLocalStorage(),
  now: () => Date = () => new Date()
): ScenarioRepository {
  return {
    load() {
      if (!storage) {
        return { status: 'empty' };
      }

      const raw = storage.getItem(SCENARIO_STORAGE_KEY);

      if (raw === null) {
        return { status: 'empty' };
      }

      try {
        const parsed = JSON.parse(raw) as unknown;

        if (isStoredScenarioState(parsed)) {
          return {
            status: 'loaded',
            state: sanitizeStoredState(parsed)
          };
        }
      } catch {
        // Fall through to backup/reset handling below.
      }

      const backupKey = `${INVALID_BACKUP_KEY_PREFIX}${now().toISOString()}`;

      try {
        storage.setItem(backupKey, raw);
        return { status: 'corrupt', backupKey };
      } catch {
        return { status: 'corrupt', backupKey: null };
      }
    },
    save(state) {
      if (!storage) {
        return;
      }

      storage.setItem(SCENARIO_STORAGE_KEY, JSON.stringify(sanitizeStoredState(state)));
    }
  };
}

function getBrowserLocalStorage(): Storage | null {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}

function sanitizeStoredState(state: StoredScenarioState): StoredScenarioState {
  const scenarios = state.scenarios.map(sanitizeScenario);
  const activeScenarioId = scenarios.some((scenario) => scenario.id === state.activeScenarioId)
    ? state.activeScenarioId
    : (scenarios[0]?.id ?? null);

  return {
    schemaVersion: 1,
    activeScenarioId,
    scenarios
  };
}

function sanitizeScenario(scenario: MortgageScenario): MortgageScenario {
  return {
    id: scenario.id,
    name: scenario.name,
    createdAt: scenario.createdAt,
    updatedAt: scenario.updatedAt,
    currency: 'CAD',
    startDate: scenario.startDate,
    principalAmount: scenario.principalAmount,
    amortizationMonths: scenario.amortizationMonths,
    initialTerm: sanitizeTerm(scenario.initialTerm),
    paymentFrequency: scenario.paymentFrequency,
    lumpSums: scenario.lumpSums.map(sanitizeLumpSum),
    renewals: scenario.renewals.map(sanitizeRenewal)
  };
}

function sanitizeTerm(term: MortgageTerm): MortgageTerm {
  return {
    id: term.id,
    startDate: term.startDate,
    termMonths: term.termMonths,
    annualInterestRate: term.annualInterestRate,
    paymentFrequency: term.paymentFrequency,
    paymentAmount: term.paymentAmount,
    paymentStrategy: term.paymentStrategy
  };
}

function sanitizeLumpSum(lumpSum: LumpSumEvent): LumpSumEvent {
  return {
    id: lumpSum.id,
    date: lumpSum.date,
    amount: lumpSum.amount,
    label: lumpSum.label
  };
}

function sanitizeRenewal(renewal: RenewalEvent): RenewalEvent {
  return {
    id: renewal.id,
    effectiveDate: renewal.effectiveDate,
    termMonths: renewal.termMonths,
    annualInterestRate: renewal.annualInterestRate,
    paymentFrequency: renewal.paymentFrequency,
    paymentStrategy: renewal.paymentStrategy,
    note: renewal.note
  };
}

function isStoredScenarioState(value: unknown): value is StoredScenarioState {
  if (!isRecord(value)) {
    return false;
  }

  return (
    value.schemaVersion === 1 &&
    (typeof value.activeScenarioId === 'string' || value.activeScenarioId === null) &&
    Array.isArray(value.scenarios) &&
    value.scenarios.length > 0 &&
    value.scenarios.every(isMortgageScenario)
  );
}

function isMortgageScenario(value: unknown): value is MortgageScenario {
  if (!isRecord(value)) {
    return false;
  }

  return (
    typeof value.id === 'string' &&
    typeof value.name === 'string' &&
    typeof value.createdAt === 'string' &&
    typeof value.updatedAt === 'string' &&
    value.currency === 'CAD' &&
    typeof value.startDate === 'string' &&
    isSupportedIsoDate(value.startDate) &&
    isPositiveFiniteNumber(value.principalAmount) &&
    isPositiveInteger(value.amortizationMonths) &&
    isPaymentFrequency(value.paymentFrequency) &&
    isMortgageTerm(value.initialTerm) &&
    Array.isArray(value.lumpSums) &&
    value.lumpSums.every(isLumpSum) &&
    Array.isArray(value.renewals) &&
    value.renewals.every(isRenewal)
  );
}

function isMortgageTerm(value: unknown): value is MortgageTerm {
  if (!isRecord(value)) {
    return false;
  }

  return (
    typeof value.id === 'string' &&
    typeof value.startDate === 'string' &&
    isSupportedIsoDate(value.startDate) &&
    isPositiveInteger(value.termMonths) &&
    isNonNegativeFiniteNumber(value.annualInterestRate) &&
    isPaymentFrequency(value.paymentFrequency) &&
    (value.paymentAmount === undefined || isPositiveFiniteNumber(value.paymentAmount)) &&
    isPaymentStrategy(value.paymentStrategy)
  );
}

function isRenewal(value: unknown): value is RenewalEvent {
  if (!isRecord(value)) {
    return false;
  }

  return (
    typeof value.id === 'string' &&
    typeof value.effectiveDate === 'string' &&
    isSupportedIsoDate(value.effectiveDate) &&
    isPositiveInteger(value.termMonths) &&
    isNonNegativeFiniteNumber(value.annualInterestRate) &&
    (value.paymentFrequency === undefined || isPaymentFrequency(value.paymentFrequency)) &&
    isPaymentStrategy(value.paymentStrategy) &&
    (value.note === undefined || typeof value.note === 'string')
  );
}

function isLumpSum(value: unknown): value is LumpSumEvent {
  if (!isRecord(value)) {
    return false;
  }

  return (
    typeof value.id === 'string' &&
    typeof value.date === 'string' &&
    isSupportedIsoDate(value.date) &&
    isPositiveFiniteNumber(value.amount) &&
    (value.label === undefined || typeof value.label === 'string')
  );
}

function isPaymentFrequency(value: unknown): value is PaymentFrequency {
  return paymentFrequencies.includes(value as PaymentFrequency);
}

function isPaymentStrategy(value: unknown): value is PaymentStrategy {
  return paymentStrategies.includes(value as PaymentStrategy);
}

function isPositiveInteger(value: unknown): value is number {
  return Number.isInteger(value) && Number(value) > 0;
}

function isPositiveFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0;
}

function isNonNegativeFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
