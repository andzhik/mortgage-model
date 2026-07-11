import type { VueWrapper } from '@vue/test-utils';
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

async function mountApp() {
  const [{ mount }, { default: AppShell }] = await Promise.all([
    import('@vue/test-utils'),
    import('../src/app/AppShell')
  ]);

  return mount(AppShell);
}

function buttonNamed(wrapper: VueWrapper, name: string) {
  return wrapper.findAll('button').find((button) => button.text() === name);
}

describe('App validation and warnings', () => {
  it('renders immediate validation messages without replacing the valid projection', async () => {
    const wrapper = await mountApp();

    try {
      const paymentBeforeInvalidEdit = wrapper.text().includes('$2,908.02');
      expect(paymentBeforeInvalidEdit).toBe(true);

      await wrapper.get('input[aria-label="Mortgage amount"]').setValue('0');
      expect(wrapper.text()).toContain('Mortgage amount must be greater than zero.');
      expect(wrapper.get('input[aria-label="Mortgage amount"]').attributes('aria-invalid')).toBe('true');
      expect(wrapper.text()).toContain('$2,908.02');

      await wrapper.get('input[aria-label="Amortization years"]').setValue('0');
      expect(wrapper.text()).toContain('Amortization must be greater than zero.');

      await wrapper.get('input[aria-label="Term years"]').setValue('0');
      expect(wrapper.text()).toContain('Term length must be greater than zero.');

      await wrapper.get('input[aria-label="Annual interest rate"]').setValue('-1');
      expect(wrapper.text()).toContain('Interest rate cannot be negative.');

      await wrapper.get('select[aria-label="Payment frequency"]').setValue('');
      expect(wrapper.text()).toContain('Payment frequency is required.');

      await buttonNamed(wrapper, 'New')?.trigger('click');
      expect(wrapper.text()).not.toContain('Payment frequency is required.');
    } finally {
      wrapper.unmount();
    }
  });

  it('validates renewal and lump-sum fields, including unique renewal dates', async () => {
    const wrapper = await mountApp();

    try {
      await buttonNamed(wrapper, 'Add lump sum')?.trigger('click');
      await wrapper.get('input[aria-label="Lump sum date 1"]').setValue('2020-01-01');
      await wrapper.get('input[aria-label="Lump sum amount 1"]').setValue('0');
      expect(wrapper.text()).toContain('Lump-sum date must be on or after the mortgage start date.');
      expect(wrapper.text()).toContain('Lump-sum amount must be greater than zero.');

      await buttonNamed(wrapper, 'Add renewal')?.trigger('click');
      await buttonNamed(wrapper, 'Add renewal')?.trigger('click');
      const firstRenewalDate = (
        wrapper.get('input[aria-label="Renewal effective date 1"]').element as HTMLInputElement
      ).value;

      await wrapper.get('input[aria-label="Renewal effective date 2"]').setValue(firstRenewalDate);
      expect(wrapper.text()).toContain('Renewal dates must be unique.');

      await wrapper.get('input[aria-label="Renewal effective date 2"]').setValue('2020-01-01');
      expect(wrapper.text()).toContain('Renewal date must be on or after the mortgage start date.');

      await wrapper.get('input[aria-label="Renewal term years 1"]').setValue('0');
      expect(wrapper.text()).toContain('Term length must be greater than zero.');
    } finally {
      wrapper.unmount();
    }
  });

  it('renders projection warnings with live, non-color-only warning text', async () => {
    const wrapper = await mountApp();

    try {
      await buttonNamed(wrapper, 'Add lump sum')?.trigger('click');
      await wrapper.get('input[aria-label="Lump sum amount 1"]').setValue('9999999');

      const panel = wrapper.get('section[aria-labelledby="projection-warnings-heading"]');
      expect(panel.attributes('aria-live')).toBe('polite');
      expect(panel.text()).toContain('Warning ·');
      expect(panel.text()).toContain('was capped at the remaining balance');
      expect(panel.get('li').attributes('data-severity')).toBe('warning');
    } finally {
      wrapper.unmount();
    }
  });
});
