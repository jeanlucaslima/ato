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
  discarded: boolean;
  /** Native tab group id, or -1 when ungrouped. */
  groupId: number;
  /** Epoch ms of last access. */
  lastAccessed: number;
}

export interface Snapshot {
  tabs: readonly Tab[];
  focusedWindowId: number;
  /** Epoch ms the snapshot was taken; used for relative ages. */
  now: number;
}
