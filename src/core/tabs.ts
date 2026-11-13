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

/**
 * Key that identifies duplicates. Only web and file pages take part; browser
 * pages (`chrome://`, extensions, `about:`) and loading tabs never do.
 */
export function duplicateKey(tab: Pick<Tab, 'url'>): string | null {
  return tab.url && COMPARABLE.test(tab.url) ? tab.url : null;
}

/** Copies per duplicate key, for every key seen at least once. */
export function countCopies(tabs: readonly Tab[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const tab of tabs) {
    const key = duplicateKey(tab);
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
