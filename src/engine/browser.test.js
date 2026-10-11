import { expect, it } from 'vitest';
import { createBrowser, createSnapshotStore } from './browser.js';
import { createFakeChrome } from './fake-browser.js';

const tabs = [
  { id: 1, windowId: 1, active: true, url: 'https://a.test' },
  { id: 2, windowId: 2, active: true, url: 'https://b.test', pinned: true, groupId: 8, discarded: true }
];

it('recovers Chrome state on restart and tracks activation, focus, metadata and movement', async () => {
  const api = createFakeChrome(tabs);
  const store = createSnapshotStore(createBrowser(api));
  await store.refresh();
  await api.windows.update(2, { focused: true });
  await api.tabs.update(2, { audible: true, url: 'https://changed.test' });
  await api.tabs.move(1, { windowId: 2 });
  await store.refresh();
  expect(store.getSnapshot().focusedWindowId).toBe(2);
  expect(store.getSnapshot().tabs.find(tab => tab.id === 2)).toMatchObject({
    pinned: true, groupId: 8, discarded: true, audible: true, url: 'https://changed.test'
  });
  expect(store.getSnapshot().tabs.find(tab => tab.id === 1).windowId).toBe(2);
  store.dispose();
  const restarted = createSnapshotStore(createBrowser(api));
  expect(await restarted.refresh()).toEqual(store.getSnapshot());
  restarted.dispose();
  expect(api.tabs.onActivated.listeners.size).toBe(0);
});

it('does not publish an old snapshot after tab removal during its read', async () => {
  const api = createFakeChrome(tabs);
  const browser = createBrowser(api);
  const read = browser.readSnapshot;
  let release;
  browser.readSnapshot = async () => {
    const snapshot = await read();
    await new Promise(resolve => { release = resolve; });
    browser.readSnapshot = read;
    return snapshot;
  };
  const store = createSnapshotStore(browser);
  const pending = store.refresh();
  while (!release) await Promise.resolve();
  await api.tabs.remove(2);
  release();
  await pending;
  expect(store.getSnapshot().tabs.map(tab => tab.id)).toEqual([1]);
  store.dispose();
});

it('ignores delayed old metadata reads and reconciles simultaneous updates', async () => {
  const api = createFakeChrome(tabs);
  const browser = createBrowser(api);
  const store = createSnapshotStore(browser);
  await store.refresh();
  const originalGet = browser.getTab;
  let release;
  browser.getTab = async id => {
    const old = await originalGet(id);
    if (id === 2 && !release) await new Promise(resolve => { release = () => resolve(); });
    return old;
  };
  await api.tabs.update(2, { title: 'Old' });
  while (!release) await Promise.resolve();
  await api.tabs.update(2, { title: 'New' });
  await api.tabs.update(1, { audible: true });
  await store.refresh();
  release();
  await store.refresh();
  expect(store.getSnapshot().tabs.find(tab => tab.id === 2).title).toBe('New');
  expect(store.getSnapshot().tabs.find(tab => tab.id === 1).audible).toBe(true);
  store.dispose();
});

it('late/reordered events read live data and replacement cannot resurrect the removed identity', async () => {
  const api = createFakeChrome(tabs);
  const store = createSnapshotStore(createBrowser(api));
  await store.refresh();
  await api.tabs.update(2, { title: 'Latest' });
  api.tabs.onUpdated.emit(2, { title: 'Stale' }, { ...tabs[1], title: 'Stale' });
  await store.refresh();
  expect(store.getSnapshot().tabs.find(tab => tab.id === 2).title).toBe('Latest');
  api.state.delete(2);
  api.state.set(8, { ...tabs[1], id: 8 });
  api.tabs.onReplaced.emit(8, 2);
  api.tabs.onCreated.emit(tabs[1]);
  await store.refresh();
  expect(store.getSnapshot().tabs.map(tab => tab.id)).toEqual([1, 8]);
  store.dispose();
});

it('reconciles activation without relying on tab update events, retaining last focus when Chrome loses focus', async () => {
  const api = createFakeChrome([...tabs, { id: 3, windowId: 1, url: 'https://new.test/' }]);
  const store = createSnapshotStore(createBrowser(api));
  await store.refresh();
  api.state.get(1).active = false;
  api.state.get(3).active = true;
  api.tabs.onActivated.emit({ tabId: 3, windowId: 1 });
  api.loseFocus();
  await store.refresh();
  expect(store.getSnapshot().focusedWindowId).toBe(1);
  expect(store.getSnapshot().tabs.filter(tab => tab.active && tab.windowId === 1).map(tab => tab.id)).toEqual([3]);
  store.dispose();
});
