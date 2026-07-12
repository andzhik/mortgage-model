import {
  CategoryScale,
  Chart as ChartJS,
  Legend,
  LinearScale,
  LineElement,
  PointElement,
  Tooltip
} from 'chart.js';
import { computed, defineComponent, h } from 'vue';
import { formatMoney } from '../app/formatters';
import { preparePaymentBreakdownChart } from '../domain/chartData';
import type { ProjectionChartSeries } from '../domain/mortgageTypes';
import ChartRenderer from './ChartRenderer';
import { measureMortgageWork } from '../performance/uiPerformance';

ChartJS.register(CategoryScale, LinearScale, LineElement, PointElement, Tooltip, Legend);

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
      const firstPoint = props.chartSeries.paymentBreakdown.find(
        (point) => point.scheduledInterestPaid > 0 || point.scheduledPrincipalPaid > 0
      );
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
              ? `Regular payment breakdown starts with ${formatMoney(firstPoint.scheduledPrincipalPaid)} paid to principal and ${formatMoney(firstPoint.scheduledInterestPaid)} interest.`
              : 'Payment breakdown chart.'
          },
          [h(ChartRenderer, { kind: 'line', data: prepared.data, options: prepared.options })]
        )
      ]);
    };
  }
});
