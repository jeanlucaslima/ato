/** What the popup remembers between renders, separate from browser data. */
import { DEFAULT_POLICY, type DuplicatePolicy } from '../core/duplicates';
import type { Snapshot, Tab } from '../core/types';
import type { ItemKey, Scope, SiteSort, TabSort } from './model';

export interface Toast {
  id: number;
  message: string;
  /** Tabs that Undo would bring back. */
  undo?: readonly Tab[];
}

export interface UiState {
  view: 'tabs' | 'sites';
  tabSort: TabSort;
  siteSort: SiteSort;
  scope: Scope;
  query: string;
  searchFocused: boolean;
  reviewOpen: boolean;
  /** Keyboard shortcuts panel. */
  helpOpen: boolean;
  expanded: ReadonlySet<string>;
  cursor?: ItemKey;
  /** Browse cursor to restore when search is cleared. */
  searchReturn?: ItemKey;
  /** Present while in Select mode. */
  selection?: ReadonlySet<number>;
  /** Keep/close choices made in duplicate review, by tab id. */
  overrides: ReadonlyMap<number, 'keep' | 'close'>;
  /** Tabs animating out before they are actually closed. */
  closing: ReadonlySet<number>;
  toast?: Toast;
  policy: DuplicatePolicy;
}

export interface AppState {
  /** `null` until the first browser snapshot arrives. */
  snapshot: Snapshot | null;
  ui: UiState;
}

export function initialUi(overrides: Partial<UiState> = {}): UiState {
  return {
    view: 'tabs',
    tabSort: 'recent',
    siteSort: 'most',
    scope: 'all',
    query: '',
    searchFocused: true,
    reviewOpen: false,
    helpOpen: false,
    expanded: new Set(),
    overrides: new Map(),
    closing: new Set(),
    policy: DEFAULT_POLICY,
    ...overrides,
  };
}
