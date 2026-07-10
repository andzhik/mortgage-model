import { describe, expect, it } from 'vitest';
import { clampCentLevelBalance, isCentLevelZero, roundMoney } from '../src/domain/money';

describe('money utilities', () => {
  it('rounds money values to cents', () => {
    expect(roundMoney(10.004)).toBe(10);
    expect(roundMoney(10.005)).toBe(10.01);
    expect(roundMoney(-10.005)).toBe(-10.01);
    expect(Object.is(roundMoney(-0.004), -0)).toBe(false);
  });

  it('can clamp cent-level cleanup balances to zero', () => {
    expect(isCentLevelZero(0.004)).toBe(true);
    expect(isCentLevelZero(0.006)).toBe(false);
    expect(clampCentLevelBalance(-0.004)).toBe(0);
    expect(clampCentLevelBalance(12.345)).toBe(12.35);
  });
});
