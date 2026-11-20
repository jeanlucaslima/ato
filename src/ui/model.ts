/**
 * View model for the popup: everything the UI needs to render, nothing more.
 * Rendering is a pure function of this model (see `renderPopup`). The live
 * popup derives it from browser state + UI state (see `derive.ts`).
 */

/** Half-open `[start, end)` character range to highlight. */
export type Range = readonly [start: number, end: number];

/** Stable key for whatever the keyboard cursor is on. */
export type ItemKey = `tab:${number}` | `site:${string}` | `copy:${number}` | `fold:${string}`;

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
  muted?: boolean;
  /** Discarded by the browser or by ATO; still in the tab strip. */
  unloaded?: boolean;
  /** Number of copies when this tab is part of a duplicate set (≥ 2). */
  copies?: number;
  /** Short relative time since last access, e.g. `"12m"`. */
  age?: string;
  /** Animating out; about to be closed. */
  closing?: boolean;
  titleMatches?: readonly Range[];
  detailMatches?: readonly Range[];
}

export interface SiteGroup {
  domain: string;
  favIconUrl?: string;
  tabs: TabRow[];
  expanded: boolean;
}

import type { KeepReason } from '../core/duplicates';

export type { KeepReason };

export type CopyVerdict =
  | { action: 'keep'; reason: KeepReason }
  | { action: 'close'; age: string };

export interface DuplicateCopy {
  tabId: number;
  /** The copy as a tab: its own title, favicon and marks (current, playing, pinned). */
  row: TabRow;
  /** Human location, e.g. `"Window 1 · tab 4"`. */
  location: string;
  verdict: CopyVerdict;
  /** Protected (current, playing, pinned, grouped): always kept, can't be flipped. */
  locked: boolean;
  /** Confirmed and animating out; the browser is closing it. */
  closing: boolean;
}

/** A big set's Close copies as one row, so a set of 18 doesn't fill the list. */
export interface CopyFold {
  /** Copies it stands for. */
  count: number;
  open: boolean;
  /** Where they are, e.g. `"Window 18"` or `"3 windows"`. */
  where: string;
  /** Last-used range, e.g. `"now – 5h"`. */
  ages: string;
  favIconUrl?: string;
  /** All of them confirmed and on their way out. */
  closing: boolean;
}

export interface DuplicateSet {
  /** The duplicate key (the shared URL). */
  key: string;
  title: string;
  domain: string;
  /** The address every copy shares, without the scheme: what makes them duplicates. */
  address: string;
  /** Every copy it closes is on its way out: the set folds away once they're gone. */
  resolving: boolean;
  /** Every copy in the set, folded ones included. */
  size: number;
  /** Copies not yet confirmed that this set would close (folded ones included). */
  toClose: number;
  /** Copies shown as rows, in order; a closed fold leaves out the copies it stands for. */
  copies: DuplicateCopy[];
  fold?: CopyFold;
}

export type SearchMode = 'contains' | 'exact';
export type { SearchField } from '../core/search';
import type { SearchField } from '../core/search';
export type TabSort = 'recent' | 'oldest' | 'title' | 'site' | 'copies';
export type SiteSort = 'most' | 'name' | 'recent';
export type Scope = 'all' | 'current';

export type Screen =
  | { kind: 'loading' }
  | { kind: 'tabs'; sort: TabSort; rows: TabRow[] }
  | { kind: 'sites'; sort: SiteSort; groups: SiteGroup[] }
  | {
      kind: 'search';
      query: string;
      /** A leading `url:` / `title:`, shown as a chip in the search field. */
      field: SearchField | null;
      /** What the search field holds: the query without the chip's prefix. */
      text: string;
      mode: SearchMode;
      results: TabRow[];
      windowCount: number;
      /** `dupe:` only: extra copies among the results, what "Close" there closes (one of each stays). */
      extra?: number;
    }
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
  helpOpen: boolean;
  cursor?: ItemKey;
  /** Present while in Select mode; holds the selected tab ids. */
  selection?: ReadonlySet<number>;
  toast?: { id: number; message: string; undo: boolean };
  /** Tabs making sound, in any window, most recent first. */
  playing: TabRow[];
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
    helpOpen: false,
    playing: [],
  };
}
