import type { ChartData, ChartOptions } from 'chart.js';
import type { ProjectionChartSeries } from './mortgageTypes';

export type ChartGranularity = 'payment' | 'month' | 'year';

export type PreparedBalanceChart = {
  data: ChartData<'line', (number | null)[], string>;
  options: ChartOptions<'line'>;
  granularity: ChartGranularity;
  sourcePointCount: number;
  lumpSumMarkerCount: number;
  renewalMarkerCount: number;
  termBands: ProjectionChartSeries['termBands'];
};

export type PreparedPaymentBreakdownChart = {
  data: ChartData<'bar', number[], string>;
  options: ChartOptions<'bar'>;
  granularity: ChartGranularity;
  sourcePointCount: number;
};

export const CHART_COLORS = {
  balance: '#276a73',
  renewal: '#6b4fb3',
  interest: '#9f4a54',
  principal: '#2f6f75',
  lumpSum: '#b88a2e'
} as const;

export function prepareBalanceChart(
  chartSeries: ProjectionChartSeries,
  granularity: ChartGranularity = chooseChartGranularity(chartSeries.balanceOverTime.length)
): PreparedBalanceChart {
  const buckets = createBalanceBuckets(chartSeries, granularity);
  const labels = buckets.map((bucket) => bucket.label);
  const balances = buckets.map((bucket) => bucket.balance);
  const lumpSumMarkers = buckets.map((bucket) =>
    bucket.lumpSumPayment > 0 ? bucket.balance : null
  );
  const renewalMarkers = buckets.map((bucket) =>
    bucket.renewalLabels.length > 0 ? bucket.balance : null
  );

  return {
    data: {
      labels,
      datasets: [
        {
          label: 'Remaining balance',
          data: balances,
          borderColor: CHART_COLORS.balance,
          backgroundColor: withAlpha(CHART_COLORS.balance, 0.12),
          borderWidth: 2,
          pointRadius: labels.length > 160 ? 0 : 2,
          pointHoverRadius: 5,
          tension: 0.18,
          fill: true
        },
        {
          label: 'Lump-sum payments',
          data: lumpSumMarkers,
          borderColor: CHART_COLORS.lumpSum,
          backgroundColor: CHART_COLORS.lumpSum,
          borderWidth: 0,
          pointRadius: 5,
          pointHoverRadius: 7,
          showLine: false
        },
        {
          label: 'Renewals',
          data: renewalMarkers,
          borderColor: CHART_COLORS.renewal,
          backgroundColor: CHART_COLORS.renewal,
          borderWidth: 0,
          pointStyle: 'triangle',
          pointRadius: 6,
          pointHoverRadius: 8,
          showLine: false
        }
      ]
    },
    options: createLineOptions(),
    granularity,
    sourcePointCount: chartSeries.balanceOverTime.length,
    lumpSumMarkerCount: buckets.filter((bucket) => bucket.lumpSumPayment > 0).length,
    renewalMarkerCount: buckets.filter((bucket) => bucket.renewalLabels.length > 0).length,
    termBands: chartSeries.termBands
  };
}

export function preparePaymentBreakdownChart(
  chartSeries: ProjectionChartSeries,
  granularity: ChartGranularity = chooseChartGranularity(chartSeries.paymentBreakdown.length)
): PreparedPaymentBreakdownChart {
  const buckets = createPaymentBuckets(chartSeries, granularity);

  return {
    data: {
      labels: buckets.map((bucket) => bucket.label),
      datasets: [
        {
          label: 'Scheduled interest',
          data: buckets.map((bucket) => roundChartValue(bucket.scheduledInterestPaid)),
          backgroundColor: CHART_COLORS.interest,
          borderColor: CHART_COLORS.interest,
          borderWidth: 1,
          stack: 'payments'
        },
        {
          label: 'Scheduled principal',
          data: buckets.map((bucket) => roundChartValue(bucket.scheduledPrincipalPaid)),
          backgroundColor: CHART_COLORS.principal,
          borderColor: CHART_COLORS.principal,
          borderWidth: 1,
          stack: 'payments'
        },
        {
          label: 'Lump sums',
          data: buckets.map((bucket) => roundChartValue(bucket.lumpSumPayment)),
          backgroundColor: CHART_COLORS.lumpSum,
          borderColor: CHART_COLORS.lumpSum,
          borderWidth: 1,
          stack: 'payments'
        }
      ]
    },
    options: createBarOptions(),
    granularity,
    sourcePointCount: chartSeries.paymentBreakdown.length
  };
}

export function chooseChartGranularity(pointCount: number): ChartGranularity {
  if (pointCount > 900) {
    return 'year';
  }

  if (pointCount > 180) {
    return 'month';
  }

  return 'payment';
}

type BalanceBucket = {
  label: string;
  lastDate: string;
  balance: number;
  lumpSumPayment: number;
  renewalLabels: string[];
};

type PaymentBucket = {
  label: string;
  scheduledInterestPaid: number;
  scheduledPrincipalPaid: number;
  lumpSumPayment: number;
};

function createBalanceBuckets(
  chartSeries: ProjectionChartSeries,
  granularity: ChartGranularity
): BalanceBucket[] {
  const bucketMap = new Map<string, BalanceBucket>();

  for (const point of chartSeries.balanceOverTime) {
    const label = toBucketLabel(point.date, granularity);
    const existing = bucketMap.get(label);

    if (existing) {
      existing.lastDate = point.date;
      existing.balance = point.balance;
    } else {
      bucketMap.set(label, {
        label,
        lastDate: point.date,
        balance: point.balance,
        lumpSumPayment: 0,
        renewalLabels: []
      });
    }
  }

  for (const point of chartSeries.paymentBreakdown) {
    const label = toBucketLabel(point.date, granularity);
    const bucket = bucketMap.get(label);

    if (bucket) {
      bucket.lumpSumPayment += point.lumpSumPayment;
    }
  }

  for (const marker of chartSeries.renewalMarkers) {
    const label = toBucketLabel(marker.date, granularity);
    const bucket =
      bucketMap.get(label) ??
      [...bucketMap.values()].find((candidate) => candidate.lastDate >= marker.date);

    if (bucket) {
      bucket.renewalLabels.push(marker.label);
    }
  }

  return [...bucketMap.values()].map((bucket) => ({
    ...bucket,
    balance: roundChartValue(bucket.balance),
    lumpSumPayment: roundChartValue(bucket.lumpSumPayment)
  }));
}

function createPaymentBuckets(
  chartSeries: ProjectionChartSeries,
  granularity: ChartGranularity
): PaymentBucket[] {
  const bucketMap = new Map<string, PaymentBucket>();

  for (const point of chartSeries.paymentBreakdown) {
    const label = toBucketLabel(point.date, granularity);
    const existing = bucketMap.get(label);

    if (existing) {
      existing.scheduledInterestPaid += point.scheduledInterestPaid;
      existing.scheduledPrincipalPaid += point.scheduledPrincipalPaid;
      existing.lumpSumPayment += point.lumpSumPayment;
    } else {
      bucketMap.set(label, {
        label,
        scheduledInterestPaid: point.scheduledInterestPaid,
        scheduledPrincipalPaid: point.scheduledPrincipalPaid,
        lumpSumPayment: point.lumpSumPayment
      });
    }
  }

  return [...bucketMap.values()];
}

function createLineOptions(): ChartOptions<'line'> {
  return {
    responsive: true,
    maintainAspectRatio: false,
    interaction: {
      mode: 'index',
      intersect: false
    },
    plugins: {
      legend: {
        position: 'bottom'
      },
      tooltip: {
        callbacks: {
          label: (context) => `${context.dataset.label}: ${formatChartMoney(context.parsed.y)}`
        }
      }
    },
    scales: {
      x: {
        ticks: {
          maxRotation: 0,
          autoSkip: true
        },
        grid: {
          display: false
        }
      },
      y: {
        beginAtZero: true,
        ticks: {
          callback: (value) => formatCompactMoney(Number(value))
        }
      }
    }
  };
}

function createBarOptions(): ChartOptions<'bar'> {
  return {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'bottom'
      },
      tooltip: {
        callbacks: {
          label: (context) => `${context.dataset.label}: ${formatChartMoney(context.parsed.y)}`
        }
      }
    },
    scales: {
      x: {
        stacked: true,
        ticks: {
          maxRotation: 0,
          autoSkip: true
        },
        grid: {
          display: false
        }
      },
      y: {
        stacked: true,
        beginAtZero: true,
        ticks: {
          callback: (value) => formatCompactMoney(Number(value))
        }
      }
    }
  };
}

function toBucketLabel(date: string, granularity: ChartGranularity): string {
  if (granularity === 'year') {
    return date.slice(0, 4);
  }

  if (granularity === 'month') {
    return date.slice(0, 7);
  }

  return date;
}

function roundChartValue(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function formatChartMoney(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return '$0.00';
  }

  return new Intl.NumberFormat('en-CA', {
    style: 'currency',
    currency: 'CAD',
    maximumFractionDigits: 2
  }).format(value);
}

function formatCompactMoney(value: number): string {
  return new Intl.NumberFormat('en-CA', {
    style: 'currency',
    currency: 'CAD',
    notation: 'compact',
    maximumFractionDigits: 1
  }).format(value);
}

function withAlpha(hexColor: string, alpha: number): string {
  const red = Number.parseInt(hexColor.slice(1, 3), 16);
  const green = Number.parseInt(hexColor.slice(3, 5), 16);
  const blue = Number.parseInt(hexColor.slice(5, 7), 16);

  return `rgb(${red} ${green} ${blue} / ${alpha})`;
}
