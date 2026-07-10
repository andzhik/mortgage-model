const CENTS_PER_DOLLAR = 100;

export function roundMoney(value: number): number {
  if (!Number.isFinite(value)) {
    throw new Error('Money value must be finite.');
  }

  const roundedCents = Math.round((Math.abs(value) + Number.EPSILON) * CENTS_PER_DOLLAR);

  if (roundedCents === 0) {
    return 0;
  }

  return (Math.sign(value) || 1) * (roundedCents / CENTS_PER_DOLLAR);
}

export function isCentLevelZero(value: number): boolean {
  return Math.abs(value) < 0.005;
}

export function clampCentLevelBalance(value: number): number {
  return isCentLevelZero(value) ? 0 : roundMoney(value);
}
