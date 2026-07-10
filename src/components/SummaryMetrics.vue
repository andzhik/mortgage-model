<script setup lang="ts">
import { computed } from 'vue';
import { formatDate, formatMoney } from '../app/formatters';
import type { ProjectionSummary } from '../domain/mortgageTypes';

const props = defineProps<{
  summary: ProjectionSummary;
}>();

const metrics = computed(() => [
  { label: 'Regular payment', value: formatMoney(props.summary.regularPaymentAmount) },
  {
    label: 'Next interest',
    value: formatMoney(props.summary.nextPaymentInterestPortion)
  },
  {
    label: 'Next principal',
    value: formatMoney(props.summary.nextPaymentPrincipalPortion)
  },
  { label: 'Payoff date', value: formatDate(props.summary.finalPaymentDate) },
  { label: 'Total interest', value: formatMoney(props.summary.totalInterestPaid) },
  { label: 'Total principal', value: formatMoney(props.summary.totalPrincipalPaid) },
  { label: 'Total lump sums', value: formatMoney(props.summary.totalLumpSumsPaid) },
  { label: 'Total paid', value: formatMoney(props.summary.totalPaid) }
]);
</script>

<template>
  <section class="panel" aria-labelledby="summary-heading">
    <div class="panel-heading">
      <h2 id="summary-heading">Summary metrics</h2>
      <span class="status-pill">Projected</span>
    </div>

    <dl class="metric-grid">
      <div v-for="metric in metrics" :key="metric.label" class="metric">
        <dt>{{ metric.label }}</dt>
        <dd>{{ metric.value }}</dd>
      </div>
    </dl>
  </section>
</template>
