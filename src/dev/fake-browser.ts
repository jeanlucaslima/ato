import { stillClosable, type DuplicatePolicy } from '../core/duplicates';
import type { Snapshot, Tab } from '../core/types';
import type { BrowserPort, CloseResult, UndoOffer } from '../ui/browser';
import type { Restored } from '../ui/chrome-restore';

/** In-memory browser for the gallery and tests. Mutations notify subscribers. */
export class FakeBrowser implements BrowserPort {
  private state: Snapshot;
  private listeners = new Set<() => void>();

  /** `onOpenSettings`: what the gear does here (the gallery scrolls to its settings page). */
  constructor(initial: Snapshot, private onOpenSettings?: () => void) {
    this.state = initial;
  }

  async snapshot(): Promise<Snapshot> {
    return this.state;
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  async close(tabIds: number[], policy: DuplicatePolicy | null, cleanup = false): Promise<CloseResult> {
    const { closable, kept } = stillClosable(this.state.tabs, tabIds, policy, cleanup);
    const ids = new Set(closable.map((t) => t.id));
    this.commit(this.state.tabs.filter((t) => !ids.has(t.id)));
    return { closed: closable, kept };
  }

  /** Change tabs in place, as the user would between a decision and its close (tests). */
  change(update: (tab: Tab) => Tab): void {
    this.commit(this.state.tabs.map(update));
  }

  /** Like Chrome: the last 25 come back whole, older ones are reopened fresh. */
  async restore(tabs: readonly Tab[]): Promise<Restored> {
    const present = new Set(this.state.tabs.map((t) => t.id));
    const back = tabs.filter((t) => !present.has(t.id)).map((t) => ({ ...t, active: false }));
    this.commit([...this.state.tabs, ...back].sort((a, b) => a.windowId - b.windowId || a.index - b.index));
    return { count: back.length, fresh: Math.max(0, back.length - 25) };
  }

  /** What `pendingUndo` answers (tests): a right-click close to offer undo for. */
  undoOffer: UndoOffer | null = null;

  async pendingUndo(): Promise<UndoOffer | null> {
    return this.undoOffer;
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

  async moveToWindow(tabIds: number[], windowId: number): Promise<void> {
    const ids = new Set(tabIds);
    const staying = this.state.tabs.filter((t) => !ids.has(t.id));
    const moving = this.state.tabs.filter((t) => ids.has(t.id)).map((t) => ({ ...t, windowId, active: false }));
    const groups = this.state.groups?.map((g) => (moving.some((t) => t.groupId === g.id) ? { ...g, windowId } : g));
    this.state = { ...this.state, groups };
    this.commit([...staying, ...moving].sort((a, b) => a.windowId - b.windowId || (ids.has(a.id) ? 1 : 0) - (ids.has(b.id) ? 1 : 0) || a.index - b.index));
  }

  async focusWindow(windowId: number): Promise<void> {
    this.state = { ...this.state, focusedWindowId: windowId };
    this.commit([...this.state.tabs]);
  }

  async setMuted(tabId: number, muted: boolean): Promise<void> {
    this.commit(this.state.tabs.map((t) => (t.id === tabId ? { ...t, muted } : t)));
  }

  async openSettings(): Promise<void> {
    this.onOpenSettings?.();
  }

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
