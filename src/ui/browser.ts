import type { Snapshot, Tab } from '../core/types';
import type { Restored } from './chrome-restore';

/**
 * What the popup needs from the browser. The extension implements it over
 * `chrome.*`; the screen gallery uses an in-memory fake.
 */
export interface BrowserPort {
  snapshot(): Promise<Snapshot>;
  /** Calls `listener` whenever tabs or windows change. Returns an unsubscribe. */
  subscribe(listener: () => void): () => void;
  /** Resolves with the tabs that were actually closed. */
  close(tabIds: number[]): Promise<Tab[]>;
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
