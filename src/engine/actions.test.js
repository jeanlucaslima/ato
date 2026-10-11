import { expect, it } from 'vitest';
import { createBrowser } from './browser.js';
import { createActions } from './actions.js';
import { createFakeChrome } from './fake-browser.js';

const same = 'https://same.test/';
const tabs = [
  { id: 1, windowId: 1, active: true, url: 'https://other.test/' },
  { id: 2, windowId: 2, url: same },
  { id: 3, windowId: 2, active: true, url: same },
  { id: 4, windowId: 2, url: same }
];
const setup = () => {
  const api = createFakeChrome(tabs, 2);
  return { api, actions: createActions(createBrowser(api)) };
};

it.each(['oldest', 'newest'])('keeps the current duplicate with three repeats (%s)', async keepTab => {
  const { api, actions } = setup();
  const result = await actions.run({ type: 'close-duplicates' }, { keepTab });
  expect(result.succeeded.sort()).toEqual([2, 4]);
  expect([...api.state.keys()]).toEqual([1, 3]);
});

it('protects a newly active target without expanding the planned target set', async () => {
  const { api, actions } = setup();
  const plan = await actions.plan({ type: 'close-duplicates' });
  await api.tabs.update(2, { active: true });
  const result = await actions.execute(plan);
  expect(result.succeeded).toEqual([4]);
  expect(result.skipped).toContainEqual({ id: 2, reason: 'current' });
  expect([...api.state.keys()]).toEqual([1, 2, 3]);
});

it('skips changed identities and leaves the last remaining instance after external removal', async () => {
  const { api, actions } = setup();
  const plan = await actions.plan({ type: 'close-duplicates' });
  await api.tabs.update(2, { url: 'https://different.test/' });
  await api.tabs.remove(3);
  const result = await actions.execute(plan);
  expect(result.succeeded).toEqual([]);
  expect(api.state.has(4)).toBe(true);
});

it('reports individual failures without inflating the close or undo count', async () => {
  const { api, actions } = setup();
  api.failures.add('remove:2');
  const result = await actions.run({ type: 'close-duplicates' });
  expect(result.succeeded).toEqual([4]);
  expect(result.failed).toEqual([{ id: 2, error: 'Removal failed' }]);
  const undo = await actions.run({ type: 'undo', operationId: result.operationId });
  expect(undo.restored).toHaveLength(1);
  expect(undo.recreated).toEqual([]);
});

it('undo survives worker restart and never restores an unrelated recent close', async () => {
  const { api, actions } = setup();
  const result = await actions.run({ type: 'close-duplicates' });
  await api.tabs.remove(1);
  const restarted = createActions(createBrowser(api));
  const restored = await restarted.run({ type: 'undo', operationId: result.operationId });
  expect(restored.restored).toHaveLength(2);
  expect([...api.state.values()].every(tab => tab.url === same)).toBe(true);
  await expect(api.sessions.getRecentlyClosed()).resolves.toHaveLength(1);
});

it('scopes cleanup and gives pinned/grouped/internal tabs precedence over keep preference', async () => {
  const api = createFakeChrome([
    { id: 1, windowId: 1, url: same },
    { id: 2, windowId: 1, url: same, pinned: true },
    { id: 3, windowId: 1, url: same, groupId: 5 },
    { id: 4, windowId: 2, url: same },
    { id: 5, windowId: 1, url: 'chrome://settings' },
    { id: 6, windowId: 1, url: 'chrome://settings' }
  ]);
  const actions = createActions(createBrowser(api));
  const result = await actions.run({ type: 'close-duplicates', scope: { type: 'window', windowId: 1 } },
    { keepTab: 'oldest', protectPinned: true, protectGroups: true });
  expect(result.succeeded).toEqual([1]);
  expect([...api.state.keys()]).toEqual([2, 3, 4, 5, 6]);
});

it.each(['oldest', 'newest'])('uses %s when no duplicate is protected or current', async keepTab => {
  const api = createFakeChrome(tabs, 1);
  const result = await createActions(createBrowser(api)).run({ type: 'close-duplicates' }, { keepTab });
  expect(result.succeeded.sort()).toEqual(keepTab === 'oldest' ? [3, 4] : [2, 3]);
});

it('moves validated targets serially and reports partial failure', async () => {
  const { api, actions } = setup();
  api.failures.add('move:4');
  const result = await actions.run({ type: 'move', targets: tabs.slice(1) });
  expect(result.succeeded).toEqual([2, 3]);
  expect(result.failed).toEqual([{ id: 4, error: 'Move failed' }]);
  expect(api.state.get(2).windowId).toBe(api.state.get(3).windowId);
  expect(api.state.get(4).windowId).toBe(2);
});
