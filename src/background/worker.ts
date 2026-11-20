/**
 * MV3 service worker. For now it only keeps the toolbar badge true: the
 * duplicate count (or all tabs) in the chosen color, following the badge
 * settings live. Chrome stops the worker when idle; every wake runs this file
 * again, so listeners are registered at the top level, synchronously.
 */
import { badgeFor } from '../core/badge';
import { DEFAULT_SETTINGS } from '../core/settings';
import { fromChromeTab } from '../ui/chrome-browser';
import { ChromeSettings } from '../ui/chrome-settings';

/** Batch bursts of tab events (opening a window fires dozens) into one recount. */
const DEBOUNCE_MS = 300;

const settings = new ChromeSettings();
let timer: ReturnType<typeof setTimeout> | undefined;

async function refreshBadge(): Promise<void> {
  const [tabs, current] = await Promise.all([chrome.tabs.query({ windowType: 'normal' }), settings.load().catch(() => DEFAULT_SETTINGS)]);
  const now = Date.now();
  const badge = badgeFor(
    tabs.flatMap((t) => fromChromeTab(t, now) ?? []),
    current,
  );
  await Promise.all([
    chrome.action.setBadgeText({ text: badge.text }),
    chrome.action.setBadgeBackgroundColor({ color: badge.color }),
    chrome.action.setBadgeTextColor({ color: '#ffffff' }),
  ]);
}

function scheduleRefresh(): void {
  clearTimeout(timer);
  timer = setTimeout(() => void refreshBadge(), DEBOUNCE_MS);
}

/** Tab changes that can change the count: what's open, where, and what's protected. */
const COUNTED: readonly (keyof chrome.tabs.TabChangeInfo)[] = ['url', 'pinned', 'audible', 'groupId'];

chrome.tabs.onCreated.addListener(scheduleRefresh);
chrome.tabs.onRemoved.addListener(scheduleRefresh);
chrome.tabs.onReplaced.addListener(scheduleRefresh);
chrome.tabs.onAttached.addListener(scheduleRefresh);
chrome.tabs.onDetached.addListener(scheduleRefresh);
// Which tab is current decides which copy is kept, and so what counts.
chrome.tabs.onActivated.addListener(scheduleRefresh);
chrome.tabs.onUpdated.addListener((_id, change) => {
  if (COUNTED.some((key) => key in change)) scheduleRefresh();
});
settings.subscribe(scheduleRefresh);

// Install, update, browser start, enable, reload (Chrome 157+). A wake for any
// other reason also lands here, so count right away too.
const runtime = chrome.runtime as typeof chrome.runtime & { onExtensionLoaded?: chrome.events.Event<() => void> };
runtime.onExtensionLoaded?.addListener(scheduleRefresh);
void refreshBadge();
