// The worker owns command execution so operations outlive the popup.
import { createBrowser, createSnapshotStore } from '../engine/browser.js';
import { createActions } from '../engine/actions.js';
import { findDuplicates } from '../engine/queries.js';
import { scopedTabs } from '../engine/policy.js';
import { initLogger, error } from '../shared/logger.js';

const defaults = {
  matchMode: 'exact', keepTab: 'oldest', protectPinned: true, protectGroups: false,
  showBadge: true, badgeMode: 'duplicates', badgeColor: '#DC2626', currentWindowOnly: false
};
let settings = { ...defaults };
const browser = createBrowser();
const actions = createActions(browser);
const store = createSnapshotStore(browser, err => error('Snapshot reconciliation failed:', err));
let ready = false;

function updateBadge(snapshot = store.getSnapshot()) {
  if (!ready) return;
  const tabs = scopedTabs(snapshot.tabs, settings.currentWindowOnly
    ? { type: 'window', windowId: snapshot.focusedWindowId } : { type: 'all' });
  const count = settings.badgeMode === 'allTabs' ? tabs.length : findDuplicates(tabs, settings.matchMode).length;
  chrome.action.setBadgeText({ text: settings.showBadge && (count || settings.badgeMode === 'allTabs') ? String(count) : '' });
  chrome.action.setBadgeBackgroundColor({ color: settings.badgeColor });
}
store.subscribe(updateBadge);

// Register synchronously: MV3 must be able to dispatch events as the worker starts.
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action !== 'tabEngine') return;
  (async () => {
    try {
      const liveSettings = await chrome.storage.sync.get(defaults);
      const result = await actions.run(message.command, liveSettings);
      sendResponse({ result });
    } catch (err) {
      error('Tab command failed:', err);
      sendResponse({ error: err.message });
    }
  })();
  return true;
});

chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== 'sync') return;
  for (const key of Object.keys(defaults)) {
    if (changes[key]) settings[key] = changes[key].newValue ?? defaults[key];
  }
  updateBadge();
});

(async () => {
  try {
    await initLogger();
    settings = await chrome.storage.sync.get(defaults);
    ready = true;
    await store.refresh();
  } catch (err) {
    error('Worker initialization failed:', err);
  }
})();
