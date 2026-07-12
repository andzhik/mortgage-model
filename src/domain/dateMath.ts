import type { PaymentFrequency } from './mortgageTypes';

const ISO_DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
export const MAX_SUPPORTED_DATE = '2100-12-31';

export function isSupportedIsoDate(value: string): boolean {
  try {
    parseIsoDate(value);
    return value <= MAX_SUPPORTED_DATE;
  } catch {
    return false;
  }
}

export function clampToSupportedDate(value: string): string | null {
  try {
    parseIsoDate(value);
    return value > MAX_SUPPORTED_DATE ? MAX_SUPPORTED_DATE : value;
  } catch {
    return null;
  }
}

export function parseIsoDate(value: string): Date {
  const match = ISO_DATE_PATTERN.exec(value);

  if (!match) {
    throw new Error(`Invalid ISO date: ${value}`);
  }

  const [, yearText, monthText, dayText] = match;
  const year = Number(yearText);
  const monthIndex = Number(monthText) - 1;
  const day = Number(dayText);
  const date = new Date(Date.UTC(year, monthIndex, day));

  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== monthIndex ||
    date.getUTCDate() !== day
  ) {
    throw new Error(`Invalid ISO date: ${value}`);
  }

  return date;
}

export function formatIsoDate(date: Date): string {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
}

export function compareIsoDates(left: string, right: string): number {
  return parseIsoDate(left).getTime() - parseIsoDate(right).getTime();
}

export function addDays(date: string, days: number): string {
  const parsed = parseIsoDate(date);
  parsed.setUTCDate(parsed.getUTCDate() + days);

  return formatIsoDate(parsed);
}

export function addMonths(date: string, months: number): string {
  const parsed = parseIsoDate(date);
  const year = parsed.getUTCFullYear();
  const monthIndex = parsed.getUTCMonth();
  const day = parsed.getUTCDate();
  const targetMonthIndex = monthIndex + months;
  const targetYear = year + Math.floor(targetMonthIndex / 12);
  const normalizedMonthIndex = ((targetMonthIndex % 12) + 12) % 12;
  const clampedDay = Math.min(day, getDaysInMonth(targetYear, normalizedMonthIndex));

  return formatIsoDate(new Date(Date.UTC(targetYear, normalizedMonthIndex, clampedDay)));
}

export function getFirstPaymentDate(startDate: string, frequency: PaymentFrequency): string {
  if (frequency !== 'semi-monthly') {
    return parseAndReturn(startDate);
  }

  return getNextSemiMonthlyDateOnOrAfter(startDate);
}

export function getNextPaymentDate(paymentDate: string, frequency: PaymentFrequency): string {
  switch (frequency) {
    case 'weekly':
      return addDays(paymentDate, 7);
    case 'bi-weekly':
      return addDays(paymentDate, 14);
    case 'semi-monthly':
      return getNextSemiMonthlyDateAfter(paymentDate);
    case 'monthly':
      return addMonths(paymentDate, 1);
  }
}

export function generatePaymentDates(
  startDate: string,
  frequency: PaymentFrequency,
  count: number
): string[] {
  if (!Number.isInteger(count) || count < 0) {
    throw new Error('Payment date count must be a non-negative integer.');
  }

  const dates: string[] = [];
  let nextDate = getFirstPaymentDate(startDate, frequency);

  for (let index = 0; index < count; index += 1) {
    dates.push(nextDate);
    nextDate = getNextPaymentDate(nextDate, frequency);
  }

  return dates;
}

function parseAndReturn(date: string): string {
  parseIsoDate(date);
  return date;
}

function getDaysInMonth(year: number, monthIndex: number): number {
  return new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate();
}

function getNextSemiMonthlyDateOnOrAfter(date: string): string {
  const parsed = parseIsoDate(date);
  const year = parsed.getUTCFullYear();
  const monthIndex = parsed.getUTCMonth();
  const day = parsed.getUTCDate();

  if (day === 1 || day === 15) {
    return date;
  }

  if (day < 15) {
    return formatIsoDate(new Date(Date.UTC(year, monthIndex, 15)));
  }

  return formatIsoDate(new Date(Date.UTC(year, monthIndex + 1, 1)));
}

function getNextSemiMonthlyDateAfter(date: string): string {
  const parsed = parseIsoDate(date);
  const year = parsed.getUTCFullYear();
  const monthIndex = parsed.getUTCMonth();
  const day = parsed.getUTCDate();

  if (day < 15) {
    return formatIsoDate(new Date(Date.UTC(year, monthIndex, 15)));
  }

  return formatIsoDate(new Date(Date.UTC(year, monthIndex + 1, 1)));
}
