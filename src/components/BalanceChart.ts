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
import { computed, defineComponent, h } from 'vue';
import { formatMoney } from '../app/formatters';
import { prepareBalanceChart } from '../domain/chartData';
import type { ProjectionChartSeries } from '../domain/mortgageTypes';
import ChartRenderer from './ChartRenderer';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Filler, Tooltip, Legend);

export default defineComponent({
  name: 'BalanceChart',
  props: {
    chartSeries: {
      type: Object as () => ProjectionChartSeries,
      required: true
    }
  },
  setup(props) {
    const preparedChart = computed(() => prepareBalanceChart(props.chartSeries));

    return () => {
      const prepared = preparedChart.value;
      const firstPoint = props.chartSeries.balanceOverTime[0];
      const lastPoint = props.chartSeries.balanceOverTime.at(-1);
      const pointLabel =
        prepared.granularity === 'payment'
          ? `${prepared.sourcePointCount} payments`
          : `${prepared.data.labels?.length ?? 0} ${prepared.granularity}s`;

      return h('section', { class: 'panel chart-panel', 'aria-labelledby': 'balance-chart-heading' }, [
        h('div', { class: 'panel-heading' }, [
          h('h2', { id: 'balance-chart-heading' }, 'Balance over time'),
          h('span', { class: 'status-pill' }, pointLabel)
        ]),
        prepared.termBands.length > 0
          ? h(
              'div',
              {
                class: 'term-band-strip',
                style: {
                  gridTemplateColumns: `repeat(${prepared.termBands.length}, minmax(0, 1fr))`
                },
                'aria-label': 'Mortgage term bands'
              },
              prepared.termBands.map((termBand) =>
                h(
                  'span',
                  { key: `${termBand.label}-${termBand.startDate}`, class: 'term-band-segment' },
                  `${termBand.label} ${termBand.startDate} to ${termBand.endDate}`
                )
              )
            )
          : null,
        h(
          'div',
          {
            class: 'chart-canvas-wrap',
            role: 'img',
            'aria-label':
              firstPoint && lastPoint
                ? `Balance projection from ${firstPoint.date} ${formatMoney(firstPoint.balance)} to ${lastPoint.date} ${formatMoney(lastPoint.balance)}.`
                : 'Balance projection chart.'
          },
          [h(ChartRenderer, { kind: 'line', data: prepared.data, options: prepared.options })]
        )
      ]);
    };
  }
});
