// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from 'vitest';
import { FakeBrowser } from '../dev/fake-browser';
import { GROUPED, SNAPSHOT } from '../dev/fixtures';
import type { Snapshot } from '../core/types';
import type { UiState } from './state';
import { mountApp, type App } from './app';
import { initialUi } from './state';

let app: App | undefined;
afterEach(() => {
  app?.destroy();
  document.body.replaceChildren();
});

function mount(ui = {}) {
  const container = document.createElement('div');
  document.body.append(container);
  app = mountApp(container, new FakeBrowser(SNAPSHOT), { snapshot: SNAPSHOT, ui: initialUi(ui) }, { autofocus: true });
  const input = container.querySelector<HTMLInputElement>('input[name="q"]')!;
  const press = (key: string, target: Element = document.activeElement ?? input) =>
    target.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }));
  return { container, input, press };
}

describe('cursor-only fast path', () => {
  /** Mount-specific ids aside, the DOM a mount shows. */
  const html = (el: Element) => el.innerHTML.replace(/ (id|aria-activedescendant|aria-controls)="[^"]*"/g, '');

  it.each<[string, Snapshot, Partial<UiState>]>([
    ['tabs', SNAPSHOT, {}],
    ['windows', GROUPED, { view: 'windows', openWindows: new Set([2]) }],
    ['sites', SNAPSHOT, { view: 'sites', expanded: new Set(['news.ycombinator.com']) }],
  ])('leaves the same DOM as a full render (%s)', (_name, snapshot, ui) => {
    const a = document.createElement('div');
    document.body.append(a);
    const first = mountApp(a, new FakeBrowser(snapshot), { snapshot, ui: initialUi(ui) }, { autofocus: true });
    const input = a.querySelector('input')!;
    for (let i = 0; i < 4; i++) input.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true, cancelable: true }));
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true, cancelable: true }));
    const cursor = a.querySelector<HTMLElement>('.is-cursor')?.dataset.key;
    expect(cursor).toBeTruthy();
    const moved = html(a);
    first.destroy();

    const b = document.createElement('div');
    document.body.append(b);
    app = mountApp(b, new FakeBrowser(snapshot), { snapshot, ui: initialUi({ ...ui, cursor: cursor as UiState['cursor'] }) }, { autofocus: true });
    expect(moved).toBe(html(b));
  });
});

describe('mountApp keyboard + a11y', () => {
  it('moves the cursor from the search field and announces it', () => {
    const { container, input, press } = mount();
    expect(document.activeElement).toBe(input);
    press('ArrowDown');
    press('ArrowDown');
    const id = input.getAttribute('aria-activedescendant');
    const cursor = container.querySelector('.is-cursor');
    expect(id).toBeTruthy();
    expect(cursor?.id).toBe(id);
    expect(cursor?.getAttribute('aria-selected')).toBe('true');
    expect(container.querySelectorAll('[aria-selected="true"][role="option"]')).toHaveLength(1);
    expect(input.getAttribute('aria-controls')).toBe(container.querySelector('.list')?.id);
  });

  it('leaves search with Escape so letter shortcuts work, and typing returns to it', () => {
    const { container, input, press } = mount();
    press('Escape', input);
    const popup = container.querySelector('.popup')!;
    expect(document.activeElement).toBe(popup);
    press('s', popup);
    expect(container.querySelector('.list')?.getAttribute('role')).toBe('tree');
    press('g', popup);
    expect(document.activeElement).toBe(input);
    expect(input.value).toBe('g');
  });

  it('opens and closes the shortcuts panel', () => {
    const { container, input, press } = mount();
    press('Escape', input);
    const popup = container.querySelector('.popup')!;
    press('?', popup);
    expect(container.querySelector('[role="dialog"]')).not.toBeNull();
    press('Escape', popup);
    expect(container.querySelector('[role="dialog"]')).toBeNull();
  });
});
