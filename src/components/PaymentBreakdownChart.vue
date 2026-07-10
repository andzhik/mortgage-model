<script setup lang="ts">
import {
  BarElement,
  CategoryScale,
  Chart as ChartJS,
  Legend,
  LinearScale,
  Tooltip
} from 'chart.js';
import { computed } from 'vue';
import { Bar } from 'vue-chartjs';
import { formatMoney } from '../app/formatters';
import { preparePaymentBreakdownChart } from '../domain/chartData';
import type { ProjectionChartSeries } from '../domain/mortgageTypes';

ChartJS.register(CategoryScale, LinearScale, BarElement, Tooltip, Legend);

const props = defineProps<{
  chartSeries: ProjectionChartSeries;
}>();

const preparedChart = computed(() => preparePaymentBreakdownChart(props.chartSeries));
const firstPoint = computed(() => props.chartSeries.paymentBreakdown[0]);
const pointLabel = computed(() =>
  preparedChart.value.granularity === 'payment'
    ? `${preparedChart.value.sourcePointCount} payments`
    : `${preparedChart.value.data.labels?.length ?? 0} ${preparedChart.value.granularity}s`
);
</script>

<template>
  <section class="panel chart-panel" aria-labelledby="breakdown-chart-heading">
    <div class="panel-heading">
      <h2 id="breakdown-chart-heading">Payment breakdown</h2>
      <span class="status-pill">{{ pointLabel }}</span>
    </div>

    <div
      class="chart-canvas-wrap"
      role="img"
      :aria-label="
        firstPoint
          ? `Payment breakdown starts with ${formatMoney(firstPoint.scheduledInterestPaid)} interest, ${formatMoney(firstPoint.scheduledPrincipalPaid)} principal, and ${formatMoney(firstPoint.lumpSumPayment)} lump sum.`
          : 'Payment breakdown chart.'
      "
    >
      <Bar :data="preparedChart.data" :options="preparedChart.options" />
    </div>
  </section>
</template>
