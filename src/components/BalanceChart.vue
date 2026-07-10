<script setup lang="ts">
import { computed } from 'vue';
import { formatMoney } from '../app/formatters';
import type { ProjectionChartSeries } from '../domain/mortgageTypes';

const props = defineProps<{
  series: ProjectionChartSeries['balanceOverTime'];
}>();

const firstPoint = computed(() => props.series[0]);
const lastPoint = computed(() => props.series.at(-1));
</script>

<template>
  <section class="panel chart-panel" aria-labelledby="balance-chart-heading">
    <div class="panel-heading">
      <h2 id="balance-chart-heading">Balance over time</h2>
      <span class="status-pill">{{ series.length }} points</span>
    </div>

    <div class="chart-placeholder" role="img" aria-label="Balance projection preview">
      <div class="chart-line chart-line-balance"></div>
      <span v-if="firstPoint && lastPoint">
        {{ firstPoint.date }} balance {{ formatMoney(firstPoint.balance) }} to
        {{ lastPoint.date }} balance {{ formatMoney(lastPoint.balance) }}.
      </span>
    </div>
  </section>
</template>
