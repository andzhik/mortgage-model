import { JSDOM } from 'jsdom';
import { describe, expect, it } from 'vitest';

if (typeof document === 'undefined') {
  const dom = new JSDOM('<!doctype html><html><body></body></html>');

  globalThis.window = dom.window as unknown as Window & typeof globalThis;
  globalThis.document = dom.window.document;
  globalThis.navigator = dom.window.navigator;
  globalThis.Element = dom.window.Element;
  globalThis.HTMLElement = dom.window.HTMLElement;
  globalThis.Node = dom.window.Node;
  globalThis.SVGElement = dom.window.SVGElement;
}

describe('App projection wiring', () => {
  it('updates projection summary when core mortgage inputs change', async () => {
    const [{ mount }, { default: AppShell }] = await Promise.all([
      import('@vue/test-utils'),
      import('../src/app/AppShell')
    ]);
    const wrapper = mount(AppShell);

    try {
      expect(wrapper.text()).toContain('$2,908.02');
      expect(wrapper.text()).toContain('$2,061.96');
      expect(wrapper.text()).toContain('$846.06');

      await wrapper.get('input[aria-label="Start date"]').setValue('');

      expect(wrapper.text()).toContain('$2,908.02');

      await wrapper.get('input[aria-label="Mortgage amount"]').setValue('250000');

      expect(wrapper.text()).toContain('$1,454.01');
      expect(wrapper.text()).toContain('$1,030.98');
      expect(wrapper.text()).toContain('$423.03');

      await wrapper.get('input[aria-label="Annual interest rate"]').setValue('4');

      expect(wrapper.text()).toContain('$1,315.05');
      expect(wrapper.text()).toContain('$826.47');
      expect(wrapper.text()).toContain('$488.58');

      await wrapper.get('select[aria-label="Payment frequency"]').setValue('weekly');

      expect(wrapper.text()).toContain('$303.09');
      expect(wrapper.text()).toContain('$190.48');
      expect(wrapper.text()).toContain('$112.61');
      expect(wrapper.text()).toContain('1300 rows');
    } finally {
      wrapper.unmount();
    }
  });

  it('adds, edits, and deletes lump sums from the live projection', async () => {
    const [{ mount }, { default: AppShell }] = await Promise.all([
      import('@vue/test-utils'),
      import('../src/app/AppShell')
    ]);
    const wrapper = mount(AppShell);

    try {
      expect(wrapper.text()).toContain('$2,908.02');
      expect(wrapper.text()).toContain('Total lump sums');
      expect(wrapper.text()).toContain('$0.00');

      const addButton = wrapper
        .findAll('button')
        .find((button) => button.text() === 'Add lump sum');

      expect(addButton).toBeTruthy();
      await addButton?.trigger('click');

      expect(wrapper.get('input[aria-label="Lump sum amount 1"]').element).toBeTruthy();
      expect(wrapper.text()).toContain('$1,000.00');
      expect(wrapper.text()).toContain('$2,908.02');

      await wrapper.get('input[aria-label="Lump sum date 1"]').setValue('2027-01-10');
      await wrapper.get('input[aria-label="Lump sum amount 1"]').setValue('25000');
      await wrapper.get('input[aria-label="Lump sum label 1"]').setValue('Annual bonus');

      expect(wrapper.text()).toContain('$25,000.00');
      expect(wrapper.text()).toContain('Annual bonus');
      expect(wrapper.text()).toContain('$2,908.02');

      await wrapper.get('button[aria-label="Delete lump sum 1"]').trigger('click');

      expect(wrapper.find('input[aria-label="Lump sum amount 1"]').exists()).toBe(false);
      expect(wrapper.text()).toContain('No lump-sum payments yet.');
    } finally {
      wrapper.unmount();
    }
  });
});
