import type { DuplicatePolicy } from '../core/duplicates';
import type { Snapshot, Tab } from '../core/types';
import type { Restored } from './chrome-restore';

export interface CloseResult {
  closed: Tab[];
  /** Asked for, but protected when the close ran (left open). */
  kept: Tab[];
  /** Epoch ms just before the tabs were removed, when the browser knows it. */
  closedAt?: number;
}

/** A close made elsewhere (the right-click menu) that the popup can undo. */
export interface UndoOffer {
  tabs: readonly Tab[];
  closedAt: number;
  message: string;
}

/**
 * What the popup needs from the browser. The extension implements it over
 * `chrome.*`; the screen gallery uses an in-memory fake.
 */
export interface BrowserPort {
  snapshot(): Promise<Snapshot>;
  /** Calls `listener` whenever tabs or windows change. Returns an unsubscribe. */
  subscribe(listener: () => void): () => void;
  /**
   * Close tabs. With a `policy` (bulk closes) protection is checked again on the
   * browser's current state first, and tabs protected by then are `kept`; with
   * `cleanup` (duplicate cleanup) so is a copy of every page that would have none
   * left. `focusedOnly`: of the current tabs, only the focused window's is protected
   * (read fresh, like the rest). Resolves with the tabs really closed.
   */
  close(tabIds: number[], policy: DuplicatePolicy | null, cleanup?: boolean, focusedOnly?: boolean): Promise<CloseResult>;
  /** Reopens closed tabs, any number; resolves with how many came back, how many without history, and which couldn't. */
  restore(tabs: readonly Tab[], closedAt?: number): Promise<Restored>;
  /** A recent right-click close to offer undo for when the popup opens, or `null`. */
  pendingUndo(): Promise<UndoOffer | null>;
  activate(tabId: number): Promise<void>;
  discard(tabIds: number[]): Promise<void>;
  moveToNewWindow(tabIds: number[]): Promise<void>;
  /** Move tabs to the end of an existing window; groups moved whole stay groups. */
  moveToWindow(tabIds: number[], windowId: number): Promise<void>;
  /** Bring a window to the front. */
  focusWindow(windowId: number): Promise<void>;
  openSettings(): Promise<void>;
  setMuted(tabId: number, muted: boolean): Promise<void>;
}
