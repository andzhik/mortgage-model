<script setup lang="ts">
import { computed } from 'vue';
import type { MortgageScenario, PaymentFrequency } from '../domain/mortgageTypes';
import { PAYMENT_FREQUENCY_METADATA } from '../domain/paymentFrequency';

export type MortgageInputUpdate = Partial<{
  principalAmount: number;
  startDate: string;
  amortizationMonths: number;
  termMonths: number;
  annualInterestRate: number;
  paymentFrequency: PaymentFrequency;
}>;

const props = defineProps<{
  scenario: MortgageScenario;
}>();

const emit = defineEmits<{
  'update-scenario': [update: MortgageInputUpdate];
}>();

const amortizationYears = computed(() => Math.floor(props.scenario.amortizationMonths / 12));
const amortizationExtraMonths = computed(() => props.scenario.amortizationMonths % 12);
const termYears = computed(() => Math.floor(props.scenario.initialTerm.termMonths / 12));
const termExtraMonths = computed(() => props.scenario.initialTerm.termMonths % 12);
const annualInterestRatePercent = computed(() => props.scenario.initialTerm.annualInterestRate * 100);

const frequencies = Object.values(PAYMENT_FREQUENCY_METADATA);

function toNumber(event: Event): number {
  const value = Number((event.target as HTMLInputElement).value);
  return Number.isFinite(value) ? value : 0;
}

function toText(event: Event): string {
  return (event.target as HTMLInputElement).value;
}

function updateStartDate(event: Event): void {
  const startDate = toText(event);

  if (startDate) {
    emit('update-scenario', { startDate });
  }
}

function updateAmortization(years: number, months: number): void {
  emit('update-scenario', {
    amortizationMonths: Math.max(1, years * 12 + months)
  });
}

function updateTerm(years: number, months: number): void {
  emit('update-scenario', {
    termMonths: Math.max(1, years * 12 + months)
  });
}
</script>

<template>
  <section class="panel editor-section" aria-labelledby="mortgage-inputs-heading">
    <div class="panel-heading">
      <h2 id="mortgage-inputs-heading">Mortgage inputs</h2>
      <span class="status-pill">Live</span>
    </div>

    <form class="input-grid" @submit.prevent>
      <label>
        Mortgage amount
        <input
          aria-label="Mortgage amount"
          type="number"
          :value="scenario.principalAmount"
          min="1"
          step="1000"
          @input="emit('update-scenario', { principalAmount: Math.max(1, toNumber($event)) })"
        />
      </label>
      <label>
        Start date
        <input
          aria-label="Start date"
          type="date"
          :value="scenario.startDate"
          @input="updateStartDate"
        />
      </label>
      <label>
        Amortization years
        <input
          aria-label="Amortization years"
          type="number"
          :value="amortizationYears"
          min="0"
          step="1"
          @input="updateAmortization(Math.max(0, toNumber($event)), amortizationExtraMonths)"
        />
      </label>
      <label>
        Amortization months
        <input
          aria-label="Amortization months"
          type="number"
          :value="amortizationExtraMonths"
          min="0"
          max="11"
          step="1"
          @input="updateAmortization(amortizationYears, Math.min(11, Math.max(0, toNumber($event))))"
        />
      </label>
      <label>
        Term years
        <input
          aria-label="Term years"
          type="number"
          :value="termYears"
          min="0"
          step="1"
          @input="updateTerm(Math.max(0, toNumber($event)), termExtraMonths)"
        />
      </label>
      <label>
        Term months
        <input
          aria-label="Term months"
          type="number"
          :value="termExtraMonths"
          min="0"
          max="11"
          step="1"
          @input="updateTerm(termYears, Math.min(11, Math.max(0, toNumber($event))))"
        />
      </label>
      <label>
        Annual interest rate
        <input
          aria-label="Annual interest rate"
          type="number"
          :value="annualInterestRatePercent"
          min="0"
          step="0.01"
          @input="emit('update-scenario', { annualInterestRate: Math.max(0, toNumber($event)) / 100 })"
        />
      </label>
      <label>
        Payment frequency
        <select
          aria-label="Payment frequency"
          :value="scenario.paymentFrequency"
          @change="emit('update-scenario', { paymentFrequency: toText($event) as PaymentFrequency })"
        >
          <option
            v-for="frequency in frequencies"
            :key="frequency.frequency"
            :value="frequency.frequency"
          >
            {{ frequency.label }}
          </option>
        </select>
      </label>
    </form>
  </section>
</template>
