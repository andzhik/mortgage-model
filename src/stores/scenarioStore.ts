import { computed, reactive, readonly } from 'vue';
import type {
  LumpSumEvent,
  MortgageProjection,
  MortgageScenario,
  PaymentFrequency,
  PaymentStrategy,
  RenewalEvent
} from '../domain/mortgageTypes';
import { projectMortgageScenario } from '../domain/mortgageCalculator';
import { addDays, addMonths } from '../domain/dateMath';
import {
  createLocalStorageRepository,
  type ScenarioRepository,
  type StoredScenarioState
} from '../persistence/localStorageRepository';

export type MortgageInputUpdate = Partial<{
  principalAmount: number;
  startDate: string;
  amortizationMonths: number;
  termMonths: number;
  annualInterestRate: number;
  paymentFrequency: PaymentFrequency;
}>;

export type LumpSumInputUpdate = Partial<{
  date: string;
  amount: number;
  label: string;
}>;

export type RenewalInputUpdate = Partial<{
  effectiveDate: string;
  termMonths: number;
  annualInterestRate: number;
  paymentFrequency: PaymentFrequency;
  paymentStrategy: PaymentStrategy;
  note: string;
}>;

export type ScenarioStoreOptions = {
  repository?: ScenarioRepository;
  now?: () => Date;
  idFactory?: (prefix: string) => string;
  debounceMs?: number;
};

let fallbackIdCounter = 1;

export function createDefaultScenario(
  now: () => Date = () => new Date(),
  idFactory: (prefix: string) => string = createScenarioId,
  name = 'Scenario 1'
): MortgageScenario {
  const timestamp = now().toISOString();
  const startDate = timestamp.slice(0, 10);
  const scenarioId = idFactory('scenario');

  return {
    id: scenarioId,
    name,
    createdAt: timestamp,
    updatedAt: timestamp,
    currency: 'CAD',
    startDate,
    principalAmount: 500_000,
    amortizationMonths: 25 * 12,
    paymentFrequency: 'monthly',
    initialTerm: {
      id: idFactory('term'),
      startDate,
      termMonths: 5 * 12,
      annualInterestRate: 0.05,
      paymentFrequency: 'monthly',
      paymentStrategy: 'recalculate-payment'
    },
    lumpSums: [],
    renewals: []
  };
}

export function useScenarioStore(options: ScenarioStoreOptions = {}) {
  const repository = options.repository ?? createLocalStorageRepository();
  const now = options.now ?? (() => new Date());
  const idFactory = options.idFactory ?? createScenarioId;
  const debounceMs = options.debounceMs ?? 250;
  const loaded = repository.load();
  const initialScenario = createDefaultScenario(now, idFactory);
  const initialState =
    loaded.status === 'loaded'
      ? loaded.state
      : {
          schemaVersion: 1,
          activeScenarioId: initialScenario.id,
          scenarios: [initialScenario]
        };
  const state = reactive<StoredScenarioState>({
    schemaVersion: 1,
    activeScenarioId: initialState.activeScenarioId,
    scenarios: initialState.scenarios.map(cloneScenario)
  });
  let pendingSaveId: ReturnType<typeof setTimeout> | undefined;

  const activeScenario = computed(() => {
    const active = state.scenarios.find((scenario) => scenario.id === state.activeScenarioId);
    return active ?? state.scenarios[0];
  });
  const projection = computed<MortgageProjection>(() => projectMortgageScenario(activeScenario.value));

  if (loaded.status !== 'loaded') {
    scheduleSave();
  }

  function switchActiveScenario(id: string): void {
    if (!state.scenarios.some((scenario) => scenario.id === id)) {
      return;
    }

    state.activeScenarioId = id;
    scheduleSave();
  }

  function createScenario(): MortgageScenario {
    const scenario = createDefaultScenario(
      now,
      idFactory,
      `Scenario ${state.scenarios.length + 1}`
    );

    state.scenarios.push(scenario);
    state.activeScenarioId = scenario.id;
    scheduleSave();

    return scenario;
  }

  function duplicateActiveScenario(): MortgageScenario {
    const timestamp = now().toISOString();
    const source = activeScenario.value;
    const duplicate = cloneScenario(source);
    duplicate.id = idFactory('scenario');
    duplicate.name = `${source.name} copy`;
    duplicate.createdAt = timestamp;
    duplicate.updatedAt = timestamp;
    duplicate.initialTerm = {
      ...duplicate.initialTerm,
      id: idFactory('term')
    };
    duplicate.lumpSums = duplicate.lumpSums.map((lumpSum) => ({
      ...lumpSum,
      id: idFactory('lump-sum')
    }));
    duplicate.renewals = duplicate.renewals.map((renewal) => ({
      ...renewal,
      id: idFactory('renewal')
    }));

    state.scenarios.push(duplicate);
    state.activeScenarioId = duplicate.id;
    scheduleSave();

    return duplicate;
  }

  function renameScenario(id: string, name: string): void {
    const scenario = state.scenarios.find((candidate) => candidate.id === id);
    const trimmedName = name.trim();

    if (!scenario || trimmedName.length === 0) {
      return;
    }

    scenario.name = trimmedName;
    touchScenario(scenario);
  }

  function deleteScenario(id: string): void {
    const scenarioIndex = state.scenarios.findIndex((scenario) => scenario.id === id);

    if (scenarioIndex === -1) {
      return;
    }

    state.scenarios.splice(scenarioIndex, 1);

    if (state.scenarios.length === 0) {
      const replacement = createDefaultScenario(now, idFactory);
      state.scenarios.push(replacement);
      state.activeScenarioId = replacement.id;
    } else if (state.activeScenarioId === id) {
      const nextScenario = state.scenarios[Math.max(0, scenarioIndex - 1)];
      state.activeScenarioId = nextScenario.id;
    }

    scheduleSave();
  }

  function updateScenario(update: MortgageInputUpdate): void {
    const scenario = activeScenario.value;

    if (update.principalAmount !== undefined) {
      scenario.principalAmount = Math.max(1, update.principalAmount);
    }

    if (update.startDate !== undefined && update.startDate) {
      const startDate = update.startDate;
      scenario.startDate = startDate;
      scenario.initialTerm.startDate = startDate;
      scenario.lumpSums = scenario.lumpSums.map((lumpSum) => ({
        ...lumpSum,
        date: lumpSum.date < startDate ? startDate : lumpSum.date
      }));
      let earliestRenewalDate = startDate;
      scenario.renewals = [...scenario.renewals]
        .sort((left, right) => left.effectiveDate.localeCompare(right.effectiveDate))
        .map((renewal) => {
          const effectiveDate =
            renewal.effectiveDate < earliestRenewalDate
              ? earliestRenewalDate
              : renewal.effectiveDate;
          earliestRenewalDate = addDays(effectiveDate, 1);

          return { ...renewal, effectiveDate };
        });
    }

    if (update.amortizationMonths !== undefined) {
      scenario.amortizationMonths = Math.max(1, update.amortizationMonths);
    }

    if (update.termMonths !== undefined) {
      scenario.initialTerm.termMonths = Math.max(1, update.termMonths);
    }

    if (update.annualInterestRate !== undefined) {
      scenario.initialTerm.annualInterestRate = Math.max(0, update.annualInterestRate);
    }

    if (update.paymentFrequency !== undefined) {
      scenario.paymentFrequency = update.paymentFrequency;
      scenario.initialTerm.paymentFrequency = update.paymentFrequency;
    }

    touchScenario(scenario);
  }

  function addLumpSum(): void {
    const scenario = activeScenario.value;

    scenario.lumpSums.push({
      id: idFactory('lump-sum'),
      date: scenario.startDate,
      amount: 1_000,
      label: undefined
    });
    touchScenario(scenario);
  }

  function updateLumpSum(id: string, update: LumpSumInputUpdate): void {
    const scenario = activeScenario.value;
    const lumpSum = scenario.lumpSums.find((candidate) => candidate.id === id);

    if (!lumpSum) {
      return;
    }

    if (update.date !== undefined && update.date) {
      lumpSum.date = update.date < scenario.startDate ? scenario.startDate : update.date;
    }

    if (update.amount !== undefined) {
      lumpSum.amount = Math.max(1, update.amount);
    }

    if (update.label !== undefined) {
      const label = update.label.trim();
      lumpSum.label = label.length > 0 ? label : undefined;
    }

    touchScenario(scenario);
  }

  function deleteLumpSum(id: string): void {
    const scenario = activeScenario.value;
    scenario.lumpSums = scenario.lumpSums.filter((lumpSum: LumpSumEvent) => lumpSum.id !== id);
    touchScenario(scenario);
  }

  function addRenewal(): void {
    const scenario = activeScenario.value;
    const previousRenewal = [...scenario.renewals].sort((left, right) =>
      left.effectiveDate.localeCompare(right.effectiveDate)
    ).at(-1);
    const effectiveDate = previousRenewal
      ? addMonths(previousRenewal.effectiveDate, previousRenewal.termMonths)
      : addMonths(scenario.startDate, scenario.initialTerm.termMonths);

    scenario.renewals.push({
      id: idFactory('renewal'),
      effectiveDate,
      termMonths: scenario.initialTerm.termMonths,
      annualInterestRate: scenario.initialTerm.annualInterestRate,
      paymentFrequency: scenario.paymentFrequency,
      paymentStrategy: 'recalculate-payment',
      note: undefined
    });
    touchScenario(scenario);
  }

  function updateRenewal(id: string, update: RenewalInputUpdate): void {
    const scenario = activeScenario.value;
    const renewal = scenario.renewals.find((candidate) => candidate.id === id);

    if (!renewal) {
      return;
    }

    if (update.effectiveDate !== undefined && update.effectiveDate) {
      renewal.effectiveDate =
        update.effectiveDate < scenario.startDate ? scenario.startDate : update.effectiveDate;
      scenario.renewals.sort((left, right) =>
        left.effectiveDate.localeCompare(right.effectiveDate)
      );
    }

    if (update.termMonths !== undefined) {
      renewal.termMonths = Math.max(1, update.termMonths);
    }

    if (update.annualInterestRate !== undefined) {
      renewal.annualInterestRate = Math.max(0, update.annualInterestRate);
    }

    if (update.paymentFrequency !== undefined) {
      renewal.paymentFrequency = update.paymentFrequency;
    }

    if (update.paymentStrategy !== undefined) {
      renewal.paymentStrategy = update.paymentStrategy;
    }

    if (update.note !== undefined) {
      const note = update.note.trim();
      renewal.note = note.length > 0 ? note : undefined;
    }

    touchScenario(scenario);
  }

  function deleteRenewal(id: string): void {
    const scenario = activeScenario.value;
    scenario.renewals = scenario.renewals.filter((renewal: RenewalEvent) => renewal.id !== id);
    touchScenario(scenario);
  }

  function flushPendingPersistence(): void {
    if (pendingSaveId !== undefined) {
      clearTimeout(pendingSaveId);
      pendingSaveId = undefined;
    }

    repository.save(toStoredState());
  }

  function touchScenario(scenario: MortgageScenario): void {
    scenario.updatedAt = now().toISOString();
    scheduleSave();
  }

  function scheduleSave(): void {
    if (pendingSaveId !== undefined) {
      clearTimeout(pendingSaveId);
    }

    pendingSaveId = setTimeout(() => {
      pendingSaveId = undefined;
      repository.save(toStoredState());
    }, debounceMs);
  }

  function toStoredState(): StoredScenarioState {
    return {
      schemaVersion: 1,
      activeScenarioId: state.activeScenarioId,
      scenarios: state.scenarios.map(cloneScenario)
    };
  }

  return {
    state: readonly(state),
    activeScenario,
    projection,
    switchActiveScenario,
    createScenario,
    duplicateActiveScenario,
    renameScenario,
    deleteScenario,
    updateScenario,
    addLumpSum,
    updateLumpSum,
    deleteLumpSum,
    addRenewal,
    updateRenewal,
    deleteRenewal,
    flushPendingPersistence
  };
}

function cloneScenario(scenario: MortgageScenario): MortgageScenario {
  return {
    ...scenario,
    initialTerm: { ...scenario.initialTerm },
    lumpSums: scenario.lumpSums.map((lumpSum) => ({ ...lumpSum })),
    renewals: scenario.renewals.map((renewal) => ({ ...renewal }))
  };
}

function createScenarioId(prefix: string): string {
  const randomId =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${fallbackIdCounter}`;
  fallbackIdCounter += 1;

  return `${prefix}-${randomId}`;
}
