/**
 * Runtime: owns the state, turns DOM events into actions, runs effects against
 * the browser, and re-renders by morphing the DOM in place.
 */
import type { Action, Effect } from './actions';
import type { BrowserPort } from './browser';
import { deriveModel } from './derive';
import { resolveKey } from './keys';
import type { ItemKey } from './model';
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

export function mountApp(container: HTMLElement, browser: BrowserPort | null, initial: AppState, options: MountOptions = {}): App {
  let state = initial;
  let root: HTMLElement | null = null;
  let shiftHeld = false;
  const timers = new Set<ReturnType<typeof setTimeout>>();

  const later = (ms: number, fn: () => void) => {
    const id = setTimeout(() => {
      timers.delete(id);
      fn();
    }, ms);
    timers.add(id);
  };

  function render(): void {
    const next = renderPopup(deriveModel(state));
    if (!root) {
      root = next;
      container.replaceChildren(root);
    } else {
      morph(root, next);
    }
    // The shortcuts panel takes the keyboard: move focus off the search field behind it.
    if (state.ui.helpOpen && root.contains(document.activeElement) && document.activeElement !== root) root.focus();
    const cursor = state.ui.cursor && root.querySelector(`[data-key="${CSS.escape(state.ui.cursor)}"]`);
    if (cursor) cursor.scrollIntoView({ block: 'nearest' });
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
        void browser.restore(effect.tabs).then((count) => dispatch({ type: 'restored', count }));
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
      case 'expireToast':
        later(TOAST_MS, () => dispatch({ type: 'dismissToast', id: effect.id }));
        return;
      case 'openSettings':
        void browser.openSettings();
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
      case 'open-review':
        return { type: 'openReview' };
      case 'close-review':
        return { type: 'closeReview' };
      case 'confirm-review':
        return { type: 'confirmReview' };
      case 'flip':
        return { type: 'flip', tabId: id };
      case 'view':
        return { type: 'setView', view: el.dataset.view === 'sites' ? 'sites' : 'tabs' };
      case 'cycle-sort':
        return { type: 'cycleSort' };
      case 'cycle-scope':
        return { type: 'cycleScope' };
      case 'clear-query':
        return { type: 'clearQuery' };
      case 'close-results':
        return { type: 'closeResults' };
      case 'unload-results':
        return { type: 'unloadResults' };
      case 'undo':
        return { type: 'undo' };
      case 'settings':
        return { type: 'openSettings' };
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
      case 'toggle-selected':
        return { type: 'toggleSelected', tabId: id, range: shiftHeld };
      default:
        return null;
    }
  };

  const onClick = (event: MouseEvent) => {
    shiftHeld = event.shiftKey;
    const el = (event.target as HTMLElement).closest<HTMLElement>('[data-action]');
    if (!el || !container.contains(el) || el.dataset.action === 'toggle-selected') return;
    const action = actionFor(el, event);
    if (action) dispatch(action);
    if (el.dataset.action === 'clear-query') searchInput()?.focus();
  };

  const onChange = (event: Event) => {
    const el = event.target as HTMLElement;
    if (el.dataset.action === 'toggle-selected') {
      const action = actionFor(el, event);
      if (action) dispatch(action);
    }
  };

  const onInput = (event: Event) => {
    const el = event.target as HTMLInputElement;
    if (el.name === 'q') dispatch({ type: 'query', text: el.value });
  };

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
          dispatch({ type: 'query', text: input.value });
        }
      }
    }
  };

  const onPointerMove = (event: PointerEvent) => {
    // Mouse users get the cursor where they point, so keys act on what they see.
    const el = (event.target as HTMLElement).closest<HTMLElement>('[data-key]');
    const key = el?.dataset.key as ItemKey | undefined;
    if (key && key !== state.ui.cursor && !key.startsWith('list:')) dispatch({ type: 'setCursor', key });
  };

  container.addEventListener('click', onClick);
  container.addEventListener('change', onChange);
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
      container.removeEventListener('change', onChange);
      container.removeEventListener('input', onInput);
      container.removeEventListener('focusin', onFocus);
      container.removeEventListener('focusout', onFocus);
      container.removeEventListener('keydown', onKeydown);
      container.removeEventListener('pointermove', onPointerMove);
    },
  };
}
