import { countCopies, domainOf, duplicateKey, type MatchMode } from './tabs';
import type { Tab } from './types';

export type Range = readonly [start: number, end: number];

/** `url:` / `title:` narrow where terms match; `dupe:` narrows to tabs open more than once. */
export type SearchField = 'url' | 'title' | 'dupe';

export interface ParsedQuery {
  /** `contains`: each term anywhere (substring). `exact`: a quoted phrase, as whole words. */
  mode: 'contains' | 'exact';
  field: 'all' | SearchField;
  terms: string[];
}

const FIELD_PREFIX = /^\s*(url|title|dupe):\s*/i;

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
 * `"exact phrase"` → one term matched as whole words (see `matcher`); `url:` / `title:` prefixes scope the field;
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

/** Every occurrence of every term in `text` (case-insensitive), as `mode` matches them. */
export function findRanges(text: string, terms: readonly string[], mode: ParsedQuery['mode'] = 'contains'): Range[] {
  return matcher(terms, mode).ranges(text);
}

/** A letter or digit in any script: what a word is made of. */
const WORD_CHAR = /[\p{L}\p{N}]/u;

interface Matcher {
  /** Every term occurs in `text`. */
  all(text: string): boolean;
  /** Where the terms occur in `text`. */
  ranges(text: string): Range[];
}

const escapeRegExp = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * How terms are found, built once per query. `contains`: substrings. `exact`:
 * the phrase as whole words, so `"cat"` finds "my cat" and "cat-food" but not
 * "catalog" or "bobcat"; an edge of the phrase that is itself a letter or digit
 * must not touch another one (`"/docs"` still finds "a.test/docs/x").
 */
function matcher(terms: readonly string[], mode: ParsedQuery['mode']): Matcher {
  if (mode === 'contains') {
    return {
      all: (text) => {
        const lower = text.toLowerCase();
        return terms.every((t) => lower.includes(t));
      },
      ranges: (text) => {
        const lower = text.toLowerCase();
        const ranges: Range[] = [];
        for (const term of terms) {
          for (let i = lower.indexOf(term); i !== -1; i = lower.indexOf(term, i + term.length)) ranges.push([i, i + term.length]);
        }
        return ranges;
      },
    };
  }
  const patterns = terms.map((term) => {
    const before = WORD_CHAR.test(term[0] ?? '') ? '(?<![\\p{L}\\p{N}])' : '';
    const after = WORD_CHAR.test(term[term.length - 1] ?? '') ? '(?![\\p{L}\\p{N}])' : '';
    return before + escapeRegExp(term) + after;
  });
  // Separate regexes: `test` on a global one would leave a lastIndex that matchAll copies.
  const tests = patterns.map((p) => new RegExp(p, 'iu'));
  const finds = patterns.map((p) => new RegExp(p, 'giu'));
  return {
    all: (text) => tests.every((p) => p.test(text)),
    ranges: (text) => finds.flatMap((p) => [...text.matchAll(p)].map((m): Range => [m.index, m.index + m[0].length])),
  };
}

export interface SearchHit {
  tab: Tab;
  titleRanges: Range[];
  urlRanges: Range[];
}

/**
 * Tabs where every term appears in the searched fields; title hits rank first.
 * `dupe:` searches only tabs that have a copy; with no terms it lists them all,
 * copies side by side, biggest sets first.
 */
export function searchTabs(tabs: readonly Tab[], query: ParsedQuery, match: MatchMode = 'exact'): SearchHit[] {
  if (query.field === 'dupe') {
    const counts = countCopies(tabs, match);
    const copiesOf = (t: Tab) => counts.get(duplicateKey(t, match) ?? '') ?? 0;
    const duplicated = tabs.filter((t) => copiesOf(t) > 1);
    if (query.terms.length === 0) {
      return duplicated
        .sort((a, b) => copiesOf(b) - copiesOf(a) || a.url.localeCompare(b.url) || b.lastAccessed - a.lastAccessed)
        .map((tab) => ({ tab, titleRanges: [], urlRanges: [] }));
    }
    return searchTabs(duplicated, { ...query, field: 'all' });
  }
  if (query.terms.length === 0) return [];
  const find = matcher(query.terms, query.mode);
  const hits: (SearchHit & { score: number })[] = [];
  for (const tab of tabs) {
    const title = query.field === 'url' ? '' : tab.title;
    const url = query.field === 'title' ? '' : tab.url;
    // Newlines keep fields apart: a phrase never runs from one into the next.
    if (!find.all(`${title}\n${url}\n${query.field === 'all' ? domainOf(tab.url) : ''}`)) continue;
    const titleRanges = find.ranges(title);
    hits.push({ tab, titleRanges, urlRanges: find.ranges(url), score: titleRanges.length });
  }
  return hits.sort((a, b) => b.score - a.score || b.tab.lastAccessed - a.tab.lastAccessed).map(({ score: _s, ...hit }) => hit);
}
