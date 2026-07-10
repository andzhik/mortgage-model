<script setup lang="ts">
import {
  createColumnHelper,
  FlexRender,
  getCoreRowModel,
  useVueTable
} from '@tanstack/vue-table';
import { formatMoney, formatPercent } from '../app/formatters';
import type { PaymentScheduleRow } from '../domain/mortgageTypes';

const props = defineProps<{
  rows: PaymentScheduleRow[];
}>();

const columnHelper = createColumnHelper<PaymentScheduleRow>();

const columns = [
  columnHelper.accessor('sequence', { header: '#' }),
  columnHelper.accessor('date', { header: 'Date' }),
  columnHelper.accessor('openingBalance', {
    header: 'Opening balance',
    cell: (info) => formatMoney(info.getValue())
  }),
  columnHelper.accessor('scheduledPayment', {
    header: 'Scheduled payment',
    cell: (info) => formatMoney(info.getValue())
  }),
  columnHelper.accessor('scheduledInterestPaid', {
    header: 'Interest portion',
    cell: (info) => formatMoney(info.getValue())
  }),
  columnHelper.accessor('scheduledPrincipalPaid', {
    header: 'Principal portion',
    cell: (info) => formatMoney(info.getValue())
  }),
  columnHelper.accessor('lumpSumPayment', {
    header: 'Lump sum',
    cell: (info) => formatMoney(info.getValue())
  }),
  columnHelper.accessor('totalPayment', {
    header: 'Total payment',
    cell: (info) => formatMoney(info.getValue())
  }),
  columnHelper.accessor('totalPrincipalReduction', {
    header: 'Principal reduction',
    cell: (info) => formatMoney(info.getValue())
  }),
  columnHelper.accessor('closingBalance', {
    header: 'Closing balance',
    cell: (info) => formatMoney(info.getValue())
  }),
  columnHelper.accessor('annualInterestRate', {
    header: 'Rate',
    cell: (info) => formatPercent(info.getValue())
  }),
  columnHelper.accessor('periodId', { header: 'Term' }),
  columnHelper.accessor((row) => row.notes?.join(', ') ?? row.eventType ?? '', {
    id: 'eventNotes',
    header: 'Event notes'
  })
];

const table = useVueTable({
  get data() {
    return props.rows;
  },
  columns,
  getCoreRowModel: getCoreRowModel()
});
</script>

<template>
  <section class="panel schedule-panel" aria-labelledby="schedule-heading">
    <div class="panel-heading">
      <h2 id="schedule-heading">Payment schedule</h2>
      <span class="status-pill">{{ rows.length }} rows</span>
    </div>

    <div class="table-scroll">
      <table>
        <thead>
          <tr v-for="headerGroup in table.getHeaderGroups()" :key="headerGroup.id">
            <th v-for="header in headerGroup.headers" :key="header.id" scope="col">
              <FlexRender
                v-if="!header.isPlaceholder"
                :render="header.column.columnDef.header"
                :props="header.getContext()"
              />
            </th>
          </tr>
        </thead>
        <tbody>
          <tr v-if="table.getRowModel().rows.length === 0">
            <td :colspan="columns.length" class="empty-state">
              No payment schedule rows yet.
            </td>
          </tr>
          <tr v-for="row in table.getRowModel().rows" :key="row.id">
            <td v-for="cell in row.getVisibleCells()" :key="cell.id">
              <FlexRender :render="cell.column.columnDef.cell" :props="cell.getContext()" />
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </section>
</template>
