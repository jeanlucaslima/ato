// Deterministic test adapter, limited to the Chrome APIs used by the engine.
export function createFakeChrome(initialTabs = [], focusedWindowId = 1) {
  const event = () => {
    const listeners = new Set();
    return { addListener: fn => listeners.add(fn), removeListener: fn => listeners.delete(fn),
      emit: (...args) => listeners.forEach(fn => fn(...args)), listeners };
  };
  const tabs = new Map(initialTabs.map((tab, index) => [tab.id, { index, groupId: -1, ...tab }]));
  const sessions = [];
  const sessionStorage = {};
  let nextId = Math.max(0, ...tabs.keys()) + 1;
  let nextSession = 1;
  const failures = new Set();
  const api = {
    state: tabs, failures, sessions,
    tabs: Object.fromEntries(['onCreated', 'onUpdated', 'onRemoved', 'onActivated', 'onMoved',
      'onAttached', 'onDetached', 'onReplaced'].map(name => [name, event()])),
    windows: Object.fromEntries(['onCreated', 'onRemoved', 'onFocusChanged'].map(name => [name, event()])),
    storage: { session: {
      get: async key => ({ [key]: structuredClone(sessionStorage[key]) }),
      set: async values => Object.assign(sessionStorage, structuredClone(values))
    } }
  };
  api.tabs.get = async id => {
    if (!tabs.has(id) || failures.has(`get:${id}`)) throw new Error(`No tab ${id}`);
    return { ...tabs.get(id) };
  };
  api.tabs.query = async query => [...tabs.values()].filter(tab =>
    (query.windowId == null || tab.windowId === query.windowId) &&
    (!query.active || tab.active) && (!query.lastFocusedWindow || tab.windowId === focusedWindowId)
  ).map(tab => ({ ...tab }));
  api.tabs.update = async (id, changes) => {
    const tab = await api.tabs.get(id);
    if (changes.active) {
      for (const other of tabs.values()) if (other.windowId === tab.windowId) other.active = other.id === id;
      api.tabs.onActivated.emit({ tabId: id, windowId: tab.windowId });
    }
    Object.assign(tabs.get(id), changes);
    api.tabs.onUpdated.emit(id, changes, { ...tabs.get(id) });
    return { ...tabs.get(id) };
  };
  api.tabs.remove = async id => {
    if (failures.has(`remove:${id}`)) throw new Error('Removal failed');
    const tab = await api.tabs.get(id);
    tabs.delete(id);
    sessions.unshift({ tab: { ...tab, sessionId: `session-${nextSession++}` } });
    sessions.splice(25);
    api.tabs.onRemoved.emit(id, { windowId: tab.windowId });
  };
  api.tabs.create = async properties => {
    const tab = { id: nextId++, windowId: focusedWindowId, ...properties };
    tabs.set(tab.id, tab);
    api.tabs.onCreated.emit(tab);
    return { ...tab };
  };
  api.tabs.move = async (id, { windowId }) => {
    if (failures.has(`move:${id}`)) throw new Error('Move failed');
    const tab = await api.tabs.get(id);
    tabs.get(id).windowId = windowId;
    api.tabs.onAttached.emit(id, { newWindowId: windowId });
    return { ...tab, windowId };
  };
  api.windows.getAll = async () => [...new Set([...tabs.values()].map(tab => tab.windowId))]
    .map(id => ({ id, type: 'normal', focused: id === focusedWindowId,
      tabs: [...tabs.values()].filter(tab => tab.windowId === id).map(tab => ({ ...tab })) }));
  api.windows.getLastFocused = async () => ({ id: focusedWindowId });
  api.windows.update = async (id, { focused }) => {
    if (focused) focusedWindowId = id;
    api.windows.onFocusChanged.emit(id);
    return { id, focused };
  };
  api.windows.create = async ({ tabId }) => {
    const id = Math.max(0, ...[...tabs.values()].map(tab => tab.windowId)) + 1;
    await api.tabs.move(tabId, { windowId: id });
    await api.windows.update(id, { focused: true });
    return { id };
  };
  api.sessions = {
    getRecentlyClosed: async () => structuredClone(sessions),
    restore: async id => {
      if (failures.has(`restore:${id}`)) throw new Error('Restore failed');
      const index = sessions.findIndex(session => session.tab?.sessionId === id);
      if (index < 0) throw new Error('No session');
      const [session] = sessions.splice(index, 1);
      const tab = await api.tabs.create({ ...session.tab, id: nextId++ });
      return { tab };
    }
  };
  return api;
}
