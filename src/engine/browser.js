/** Small Chrome boundary. No cached state is used by readSnapshot or tab mutations. */
export function createBrowser(api = chrome) {
  return {
    api,
    async readSnapshot() {
      const [windows, lastFocused] = await Promise.all([
        api.windows.getAll({ populate: true }),
        api.windows.getLastFocused().catch(() => null)
      ]);
      const focusedWindowId = windows.find(window => window.focused)?.id ?? lastFocused?.id ?? null;
      return {
        tabs: windows.flatMap(window => window.tabs || []).map(tab => ({ ...tab })),
        windows: windows.map(({ tabs, ...window }) => window),
        focusedWindowId
      };
    },
    getTab: id => api.tabs.get(id),
    removeTab: id => api.tabs.remove(id),
    moveTab: (id, windowId) => api.tabs.move(id, { windowId, index: -1 }),
    createWindow: id => api.windows.create({ tabId: id }),
    async activateTab(id) {
      const tab = await api.tabs.update(id, { active: true });
      await api.windows.update(tab.windowId, { focused: true });
      return tab;
    }
  };
}

/** Recoverable cache. Events invalidate outstanding reads; structural changes resync from Chrome. */
export function createSnapshotStore(browser, onError = () => {}) {
  let snapshot = { tabs: [], windows: [], focusedWindowId: null };
  let revision = 0;
  let inFlight = null;
  let disposed = false;
  const subscribers = new Set();
  const listeners = [];
  const tabReads = new Map();
  const publish = () => subscribers.forEach(listener => listener(snapshot));

  function refresh() {
    if (inFlight) return inFlight;
    inFlight = (async () => {
      let version;
      let next;
      do {
        version = revision;
        next = await browser.readSnapshot();
      } while (!disposed && version !== revision);
      if (!disposed) {
        revision++;
        snapshot = next;
        publish();
      }
      return snapshot;
    })().finally(() => { inFlight = null; });
    return inFlight;
  }

  function resync() {
    revision++;
    refresh().catch(onError);
  }

  async function updateTab(id) {
    const version = (tabReads.get(id) || 0) + 1;
    tabReads.set(id, version);
    const snapshotVersion = ++revision;
    try {
      const tab = await browser.getTab(id);
      if (disposed || tabReads.get(id) !== version) return;
      if (snapshotVersion !== revision) {
        resync();
        return;
      }
      snapshot = { ...snapshot, tabs: [...snapshot.tabs.filter(tab => tab.id !== id), tab] };
      // Preserve browser order rather than moving every metadata update to the end.
      snapshot.tabs.sort((a, b) => a.windowId - b.windowId || a.index - b.index);
      publish();
    } catch {
      // A rejected get may be transient, not proof that the tab was removed.
      resync();
    }
  }

  function listen(event, callback) {
    if (!event) return;
    event.addListener(callback);
    listeners.push(() => event.removeListener(callback));
  }

  const { tabs, windows } = browser.api;
  listen(tabs.onUpdated, id => { updateTab(id); });
  listen(tabs.onRemoved, id => {
    tabReads.delete(id);
    snapshot = { ...snapshot, tabs: snapshot.tabs.filter(tab => tab.id !== id) };
    publish();
    resync();
  });
  for (const event of [tabs.onCreated, tabs.onActivated, tabs.onMoved, tabs.onAttached,
    tabs.onDetached, tabs.onReplaced, windows.onCreated, windows.onRemoved, windows.onFocusChanged]) {
    listen(event, resync);
  }

  return {
    refresh,
    getSnapshot: () => snapshot,
    subscribe(listener) { subscribers.add(listener); return () => subscribers.delete(listener); },
    dispose() {
      disposed = true;
      listeners.forEach(remove => remove());
      subscribers.clear();
    }
  };
}
