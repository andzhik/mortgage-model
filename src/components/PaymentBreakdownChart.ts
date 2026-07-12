import {
  BarElement,
  CategoryScale,
  Chart as ChartJS,
  Legend,
  LinearScale,
  Tooltip
} from 'chart.js';
import { computed, defineComponent, h } from 'vue';
import { formatMoney } from '../app/formatters';
import { preparePaymentBreakdownChart } from '../domain/chartData';
import type { ProjectionChartSeries } from '../domain/mortgageTypes';
import ChartRenderer from './ChartRenderer';
import { measureMortgageWork } from '../performance/uiPerformance';

ChartJS.register(CategoryScale, LinearScale, BarElement, Tooltip, Legend);

export default defineComponent({
  name: 'PaymentBreakdownChart',
  props: {
    chartSeries: {
      type: Object as () => ProjectionChartSeries,
      required: true
    }
  },
  setup(props) {
    const preparedChart = computed(() =>
      measureMortgageWork('payment chart preparation', () =>
        preparePaymentBreakdownChart(props.chartSeries)
      )
    );

    return () => {
      const prepared = preparedChart.value;
      const firstPoint = props.chartSeries.paymentBreakdown[0];
      const pointLabel =
        prepared.granularity === 'payment'
          ? `${prepared.sourcePointCount} payments`
          : `${prepared.data.labels?.length ?? 0} ${prepared.granularity}s`;

      return h('section', { class: 'panel chart-panel', 'aria-labelledby': 'breakdown-chart-heading' }, [
        h('div', { class: 'panel-heading' }, [
          h('h2', { id: 'breakdown-chart-heading' }, 'Payment breakdown'),
          h('span', { class: 'status-pill' }, pointLabel)
        ]),
        h(
          'div',
          {
            class: 'chart-canvas-wrap',
            role: 'img',
            'aria-label': firstPoint
              ? `Payment breakdown starts with ${formatMoney(firstPoint.scheduledInterestPaid)} interest, ${formatMoney(firstPoint.scheduledPrincipalPaid)} principal, and ${formatMoney(firstPoint.lumpSumPayment)} lump sum.`
              : 'Payment breakdown chart.'
          },
          [h(ChartRenderer, { kind: 'bar', data: prepared.data, options: prepared.options })]
        )
      ]);
    };
  }
});
