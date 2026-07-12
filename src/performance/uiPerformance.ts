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

function logMortgageDuration(label: string, startedAt: number, finishedAt: number): void {
  console.log(`[mortgage performance] ${label}: ${(finishedAt - startedAt).toFixed(2)} ms`);
}

export function measureMortgageWork<T>(label: string, work: () => T): T {
  if (!enabled) {
    return work();
  }

  const startedAt = performance.now();

  try {
    return work();
  } finally {
    logMortgageDuration(label, startedAt, performance.now());
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
  const vueUpdatedAt = performance.now();

  logMortgageDuration('scenario mutation → Vue updated hook', startedAt, vueUpdatedAt);

  requestAnimationFrame(() => {
    const firstAnimationFrameAt = performance.now();
    logMortgageDuration(
      'Vue updated hook → first animation frame',
      vueUpdatedAt,
      firstAnimationFrameAt
    );

    requestAnimationFrame(() => {
      const nextPaintAt = performance.now();
      logMortgageDuration('first → second animation frame', firstAnimationFrameAt, nextPaintAt);
      logMortgageDuration('scenario mutation → next paint', startedAt, nextPaintAt);
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
