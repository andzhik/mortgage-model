<script setup lang="ts">
import { computed } from 'vue';
import { formatMoney } from '../app/formatters';
import type { ProjectionChartSeries } from '../domain/mortgageTypes';

const props = defineProps<{
  series: ProjectionChartSeries['paymentBreakdown'];
}>();

const firstPoint = computed(() => props.series[0]);
</script>

<template>
  <section class="panel chart-panel" aria-labelledby="breakdown-chart-heading">
    <div class="panel-heading">
      <h2 id="breakdown-chart-heading">Payment breakdown</h2>
      <span class="status-pill">Projected</span>
    </div>

    <div class="chart-placeholder bar-placeholder" role="img" aria-label="Payment breakdown preview">
      <div class="bar-set" aria-hidden="true">
        <span class="bar interest"></span>
        <span class="bar principal"></span>
        <span class="bar lump-sum"></span>
      </div>
      <span v-if="firstPoint">
        First payment:
        {{ formatMoney(firstPoint.scheduledInterestPaid) }} interest,
        {{ formatMoney(firstPoint.scheduledPrincipalPaid) }} principal,
        {{ formatMoney(firstPoint.lumpSumPayment) }} lump sum.
      </span>
    </div>
  </section>
</template>
