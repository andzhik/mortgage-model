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

describe('App shell', () => {
  it('renders the main dashboard regions', async () => {
    const [{ createApp }, { default: AppShell }] = await Promise.all([
      import('vue'),
      import('../src/app/AppShell')
    ]);
    const host = document.createElement('div');
    document.body.appendChild(host);
    const app = createApp(AppShell);

    try {
      app.mount(host);

      expect(host.querySelector('.scenario-bar')).not.toBeNull();
      expect(host.querySelector('.dashboard')).not.toBeNull();
      expect(host.querySelector('.editing-panel')).not.toBeNull();
      expect(host.textContent).toContain('Summary metrics');
      expect(host.textContent).toContain('Balance over time');
      expect(host.textContent).toContain('Payment breakdown');
      expect(host.textContent).toContain('Payment schedule');
      expect(host.textContent).toContain('Mortgage inputs');
      expect(host.textContent).toContain('Renewals');
      expect(host.textContent).toContain('Lump sums');
      expect(host.querySelector('table')?.getAttribute('aria-rowcount')).toBe('301');
      const mountedScheduleRows = host.querySelectorAll('tbody tr[data-sequence]');
      expect(mountedScheduleRows.length).toBeGreaterThan(0);
      expect(mountedScheduleRows.length).toBeLessThan(300);
      expect(mountedScheduleRows[0]?.getAttribute('data-sequence')).toBe('1');
      expect(mountedScheduleRows[0]?.getAttribute('aria-rowindex')).toBe('2');
    } finally {
      app.unmount();
      host.remove();
    }
  });
});
