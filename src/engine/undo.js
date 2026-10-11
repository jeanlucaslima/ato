const KEY = 'tabEngineUndo';

/** Short-lived operation records, not a browsing history. Survive MV3 worker restarts. */
export function createUndo(browser) {
  const { sessions, storage, tabs } = browser.api;

  async function recentlyClosed() {
    try { return await sessions.getRecentlyClosed(); } catch { return []; }
  }

  async function save(record) {
    await storage.session.set({ [KEY]: record });
  }

  return {
    recentlyClosed,
    save,
    async capture(tab, before) {
      const oldIds = new Set(before.map(session => session.tab?.sessionId));
      const newSessions = (await recentlyClosed()).filter(session =>
        session.tab && !oldIds.has(session.tab.sessionId));
      // No guessing by URL alone: concurrent same-URL closes are ambiguous.
      const matches = newSessions.filter(session => session.tab.url === tab.url &&
        session.tab.windowId === tab.windowId && session.tab.index === tab.index);
      return {
        url: tab.url, windowId: tab.windowId, index: tab.index, pinned: Boolean(tab.pinned),
        sessionId: newSessions.length === 1 && matches.length === 1 ? matches[0].tab.sessionId : null
      };
    },
    async restore(operationId) {
      const record = (await storage.session.get(KEY))[KEY];
      const result = { restored: [], recreated: [], failed: [] };
      if (!record || record.id !== operationId) return result;
      const remaining = [];
      const available = new Set((await recentlyClosed()).map(session => session.tab?.sessionId));
      for (const entry of [...record.entries].reverse()) {
        // Persist consumption before mutation: a worker interruption must not duplicate a restoration.
        record.entries = record.entries.filter(item => item !== entry);
        await save(record);
        try {
          if (entry.sessionId && available.has(entry.sessionId)) {
            const session = await sessions.restore(entry.sessionId);
            if (session.tab) result.restored.push(session.tab.id);
          } else {
            const windows = await browser.api.windows.getAll();
            const windowId = windows.some(window => window.id === entry.windowId) ? entry.windowId : undefined;
            const tab = await tabs.create({ url: entry.url, windowId, index: entry.index,
              pinned: entry.pinned, active: false });
            result.recreated.push(tab.id);
          }
        } catch (error) {
          result.failed.push({ url: entry.url, error: error.message });
          remaining.push(entry);
        }
      }
      record.entries = remaining;
      await save(record);
      return result;
    }
  };
}
