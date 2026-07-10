import { defineComponent, h } from 'vue';
import { vi } from 'vitest';

function makeChartStub(kind: 'bar' | 'line') {
  return defineComponent({
    name: `${kind}-chart-stub`,
    props: {
      data: {
        type: Object,
        required: true
      },
      options: {
        type: Object,
        required: true
      }
    },
    setup(props) {
      return () => {
        const data = props.data as {
          labels?: string[];
          datasets?: { label?: string }[];
        };

        return h('div', {
          'data-chart-kind': kind,
          'data-dataset-labels': data.datasets?.map((dataset) => dataset.label).join('|') ?? '',
          'data-label-count': String(data.labels?.length ?? 0)
        });
      };
    }
  });
}

vi.mock('vue-chartjs', () => ({
  Bar: makeChartStub('bar'),
  Line: makeChartStub('line')
}));
