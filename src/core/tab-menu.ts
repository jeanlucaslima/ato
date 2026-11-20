/**
 * What the tab right-click menu closes. The right-clicked tab always stays: the
 * user picked it as the one to keep. Everything else follows the same
 * protections as the popup (current, playing, pinned, grouped per policy).
 */
import { protection, type DuplicatePolicy } from './duplicates';
import { domainOf, duplicateKey } from './tabs';
import type { Tab } from './types';

/** "Close duplicates of this tab": its other copies, protected ones aside. */
export function duplicatesOf(clicked: Tab, tabs: readonly Tab[], policy: DuplicatePolicy): Tab[] {
  const key = duplicateKey(clicked);
  if (key === null) return [];
  return tabs.filter((t) => t.id !== clicked.id && duplicateKey(t) === key && protection(t, policy) === null);
}

/** "Close other tabs from this site": the rest of its site, protected ones aside. */
export function othersFromSite(clicked: Tab, tabs: readonly Tab[], policy: DuplicatePolicy): Tab[] {
  const site = domainOf(clicked.url);
  if (!site) return [];
  return tabs.filter((t) => t.id !== clicked.id && domainOf(t.url) === site && protection(t, policy) === null);
}
