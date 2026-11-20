/** Browser snapshot + UI state → the PopupModel the renderer draws. */
import { applyOverrides, planDuplicates, protection, tabsToClose, type DuplicateSet as PlanSet } from '../core/duplicates';
import { parseQuery, searchTabs, splitField } from '../core/search';
import { countCopies, domainOf, duplicateKey, formatAge, pathOf } from '../core/tabs';
import type { Snapshot, Tab } from '../core/types';
import { loadingModel, type DuplicateSet, type PopupModel, type Range, type SiteGroup, type TabRow } from './model';
import type { AppState, UiState } from './state';

/** Tabs in the popup's scope. Search ignores scope and always sees every window. */
export function scopedTabs(snapshot: Snapshot, ui: UiState): Tab[] {
  return ui.scope === 'current' ? snapshot.tabs.filter((t) => t.windowId === snapshot.focusedWindowId) : [...snapshot.tabs];
}

export function duplicatePlan(snapshot: Snapshot, ui: UiState): PlanSet[] {
  return applyOverrides(planDuplicates(scopedTabs(snapshot, ui), ui.policy), ui.overrides, ui.policy);
}

function toRow(tab: Tab, snapshot: Snapshot, copies: Map<string, number>, ui: UiState): TabRow {
  const domain = domainOf(tab.url);
  const key = duplicateKey(tab);
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
  const copiesOf = (t: Tab) => copies.get(duplicateKey(t) ?? '') ?? 0;
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
      return tabs.sort((a, b) => copiesOf(b) - copiesOf(a) || (duplicateKey(a) ?? '').localeCompare(duplicateKey(b) ?? ''));
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
    tabs: ts.flatMap((t) => {
      const row = rows.get(t.id);
      const spansWindows = new Set(ts.map((x) => x.windowId)).size > 1;
      return row ? [{ ...row, detail: nestedDetail(t, row, spansWindows, windowOf) }] : [];
    }),
  }));
}

function reviewSets(plan: PlanSet[], snapshot: Snapshot, ui: UiState, rows: ReadonlyMap<number, TabRow>): DuplicateSet[] {
  const windowOf = windowNumbers(snapshot);
  const where = (t: Tab) => `Window ${windowOf(t)} · tab ${t.index + 1}`;
  return plan.map((set) => {
    const first = set.copies[0]?.tab;
    return {
      title: first?.title || set.key,
      domain: first ? domainOf(first.url) : '',
      address: displayUrl(set.key, []).text,
      copies: set.copies.map(({ tab, decision }) => ({
        tabId: tab.id,
        row: rows.get(tab.id) ?? toRow(tab, snapshot, new Map(), ui),
        location: where(tab),
        locked: protection(tab, ui.policy) !== null,
        verdict:
          decision.action === 'keep'
            ? { action: 'keep' as const, reason: decision.reason }
            : { action: 'close' as const, age: formatAge(snapshot.now - tab.lastAccessed) },
      })),
    };
  });
}

/** URL without `https://` / `http://` / `www.`, with highlight ranges shifted to match. */
export function displayUrl(url: string, ranges: readonly Range[]): { text: string; ranges: Range[] } {
  const cut = /^(https?:\/\/)?(www\.)?/.exec(url)?.[0].length ?? 0;
  return {
    text: url.slice(cut),
    ranges: ranges.map(([s, e]): Range => [Math.max(0, s - cut), e - cut]).filter(([s, e]) => e > s),
  };
}

export function deriveModel({ snapshot, ui }: AppState): PopupModel {
  if (!snapshot) return { ...loadingModel(), searchFocused: ui.searchFocused, helpOpen: ui.helpOpen, scope: ui.scope };

  const tabs = scopedTabs(snapshot, ui);
  const copies = countCopies(tabs);
  const rows = new Map(tabs.map((t) => [t.id, toRow(t, snapshot, copies, ui)]));
  const plan = duplicatePlan(snapshot, ui);
  const base = {
    tabCount: tabs.length,
    siteCount: new Set(tabs.map((t) => domainOf(t.url) || 'Other')).size,
    windowCount: new Set(tabs.map((t) => t.windowId)).size,
    duplicates: { extra: tabsToClose(planDuplicates(tabs, ui.policy)).length, sets: plan.length },
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
    const allCopies = countCopies(snapshot.tabs);
    const hits = searchTabs(snapshot.tabs, parsed);
    return {
      ...base,
      screen: {
        kind: 'search',
        query: ui.query,
        ...(({ field, rest }) => ({ field, text: rest }))(splitField(ui.query)),
        mode: parsed.mode,
        windowCount: new Set(hits.map((h) => h.tab.windowId)).size,
        results: hits.map(({ tab, titleRanges, urlRanges }) => {
          const { text, ranges } = displayUrl(tab.url, urlRanges);
          return { ...toRow(tab, snapshot, allCopies, ui), detail: text, titleMatches: titleRanges, detailMatches: ranges };
        }),
      },
    };
  }

  if (ui.view === 'sites') {
    return { ...base, screen: { kind: 'sites', sort: ui.siteSort, groups: siteGroups(tabs, rows, ui, snapshot) } };
  }

  const sorted = sortTabs(tabs, ui, copies);
  return { ...base, screen: { kind: 'tabs', sort: ui.tabSort, rows: sorted.map((t) => rows.get(t.id)).filter((r): r is TabRow => !!r) } };
}
