import { domainOf } from './tabs';
import type { Tab } from './types';

export type Range = readonly [start: number, end: number];

export type SearchField = 'url' | 'title';

export interface ParsedQuery {
  mode: 'contains' | 'exact';
  field: 'all' | SearchField;
  terms: string[];
}

const FIELD_PREFIX = /^\s*(url|title):\s*/i;

/**
 * Split a leading `url:` / `title:` off a query; the popup shows it as a chip
 * and the rest as the search text. Only the first prefix counts.
 */
export function splitField(raw: string): { field: SearchField | null; rest: string } {
  const prefix = FIELD_PREFIX.exec(raw);
  if (!prefix?.[1]) return { field: null, rest: raw };
  return { field: prefix[1].toLowerCase() as SearchField, rest: raw.slice(prefix[0].length) };
}

/** Inverse of `splitField`: the query a chip plus search text stand for. */
export function joinField(field: SearchField | null, rest: string): string {
  return field ? `${field}:${rest}` : rest;
}

/**
 * `"exact phrase"` → one exact term; `url:` / `title:` prefixes scope the field;
 * anything else → whitespace-separated terms that must all appear.
 */
export function parseQuery(raw: string): ParsedQuery {
  const split = splitField(raw);
  const field: ParsedQuery['field'] = split.field ?? 'all';
  const text = split.rest.trim();
  const quoted = /^"(.*)"?$/.exec(text);
  if (quoted && text.length > 1) {
    const phrase = (quoted[1] ?? '').replace(/"$/, '').toLowerCase();
    return { mode: 'exact', field, terms: phrase ? [phrase] : [] };
  }
  return { mode: 'contains', field, terms: text.toLowerCase().split(/\s+/).filter(Boolean) };
}

/** Every occurrence of every term in `text` (case-insensitive). */
export function findRanges(text: string, terms: readonly string[]): Range[] {
  const lower = text.toLowerCase();
  const ranges: Range[] = [];
  for (const term of terms) {
    for (let i = lower.indexOf(term); i !== -1; i = lower.indexOf(term, i + term.length)) {
      ranges.push([i, i + term.length]);
    }
  }
  return ranges;
}

export interface SearchHit {
  tab: Tab;
  titleRanges: Range[];
  urlRanges: Range[];
}

/** Tabs where every term appears in the searched fields; title hits rank first. */
export function searchTabs(tabs: readonly Tab[], query: ParsedQuery): SearchHit[] {
  if (query.terms.length === 0) return [];
  const hits: (SearchHit & { score: number })[] = [];
  for (const tab of tabs) {
    const title = query.field === 'url' ? '' : tab.title;
    const url = query.field === 'title' ? '' : tab.url;
    const haystack = `${title}\n${url}\n${query.field === 'all' ? domainOf(tab.url) : ''}`.toLowerCase();
    if (!query.terms.every((t) => haystack.includes(t))) continue;
    const titleRanges = findRanges(title, query.terms);
    hits.push({ tab, titleRanges, urlRanges: findRanges(url, query.terms), score: titleRanges.length });
  }
  return hits.sort((a, b) => b.score - a.score || b.tab.lastAccessed - a.tab.lastAccessed).map(({ score: _s, ...hit }) => hit);
}
