/**
 * MV3 service worker: keeps the toolbar badge true (the duplicate count or all
 * tabs, in the chosen color, following the badge settings live) and runs the
 * tab right-click menu. Chrome stops the worker when idle; every wake runs this
 * file again, so listeners are registered at the top level, synchronously.
 */
import { badgeFor } from '../core/badge';
import { DEFAULT_SETTINGS } from '../core/settings';
import type { Tab } from '../core/types';
import { closeTabs, readCloseRequest, undoClose } from '../ui/chrome-close';
import { closeFromMenu, MENU } from '../ui/chrome-menu';
import { RESTORE_MESSAGE } from '../ui/chrome-restore';
import { fromChromeTab } from '../ui/chrome-tab';
import { ChromeSettings } from '../ui/chrome-settings';

/** Batch bursts of tab events (opening a window fires dozens) into one recount. */
const DEBOUNCE_MS = 300;

const settings = new ChromeSettings();
let timer: ReturnType<typeof setTimeout> | undefined;

/** Every normal-window tab, as ATO sees it, and the current settings. */
async function readState(): Promise<[Tab[], Awaited<ReturnType<ChromeSettings['load']>>]> {
  const [tabs, current] = await Promise.all([chrome.tabs.query({ windowType: 'normal' }), settings.load().catch(() => DEFAULT_SETTINGS)]);
  const now = Date.now();
  return [tabs.flatMap((t) => fromChromeTab(t, now) ?? []), current];
}

async function refreshBadge(): Promise<void> {
  const [tabs, current] = await readState();
  const badge = badgeFor(tabs, current);
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

// --- Closing and undo --------------------------------------------------------------

// The popup closes through the worker, the same path as the right-click menu.
// Only ATO's own pages may ask.
chrome.runtime.onMessage.addListener((message: unknown, sender, reply) => {
  const request = sender.id === chrome.runtime.id ? readCloseRequest(message) : null;
  if (!request) return false;
  void closeTabs(request.tabIds, request.policy).then(
    (result) => reply({ ok: true, ...result }),
    (error: unknown) => reply({ ok: false, error: String(error) }),
  );
  return true; // reply comes later
});

// The popup asks the worker to restore: Chrome may close the popup as tabs come
// back, and the worker keeps going.
chrome.runtime.onMessage.addListener((message: { type?: string; tabs?: Tab[]; closedAt?: number }, sender, reply) => {
  if (sender.id !== chrome.runtime.id || message?.type !== RESTORE_MESSAGE || !Array.isArray(message.tabs)) return false;
  const closedAt = typeof message.closedAt === 'number' ? message.closedAt : undefined;
  void undoClose(message.tabs, closedAt).then(reply, () => reply({ count: 0, fresh: 0 }));
  return true; // reply comes later
});

// --- Tab right-click menu -------------------------------------------------------

/**
 * Menu items persist once created, so they're (re)made on install, update and
 * load; removeAll first, so a reload doesn't add them twice. `"tab"` (the tab
 * strip, Chrome 150+) isn't in @types/chrome yet, and `"all"` doesn't cover it.
 */
function createMenus(): void {
  chrome.contextMenus.removeAll(() => {
    const contexts = ['tab'] as unknown as [chrome.contextMenus.ContextType];
    for (const item of Object.values(MENU)) chrome.contextMenus.create({ id: item.id, title: item.title, contexts });
  });
}

chrome.contextMenus.onClicked.addListener((info, tab) => void closeFromMenu(info.menuItemId, tab?.id, () => settings.load()));
chrome.runtime.onInstalled.addListener(createMenus);

// Install, update, browser start, enable, reload (Chrome 157+). A wake for any
// other reason also lands here, so count right away too.
const runtime = chrome.runtime as typeof chrome.runtime & { onExtensionLoaded?: chrome.events.Event<() => void> };
runtime.onExtensionLoaded?.addListener(() => {
  createMenus();
  scheduleRefresh();
});
void refreshBadge();
