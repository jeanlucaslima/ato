import type { DuplicatePolicy } from '../core/duplicates';
import type { Snapshot, Tab } from '../core/types';
import type { Restored } from './chrome-restore';

export interface CloseResult {
  closed: Tab[];
  /** Asked for, but protected when the close ran (left open). */
  kept: Tab[];
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
   * browser's current state first, and tabs protected by then are `kept`.
   * Resolves with the tabs really closed.
   */
  close(tabIds: number[], policy: DuplicatePolicy | null): Promise<CloseResult>;
  /** Reopens closed tabs, any number; resolves with how many came back (and how many without history). */
  restore(tabs: readonly Tab[]): Promise<Restored>;
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
