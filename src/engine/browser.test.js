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
