/**
 * The popup's state machine: `update(state, action)` → next state + effects.
 * Pure — browser work is described as effects and run by the runtime (`app.ts`).
 */
import { protection, tabsToClose } from '../core/duplicates';
import { parseQuery, searchTabs } from '../core/search';
import { domainOf } from '../core/tabs';
import type { Tab } from '../core/types';
import type { Action, Effect } from './actions';
import { deriveModel, duplicatePlan, scopedTabs } from './derive';
import { plural } from './format';
import type { ItemKey, PopupModel, SiteSort, TabSort } from './model';
import type { AppState, Toast, UiState } from './state';

export type Result = [AppState, Effect[]];

const TAB_SORTS: TabSort[] = ['recent', 'oldest', 'title', 'site', 'copies'];
const SITE_SORTS: SiteSort[] = ['most', 'name', 'recent'];
const next = <T>(list: readonly T[], value: T): T => list[(list.indexOf(value) + 1) % list.length] ?? value;

/** Keys the cursor can visit, in screen order. */
export function navOrder(model: PopupModel): ItemKey[] {
  const s = model.screen;
  switch (s.kind) {
    case 'loading':
      return [];
    case 'tabs':
      return s.rows.map((r) => `tab:${r.id}` as const);
    case 'search':
      return s.results.map((r) => `tab:${r.id}` as const);
    case 'sites':
      return s.groups.flatMap((g): ItemKey[] => [`site:${g.domain}`, ...(g.expanded ? g.tabs.map((t) => `tab:${t.id}` as const) : [])]);
    case 'review':
      return s.sets.flatMap((set) => set.copies.map((c) => `copy:${c.tabId}` as const));
  }
}

const tabIdOf = (key: ItemKey | undefined): number | null => (key?.startsWith('tab:') || key?.startsWith('copy:') ? Number(key.split(':')[1]) : null);

/** Where the cursor should land once `removed` tabs disappear. */
function cursorAfter(order: ItemKey[], removed: ReadonlySet<number>, cursor: ItemKey | undefined): ItemKey | undefined {
  const id = tabIdOf(cursor);
  if (cursor === undefined || id === null || !removed.has(id)) return cursor;
  const at = order.indexOf(cursor);
  const survives = (k: ItemKey) => {
    const tid = tabIdOf(k);
    return tid === null || !removed.has(tid);
  };
  return order.slice(at + 1).find(survives) ?? order.slice(0, at).reverse().find(survives);
}

function withToast(state: AppState, message: string, undo?: readonly Tab[]): Result {
  const toast: Toast = { id: (state.ui.toast?.id ?? 0) + 1, message, undo };
  return [{ ...state, ui: { ...state.ui, toast } }, [{ kind: 'expireToast', id: toast.id }]];
}

function setUi(state: AppState, patch: Partial<UiState>): AppState {
  return { ...state, ui: { ...state.ui, ...patch } };
}

/**
 * Start closing `tabs`: they animate out, then the runtime closes them.
 * Bulk closes skip protected tabs; an explicit single close does not.
 */
function startClose(state: AppState, tabs: readonly Tab[], noun: string, bulk: boolean): Result {
  const eligible = bulk ? tabs.filter((t) => protection(t, state.ui.policy) === null) : [...tabs];
  const skipped = tabs.length - eligible.length;
  if (eligible.length === 0) return withToast(state, skipped ? `Nothing to close — ${plural(skipped, 'tab')} protected` : 'Nothing to close');
  const ids = new Set(eligible.map((t) => t.id));
  const order = navOrder(deriveModel(state));
  const closing = new Set([...state.ui.closing, ...ids]);
  const message = `Closed ${plural(eligible.length, noun)}${skipped ? ` · kept ${skipped} protected` : ''}`;
  const ui: UiState = { ...state.ui, closing, cursor: cursorAfter(order, ids, state.ui.cursor) };
  return [{ ...state, ui }, [{ kind: 'close', tabIds: [...ids], message }]];
}

function startUnload(state: AppState, tabs: readonly Tab[]): Result {
  const eligible = tabs.filter((t) => !t.active && !t.discarded);
  if (eligible.length === 0) return withToast(state, 'Nothing to unload');
  const [s] = withToast(state, `Unloaded ${plural(eligible.length, 'tab')}`);
  return [s, [{ kind: 'discard', tabIds: eligible.map((t) => t.id) }, { kind: 'expireToast', id: s.ui.toast?.id ?? 0 }]];
}

function tabsById(state: AppState, ids: Iterable<number>): Tab[] {
  const wanted = new Set(ids);
  return state.snapshot?.tabs.filter((t) => wanted.has(t.id)) ?? [];
}

function siteTabs(state: AppState, domain: string): Tab[] {
  return state.snapshot ? scopedTabs(state.snapshot, state.ui).filter((t) => (domainOf(t.url) || 'Other') === domain) : [];
}

function resultTabs(state: AppState): Tab[] {
  return state.snapshot ? searchTabs(state.snapshot.tabs, parseQuery(state.ui.query)).map((h) => h.tab) : [];
}

function toggleInSet<T>(set: ReadonlySet<T>, value: T, on = !set.has(value)): Set<T> {
  const copy = new Set(set);
  if (on) copy.add(value);
  else copy.delete(value);
  return copy;
}

function onCursorKey(state: AppState, key: Extract<Action, { type: 'cursorKey' }>['key']): Result {
  const { ui } = state;
  const cursor = ui.cursor;
  const model = deriveModel(state);

  if (ui.reviewOpen) {
    const id = tabIdOf(cursor);
    if (key === 'enter') return update(state, { type: 'confirmReview' });
    if ((key === 'space' || key === 'delete') && id !== null) return update(state, { type: 'flip', tabId: id });
    return [state, []];
  }

  if (cursor?.startsWith('site:')) {
    const domain = cursor.slice(5);
    if (key === 'enter' || key === 'space') return update(state, { type: 'toggleSite', domain });
    if (key === 'right') return update(state, { type: 'toggleSite', domain, open: true });
    if (key === 'left') return update(state, { type: 'toggleSite', domain, open: false });
    if (key === 'delete') return update(state, { type: 'closeSite', domain });
    if (key === 'unload') return update(state, { type: 'unloadSite', domain });
    return [state, []];
  }

  const id = tabIdOf(cursor);
  if (ui.selection) {
    if (key === 'space' && id !== null) return update(state, { type: 'toggleSelected', tabId: id });
    if (key === 'delete') return update(state, { type: 'closeSelected' });
    if (key === 'unload') return update(state, { type: 'unloadSelected' });
  }
  if (id === null) return [state, []];
  if (key === 'enter') return update(state, { type: 'activate', tabId: id });
  if (key === 'delete') return update(state, { type: 'closeTab', tabId: id });
  if (key === 'unload') return startUnload(state, tabsById(state, [id]));
  if (key === 'left' && model.screen.kind === 'sites') {
    const domain = model.screen.groups.find((g) => g.tabs.some((t) => t.id === id))?.domain;
    if (domain) return [setUi(state, { cursor: `site:${domain}`, expanded: toggleInSet(ui.expanded, domain, false) }), []];
  }
  return [state, []];
}

export function update(state: AppState, action: Action): Result {
  const { ui } = state;
  switch (action.type) {
    case 'snapshot': {
      const ids = new Set(action.snapshot.tabs.map((t) => t.id));
      const selection = ui.selection && new Set([...ui.selection].filter((id) => ids.has(id)));
      return [{ snapshot: action.snapshot, ui: { ...ui, selection } }, []];
    }
    case 'query':
      return [setUi(state, { query: action.text, reviewOpen: false, cursor: undefined }), []];
    case 'clearQuery':
      return [setUi(state, { query: '', cursor: undefined }), []];
    case 'searchFocus':
      return [setUi(state, { searchFocused: action.focused }), []];
    case 'setView': {
      // Keep the cursor on the same tab if it's visible in the other view.
      const moved = setUi(state, { view: action.view, query: '', reviewOpen: false });
      const order = navOrder(deriveModel(moved));
      return [setUi(moved, { cursor: ui.cursor && order.includes(ui.cursor) ? ui.cursor : undefined }), []];
    }
    case 'cycleSort':
      return [ui.view === 'sites' ? setUi(state, { siteSort: next(SITE_SORTS, ui.siteSort) }) : setUi(state, { tabSort: next(TAB_SORTS, ui.tabSort) }), []];
    case 'cycleScope':
      return [setUi(state, { scope: ui.scope === 'all' ? 'current' : 'all', selection: ui.selection && new Set(), cursor: undefined }), []];
    case 'toggleSite':
      return [setUi(state, { expanded: toggleInSet(ui.expanded, action.domain, action.open), cursor: `site:${action.domain}` }), []];

    case 'openReview':
      return [setUi(state, { reviewOpen: true, query: '', selection: undefined, overrides: new Map(), cursor: undefined }), []];
    case 'closeReview':
      return [setUi(state, { reviewOpen: false, overrides: new Map(), cursor: undefined }), []];
    case 'flip': {
      if (!state.snapshot) return [state, []];
      const copy = duplicatePlan(state.snapshot, ui)
        .flatMap((s) => s.copies)
        .find((c) => c.tab.id === action.tabId);
      if (!copy) return [state, []];
      const overrides = new Map(ui.overrides).set(action.tabId, copy.decision.action === 'keep' ? 'close' : 'keep');
      return [setUi(state, { overrides, cursor: `copy:${action.tabId}` }), []];
    }
    case 'confirmReview': {
      if (!state.snapshot) return [state, []];
      const tabs = tabsToClose(duplicatePlan(state.snapshot, ui));
      const [s, effects] = startClose(setUi(state, { reviewOpen: false, overrides: new Map(), cursor: undefined }), tabs, 'duplicate', true);
      return [s, effects];
    }

    case 'activate': {
      const tab = tabsById(state, [action.tabId])[0];
      if (!tab) return [state, []];
      const [s, effects] = withToast(state, `Switched to “${tab.title}”`);
      return [s, [{ kind: 'activate', tabId: tab.id }, ...effects]];
    }
    case 'closeTab':
      return startClose(state, tabsById(state, [action.tabId]), 'tab', false);
    case 'closeSite':
      return startClose(state, siteTabs(state, action.domain), 'tab', true);
    case 'unloadSite':
      return startUnload(state, siteTabs(state, action.domain));
    case 'closeResults':
      return startClose(state, resultTabs(state), 'tab', true);
    case 'unloadResults':
      return startUnload(state, resultTabs(state));
    case 'closed': {
      const closing = new Set(ui.closing);
      for (const t of action.tabs) closing.delete(t.id);
      return withToast(setUi(state, { closing }), action.message, action.tabs);
    }
    case 'undo': {
      const tabs = ui.toast?.undo;
      if (!tabs?.length) return [state, []];
      return [setUi(state, { toast: undefined }), [{ kind: 'restore', tabs }]];
    }
    case 'restored':
      return withToast(state, `Restored ${plural(action.count, 'tab')}`);
    case 'dismissToast':
      return ui.toast?.id === action.id ? [setUi(state, { toast: undefined }), []] : [state, []];

    case 'toggleSelectMode':
      return [setUi(state, { selection: ui.selection ? undefined : new Set(), reviewOpen: false }), []];
    case 'exitSelect':
      return [setUi(state, { selection: undefined }), []];
    case 'toggleSelected': {
      const selection = new Set(ui.selection ?? []);
      const order = navOrder(deriveModel(state));
      const key = `tab:${action.tabId}` as const;
      const anchor = ui.cursor && order.includes(ui.cursor) ? order.indexOf(ui.cursor) : -1;
      if (action.range && anchor !== -1) {
        const target = order.indexOf(key);
        for (const k of order.slice(Math.min(anchor, target), Math.max(anchor, target) + 1)) {
          const id = tabIdOf(k);
          if (id !== null) selection.add(id);
        }
      } else if (selection.has(action.tabId)) selection.delete(action.tabId);
      else selection.add(action.tabId);
      return [setUi(state, { selection, cursor: key }), []];
    }
    case 'closeSelected': {
      const [s, effects] = startClose(state, tabsById(state, ui.selection ?? []), 'tab', true);
      return [setUi(s, { selection: undefined }), effects];
    }
    case 'unloadSelected': {
      const [s, effects] = startUnload(state, tabsById(state, ui.selection ?? []));
      return [setUi(s, { selection: undefined }), effects];
    }
    case 'moveSelected': {
      const ids = [...(ui.selection ?? [])];
      if (ids.length === 0) return [state, []];
      const [s, effects] = withToast(setUi(state, { selection: undefined }), `Moved ${plural(ids.length, 'tab')} to a new window`);
      return [s, [{ kind: 'move', tabIds: ids }, ...effects]];
    }

    case 'setCursor':
      return [setUi(state, { cursor: action.key }), []];
    case 'moveCursor': {
      const order = navOrder(deriveModel(state));
      if (order.length === 0) return [state, []];
      const at = ui.cursor ? order.indexOf(ui.cursor) : -1;
      const target = at === -1 ? (action.delta > 0 ? 0 : order.length - 1) : Math.min(order.length - 1, Math.max(0, at + action.delta));
      return [setUi(state, { cursor: order[target] }), []];
    }
    case 'cursorTo': {
      const order = navOrder(deriveModel(state));
      return [setUi(state, { cursor: action.where === 'first' ? order[0] : order[order.length - 1] }), []];
    }
    case 'extendSelection': {
      if (!ui.selection) return [state, []];
      const order = navOrder(deriveModel(state));
      const at = ui.cursor ? order.indexOf(ui.cursor) : -1;
      const target = order[Math.min(order.length - 1, Math.max(0, at + action.delta))];
      const selection = new Set(ui.selection);
      for (const key of [ui.cursor, target]) {
        const id = tabIdOf(key);
        if (id !== null && key?.startsWith('tab:')) selection.add(id);
      }
      return [setUi(state, { selection, cursor: target }), []];
    }
    case 'selectAll': {
      if (!ui.selection) return [state, []];
      const ids = navOrder(deriveModel(state)).flatMap((k) => (k.startsWith('tab:') ? [Number(k.slice(4))] : []));
      return [setUi(state, { selection: new Set(ids) }), []];
    }
    case 'toggleView':
      return update(state, { type: 'setView', view: ui.view === 'sites' ? 'tabs' : 'sites' });
    case 'toggleHelp':
      return [setUi(state, { helpOpen: !ui.helpOpen }), []];
    case 'cursorKey':
      return onCursorKey(state, action.key);
    case 'openSettings': {
      const [s, effects] = withToast(state, 'Settings open in a new tab');
      return [s, [{ kind: 'openSettings' }, ...effects]];
    }
  }
}
