import type { Snapshot, Tab } from '../core/types';
import type { BrowserPort } from '../ui/browser';

/** In-memory browser for the gallery and tests. Mutations notify subscribers. */
export class FakeBrowser implements BrowserPort {
  private state: Snapshot;
  private listeners = new Set<() => void>();

  constructor(initial: Snapshot) {
    this.state = initial;
  }

  async snapshot(): Promise<Snapshot> {
    return this.state;
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  async close(tabIds: number[]): Promise<Tab[]> {
    const ids = new Set(tabIds);
    const closed = this.state.tabs.filter((t) => ids.has(t.id));
    this.commit(this.state.tabs.filter((t) => !ids.has(t.id)));
    return closed;
  }

  async restore(tabs: readonly Tab[]): Promise<number> {
    const present = new Set(this.state.tabs.map((t) => t.id));
    const back = tabs.filter((t) => !present.has(t.id)).map((t) => ({ ...t, active: false }));
    this.commit([...this.state.tabs, ...back].sort((a, b) => a.windowId - b.windowId || a.index - b.index));
    return back.length;
  }

  async activate(tabId: number): Promise<void> {
    const target = this.state.tabs.find((t) => t.id === tabId);
    if (!target) return;
    this.state = { ...this.state, focusedWindowId: target.windowId };
    this.commit(
      this.state.tabs.map((t) =>
        t.windowId !== target.windowId ? t : { ...t, active: t.id === tabId, discarded: t.id === tabId ? false : t.discarded, lastAccessed: t.id === tabId ? this.state.now : t.lastAccessed },
      ),
    );
  }

  async discard(tabIds: number[]): Promise<void> {
    const ids = new Set(tabIds);
    this.commit(this.state.tabs.map((t) => (ids.has(t.id) && !t.active ? { ...t, discarded: true } : t)));
  }

  async moveToNewWindow(tabIds: number[]): Promise<void> {
    const ids = new Set(tabIds);
    const windowId = Math.max(0, ...this.state.tabs.map((t) => t.windowId)) + 1;
    let index = 0;
    this.commit(this.state.tabs.map((t) => (ids.has(t.id) ? { ...t, windowId, index: index++, active: index === 1 } : t)));
  }

  async openSettings(): Promise<void> {}

  private commit(tabs: Tab[]): void {
    const indexed = new Map<number, number>();
    const reindexed = tabs.map((t) => {
      const i = indexed.get(t.windowId) ?? 0;
      indexed.set(t.windowId, i + 1);
      return { ...t, index: i };
    });
    this.state = { ...this.state, tabs: reindexed };
    for (const listener of this.listeners) listener();
  }
}
