<script setup lang="ts">
import {
  createColumnHelper,
  FlexRender,
  getCoreRowModel,
  useVueTable
} from '@tanstack/vue-table';

type PlaceholderPaymentRow = {
  sequence: number;
  date: string;
  openingBalance: string;
  scheduledPayment: string;
  scheduledInterest: string;
  scheduledPrincipal: string;
  lumpSum: string;
  totalPayment: string;
  closingBalance: string;
};

const columnHelper = createColumnHelper<PlaceholderPaymentRow>();
const data: PlaceholderPaymentRow[] = [];

const columns = [
  columnHelper.accessor('sequence', { header: '#' }),
  columnHelper.accessor('date', { header: 'Date' }),
  columnHelper.accessor('openingBalance', { header: 'Opening balance' }),
  columnHelper.accessor('scheduledPayment', { header: 'Scheduled payment' }),
  columnHelper.accessor('scheduledInterest', { header: 'Interest' }),
  columnHelper.accessor('scheduledPrincipal', { header: 'Principal' }),
  columnHelper.accessor('lumpSum', { header: 'Lump sum' }),
  columnHelper.accessor('totalPayment', { header: 'Total payment' }),
  columnHelper.accessor('closingBalance', { header: 'Closing balance' })
];

const table = useVueTable({
  get data() {
    return data;
  },
  columns,
  getCoreRowModel: getCoreRowModel()
});
</script>

<template>
  <section class="panel schedule-panel" aria-labelledby="schedule-heading">
    <div class="panel-heading">
      <h2 id="schedule-heading">Payment schedule</h2>
      <span class="status-pill">Empty</span>
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
