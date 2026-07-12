type MortgagePerformanceApi = {
  enable(): void;
  disable(): void;
  readonly enabled: boolean;
};

declare global {
  interface Window {
    __mortgagePerformance?: MortgagePerformanceApi;
  }
}

let enabled = false;
let pendingUiUpdateStartedAt: number | undefined;

export function measureMortgageWork<T>(label: string, work: () => T): T {
  if (!enabled) {
    return work();
  }

  const startedAt = performance.now();

  try {
    return work();
  } finally {
    console.log(`[mortgage performance] ${label}: ${(performance.now() - startedAt).toFixed(2)} ms`);
  }
}

export function beginMortgageUiUpdate(): void {
  if (enabled && pendingUiUpdateStartedAt === undefined) {
    pendingUiUpdateStartedAt = performance.now();
  }
}

export function finishMortgageUiUpdateAfterPaint(): void {
  if (!enabled || pendingUiUpdateStartedAt === undefined) {
    return;
  }

  const startedAt = pendingUiUpdateStartedAt;
  pendingUiUpdateStartedAt = undefined;

  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      console.log(
        `[mortgage performance] scenario mutation → next paint: ${(performance.now() - startedAt).toFixed(2)} ms`
      );
    });
  });
}

if (typeof window !== 'undefined') {
  const api: MortgagePerformanceApi = {
    enable() {
      enabled = true;
      console.info(
        '[mortgage performance] enabled; change an input to record projection, chart, render, and next-paint timings.'
      );
    },
    disable() {
      enabled = false;
      pendingUiUpdateStartedAt = undefined;
      console.info('[mortgage performance] disabled.');
    },
    get enabled() {
      return enabled;
    }
  };

  window.__mortgagePerformance = api;
}

