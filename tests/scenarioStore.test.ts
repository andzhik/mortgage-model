import { describe, expect, it } from 'vitest';
import {
  INVALID_BACKUP_KEY_PREFIX,
  SCENARIO_STORAGE_KEY,
  createLocalStorageRepository,
  type ScenarioStorage,
  type StoredScenarioState
} from '../src/persistence/localStorageRepository';
import { createDefaultScenario, useScenarioStore } from '../src/stores/scenarioStore';

class MemoryStorage implements ScenarioStorage {
  values = new Map<string, string>();

  getItem(key: string): string | null {
    return this.values.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    this.values.set(key, value);
  }
}

function fixedNow(): Date {
  return new Date('2026-01-10T12:00:00.000Z');
}

function createSequentialIdFactory() {
  let nextId = 1;

  return (prefix: string) => {
    const id = `${prefix}-${nextId}`;
    nextId += 1;

    return id;
  };
}

describe('scenario store', () => {
  it('creates, duplicates, renames, deletes, and switches active scenarios', () => {
    const storage = new MemoryStorage();
    const store = useScenarioStore({
      repository: createLocalStorageRepository(storage, fixedNow),
      now: fixedNow,
      idFactory: createSequentialIdFactory(),
      debounceMs: 1000
    });

    expect(store.state.scenarios).toHaveLength(1);
    expect(store.activeScenario.value.name).toBe('Scenario 1');

    store.updateScenario({ principalAmount: 400_000 });
    store.addLumpSum();
    const firstScenarioId = store.activeScenario.value.id;
    const firstLumpSumId = store.activeScenario.value.lumpSums[0].id;

    const created = store.createScenario();
    expect(store.state.scenarios).toHaveLength(2);
    expect(store.activeScenario.value.id).toBe(created.id);
    expect(store.activeScenario.value.name).toBe('Scenario 2');

    store.switchActiveScenario(firstScenarioId);
    expect(store.activeScenario.value.principalAmount).toBe(400_000);

    const duplicate = store.duplicateActiveScenario();
    expect(store.state.scenarios).toHaveLength(3);
    expect(store.activeScenario.value.id).toBe(duplicate.id);
    expect(store.activeScenario.value.name).toBe('Scenario 1 copy');
    expect(store.activeScenario.value.principalAmount).toBe(400_000);
    expect(store.activeScenario.value.lumpSums).toHaveLength(1);
    expect(store.activeScenario.value.lumpSums[0].id).not.toBe(firstLumpSumId);

    store.renameScenario(duplicate.id, 'Lower rate');
    expect(store.activeScenario.value.name).toBe('Lower rate');

    store.deleteScenario(duplicate.id);
    expect(store.state.scenarios.map((scenario) => scenario.id)).not.toContain(duplicate.id);
    expect(store.activeScenario.value.id).toBe(created.id);

    store.flushPendingPersistence();
    const saved = JSON.parse(storage.getItem(SCENARIO_STORAGE_KEY) ?? '') as StoredScenarioState;
    expect(saved.activeScenarioId).toBe(created.id);
    expect(saved.scenarios).toHaveLength(2);
  });

  it('restores persisted scenarios and saves only user-input scenario data', () => {
    const storage = new MemoryStorage();
    const idFactory = createSequentialIdFactory();
    const firstScenario = createDefaultScenario(fixedNow, idFactory, 'Saved original');
    const secondScenario = createDefaultScenario(fixedNow, idFactory, 'Saved comparison');
    secondScenario.principalAmount = 325_000;
    const storedSecondScenario = {
      ...secondScenario,
      schedule: [{ sequence: 1 }],
      chartSeries: { balanceOverTime: [] },
      summary: { totalPaid: 1 }
    };
    storage.setItem(
      SCENARIO_STORAGE_KEY,
      JSON.stringify({
        schemaVersion: 1,
        activeScenarioId: secondScenario.id,
        scenarios: [firstScenario, storedSecondScenario]
      })
    );

    const store = useScenarioStore({
      repository: createLocalStorageRepository(storage, fixedNow),
      now: fixedNow,
      idFactory,
      debounceMs: 1000
    });

    expect(store.state.scenarios).toHaveLength(2);
    expect(store.activeScenario.value.name).toBe('Saved comparison');
    expect(store.activeScenario.value.principalAmount).toBe(325_000);

    store.updateScenario({ principalAmount: 350_000 });
    store.flushPendingPersistence();

    const rawSaved = storage.getItem(SCENARIO_STORAGE_KEY) ?? '';
    expect(rawSaved).not.toContain('schedule');
    expect(rawSaved).not.toContain('chartSeries');
    expect(rawSaved).not.toContain('summary');

    const saved = JSON.parse(rawSaved) as StoredScenarioState;
    expect(saved.scenarios.find((scenario) => scenario.id === secondScenario.id)?.principalAmount).toBe(
      350_000
    );
  });

  it('backs up corrupt storage and resets to a default scenario', () => {
    const storage = new MemoryStorage();
    storage.setItem(SCENARIO_STORAGE_KEY, '{not valid json');

    const store = useScenarioStore({
      repository: createLocalStorageRepository(storage, fixedNow),
      now: fixedNow,
      idFactory: createSequentialIdFactory(),
      debounceMs: 1000
    });

    expect(store.state.scenarios).toHaveLength(1);
    expect(store.activeScenario.value.name).toBe('Scenario 1');

    const backupKey = [...storage.values.keys()].find((key) =>
      key.startsWith(INVALID_BACKUP_KEY_PREFIX)
    );
    expect(backupKey).toBe(`${INVALID_BACKUP_KEY_PREFIX}${fixedNow().toISOString()}`);
    expect(storage.getItem(backupKey ?? '')).toBe('{not valid json');

    store.flushPendingPersistence();
    const saved = JSON.parse(storage.getItem(SCENARIO_STORAGE_KEY) ?? '') as StoredScenarioState;
    expect(saved.schemaVersion).toBe(1);
    expect(saved.scenarios).toHaveLength(1);
  });

  it('backs up persisted scenarios with dates after 2100 and resets safely', () => {
    const storage = new MemoryStorage();
    const scenario = createDefaultScenario(fixedNow, createSequentialIdFactory());
    scenario.startDate = '27344-01-01';
    scenario.initialTerm.startDate = scenario.startDate;
    storage.setItem(SCENARIO_STORAGE_KEY, JSON.stringify({
      schemaVersion: 1,
      activeScenarioId: scenario.id,
      scenarios: [scenario]
    }));

    const store = useScenarioStore({
      repository: createLocalStorageRepository(storage, fixedNow),
      now: fixedNow,
      idFactory: createSequentialIdFactory(),
      debounceMs: 1000
    });

    expect(store.activeScenario.value.startDate).toBe('2026-01-10');
    expect([...storage.values.keys()].some((key) => key.startsWith(INVALID_BACKUP_KEY_PREFIX))).toBe(true);
    expect(() => store.projection.value).not.toThrow();
  });

  it('caps keyboard-entered dates at the end of 2100', () => {
    const store = useScenarioStore({
      repository: createLocalStorageRepository(new MemoryStorage(), fixedNow),
      now: fixedNow,
      idFactory: createSequentialIdFactory(),
      debounceMs: 1000
    });

    store.updateScenario({ startDate: '9999-01-01' });

    expect(store.activeScenario.value.startDate).toBe('2100-12-31');
    expect(store.activeScenario.value.initialTerm.startDate).toBe('2100-12-31');
    expect(() => store.projection.value).not.toThrow();
  });

  it('keeps renewals valid when the start date reaches the supported ceiling', () => {
    const store = useScenarioStore({
      repository: createLocalStorageRepository(new MemoryStorage(), fixedNow),
      now: fixedNow,
      idFactory: createSequentialIdFactory(),
      debounceMs: 1000
    });
    store.addRenewal();
    store.addRenewal();

    store.updateScenario({ startDate: '2100-12-31' });

    expect(store.activeScenario.value.renewals.map((renewal) => renewal.effectiveDate)).toEqual([
      '2100-12-31'
    ]);
    expect(() => store.projection.value).not.toThrow();
  });

  it('keeps renewal dates ordered and unique when the mortgage start date advances', () => {
    const store = useScenarioStore({
      repository: createLocalStorageRepository(new MemoryStorage(), fixedNow),
      now: fixedNow,
      idFactory: createSequentialIdFactory(),
      debounceMs: 1000
    });

    store.addRenewal();
    store.addRenewal();
    store.updateScenario({ startDate: '2040-01-01' });

    const renewalDates = store.activeScenario.value.renewals.map(
      (renewal) => renewal.effectiveDate
    );
    expect(renewalDates).toEqual(['2040-01-01', '2040-01-02']);
    expect(new Set(renewalDates).size).toBe(renewalDates.length);
    expect(() => store.projection.value).not.toThrow();
  });
});
