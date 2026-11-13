/**
 * View model for the popup: everything the UI needs to render, nothing more.
 * Rendering is a pure function of this model (see `renderPopup`). The live
 * popup derives it from browser state; the screen gallery builds it from fixtures.
 */

/** Half-open `[start, end)` character range to highlight. */
export type Range = readonly [start: number, end: number];

/** Stable key for whatever the keyboard cursor is on. */
export type ItemKey = `tab:${number}` | `site:${string}` | `copy:${number}`;

export interface TabRow {
  id: number;
  title: string;
  /** Secondary line: the domain while browsing, the full URL in search results. */
  detail: string;
  domain: string;
  favIconUrl?: string;
  current?: boolean;
  pinned?: boolean;
  audible?: boolean;
  /** Discarded by the browser or by ATO; still in the tab strip. */
  unloaded?: boolean;
  /** Number of copies when this tab is part of a duplicate set (≥ 2). */
  copies?: number;
  /** Short relative time since last access, e.g. `"12m"`. */
  age?: string;
  titleMatches?: readonly Range[];
  detailMatches?: readonly Range[];
}

export interface SiteGroup {
  domain: string;
  favIconUrl?: string;
  tabs: TabRow[];
  expanded: boolean;
}

export type KeepReason = 'current' | 'pinned' | 'grouped' | 'oldest' | 'newest';

export type CopyVerdict =
  | { action: 'keep'; reason: KeepReason }
  | { action: 'close'; age: string };

export interface DuplicateCopy {
  tabId: number;
  /** Human location, e.g. `"Window 1 · tab 4"`. */
  location: string;
  verdict: CopyVerdict;
}

export interface DuplicateSet {
  title: string;
  domain: string;
  copies: DuplicateCopy[];
}

export type SearchMode = 'fuzzy' | 'exact' | 'wildcard';
export type TabSort = 'recent' | 'oldest' | 'title' | 'site' | 'copies';
export type SiteSort = 'most' | 'name' | 'recent';
export type Scope = 'all' | 'current';

export type Screen =
  | { kind: 'loading' }
  | { kind: 'tabs'; sort: TabSort; rows: TabRow[] }
  | { kind: 'sites'; sort: SiteSort; groups: SiteGroup[] }
  | { kind: 'search'; query: string; mode: SearchMode; results: TabRow[]; windowCount: number }
  | { kind: 'review'; keep: 'oldest' | 'newest'; protectGroups: boolean; sets: DuplicateSet[] };

export interface DuplicateSummary {
  /** Extra copies across all sets: what cleanup would close at most. */
  extra: number;
  sets: number;
}

export interface PopupModel {
  tabCount: number;
  siteCount: number;
  windowCount: number;
  duplicates: DuplicateSummary;
  scope: Scope;
  screen: Screen;
  searchFocused: boolean;
  cursor?: ItemKey;
  /** Present while in Select mode; holds the selected tab ids. */
  selection?: ReadonlySet<number>;
  toast?: { message: string; undo: boolean };
}

export function loadingModel(): PopupModel {
  return {
    tabCount: 0,
    siteCount: 0,
    windowCount: 0,
    duplicates: { extra: 0, sets: 0 },
    scope: 'all',
    screen: { kind: 'loading' },
    searchFocused: true,
  };
}
