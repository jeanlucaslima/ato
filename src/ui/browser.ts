import type { Snapshot, Tab } from '../core/types';

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
  /** Reopens closed tabs; resolves with how many came back. */
  restore(tabs: readonly Tab[]): Promise<number>;
  activate(tabId: number): Promise<void>;
  discard(tabIds: number[]): Promise<void>;
  moveToNewWindow(tabIds: number[]): Promise<void>;
  openSettings(): Promise<void>;
}
