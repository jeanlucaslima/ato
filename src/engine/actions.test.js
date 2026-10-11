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

it.each([
  ['exact', [4]], ['ignoreQuery', [2, 4]], ['ignoreHash', [3, 4]], ['ignoreQueryAndHash', [2, 3, 4]]
])('cleanup uses the same %s matching as the duplicate counter', async (matchMode, expected) => {
  const api = createFakeChrome([
    { id: 1, windowId: 1, url: `${same}?a=1#x` },
    { id: 2, windowId: 1, url: `${same}?a=2#x` },
    { id: 3, windowId: 1, url: `${same}?a=1#y` },
    { id: 4, windowId: 1, url: `${same}?a=1#x` }
  ], 2);
  const result = await createActions(createBrowser(api)).run({ type: 'close-duplicates' }, { matchMode });
  expect(result.succeeded.sort()).toEqual(expected);
});

it('rechecks active/protected state after planning and during execution', async () => {
  const { api, actions } = setup();
  const originalQuery = api.tabs.query;
  let changed = false;
  api.tabs.query = async query => {
    if (!changed) {
      changed = true;
      await api.tabs.update(2, { active: true });
      await api.tabs.update(4, { pinned: true });
    }
    return originalQuery(query);
  };
  const result = await actions.run({ type: 'close-duplicates' }, { protectPinned: true });
  expect(result.succeeded).toEqual([]);
  expect(result.skipped).toEqual([{ id: 2, reason: 'current' }, { id: 4, reason: 'pinned' }]);
});

it('a delayed final validation cannot close a tab activated during session reads', async () => {
  const { api, actions } = setup();
  const recent = api.sessions.getRecentlyClosed;
  api.sessions.getRecentlyClosed = async () => {
    await api.tabs.update(2, { active: true });
    return recent();
  };
  const result = await actions.run({ type: 'close-duplicates' });
  expect(result.succeeded).toEqual([4]);
  expect(api.state.has(2)).toBe(true);
});

it('never trusts a changed or moved UI target, and reports each skip', async () => {
  const { api, actions } = setup();
  await api.tabs.update(2, { url: 'https://changed.test/' });
  await api.tabs.move(4, { windowId: 1 });
  const result = await actions.run({ type: 'close', targets: [tabs[1], tabs[3]], single: true });
  expect(result.succeeded).toEqual([]);
  expect(result.skipped).toEqual([
    { id: 2, reason: 'changed-or-out-of-scope' }, { id: 4, reason: 'changed-or-out-of-scope' }
  ]);
});

it('serializes conflicting commands without closing additional tabs or recording duplicate undo entries', async () => {
  const { api, actions } = setup();
  const [first, second] = await Promise.all([
    actions.run({ type: 'close-duplicates' }), actions.run({ type: 'close-duplicates' })
  ]);
  expect(first.succeeded).toEqual([2, 4]);
  expect(second.succeeded).toEqual([]);
  expect([...api.state.keys()]).toEqual([1, 3]);
  expect(await actions.run({ type: 'undo-info' })).toEqual({ operationId: first.operationId, count: 2 });
});

it('reports URL-only undo after sessions expire, and consumes it only once', async () => {
  const { api, actions } = setup();
  const closed = await actions.run({ type: 'close-duplicates' });
  api.sessions.getRecentlyClosed = async () => [];
  const result = await actions.run({ type: 'undo', operationId: closed.operationId });
  expect(result.restored).toEqual([]);
  expect(result.recreated).toHaveLength(2);
  expect(result.failed).toEqual([]);
  expect((await actions.run({ type: 'undo', operationId: closed.operationId })).recreated).toEqual([]);
});

it('keeps failed restorations retryable across worker restart without repeating successful ones', async () => {
  const { api, actions } = setup();
  const closed = await actions.run({ type: 'close-duplicates' });
  api.failures.add('restore:session-1');
  const result = await actions.run({ type: 'undo', operationId: closed.operationId });
  expect(result.restored).toHaveLength(1);
  expect(result.failed).toHaveLength(1);
  api.failures.clear();
  const restarted = createActions(createBrowser(api));
  expect(await restarted.run({ type: 'undo-info' })).toEqual({ operationId: closed.operationId, count: 1 });
  expect((await restarted.run({ type: 'undo', operationId: closed.operationId })).restored).toHaveLength(1);
  expect([...api.state.values()].filter(tab => tab.url === same)).toHaveLength(3);
});

it('does not associate an unrelated concurrent session close with ATO undo', async () => {
  const { api, actions } = setup();
  const remove = api.tabs.remove;
  api.tabs.remove = async id => {
    await remove(id);
    if (api.state.has(1)) await remove(1);
  };
  const closed = await actions.run({ type: 'close-duplicates' });
  const restored = await actions.run({ type: 'undo', operationId: closed.operationId });
  expect(restored.recreated).toHaveLength(1);
  expect(restored.restored).toHaveLength(1);
  expect([...api.state.values()].every(tab => tab.url === same)).toBe(true);
});

it('reports undo persistence failure without offering a nonexistent undo operation', async () => {
  const { api, actions } = setup();
  api.storage.session.set = async () => { throw new Error('Storage unavailable'); };
  const result = await actions.run({ type: 'close-duplicates' });
  expect(result.succeeded).toEqual([2, 4]);
  expect(result.failed).toHaveLength(2);
  expect(result.operationId).toBeNull();
});

it('preserves the last instance when its survivor disappears during session reads', async () => {
  const { api, actions } = setup();
  const recent = api.sessions.getRecentlyClosed;
  api.sessions.getRecentlyClosed = async () => {
    if (api.state.has(3)) await api.tabs.remove(3);
    if (api.state.has(4)) await api.tabs.remove(4);
    return recent();
  };
  const result = await actions.run({ type: 'close-duplicates' });
  expect(result.succeeded).toEqual([]);
  expect(api.state.has(2)).toBe(true);
});
