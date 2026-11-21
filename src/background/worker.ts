/**
 * MV3 service worker: keeps the toolbar badge true (the duplicate count or all
 * tabs, in the chosen color, following the badge settings live) and runs the
 * tab right-click menu. Chrome stops the worker when idle; every wake runs this
 * file again, so listeners are registered at the top level, synchronously.
 */
import { badgeFor } from '../core/badge';
import { DEFAULT_SETTINGS, policyOf } from '../core/settings';
import { duplicatesOf, othersFromSite } from '../core/tab-menu';
import { domainOf } from '../core/tabs';
import type { Tab } from '../core/types';
import { closeTabs, readCloseRequest, undoClose } from '../ui/chrome-close';
import { RESTORE_MESSAGE } from '../ui/chrome-restore';
import { plural } from '../ui/format';
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

const MENU = {
  duplicates: { id: 'ato-close-duplicates', title: 'Close duplicates of this tab', pick: duplicatesOf, said: (n: number, _site: string) => `Closed ${plural(n, 'duplicate')} (tab menu)` },
  site: { id: 'ato-close-site', title: 'Close other tabs from this site', pick: othersFromSite, said: (n: number, site: string) => `Closed ${plural(n, 'tab')} from ${site} (tab menu)` },
} as const;

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

/** The tab that was right-clicked stays; the pick decides the rest, with every protection. */
async function onMenuClick(menuItemId: string | number, clickedId: number | undefined): Promise<void> {
  const item = Object.values(MENU).find((m) => m.id === menuItemId);
  if (!item || clickedId === undefined) return;
  const [tabs, current] = await readState();
  const clicked = tabs.find((t) => t.id === clickedId);
  if (!clicked) return;
  const policy = policyOf(current);
  const closing = item.pick(clicked, tabs, policy).map((t) => t.id);
  // The popup's close path: protection checked again right before removing, and
  // the close remembered so the popup can offer to undo it (see architecture.md).
  const site = domainOf(clicked.url);
  if (closing.length > 0) await closeTabs(closing, policy, { source: 'menu', message: (n) => item.said(n, site) });
}

chrome.contextMenus.onClicked.addListener((info, tab) => void onMenuClick(info.menuItemId, tab?.id));
chrome.runtime.onInstalled.addListener(createMenus);

// Install, update, browser start, enable, reload (Chrome 157+). A wake for any
// other reason also lands here, so count right away too.
const runtime = chrome.runtime as typeof chrome.runtime & { onExtensionLoaded?: chrome.events.Event<() => void> };
runtime.onExtensionLoaded?.addListener(() => {
  createMenus();
  scheduleRefresh();
});
void refreshBadge();
