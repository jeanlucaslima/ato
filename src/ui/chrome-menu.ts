/**
 * The tab right-click menu's two closes. The tab that was right-clicked stays;
 * the pick (`core/tab-menu.ts`) decides the rest with every protection, then
 * the shared close path (`closeTabs`) checks protection again on Chrome's
 * current state, removes, and remembers the close so the popup can offer undo.
 */
import { DEFAULT_SETTINGS, policyOf, type Settings } from '../core/settings';
import { duplicatesOf, othersFromSite } from '../core/tab-menu';
import { domainOf } from '../core/tabs';
import { closeTabs } from './chrome-close';
import { fromChromeTab } from './chrome-tab';
import { plural } from './format';

export const MENU = {
  duplicates: { id: 'ato-close-duplicates', title: 'Close duplicates of this tab', pick: duplicatesOf, said: (n: number, _site: string) => `Closed ${plural(n, 'duplicate')} (tab menu)` },
  site: { id: 'ato-close-site', title: 'Close other tabs from this site', pick: othersFromSite, said: (n: number, site: string) => `Closed ${plural(n, 'tab')} from ${site} (tab menu)` },
} as const;

/** Run menu item `menuItemId` on the right-clicked tab `clickedId`, under `load()`'s settings. */
export async function closeFromMenu(menuItemId: string | number, clickedId: number | undefined, load: () => Promise<Settings>): Promise<void> {
  const item = Object.values(MENU).find((m) => m.id === menuItemId);
  if (!item || clickedId === undefined) return;
  const now = Date.now();
  const [raw, settings] = await Promise.all([chrome.tabs.query({ windowType: 'normal' }), load().catch(() => DEFAULT_SETTINGS)]);
  const tabs = raw.flatMap((t) => fromChromeTab(t, now) ?? []);
  const clicked = tabs.find((t) => t.id === clickedId);
  if (!clicked) return;
  const policy = policyOf(settings);
  const closing = item.pick(clicked, tabs, policy).map((t) => t.id);
  const site = domainOf(clicked.url);
  if (closing.length > 0) await closeTabs(closing, policy, { source: 'menu', message: (n) => item.said(n, site) });
}
