/** Browser state as ATO sees it: a plain snapshot, independent of the Chrome API. */

export interface Tab {
  id: number;
  windowId: number;
  /** Position within its window. */
  index: number;
  title: string;
  url: string;
  favIconUrl?: string;
  /** Selected tab of its window. Never closed by bulk actions. */
  active: boolean;
  pinned: boolean;
  audible: boolean;
  /** Muted by the user; a muted tab can still be `audible` (playing, unheard). */
  muted?: boolean;
  discarded: boolean;
  /** Side-by-side pair (split view) id, or -1 / absent when not split (Chrome 140+). */
  splitViewId?: number;
  /** Native tab group id, or -1 when ungrouped. */
  groupId: number;
  /** Epoch ms of last access. */
  lastAccessed: number;
}

export type GroupColor = 'grey' | 'blue' | 'red' | 'yellow' | 'green' | 'pink' | 'purple' | 'cyan' | 'orange';

/** A native tab group: its tabs carry its id in `Tab.groupId`. */
export interface TabGroup {
  id: number;
  windowId: number;
  /** May be empty: Chrome groups don't need a name. */
  title: string;
  color: GroupColor;
  /** Folded in the tab strip. */
  collapsed: boolean;
}

export interface Snapshot {
  tabs: readonly Tab[];
  /** Tab groups by id order; absent when unknown (tests, old fixtures). */
  groups?: readonly TabGroup[];
  focusedWindowId: number;
  /** Epoch ms the snapshot was taken; used for relative ages. */
  now: number;
}
