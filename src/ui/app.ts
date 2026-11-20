/**
 * Runtime: owns the state, turns DOM events into actions, runs effects against
 * the browser, and re-renders by morphing the DOM in place.
 */
import type { Action, Effect } from './actions';
import type { BrowserPort } from './browser';
import { deriveModel } from './derive';
import { resolveKey } from './keys';
import type { ItemKey } from './model';
import { joinField, splitField } from '../core/search';
import { morph } from './morph';
import { renderPopup } from './popup';
import type { AppState } from './state';
import { update } from './update';

/** Keep in sync with the `row-out` animation in popup.css. */
export const CLOSE_ANIMATION_MS = 180;
export const TOAST_MS = 6000;

export interface App {
  dispatch(action: Action): void;
  destroy(): void;
}

export interface MountOptions {
  /** Focus the search field on mount (the real popup); off in the gallery. */
  autofocus?: boolean;
}

let mounts = 0;

/**
 * The most frequent change, pointer moves and ↑↓, only moves the cursor: patch
 * the two rows (class and aria-selected, exactly what a full render would set)
 * instead of rebuilding the list. Anything else, or Select mode (where
 * aria-selected means "selected"), returns false for a full render.
 */
function moveCursorOnly(prev: AppState, next: AppState, root: HTMLElement): boolean {
  if (prev.snapshot !== next.snapshot || next.ui.selection || prev.ui.cursor === next.ui.cursor) return false;
  for (const key of Object.keys(next.ui) as (keyof AppState['ui'])[]) {
    if (key !== 'cursor' && prev.ui[key] !== next.ui[key]) return false;
  }
  const find = (key: string | undefined) => (key ? root.querySelector<HTMLElement>(`[data-key="${CSS.escape(key)}"]`) : null);
  const from = find(prev.ui.cursor);
  const to = find(next.ui.cursor);
  if ((prev.ui.cursor && !from) || (next.ui.cursor && !to)) return false;
  for (const [el, on] of [[from, false], [to, true]] as const) {
    if (!el) continue;
    el.classList.toggle('is-cursor', on);
    if (el.hasAttribute('aria-selected')) el.setAttribute('aria-selected', String(on));
  }
  return true;
}

export function mountApp(container: HTMLElement, browser: BrowserPort | null, initial: AppState, options: MountOptions = {}): App {
  let state = initial;
  let root: HTMLElement | null = null;
  const idPrefix = `ato${++mounts}`;
  const timers = new Set<ReturnType<typeof setTimeout>>();

  const later = (ms: number, fn: () => void) => {
    const id = setTimeout(() => {
      timers.delete(id);
      fn();
    }, ms);
    timers.add(id);
  };

  /** What the DOM shows now; lets a cursor-only change skip the full render. */
  let shown: AppState | null = null;

  function render(): void {
    if (root && shown && moveCursorOnly(shown, state, root)) {
      shown = state;
      afterRender(root);
      return;
    }
    shown = state;
    const next = renderPopup(deriveModel(state));
    if (!root) {
      root = next;
      container.replaceChildren(root);
    } else {
      morph(root, next);
    }
    afterRender(root);
  }

  function afterRender(root: HTMLElement): void {
    // A render can remove the focused element (review replaces the search field):
    // keep focus in the popup, or keys stop reaching it.
    const active = document.activeElement;
    if (!active || active === document.body || !active.isConnected) root.focus();
    // The shortcuts panel takes the keyboard: move focus off the search field behind it.
    if (state.ui.helpOpen && root.contains(document.activeElement) && document.activeElement !== root) root.focus();
    const cursor = state.ui.cursor ? root.querySelector<HTMLElement>(`[data-key="${CSS.escape(state.ui.cursor)}"]`) : null;
    if (cursor) cursor.scrollIntoView({ block: 'nearest' });
    linkActiveDescendant(root, cursor);
  }

  /**
   * Focus stays in the search field (or on the popup) while the cursor moves, so
   * point assistive tech at the cursor item. IDs are per-mount: several popups can
   * share a page (the gallery).
   */
  function linkActiveDescendant(popup: HTMLElement, cursor: HTMLElement | null): void {
    const list = popup.querySelector<HTMLElement>('.list');
    if (list) list.id = `${idPrefix}-list`;
    if (cursor) cursor.id = `${idPrefix}-cursor`;
    for (const el of [popup, popup.querySelector('input[name="q"]')]) {
      if (!el) continue;
      if (cursor) el.setAttribute('aria-activedescendant', cursor.id);
      else el.removeAttribute('aria-activedescendant');
      if (el !== popup && list) el.setAttribute('aria-controls', list.id);
    }
  }

  function dispatch(action: Action): void {
    const [next, effects] = update(state, action);
    state = next;
    render();
    for (const effect of effects) run(effect);
  }

  function run(effect: Effect): void {
    if (!browser) return;
    switch (effect.kind) {
      case 'close':
        // Let the rows animate out, then close for real.
        later(CLOSE_ANIMATION_MS, () => {
          void browser.close(effect.tabIds).then((tabs) => dispatch({ type: 'closed', tabs, message: effect.message }));
        });
        return;
      case 'restore':
        void browser.restore(effect.tabs).then(({ count, fresh }) => dispatch({ type: 'restored', count, fresh }));
        return;
      case 'activate':
        void browser.activate(effect.tabId);
        return;
      case 'discard':
        void browser.discard(effect.tabIds);
        return;
      case 'move':
        void browser.moveToNewWindow(effect.tabIds);
        return;
      case 'moveTo':
        void browser.moveToWindow(effect.tabIds, effect.windowId);
        return;
      case 'focusWindow':
        void browser.focusWindow(effect.windowId);
        return;
      case 'expireToast':
        later(TOAST_MS, () => dispatch({ type: 'dismissToast', id: effect.id }));
        return;
      case 'openSettings':
        void browser.openSettings();
        return;
      case 'mute':
        void browser.setMuted(effect.tabId, effect.muted);
        return;
    }
  }

  const refresh = () => {
    if (browser) void browser.snapshot().then((snapshot) => dispatch({ type: 'snapshot', snapshot }));
  };
  const unsubscribe = browser?.subscribe(refresh);

  render();
  if (!state.snapshot) refresh();
  if (options.autofocus) searchInput()?.focus();
  // The focus ring reflects real focus, not whatever the initial state claimed.
  const focused = document.activeElement !== null && document.activeElement === searchInput();
  if (state.ui.searchFocused !== focused) dispatch({ type: 'searchFocus', focused });

  function searchInput(): HTMLInputElement | null {
    return root?.querySelector<HTMLInputElement>('input[name="q"]') ?? null;
  }

  // --- DOM events -----------------------------------------------------------

  const actionFor = (el: HTMLElement, event: MouseEvent | Event): Action | null => {
    const id = Number(el.dataset.id);
    const domain = el.dataset.domain ?? '';
    switch (el.dataset.action) {
      case 'activate': {
        const e = event as MouseEvent;
        if (state.ui.selection || e.metaKey || e.ctrlKey) {
          if (!state.ui.selection) dispatch({ type: 'toggleSelectMode' });
          return { type: 'toggleSelected', tabId: id, range: e.shiftKey };
        }
        return { type: 'activate', tabId: id };
      }
      case 'close':
        return { type: 'closeTab', tabId: id };
      case 'toggle-site':
        return { type: 'toggleSite', domain };
      case 'close-site':
        return { type: 'closeSite', domain };
      case 'unload-site':
        return { type: 'unloadSite', domain };
      case 'move-site':
        return { type: 'moveSite', domain };
      case 'show-all-results':
        return { type: 'showAllResults' };
      case 'move-results':
        return { type: 'moveResults' };
      case 'open-review':
        return { type: 'openReview' };
      case 'close-duplicates':
        return { type: 'closeDuplicates' };
      case 'close-review':
        return { type: 'closeReview' };
      case 'confirm-review':
        return { type: 'confirmReview' };
      case 'flip':
        return { type: 'flip', tabId: id };
      case 'toggle-set':
        return { type: 'toggleSet', key: el.dataset.set ?? '' };
      case 'close-set':
        return { type: 'closeSet', key: el.dataset.set ?? '' };
      case 'view':
        return { type: 'setView', view: el.dataset.view === 'sites' || el.dataset.view === 'windows' ? el.dataset.view : 'tabs' };
      case 'toggle-window':
        return { type: 'toggleWindow', windowId: Number(el.dataset.window) };
      case 'focus-window':
        return { type: 'focusWindow', windowId: Number(el.dataset.window) };
      case 'merge-window':
        return { type: 'mergeWindow', windowId: Number(el.dataset.window) };
      case 'close-window':
        return { type: 'closeWindow', windowId: Number(el.dataset.window) };
      case 'cycle-sort':
        return { type: 'cycleSort' };
      case 'cycle-scope':
        return { type: 'cycleScope' };
      case 'clear-query':
        return { type: 'clearQuery' };
      case 'clear-field':
        return { type: 'clearField' };
      case 'close-results':
        return { type: 'closeResults' };
      case 'unload-results':
        return { type: 'unloadResults' };
      case 'undo':
        return { type: 'undo' };
      case 'settings':
        return { type: 'openSettings' };
      case 'toggle-mute':
        return { type: 'toggleMute', tabId: id };
      case 'toggle-help':
        return { type: 'toggleHelp' };
      case 'close-selected':
        return { type: 'closeSelected' };
      case 'unload-selected':
        return { type: 'unloadSelected' };
      case 'move-selected':
        return { type: 'moveSelected' };
      case 'exit-select':
        return { type: 'exitSelect' };
      case 'toggle-row':
        return { type: 'toggleSelected', tabId: id, range: (event as MouseEvent).shiftKey };
      default:
        return null;
    }
  };

  const onClick = (event: MouseEvent) => {
    const el = (event.target as HTMLElement).closest<HTMLElement>('[data-action]');
    if (!el || !container.contains(el)) return;
    const action = actionFor(el, event);
    if (action) dispatch(action);
    if (el.dataset.action === 'clear-query' || el.dataset.action === 'clear-field') searchInput()?.focus();
  };

  const onInput = (event: Event) => {
    const el = event.target as HTMLInputElement;
    if (el.name !== 'q') return;
    // The field holds the text after the chip; the query is chip + text.
    dispatch({ type: 'query', text: joinField(splitField(state.ui.query).field, el.value) });
    syncSearchText(el);
  };

  /**
   * Typing `url:` turns it into a chip: take the prefix out of the field.
   * (morph leaves a focused field alone, so this is done here.)
   */
  function syncSearchText(el: HTMLInputElement): void {
    const { rest } = splitField(state.ui.query);
    if (el.value === rest) return;
    const cut = el.value.length - rest.length;
    const caret = Math.max(0, (el.selectionStart ?? el.value.length) - cut);
    el.value = rest;
    el.setSelectionRange(caret, caret);
  }

  const onFocus = (event: FocusEvent) => {
    const inSearch = (event.target as HTMLElement).matches?.('input[name="q"]');
    if (event.type === 'focusin' && inSearch) dispatch({ type: 'searchFocus', focused: true });
    if (event.type === 'focusout' && inSearch) dispatch({ type: 'searchFocus', focused: false });
  };

  const onKeydown = (event: KeyboardEvent) => {
    if (event.isComposing) return;
    const typing = (event.target as HTMLElement).matches?.('input[name="q"]') ?? false;
    const { ui } = state;
    const command = resolveKey(event, {
      typing,
      hasQuery: ui.query.length > 0,
      selecting: ui.selection !== undefined,
      reviewOpen: ui.reviewOpen,
      helpOpen: ui.helpOpen,
      hasCursor: ui.cursor !== undefined,
      fieldChip: splitField(ui.query).field !== null,
      caretAtStart: typing && (event.target as HTMLInputElement).selectionStart === 0 && (event.target as HTMLInputElement).selectionEnd === 0,
    });
    if (!command) return;
    event.preventDefault();
    switch (command.kind) {
      case 'action':
        return dispatch(command.action);
      case 'blurSearch':
        return root?.focus();
      case 'focusSearch': {
        const input = searchInput();
        if (!input) return;
        input.focus();
        if (command.text) {
          input.value += command.text;
          dispatch({ type: 'query', text: joinField(splitField(state.ui.query).field, input.value) });
          syncSearchText(input);
        }
      }
    }
  };

  const onPointerMove = (event: PointerEvent) => {
    // Mouse users get the cursor where they point, so keys act on what they see.
    const el = (event.target as HTMLElement).closest<HTMLElement>('[data-key]');
    const key = el?.dataset.key as ItemKey | undefined;
    if (key && key !== state.ui.cursor && /^((tab|site|copy|set|win|play):|dupes$)/.test(key)) dispatch({ type: 'setCursor', key });
  };

  container.addEventListener('click', onClick);
  container.addEventListener('input', onInput);
  container.addEventListener('focusin', onFocus);
  container.addEventListener('focusout', onFocus);
  container.addEventListener('keydown', onKeydown);
  container.addEventListener('pointermove', onPointerMove);

  return {
    dispatch,
    destroy() {
      unsubscribe?.();
      for (const id of timers) clearTimeout(id);
      container.removeEventListener('click', onClick);
      container.removeEventListener('input', onInput);
      container.removeEventListener('focusin', onFocus);
      container.removeEventListener('focusout', onFocus);
      container.removeEventListener('keydown', onKeydown);
      container.removeEventListener('pointermove', onPointerMove);
    },
  };
}
