import { afterEach, expect, it, vi } from 'vitest';
import { createFakeChrome } from '../engine/fake-browser.js';
import { createInitialPopupState, reducePopupState, getDuplicateTabs } from '../popup/popup-state.js';

afterEach(() => { vi.unstubAllGlobals(); vi.resetModules(); });

it('keeps badge and popup counts consistent across scope/focus changes and executes worker commands', async () => {
  const api = createFakeChrome([
    { id: 1, windowId: 1, active: true, url: 'https://same.test/' },
    { id: 2, windowId: 2, active: true, url: 'https://same.test/' },
    { id: 3, windowId: 2, url: 'https://same.test/' }
  ], 2);
  const settings = { currentWindowOnly: false };
  const storageListeners = [];
  const messages = [];
  api.storage.sync = { get: async defaults => ({ ...defaults, ...settings }) };
  api.storage.onChanged = { addListener: listener => storageListeners.push(listener) };
  api.runtime = { onMessage: { addListener: listener => messages.push(listener) } };
  api.action = { setBadgeText: vi.fn(), setBadgeBackgroundColor: vi.fn() };
  vi.stubGlobal('chrome', api);
  await import('./service-worker.js');
  await vi.waitFor(() => expect(api.action.setBadgeText).toHaveBeenLastCalledWith({ text: '2' }));
  let popup = reducePopupState(createInitialPopupState(), {
    type: 'SET_BROWSER_SNAPSHOT', tabs: [...api.state.values()], focusedWindowId: 2
  });
  expect(getDuplicateTabs(popup)).toHaveLength(2);
  settings.currentWindowOnly = true;
  storageListeners.forEach(listener => listener({ currentWindowOnly: { newValue: true } }, 'sync'));
  await vi.waitFor(() => expect(api.action.setBadgeText).toHaveBeenLastCalledWith({ text: '1' }));
  popup = reducePopupState(popup, { type: 'SET_SCOPE', scope: { type: 'window', windowId: 2 } });
  expect(getDuplicateTabs(popup)).toHaveLength(1);
  await api.windows.update(1, { focused: true });
  await vi.waitFor(() => expect(api.action.setBadgeText).toHaveBeenLastCalledWith({ text: '' }));
  await api.windows.update(2, { focused: true });
  await vi.waitFor(() => expect(api.action.setBadgeText).toHaveBeenLastCalledWith({ text: '1' }));
  const response = await new Promise(resolve => {
    expect(messages[0]({ action: 'tabEngine', command: { type: 'close-duplicates' } }, {}, resolve)).toBe(true);
  });
  expect(response.result.succeeded).toEqual([3]);
  expect(api.state.has(2)).toBe(true);
  expect(api.state.has(1)).toBe(true);
  await vi.waitFor(() => expect(api.action.setBadgeText).toHaveBeenLastCalledWith({ text: '' }));
  await api.windows.update(1, { focused: true });
  await vi.waitFor(() => expect(api.action.setBadgeText).toHaveBeenLastCalledWith({ text: '' }));
});
