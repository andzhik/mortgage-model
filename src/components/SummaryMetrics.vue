<script setup lang="ts">
const metrics = [
  { label: 'Regular payment', value: '$0.00' },
  { label: 'Next interest', value: '$0.00' },
  { label: 'Next principal', value: '$0.00' },
  { label: 'Payoff date', value: 'Not calculated' },
  { label: 'Total interest', value: '$0.00' },
  { label: 'Total principal', value: '$0.00' },
  { label: 'Total paid', value: '$0.00' },
  { label: 'End of term balance', value: '$0.00' }
];
</script>

<template>
  <section class="panel" aria-labelledby="summary-heading">
    <div class="panel-heading">
      <h2 id="summary-heading">Summary metrics</h2>
      <span class="status-pill">Placeholder</span>
    </div>

    <dl class="metric-grid">
      <div v-for="metric in metrics" :key="metric.label" class="metric">
        <dt>{{ metric.label }}</dt>
        <dd>{{ metric.value }}</dd>
      </div>
    </dl>
  </section>
</template>
