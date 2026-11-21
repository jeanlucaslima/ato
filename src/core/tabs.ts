import type { Tab } from './types';

/**
 * Site of a URL: its hostname without a leading `www.`, so `www.youtube.com`
 * and `youtube.com` group together. `''` when there is none (`about:blank`, invalid).
 */
export function domainOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return '';
  }
}

const COMPARABLE = /^(https?|file):/i;

/** What makes two tabs the same page: the whole URL, or the URL without its `#hash` and/or `?query`. */
export type MatchMode = 'exact' | 'ignoreHash' | 'ignoreQuery' | 'ignoreBoth';

/**
 * Key that identifies duplicates. Only web and file pages take part; browser
 * pages (`chrome://`, extensions, `about:`) and loading tabs never do.
 */
export function duplicateKey(tab: Pick<Tab, 'url'>, match: MatchMode = 'exact'): string | null {
  if (!tab.url || !COMPARABLE.test(tab.url)) return null;
  if (match === 'exact') return tab.url;
  try {
    const u = new URL(tab.url);
    // Read each line as "every mode except X clears this": the #hash is cleared by
    // all modes but ignoreQuery (so ignoreHash and ignoreBoth), and the ?query by
    // all modes but ignoreHash (so ignoreQuery and ignoreBoth). 'exact' returned above.
    // Not swapped: tabs.test.ts pins it with examples and properties.
    if (match !== 'ignoreQuery') u.hash = '';
    if (match !== 'ignoreHash') u.search = '';
    return u.href;
  } catch {
    return tab.url;
  }
}

/**
 * The part of a URL after the site: path, query and hash (`/item?id=1`), `/`
 * for the home page, `''` when there is no URL to read.
 */
export function pathOf(url: string): string {
  try {
    const u = new URL(url);
    return `${u.pathname}${u.search}${u.hash}` || '/';
  } catch {
    return '';
  }
}

/** Copies per duplicate key, for every key seen at least once. */
export function countCopies(tabs: readonly Tab[], match: MatchMode = 'exact'): Map<string, number> {
  const counts = new Map<string, number>();
  for (const tab of tabs) {
    const key = duplicateKey(tab, match);
    if (key !== null) counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return counts;
}

/** `"now"`, `"12m"`, `"3h"`, `"5d"`, `"7w"`. */
export function formatAge(elapsedMs: number): string {
  const minutes = Math.floor(elapsedMs / 60_000);
  if (minutes < 1) return 'now';
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  return days < 14 ? `${days}d` : `${Math.floor(days / 7)}w`;
}
