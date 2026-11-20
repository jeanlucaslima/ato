/**
 * The popup's state machine: `update(state, action)` → next state + effects.
 * Pure — browser work is described as effects and run by the runtime (`app.ts`).
 */
import { protection, tabsToClose } from '../core/duplicates';
import { parseQuery, searchTabs, splitField } from '../core/search';
import { domainOf } from '../core/tabs';
import type { Tab } from '../core/types';
import type { Action, Effect } from './actions';
import { deriveModel, duplicatePlan, extraCopies, scopedTabs } from './derive';
import { plural } from './format';
import { PLAYING_ROWS, type ItemKey, type PopupModel, type SiteSort, type TabSort } from './model';
import type { AppState, Toast, UiState } from './state';

export type Result = [AppState, Effect[]];

const TAB_SORTS: TabSort[] = ['recent', 'oldest', 'title', 'site', 'copies'];
const SITE_SORTS: SiteSort[] = ['most', 'name', 'recent'];
const next = <T>(list: readonly T[], value: T): T => list[(list.indexOf(value) + 1) % list.length] ?? value;

/** Above the list on the browse screens: the duplicates bar (when there are any) and Now playing. */
function frontKeys(model: PopupModel): ItemKey[] {
  return [...(model.duplicates.extra > 0 ? ['dupes' as const] : []), ...model.playing.slice(0, PLAYING_ROWS).map((r) => `play:${r.id}` as const)];
}

/** Keys the cursor can visit, in screen order. */
export function navOrder(model: PopupModel): ItemKey[] {
  const s = model.screen;
  const front = s.kind === 'tabs' || s.kind === 'sites' || s.kind === 'windows' ? frontKeys(model) : [];
  return [...front, ...listOrder(model)];
}

function listOrder(model: PopupModel): ItemKey[] {
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
    case 'windows':
      return s.windows.flatMap((w): ItemKey[] => [`win:${w.id}`, ...(w.expanded ? w.runs.flatMap((r) => r.tabs.map((t) => `tab:${t.id}` as const)) : [])]);
    case 'review':
      return s.sets.flatMap((set): ItemKey[] => [`set:${set.key}`, ...(set.expanded ? set.copies.map((c) => `copy:${c.tabId}` as const) : [])]);
  }
}

const tabIdOf = (key: ItemKey | undefined): number | null =>
  key?.startsWith('tab:') || key?.startsWith('copy:') || key?.startsWith('play:') ? Number(key.split(':')[1]) : null;

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

/** Drop a cursor that no longer points at anything visible; in search, fall back to the first hit. */
function withValidCursor(state: AppState): AppState {
  const order = navOrder(deriveModel(state));
  if (state.ui.cursor && order.includes(state.ui.cursor)) return state;
  return setUi(state, { cursor: state.ui.query.trim() ? order[0] : undefined });
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

/**
 * Gather `tabs` into a new window, in the order they sit now (window by window,
 * left to right). Tabs that already have a window to themselves stay put.
 */
function startMove(state: AppState, tabs: readonly Tab[]): Result {
  if (tabs.length === 0) return withToast(state, 'Nothing to move');
  const windows = new Set(tabs.map((t) => t.windowId));
  const alone = windows.size === 1 && (state.snapshot?.tabs ?? []).every((t) => t.windowId !== tabs[0]!.windowId || tabs.includes(t));
  if (alone) return withToast(state, 'Already in a window of their own');
  // Pinned tabs lead, as Chrome keeps them at the left of a window.
  const ordered = [...tabs].sort((a, b) => Number(b.pinned) - Number(a.pinned) || a.windowId - b.windowId || a.index - b.index);
  const [s, effects] = withToast(state, `Moved ${plural(tabs.length, 'tab')} to a new window`);
  return [s, [{ kind: 'move', tabIds: ordered.map((t) => t.id) }, ...effects]];
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

function windowTabs(state: AppState, windowId: number): Tab[] {
  return state.snapshot?.tabs.filter((t) => t.windowId === windowId).sort((a, b) => a.index - b.index) ?? [];
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

  // Review works like Sites: a set is a header with its copies under it.
  if (ui.reviewOpen) {
    if (cursor?.startsWith('set:')) {
      const setKey = cursor.slice(4);
      if (key === 'enter' || key === 'space') return update(state, { type: 'toggleSet', key: setKey });
      if (key === 'right' || key === 'left') return update(state, { type: 'toggleSet', key: setKey, open: key === 'right' });
      if (key === 'delete') return update(state, { type: 'closeSet', key: setKey });
      if (key === 'unload') return update(state, { type: 'unloadSet', key: setKey });
      return [state, []];
    }
    const id = tabIdOf(cursor);
    if (id === null) return [state, []];
    if (key === 'left' && model.screen.kind === 'review') {
      const set = model.screen.sets.find((s) => s.copies.some((c) => c.tabId === id));
      if (set) return update(state, { type: 'toggleSet', key: set.key, open: false });
    }
    if (key === 'space') return update(state, { type: 'flip', tabId: id });
    if (key === 'enter') return update(state, { type: 'activate', tabId: id });
    if (key === 'delete') return update(state, { type: 'closeTab', tabId: id });
    if (key === 'unload') return startUnload(state, tabsById(state, [id]));
    return [state, []];
  }

  if (cursor === 'dupes') {
    if (key === 'enter' || key === 'space' || key === 'right') return update(state, { type: 'openReview' });
    if (key === 'delete') return update(state, { type: 'closeDuplicates' });
    return [state, []];
  }

  if (cursor?.startsWith('play:')) {
    const tabId = Number(cursor.slice(5));
    if (key === 'enter') return update(state, { type: 'activate', tabId });
    if (key === 'space') return update(state, { type: 'toggleMute', tabId });
    if (key === 'delete') return update(state, { type: 'closeTab', tabId });
    return [state, []];
  }

  if (cursor?.startsWith('site:')) {
    const domain = cursor.slice(5);
    if (key === 'enter' || key === 'space') return update(state, { type: 'toggleSite', domain });
    if (key === 'right') return update(state, { type: 'toggleSite', domain, open: true });
    if (key === 'left') return update(state, { type: 'toggleSite', domain, open: false });
    if (key === 'delete') return update(state, { type: 'closeSite', domain });
    if (key === 'unload') return update(state, { type: 'unloadSite', domain });
    if (key === 'move') return update(state, { type: 'moveSite', domain });
    return [state, []];
  }

  if (cursor?.startsWith('win:')) {
    const windowId = Number(cursor.slice(4));
    if (key === 'enter') return update(state, { type: 'focusWindow', windowId });
    if (key === 'space') return update(state, { type: 'toggleWindow', windowId });
    if (key === 'right' || key === 'left') return update(state, { type: 'toggleWindow', windowId, open: key === 'right' });
    if (key === 'delete') return update(state, { type: 'closeWindow', windowId });
    if (key === 'unload') return update(state, { type: 'unloadWindow', windowId });
    if (key === 'move') return update(state, { type: 'mergeWindow', windowId });
    return [state, []];
  }

  const id = tabIdOf(cursor);
  if (ui.selection) {
    if (key === 'space' && id !== null) return update(state, { type: 'toggleSelected', tabId: id });
    if (key === 'delete') return update(state, { type: 'closeSelected' });
    if (key === 'unload') return update(state, { type: 'unloadSelected' });
    if (key === 'move') return update(state, { type: 'moveSelected' });
  }
  if (key === 'move' && model.screen.kind === 'search') return update(state, { type: 'moveResults' });
  if (id === null) return [state, []];
  if (key === 'enter') return update(state, { type: 'activate', tabId: id });
  if (key === 'delete') return update(state, { type: 'closeTab', tabId: id });
  if (key === 'unload') return startUnload(state, tabsById(state, [id]));
  if (key === 'left' && model.screen.kind === 'windows') {
    const win = model.screen.windows.find((w) => w.runs.some((r) => r.tabs.some((t) => t.id === id)));
    if (win) return [setUi(state, { cursor: `win:${win.id}`, openWindows: toggleInSet(ui.openWindows, win.id, false) }), []];
  }
  if (key === 'left' && model.screen.kind === 'sites') {
    const domain = model.screen.groups.find((g) => g.tabs.some((t) => t.id === id))?.domain;
    if (domain) return [setUi(state, { cursor: `site:${domain}`, expanded: toggleInSet(ui.expanded, domain, false) }), []];
  }
  return [state, []];
}

/**
 * Apply an action. Afterwards the cursor is always unset or on a visible item,
 * whatever the action did (re-render, sort, close, view change — see #48).
 */
export function update(state: AppState, action: Action): Result {
  const [next, effects] = step(state, action);
  return [withValidCursor(next), effects];
}

function step(state: AppState, action: Action): Result {
  const { ui } = state;
  switch (action.type) {
    case 'snapshot': {
      const ids = new Set(action.snapshot.tabs.map((t) => t.id));
      const selection = ui.selection && new Set([...ui.selection].filter((id) => ids.has(id)));
      // A tab under the cursor that vanished hands the cursor to its neighbour.
      const removed = new Set((state.snapshot?.tabs ?? []).map((t) => t.id).filter((id) => !ids.has(id)));
      const cursor = cursorAfter(navOrder(deriveModel(state)), removed, ui.cursor);
      const next: AppState = { snapshot: action.snapshot, ui: { ...ui, selection, cursor } };
      return [withValidCursor(next), []];
    }
    case 'query': {
      // Entering search remembers where browsing was; the first result is ready for Enter.
      const searchReturn = ui.query ? ui.searchReturn : ui.cursor;
      const next = setUi(state, { query: action.text, reviewOpen: false, searchReturn, cursor: undefined, showAllResults: false });
      return [setUi(next, { cursor: action.text.trim() ? navOrder(deriveModel(next))[0] : searchReturn }), []];
    }
    case 'clearQuery':
      return [withValidCursor(setUi(state, { query: '', cursor: ui.searchReturn, searchReturn: undefined })), []];
    case 'clearField': {
      // Removing the chip with nothing typed leaves search, like clearing it.
      const { rest } = splitField(ui.query);
      return update(state, rest.trim() ? { type: 'query', text: rest } : { type: 'clearQuery' });
    }
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

    case 'openReview': {
      // The cursor starts on the first set, so ↵ unfolds it rather than closing anything.
      const opened = setUi(state, { reviewOpen: true, query: '', selection: undefined, overrides: new Map(), setOpen: new Map(), cursor: undefined });
      return [setUi(opened, { cursor: navOrder(deriveModel(opened))[0] }), []];
    }
    case 'closeReview':
      return [setUi(state, { reviewOpen: false, overrides: new Map(), setOpen: new Map(), cursor: undefined }), []];
    case 'toggleSet': {
      const screen = deriveModel(state).screen;
      const shown = screen.kind === 'review' ? screen.sets.find((s) => s.key === action.key)?.expanded : undefined;
      const open = action.open ?? !shown;
      return [setUi(state, { setOpen: new Map(ui.setOpen).set(action.key, open), cursor: `set:${action.key}` }), []];
    }
    case 'unloadSet': {
      if (!state.snapshot) return [state, []];
      const set = duplicatePlan(state.snapshot, ui).find((s) => s.key === action.key);
      return startUnload(state, set ? set.copies.map((c) => c.tab) : []);
    }
    case 'closeSet': {
      if (!state.snapshot) return [state, []];
      const set = duplicatePlan(state.snapshot, ui).find((s) => s.key === action.key);
      const tabs = set ? tabsToClose([set]).filter((t) => !ui.closing.has(t.id)) : [];
      if (tabs.length === 0) return [state, []];
      // The set folds away: hand the cursor to the next set (or the one before).
      const heads = navOrder(deriveModel(state)).filter((k) => k.startsWith('set:'));
      const at = heads.indexOf(`set:${action.key}`);
      const [s, effects] = startClose(state, tabs, 'duplicate', true);
      return [setUi(s, { cursor: heads[at + 1] ?? heads[at - 1] }), effects];
    }
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
      // Review stays open: the copies animate out in place and the sets fold away,
      // ending on "No duplicates left". Copies already on their way out aren't closed twice.
      const tabs = tabsToClose(duplicatePlan(state.snapshot, ui)).filter((t) => !ui.closing.has(t.id));
      if (tabs.length === 0) return [state, []];
      return startClose(state, tabs, 'duplicate', true);
    }

    case 'closeDuplicates': {
      if (!state.snapshot) return [state, []];
      const tabs = tabsToClose(duplicatePlan(state.snapshot, setUi(state, { overrides: new Map() }).ui)).filter((t) => !ui.closing.has(t.id));
      return startClose(state, tabs, 'duplicate', true);
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
    case 'showAllResults':
      return [setUi(state, { showAllResults: true }), []];
    case 'closeResults':
      // dupe: results close only the extra copies: every page keeps one tab.
      if (parseQuery(ui.query).field === 'dupe') return state.snapshot ? startClose(state, extraCopies(state.snapshot, ui, resultTabs(state)), 'duplicate', true) : [state, []];
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
          if (k.startsWith('tab:')) selection.add(Number(k.slice(4)));
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
      const tabs = tabsById(state, ui.selection ?? []);
      if (tabs.length === 0) return [state, []];
      return startMove(setUi(state, { selection: undefined }), tabs);
    }
    case 'moveSite':
      return startMove(state, siteTabs(state, action.domain));
    case 'moveResults':
      return startMove(state, resultTabs(state));

    case 'setCursor':
      return [setUi(state, { cursor: action.key }), []];
    case 'moveCursor': {
      const order = navOrder(deriveModel(state));
      if (order.length === 0) return [state, []];
      const at = ui.cursor ? order.indexOf(ui.cursor) : -1;
      const n = order.length;
      // ↑↓ wrap around the ends; paging stops at them.
      const target =
        at === -1 ? (action.delta > 0 ? 0 : n - 1) : Math.abs(action.delta) === 1 ? (at + action.delta + n) % n : Math.min(n - 1, Math.max(0, at + action.delta));
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
      return update(state, { type: 'setView', view: ui.view === 'tabs' ? 'sites' : ui.view === 'sites' ? 'windows' : 'tabs' });
    case 'toggleWindow':
      return [setUi(state, { openWindows: toggleInSet(ui.openWindows, action.windowId, action.open), cursor: `win:${action.windowId}` }), []];
    case 'focusWindow':
      return [state, [{ kind: 'focusWindow', windowId: action.windowId }]];
    case 'mergeWindow': {
      const target = state.snapshot?.focusedWindowId;
      if (target === undefined || action.windowId === target) return withToast(state, 'That is this window');
      const tabs = windowTabs(state, action.windowId);
      if (tabs.length === 0) return [state, []];
      const [s, effects] = withToast(state, `Moved ${plural(tabs.length, 'tab')} into this window`);
      return [s, [{ kind: 'moveTo', tabIds: tabs.map((t) => t.id), windowId: target }, ...effects]];
    }
    case 'closeWindow':
      return startClose(state, windowTabs(state, action.windowId), 'tab', true);
    case 'unloadWindow':
      return startUnload(state, windowTabs(state, action.windowId));
    case 'toggleHelp':
      return [setUi(state, { helpOpen: !ui.helpOpen }), []];
    case 'cursorKey':
      return onCursorKey(state, action.key);
    case 'toggleMute': {
      const tab = state.snapshot?.tabs.find((t) => t.id === action.tabId);
      return [state, tab ? [{ kind: 'mute', tabId: tab.id, muted: !tab.muted }] : []];
    }
    case 'openSettings': {
      const [s, effects] = withToast(state, 'Settings open in a new tab');
      return [s, [{ kind: 'openSettings' }, ...effects]];
    }
    case 'policy':
      // Review choices stay; protections in the new policy still win over them.
      return [setUi(state, { policy: action.policy }), []];
  }
}
