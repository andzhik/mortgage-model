<script setup lang="ts">
import {
  CategoryScale,
  Chart as ChartJS,
  Filler,
  Legend,
  LineElement,
  LinearScale,
  PointElement,
  Tooltip
} from 'chart.js';
import { computed } from 'vue';
import { Line } from 'vue-chartjs';
import { formatMoney } from '../app/formatters';
import { prepareBalanceChart } from '../domain/chartData';
import type { ProjectionChartSeries } from '../domain/mortgageTypes';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Filler, Tooltip, Legend);

const props = defineProps<{
  chartSeries: ProjectionChartSeries;
}>();

const preparedChart = computed(() => prepareBalanceChart(props.chartSeries));
const firstPoint = computed(() => props.chartSeries.balanceOverTime[0]);
const lastPoint = computed(() => props.chartSeries.balanceOverTime.at(-1));
const pointLabel = computed(() =>
  preparedChart.value.granularity === 'payment'
    ? `${preparedChart.value.sourcePointCount} payments`
    : `${preparedChart.value.data.labels?.length ?? 0} ${preparedChart.value.granularity}s`
);
const termBandGridTemplate = computed(
  () => `repeat(${Math.max(1, preparedChart.value.termBands.length)}, minmax(0, 1fr))`
);
</script>

<template>
  <section class="panel chart-panel" aria-labelledby="balance-chart-heading">
    <div class="panel-heading">
      <h2 id="balance-chart-heading">Balance over time</h2>
      <span class="status-pill">{{ pointLabel }}</span>
    </div>

    <div
      v-if="preparedChart.termBands.length > 0"
      class="term-band-strip"
      :style="{ gridTemplateColumns: termBandGridTemplate }"
      aria-label="Mortgage term bands"
    >
      <span
        v-for="termBand in preparedChart.termBands"
        :key="`${termBand.label}-${termBand.startDate}`"
        class="term-band-segment"
      >
        {{ termBand.label }} {{ termBand.startDate }} to {{ termBand.endDate }}
      </span>
    </div>

    <div
      class="chart-canvas-wrap"
      role="img"
      :aria-label="
        firstPoint && lastPoint
          ? `Balance projection from ${firstPoint.date} ${formatMoney(firstPoint.balance)} to ${lastPoint.date} ${formatMoney(lastPoint.balance)}.`
          : 'Balance projection chart.'
      "
    >
      <Line :data="preparedChart.data" :options="preparedChart.options" />
    </div>
  </section>
</template>
