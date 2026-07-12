import { afterEach, describe, expect, it, vi } from 'vitest';

describe('mortgage UI performance measurements', () => {
  afterEach(() => {
    window.__mortgagePerformance?.disable();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    vi.resetModules();
  });

  it('breaks the next-paint total into Vue update and animation-frame phases', async () => {
    const animationFrameCallbacks: FrameRequestCallback[] = [];
    const now = vi
      .spyOn(performance, 'now')
      .mockReturnValueOnce(100)
      .mockReturnValueOnce(430)
      .mockReturnValueOnce(610)
      .mockReturnValueOnce(653.3);
    const log = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    vi.spyOn(console, 'info').mockImplementation(() => undefined);
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
      animationFrameCallbacks.push(callback);
      return animationFrameCallbacks.length;
    });

    const { beginMortgageUiUpdate, finishMortgageUiUpdateAfterPaint } = await import(
      '../src/performance/uiPerformance'
    );
    window.__mortgagePerformance?.enable();

    beginMortgageUiUpdate();
    finishMortgageUiUpdateAfterPaint();
    animationFrameCallbacks.shift()?.(0);
    animationFrameCallbacks.shift()?.(0);

    expect(now).toHaveBeenCalledTimes(4);
    expect(log.mock.calls.map(([message]) => message)).toEqual([
      '[mortgage performance] scenario mutation → Vue updated hook: 330.00 ms',
      '[mortgage performance] Vue updated hook → first animation frame: 180.00 ms',
      '[mortgage performance] first → second animation frame: 43.30 ms',
      '[mortgage performance] scenario mutation → next paint: 553.30 ms'
    ]);
  });
});
