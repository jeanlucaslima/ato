// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from 'vitest';
import { FakeBrowser } from '../dev/fake-browser';
import { GROUPED, PROTECTED_WINDOW, SNAPSHOT, TABS } from '../dev/fixtures';
import type { DuplicatePolicy } from '../core/duplicates';
import type { Snapshot } from '../core/types';
import type { CloseResult } from './browser';
import type { UiState } from './state';
import { CLOSE_ANIMATION_MS, mountApp, type App } from './app';
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
    // The arrows stepped focus out of the (empty) search field into the list, so render that state.
    app = mountApp(b, new FakeBrowser(snapshot), { snapshot, ui: initialUi({ ...ui, cursor: cursor as UiState['cursor'], searchFocused: false }) });
    expect(moved).toBe(html(b));
  });
});

describe('mountApp keyboard + a11y', () => {
  it('moves the cursor from the search field and announces it', () => {
    const { container, input, press } = mount();
    expect(document.activeElement).toBe(input);
    // Past the duplicates bar and Now playing, into the list.
    for (let i = 0; i < 4; i++) press('ArrowDown');
    const id = input.getAttribute('aria-activedescendant');
    const cursor = container.querySelector('.is-cursor');
    expect(id).toBeTruthy();
    expect(cursor?.id).toBe(id);
    expect(cursor?.getAttribute('aria-selected')).toBe('true');
    expect(container.querySelectorAll('[aria-selected="true"][role="option"]')).toHaveLength(1);
    expect(input.getAttribute('aria-controls')).toBe(container.querySelector('.list')?.id);
  });

  it('steps from the empty search field into the list with the arrows, where ⌫ and Delete close the row', async () => {
    const browser = new FakeBrowser(SNAPSHOT);
    const container = document.createElement('div');
    document.body.append(container);
    app = mountApp(container, browser, { snapshot: SNAPSHOT, ui: initialUi() }, { autofocus: true });
    const input = container.querySelector<HTMLInputElement>('input[name="q"]')!;
    const popup = container.querySelector('.popup')!;
    const key = (k: string, metaKey = false) =>
      (document.activeElement ?? input).dispatchEvent(new KeyboardEvent('keydown', { key: k, metaKey, bubbles: true, cancelable: true }));
    const cursorTab = () => Number(container.querySelector<HTMLElement>('.row.is-cursor')?.dataset.key?.replace('tab:', ''));
    const open = async () => (await browser.snapshot()).tabs.map((t) => t.id);
    const settle = () => new Promise((r) => setTimeout(r, CLOSE_ANIMATION_MS + 50));
    const foot = () => container.querySelector('.foot')!.textContent;

    expect(document.activeElement).toBe(input);
    expect(foot()).toContain('⌘⌫ close');
    while (!container.querySelector('.row.is-cursor')) key('ArrowDown');
    expect(document.activeElement).toBe(popup);
    expect(foot()).toContain('⌫ close');
    expect(foot()).not.toContain('⌘⌫');
    const first = cursorTab();
    key('Backspace');
    await settle();
    expect(await open()).not.toContain(first);
    const second = cursorTab();
    expect(second).toBeTruthy();
    key('Delete');
    await settle();
    expect(await open()).not.toContain(second);
  });

  it('keeps focus in an empty search field when pointing, and ⌘⌫ (not ⌫) closes from there', async () => {
    const browser = new FakeBrowser(SNAPSHOT);
    const container = document.createElement('div');
    document.body.append(container);
    app = mountApp(container, browser, { snapshot: SNAPSHOT, ui: initialUi() }, { autofocus: true });
    const input = container.querySelector<HTMLInputElement>('input[name="q"]')!;
    const key = (k: string, metaKey = false) => input.dispatchEvent(new KeyboardEvent('keydown', { key: k, metaKey, bubbles: true, cancelable: true }));
    // A cursor while typing in an empty field (as after pointing at a row): ⌫ edits, ⌘⌫ closes that row.
    const row = container.querySelector<HTMLElement>('.row')!;
    row.dispatchEvent(new PointerEvent('pointermove', { bubbles: true }));
    const id = Number(container.querySelector<HTMLElement>('.row.is-cursor')!.dataset.key!.replace('tab:', ''));
    key('Backspace');
    await new Promise((r) => setTimeout(r, CLOSE_ANIMATION_MS + 50));
    expect((await browser.snapshot()).tabs.map((t) => t.id)).toContain(id);
    key('Backspace', true);
    await new Promise((r) => setTimeout(r, CLOSE_ANIMATION_MS + 50));
    expect((await browser.snapshot()).tabs.map((t) => t.id)).not.toContain(id);
  });

  it.each([['a query', 'chrome'], ['a url: chip', 'url:c']])(
    'steps from search with %s into the results with ↓, where ⌫ and Delete close the row',
    async (_name, typed) => {
      const browser = new FakeBrowser(SNAPSHOT);
      const container = document.createElement('div');
      document.body.append(container);
      app = mountApp(container, browser, { snapshot: SNAPSHOT, ui: initialUi() }, { autofocus: true });
      const input = container.querySelector<HTMLInputElement>('input[name="q"]')!;
      const key = (k: string) => (document.activeElement ?? input).dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true }));
      const cursorTab = () => Number(container.querySelector<HTMLElement>('.row.is-cursor')?.dataset.key?.replace('tab:', ''));
      const open = async () => (await browser.snapshot()).tabs.map((t) => t.id);
      const settle = () => new Promise((r) => setTimeout(r, CLOSE_ANIMATION_MS + 50));
      input.value = typed;
      input.dispatchEvent(new Event('input', { bubbles: true }));
      key('ArrowDown');
      for (let i = 0; i < 10 && !container.querySelector('.row.is-cursor'); i++) key('ArrowDown');
      expect(container.querySelector('.row.is-cursor')).toBeTruthy();
      expect(document.activeElement).toBe(container.querySelector('.popup'));
      const first = cursorTab();
      expect(first).toBeTruthy();
      key('Backspace');
      await settle();
      expect(await open()).not.toContain(first);
      const second = cursorTab();
      expect(second).toBeTruthy();
      key('Delete');
      await settle();
      expect(await open()).not.toContain(second);
    },
  );

  it.each([
    ['with duplicates (the bar is the first stop)', SNAPSHOT],
    ['with none (no bar to stop on)', { ...SNAPSHOT, tabs: SNAPSHOT.tabs.filter((t, i, all) => all.findIndex((o) => o.url === t.url) === i) }],
  ])('↑ from the top of the list goes back up into search, %s', (_name, snapshot) => {
    const container = document.createElement('div');
    document.body.append(container);
    app = mountApp(container, new FakeBrowser(snapshot), { snapshot, ui: initialUi() }, { autofocus: true });
    const input = container.querySelector<HTMLInputElement>('input[name="q"]')!;
    const key = (target: Element, k: string) => target.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true }));
    const cursor = () => container.querySelector<HTMLElement>('.is-cursor')?.dataset.key;
    expect(Boolean(container.querySelector('.strip:not(.strip--clean, .strip--idle)'))).toBe(snapshot === SNAPSHOT);

    key(input, 'Escape'); // out of search, as after clicking Back from review
    const popup = container.querySelector('.popup')!;
    key(popup, 'ArrowDown');
    key(popup, 'ArrowDown');
    key(popup, 'ArrowUp');
    const first = cursor();
    expect(first).toBeTruthy();
    key(popup, 'ArrowUp');
    expect(document.activeElement).toBe(input);
    expect(cursor()).toBeUndefined();
    key(input, 'ArrowDown');
    expect(cursor()).toBe(first);
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

  it('keeps the keyboard working after review opens from the search field (which review removes)', () => {
    const { container, input, press } = mount();
    press('ArrowDown', input); // the duplicates bar
    press('Enter', input);
    expect(container.querySelector('[data-screen="review"]')).not.toBeNull();
    // Focus must stay inside the popup, or no key reaches it.
    expect(container.contains(document.activeElement)).toBe(true);
    const first = container.querySelector('.is-cursor')?.getAttribute('data-key');
    press('ArrowDown');
    const next = container.querySelector('.is-cursor')?.getAttribute('data-key');
    expect(next).toBeTruthy();
    expect(next).not.toBe(first);
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

/** Chrome refusing a close: `closesFirst` tabs go before tabs.remove rejects. */
class FailingBrowser extends FakeBrowser {
  constructor(private closesFirst = 0) {
    super(SNAPSHOT);
  }
  override async close(tabIds: number[], policy: DuplicatePolicy | null): Promise<CloseResult> {
    if (this.closesFirst > 0) await super.close(tabIds.slice(0, this.closesFirst), policy);
    throw new Error('Tabs cannot be edited right now (user may be dragging a tab).');
  }
}

describe('a close that fails', () => {
  const settle = () => new Promise((r) => setTimeout(r, CLOSE_ANIMATION_MS + 50));
  // Window 2 isn't focused: its current tab isn't the one being looked at, so it closes too.
  const windowTwo = TABS.filter((t) => t.windowId === 2).map((t) => t.id);

  function mountFailing(closesFirst: number) {
    const container = document.createElement('div');
    document.body.append(container);
    app = mountApp(container, new FailingBrowser(closesFirst), { snapshot: SNAPSHOT, ui: initialUi({ view: 'windows' }) });
    return container;
  }

  it('leaves no row closing and says it failed', async () => {
    const container = mountFailing(0);
    app!.dispatch({ type: 'toggleWindow', windowId: 2, open: true });
    app!.dispatch({ type: 'closeWindow', windowId: 2 });
    expect(container.querySelectorAll('.row.is-closing').length).toBe(windowTwo.length);
    await settle();
    expect(container.querySelectorAll('.is-closing').length).toBe(0);
    expect(container.querySelector('.toast')?.textContent).toContain('Couldn’t close tabs: finish dragging the tab, then try again');
    expect(container.querySelector('[data-action="undo"]')).toBeNull();
  });

  it('closed half, then failed: undo covers exactly the tabs that went', async () => {
    const container = mountFailing(2);
    app!.dispatch({ type: 'toggleWindow', windowId: 2, open: true });
    app!.dispatch({ type: 'closeWindow', windowId: 2 });
    await settle();
    expect(container.querySelectorAll('.is-closing').length).toBe(0);
    expect(container.querySelector('.toast')?.textContent).toContain(`Closed 2 tabs · couldn’t close ${windowTwo.length - 2}: finish dragging the tab, then try again`);
    expect(container.querySelector('[data-action="undo"]')).not.toBeNull();
    for (const id of windowTwo.slice(0, 2)) expect(container.querySelector(`[data-key="tab:${id}"]`)).toBeNull();
    for (const id of windowTwo.slice(2)) expect(container.querySelector(`[data-key="tab:${id}"]`)).not.toBeNull();
  });
});

describe('Windows view Close button', () => {
  it('counts the tabs it will close, says protected ones stay, and is gone when nothing would close', () => {
    const container = document.createElement('div');
    document.body.append(container);
    app = mountApp(container, new FakeBrowser(PROTECTED_WINDOW), { snapshot: PROTECTED_WINDOW, ui: initialUi({ view: 'windows' }) });
    const button = (w: number) => container.querySelector<HTMLButtonElement>(`[data-action="close-window"][data-window="${w}"]`);
    // Window 2: 8 tabs; three in groups stay. Its current tab closes: window 3 is the focused one.
    expect(button(2)?.textContent).toBe('Close 5');
    expect(button(2)?.getAttribute('aria-label')).toBe('Close 5 tabs; 3 protected stay (⌫)');
    // Window 3 (focused): current, pinned and playing only.
    expect(button(3)).toBeNull();
  });
});

describe('undo offered when the popup opens', () => {
  it('shows the right-click close with its Undo, which restores those tabs', async () => {
    const container = document.createElement('div');
    document.body.append(container);
    const browser = new FakeBrowser({ ...SNAPSHOT, tabs: TABS.filter((t) => t.id !== TABS[3]!.id) });
    browser.undoOffer = { tabs: [TABS[3]!], closedAt: 1, message: 'Closed 1 duplicate (tab menu)' };
    app = mountApp(container, browser, { snapshot: null, ui: initialUi() });
    await new Promise((r) => setTimeout(r, 0));
    expect(container.querySelector('.toast')?.textContent).toContain('Closed 1 duplicate (tab menu)');
    (container.querySelector('[data-action="undo"]') as HTMLElement).click();
    await new Promise((r) => setTimeout(r, 0));
    expect((await browser.snapshot()).tabs.some((t) => t.id === TABS[3]!.id)).toBe(true);
  });
});
