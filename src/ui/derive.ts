/** Browser snapshot + UI state → the PopupModel the renderer draws. */
import { applyOverrides, planDuplicates, protection, tabsToClose, type DuplicateSet as PlanSet } from '../core/duplicates';
import { parseQuery, searchTabs, splitField } from '../core/search';
import { countCopies, domainOf, duplicateKey, formatAge, pathOf } from '../core/tabs';
import type { Snapshot, Tab } from '../core/types';
import { loadingModel, type DuplicateCopy, type DuplicateSet, type GroupLabel, type WindowGroup, type WindowRun, type PopupModel, type Range, type SiteGroup, type TabRow } from './model';
import type { AppState, UiState } from './state';

/** Results drawn before "Show all": more is slow to draw and nobody reads it; keep typing. */
export const SEARCH_SHOWN = 150;

/** Tabs in the popup's scope. Search ignores scope and always sees every window. */
export function scopedTabs(snapshot: Snapshot, ui: UiState): Tab[] {
  return ui.scope === 'current' ? snapshot.tabs.filter((t) => t.windowId === snapshot.focusedWindowId) : [...snapshot.tabs];
}

export function duplicatePlan(snapshot: Snapshot, ui: UiState): PlanSet[] {
  return applyOverrides(planDuplicates(scopedTabs(snapshot, ui), ui.policy), ui.overrides, ui.policy);
}

function toRow(tab: Tab, snapshot: Snapshot, copies: Map<string, number>, ui: UiState): TabRow {
  const domain = domainOf(tab.url);
  const key = duplicateKey(tab, ui.policy.match);
  const count = key ? (copies.get(key) ?? 0) : 0;
  return {
    id: tab.id,
    title: tab.title || tab.url || 'Untitled',
    detail: domain || tab.url,
    domain,
    favIconUrl: tab.favIconUrl,
    current: tab.active && tab.windowId === snapshot.focusedWindowId,
    pinned: tab.pinned,
    audible: tab.audible,
    muted: tab.muted,
    unloaded: tab.discarded,
    copies: count > 1 ? count : undefined,
    age: formatAge(snapshot.now - tab.lastAccessed),
    closing: ui.closing.has(tab.id),
  };
}

const byTitle = (a: Tab, b: Tab) => a.title.localeCompare(b.title);

function sortTabs(tabs: Tab[], ui: UiState, copies: Map<string, number>): Tab[] {
  const key = (t: Tab) => duplicateKey(t, ui.policy.match) ?? '';
  const copiesOf = (t: Tab) => copies.get(key(t)) ?? 0;
  switch (ui.tabSort) {
    case 'recent':
      return tabs.sort((a, b) => b.lastAccessed - a.lastAccessed);
    case 'oldest':
      return tabs.sort((a, b) => a.lastAccessed - b.lastAccessed);
    case 'title':
      return tabs.sort(byTitle);
    case 'site':
      return tabs.sort((a, b) => domainOf(a.url).localeCompare(domainOf(b.url)) || byTitle(a, b));
    case 'copies':
      return tabs.sort((a, b) => copiesOf(b) - copiesOf(a) || key(a).localeCompare(key(b)));
  }
}

/** Window labels as people count them: Window 1, Window 2… in id order. */
function windowNumbers(snapshot: Snapshot): (t: Tab) => number {
  const windows = [...new Set(snapshot.tabs.map((t) => t.windowId))].sort((a, b) => a - b);
  return (t) => windows.indexOf(t.windowId) + 1;
}

/**
 * Under a site its name is already in the header, so a tab's second line says
 * what tells it apart: the page path, the window when the site spans several,
 * and how long ago it was used when it is one of several copies.
 */
function nestedDetail(tab: Tab, row: TabRow, spansWindows: boolean, windowOf: (t: Tab) => number): string {
  // Copies share a path, so where they sit is what tells them apart.
  const where = row.copies ? `Window ${windowOf(tab)}, tab ${tab.index + 1}` : spansWindows && `Window ${windowOf(tab)}`;
  return [pathOf(tab.url) || tab.url, where, row.copies && row.age && (row.age === 'now' ? 'used now' : `used ${row.age} ago`)]
    .filter(Boolean)
    .join(' · ');
}

function siteGroups(tabs: Tab[], rows: Map<number, TabRow>, ui: UiState, snapshot: Snapshot): SiteGroup[] {
  const windowOf = windowNumbers(snapshot);
  const groups = new Map<string, Tab[]>();
  for (const tab of tabs) {
    const domain = domainOf(tab.url) || 'Other';
    const group = groups.get(domain);
    if (group) group.push(tab);
    else groups.set(domain, [tab]);
  }
  const recent = (ts: Tab[]) => Math.max(...ts.map((t) => t.lastAccessed));
  const entries = [...groups];
  if (ui.siteSort === 'most') entries.sort((a, b) => b[1].length - a[1].length || a[0].localeCompare(b[0]));
  if (ui.siteSort === 'name') entries.sort((a, b) => a[0].localeCompare(b[0]));
  if (ui.siteSort === 'recent') entries.sort((a, b) => recent(b[1]) - recent(a[1]));
  return entries.map(([domain, ts]) => ({
    domain,
    favIconUrl: ts.find((t) => t.favIconUrl)?.favIconUrl,
    expanded: ui.expanded.has(domain),
    tabs: ((spansWindows) =>
      ts.flatMap((t) => {
        const row = rows.get(t.id);
        return row ? [{ ...row, detail: nestedDetail(t, row, spansWindows, windowOf) }] : [];
      }))(new Set(ts.map((x) => x.windowId)).size > 1),
  }));
}

/**
 * Every window (the Windows view ignores scope), each with its tab strip cut
 * into runs: a tab group, or the ungrouped tabs between groups.
 */
function windowGroups(snapshot: Snapshot, ui: UiState): WindowGroup[] {
  const copies = countCopies(snapshot.tabs, ui.policy.match);
  const extras = new Set(tabsToClose(planDuplicates(snapshot.tabs, ui.policy)).map((t) => t.id));
  const groups = new Map((snapshot.groups ?? []).map((g): [number, GroupLabel] => [g.id, { id: g.id, title: g.title, color: g.color, collapsed: g.collapsed }]));
  const byWindow = new Map<number, Tab[]>();
  for (const t of snapshot.tabs) {
    const list = byWindow.get(t.windowId);
    if (list) list.push(t);
    else byWindow.set(t.windowId, [t]);
  }
  return [...byWindow.keys()]
    .sort((a, b) => a - b)
    .map((id, i): WindowGroup => {
      const tabs = byWindow.get(id)!.sort((a, b) => a.index - b.index);
      const runs: WindowRun[] = [];
      for (const t of tabs) {
        const group = groups.get(t.groupId);
        const row = toRow(t, snapshot, copies, ui);
        const dot = {
          id: t.id,
          domain: row.domain,
          title: row.title,
          current: t.active,
          duplicate: extras.has(t.id),
          playing: t.audible,
          unloaded: t.discarded,
          pinned: t.pinned,
        };
        const last = runs[runs.length - 1];
        if (last && last.group?.id === group?.id) {
          last.dots.push(dot);
          last.tabs.push(row);
        } else runs.push({ group, dots: [dot], tabs: [row] });
      }
      return {
        id,
        n: i + 1,
        current: id === snapshot.focusedWindowId,
        tabCount: tabs.length,
        siteCount: new Set(tabs.map((t) => domainOf(t.url) || 'Other')).size,
        groupCount: runs.filter((r) => r.group).length,
        duplicates: tabs.filter((t) => extras.has(t.id)).length,
        closable: tabs.filter((t) => protection(t, ui.policy) === null && !ui.closing.has(t.id)).length,
        protectedCount: tabs.filter((t) => protection(t, ui.policy) !== null).length,
        playing: tabs.some((t) => t.audible),
        lastUsed: formatAge(snapshot.now - Math.max(...tabs.map((t) => t.lastAccessed))),
        expanded: ui.openWindows.has(id),
        runs,
      };
    });
}

function reviewSets(plan: PlanSet[], snapshot: Snapshot, ui: UiState, rows: ReadonlyMap<number, TabRow>): DuplicateSet[] {
  const windowOf = windowNumbers(snapshot);
  const where = (t: Tab) => `Window ${windowOf(t)} · tab ${t.index + 1}`;
  return plan.map((set): DuplicateSet => {
    const first = set.copies[0]?.tab;
    const copies = set.copies.map(({ tab, decision }): DuplicateCopy => ({
      tabId: tab.id,
      row: rows.get(tab.id) ?? toRow(tab, snapshot, new Map(), ui),
      location: where(tab),
      locked: protection(tab, ui.policy) !== null,
      closing: ui.closing.has(tab.id),
      verdict:
        decision.action === 'keep'
          ? { action: 'keep' as const, reason: decision.reason }
          : { action: 'close' as const, age: formatAge(snapshot.now - tab.lastAccessed) },
    }));
    const closers = set.copies.filter((c) => c.decision.action === 'close').map((c) => c.tab);
    const keepers = copies.filter((c) => c.verdict.action === 'keep');
    return {
      key: set.key,
      title: first?.title || set.key,
      domain: first ? domainOf(first.url) : '',
      favIconUrl: set.copies.find((c) => c.tab.favIconUrl)?.tab.favIconUrl,
      address: displayUrl(set.key, []).text,
      kept: keepers.length === 1 ? keepers[0]!.location : `${keepers.length} kept`,
      expanded: ui.setOpen.get(set.key) ?? set.copies.length <= OPEN_UP_TO,
      resolving: closers.length > 0 && closers.every((t) => ui.closing.has(t.id)),
      size: set.copies.length,
      toClose: closers.filter((t) => !ui.closing.has(t.id)).length,
      copies,
    };
  });
}

/**
 * Of `among`, the copies duplicate cleanup would close: planned over every tab
 * (so each page's keeper is chosen as usual and stays), then limited to `among`.
 */
export function extraCopies(snapshot: Snapshot, ui: UiState, among: readonly Tab[]): Tab[] {
  const ids = new Set(among.map((t) => t.id));
  return tabsToClose(planDuplicates(snapshot.tabs, ui.policy)).filter((t) => ids.has(t.id) && !ui.closing.has(t.id));
}

/** Sets with this many copies or fewer start open in review; bigger ones start folded. */
const OPEN_UP_TO = 3;

/** URL without `https://` / `http://` / `www.`, with highlight ranges shifted to match. */
export function displayUrl(url: string, ranges: readonly Range[]): { text: string; ranges: Range[] } {
  const cut = /^(https?:\/\/)?(www\.)?/.exec(url)?.[0].length ?? 0;
  return {
    text: url.slice(cut),
    ranges: ranges.map(([s, e]): Range => [Math.max(0, s - cut), e - cut]).filter(([s, e]) => e > s),
  };
}

/**
 * Models already derived, by state. States are immutable (every update makes a
 * new one), so identity is a safe key; one ↓ press used to derive the same
 * state up to three times (update, withValidCursor, render). Treat the model
 * returned as read-only: it may be shared.
 */
const derived = new WeakMap<AppState, PopupModel>();

export function deriveModel(state: AppState): PopupModel {
  let model = derived.get(state);
  if (!model) {
    model = computeModel(state);
    derived.set(state, model);
  }
  return model;
}

function computeModel({ snapshot, ui }: AppState): PopupModel {
  if (!snapshot) return { ...loadingModel(), searchFocused: ui.searchFocused, helpOpen: ui.helpOpen, scope: ui.scope };

  const tabs = scopedTabs(snapshot, ui);
  const copies = countCopies(tabs, ui.policy.match);
  const rows = new Map(tabs.map((t) => [t.id, toRow(t, snapshot, copies, ui)]));
  const plan = duplicatePlan(snapshot, ui);
  const base = {
    tabCount: tabs.length,
    siteCount: new Set(tabs.map((t) => domainOf(t.url) || 'Other')).size,
    windowCount: new Set(tabs.map((t) => t.windowId)).size,
    windowTotal: new Set(snapshot.tabs.map((t) => t.windowId)).size,
    duplicates: { extra: tabsToClose(planDuplicates(tabs, ui.policy)).filter((t) => !ui.closing.has(t.id)).length, sets: plan.length },
    scope: ui.scope,
    searchFocused: ui.searchFocused,
    helpOpen: ui.helpOpen,
    cursor: ui.cursor,
    selection: ui.selection,
    toast: ui.toast && { id: ui.toast.id, message: ui.toast.message, undo: Boolean(ui.toast.undo?.length) },
    playing: snapshot.tabs
      .filter((t) => t.audible)
      .sort((a, b) => b.lastAccessed - a.lastAccessed)
      .map((t) => toRow(t, snapshot, copies, ui)),
  };

  if (ui.reviewOpen) {
    return { ...base, screen: { kind: 'review', keep: ui.policy.keep, protectGroups: ui.policy.protectGroups, sets: reviewSets(plan, snapshot, ui, rows) } };
  }

  if (ui.query.trim()) {
    const parsed = parseQuery(ui.query);
    const allCopies = countCopies(snapshot.tabs, ui.policy.match);
    const hits = searchTabs(snapshot.tabs, parsed, ui.policy.match);
    return {
      ...base,
      screen: {
        kind: 'search',
        query: ui.query,
        ...(({ field, rest }) => ({ field, text: rest }))(splitField(ui.query)),
        mode: parsed.mode,
        total: hits.length,
        windowCount: new Set(hits.map((h) => h.tab.windowId)).size,
        extra: parsed.field === 'dupe' ? extraCopies(snapshot, ui, hits.map((h) => h.tab)).length : undefined,
        results: (ui.showAllResults ? hits : hits.slice(0, SEARCH_SHOWN)).map(({ tab, titleRanges, urlRanges }) => {
          const { text, ranges } = displayUrl(tab.url, urlRanges);
          return { ...toRow(tab, snapshot, allCopies, ui), detail: text, titleMatches: titleRanges, detailMatches: ranges };
        }),
      },
    };
  }

  if (ui.view === 'windows') {
    return { ...base, screen: { kind: 'windows', windows: windowGroups(snapshot, ui) } };
  }

  if (ui.view === 'sites') {
    return { ...base, screen: { kind: 'sites', sort: ui.siteSort, groups: siteGroups(tabs, rows, ui, snapshot) } };
  }

  const sorted = sortTabs(tabs, ui, copies);
  return { ...base, screen: { kind: 'tabs', sort: ui.tabSort, rows: sorted.map((t) => rows.get(t.id)).filter((r): r is TabRow => !!r) } };
}
