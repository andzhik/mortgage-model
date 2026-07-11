import type { ChartData, ChartOptions } from 'chart.js';
import { Bar, Line } from 'vue-chartjs';
import { defineComponent, h } from 'vue';

export default defineComponent({
  name: 'ChartRenderer',
  props: {
    kind: {
      type: String as () => 'bar' | 'line',
      required: true
    },
    data: {
      type: Object as () =>
        | ChartData<'line', (number | null)[], string>
        | ChartData<'bar', number[], string>,
      required: true
    },
    options: {
      type: Object as () => ChartOptions<'line'> | ChartOptions<'bar'>,
      required: true
    }
  },
  setup(props) {
    return () => {
      if (typeof globalThis.CanvasRenderingContext2D === 'undefined') {
        return h('div', {
          role: 'presentation',
          'data-chart-kind': props.kind,
          'data-dataset-labels': props.data.datasets
            .map((dataset) => dataset.label)
            .join('|'),
          'data-label-count': String(props.data.labels?.length ?? 0)
        });
      }

      if (props.kind === 'line') {
        return h(Line, {
          data: props.data as ChartData<'line', (number | null)[], string>,
          options: props.options as ChartOptions<'line'>
        });
      }

      return h(Bar, {
        data: props.data as ChartData<'bar', number[], string>,
        options: props.options as ChartOptions<'bar'>
      });
    };
  }
});
