/** Sample states for the screen gallery. Display data only — no browser logic. */
import type { DuplicateSet, PopupModel, Range, SiteGroup, TabRow } from '../ui/model';

const tab = (id: number, title: string, domain: string, extra: Partial<TabRow> = {}): TabRow => ({
  id,
  title,
  domain,
  detail: domain,
  ...extra,
});

const TABS: TabRow[] = [
  tab(1, 'Issues · ato', 'github.com', { current: true }),
  tab(2, 'chrome.tabs — Chrome for Developers', 'developer.chrome.com', { copies: 2 }),
  tab(3, 'Lo-fi beats to code to', 'youtube.com', { audible: true, age: '12m' }),
  tab(4, 'Inbox (3)', 'mail.proton.me', { pinned: true, age: '18m' }),
  tab(5, 'Hacker News', 'news.ycombinator.com', { copies: 3 }),
  tab(6, 'ATO 3 — screen notes', 'docs.google.com', { age: '1h' }),
  tab(7, 'fast-check: property based testing', 'fast-check.dev', { age: '2h' }),
  tab(8, 'Intl.RelativeTimeFormat — MDN', 'developer.mozilla.org', { unloaded: true, age: '2d' }),
  tab(9, 'Hacker News', 'news.ycombinator.com', { copies: 3 }),
  tab(10, 'chrome.tabs — Chrome for Developers', 'developer.chrome.com', { copies: 2 }),
];

const base: PopupModel = {
  tabCount: 48,
  siteCount: 17,
  windowCount: 2,
  duplicates: { extra: 4, sets: 3 },
  scope: 'all',
  searchFocused: false,
  screen: { kind: 'tabs', sort: 'recent', rows: TABS },
};

/** Case-insensitive occurrences of each term — enough for fixtures; real search lives in core. */
function matches(text: string, terms: string[]): Range[] {
  const lower = text.toLowerCase();
  const out: Range[] = [];
  for (const term of terms) {
    for (let i = lower.indexOf(term); i !== -1; i = lower.indexOf(term, i + term.length)) {
      out.push([i, i + term.length]);
    }
  }
  return out;
}

function searchRow(id: number, title: string, url: string, extra: Partial<TabRow> = {}): TabRow {
  const terms = ['chrome', 'tabs'];
  return {
    id,
    title,
    detail: url,
    domain: new URL(`https://${url}`).hostname,
    titleMatches: matches(title, terms),
    detailMatches: matches(url, terms),
    ...extra,
  };
}

const SITES: SiteGroup[] = [
  { domain: 'github.com', expanded: false, tabs: Array.from({ length: 12 }, (_, i) => tab(100 + i, `Repo ${i}`, 'github.com')) },
  {
    domain: 'news.ycombinator.com',
    expanded: true,
    tabs: [
      tab(5, 'Hacker News', 'news.ycombinator.com', { copies: 3 }),
      tab(9, 'Hacker News', 'news.ycombinator.com', { copies: 3 }),
      tab(11, 'Hacker News', 'news.ycombinator.com', { copies: 3 }),
      tab(12, 'Show HN: a tab manager that stays out of the way', 'news.ycombinator.com', { unloaded: true }),
    ],
  },
  { domain: 'developer.chrome.com', expanded: false, tabs: Array.from({ length: 6 }, (_, i) => tab(200 + i, `Doc ${i}`, 'developer.chrome.com')) },
  { domain: 'docs.google.com', expanded: false, tabs: Array.from({ length: 5 }, (_, i) => tab(300 + i, `Doc ${i}`, 'docs.google.com')) },
  { domain: 'youtube.com', expanded: false, tabs: Array.from({ length: 3 }, (_, i) => tab(400 + i, `Video ${i}`, 'youtube.com')) },
];

const SETS: DuplicateSet[] = [
  {
    title: 'Hacker News',
    domain: 'news.ycombinator.com',
    copies: [
      { tabId: 5, location: 'Window 1 · tab 4', verdict: { action: 'keep', reason: 'oldest' } },
      { tabId: 9, location: 'Window 1 · tab 9', verdict: { action: 'close', age: '3h' } },
      { tabId: 11, location: 'Window 2 · tab 2', verdict: { action: 'close', age: '1d' } },
    ],
  },
  {
    title: 'chrome.tabs — Chrome for Developers',
    domain: 'developer.chrome.com',
    copies: [
      { tabId: 2, location: 'Window 1 · tab 2', verdict: { action: 'keep', reason: 'current' } },
      { tabId: 10, location: 'Window 1 · tab 8', verdict: { action: 'close', age: '8m' } },
    ],
  },
  {
    title: 'Inbox (3)',
    domain: 'mail.proton.me',
    copies: [
      { tabId: 4, location: 'Window 1 · tab 1', verdict: { action: 'keep', reason: 'pinned' } },
      { tabId: 13, location: 'Window 2 · tab 5', verdict: { action: 'close', age: '5h' } },
    ],
  },
];

const SELECT_ROWS: TabRow[] = [
  tab(21, 'Postgres connection pooling explained', 'stackoverflow.com', { age: '9d' }),
  tab(22, 'Why we moved off microservices', 'medium.com', { age: '8d' }),
  tab(23, 'Q3 planning (draft)', 'docs.google.com', { age: '6d' }),
  tab(24, 'Conference talk: building fast extensions', 'youtube.com', { age: '6d' }),
  tab(25, 'Pull request #212 · vite', 'github.com', { age: '4d' }),
  tab(2, 'chrome.tabs — Chrome for Developers', 'developer.chrome.com', { copies: 2 }),
  tab(4, 'Inbox (3)', 'mail.proton.me', { pinned: true, age: '18m' }),
];

const CLEANED = TABS.filter((t) => ![9, 10].includes(t.id)).map((t) =>
  t.copies ? { ...t, copies: undefined, age: t.id === 2 ? '4m' : '3h' } : t,
);

export interface Fixture {
  name: string;
  model: PopupModel;
}

export const FIXTURES: Fixture[] = [
  { name: 'Tabs (on open)', model: { ...base, searchFocused: true } },
  {
    name: 'Search',
    model: {
      ...base,
      searchFocused: true,
      cursor: 'tab:2',
      screen: {
        kind: 'search',
        query: 'chrome tabs',
        mode: 'fuzzy',
        windowCount: 2,
        results: [
          searchRow(2, 'chrome.tabs — Chrome for Developers', 'developer.chrome.com/docs/extensions/reference/api/tabs', { copies: 2 }),
          searchRow(10, 'chrome.tabs — Chrome for Developers', 'developer.chrome.com/docs/extensions/reference/api/tabs', { copies: 2 }),
          searchRow(30, 'Unload tabs in Chrome to save memory', 'blog.chromium.org/2026/memory-tabs', { age: '3d' }),
          searchRow(31, 'Chrome Web Store — ATO tabs organizer', 'chromewebstore.google.com/detail/ato', { age: '5h' }),
        ],
      },
    },
  },
  { name: 'Sites', model: { ...base, cursor: 'site:news.ycombinator.com', screen: { kind: 'sites', sort: 'most', groups: SITES } } },
  { name: 'Duplicate review', model: { ...base, cursor: 'copy:9', screen: { kind: 'review', keep: 'oldest', protectGroups: true, sets: SETS } } },
  {
    name: 'Select mode',
    model: { ...base, cursor: 'tab:24', selection: new Set([21, 22, 23, 24]), screen: { kind: 'tabs', sort: 'oldest', rows: SELECT_ROWS } },
  },
  {
    name: 'After cleanup (undo)',
    model: {
      ...base,
      tabCount: 44,
      searchFocused: true,
      duplicates: { extra: 0, sets: 0 },
      toast: { message: 'Closed 4 duplicates', undo: true },
      screen: { kind: 'tabs', sort: 'recent', rows: CLEANED },
    },
  },
  {
    name: 'Search, no matches',
    model: { ...base, searchFocused: true, screen: { kind: 'search', query: 'kubernetes', mode: 'fuzzy', windowCount: 2, results: [] } },
  },
  {
    name: 'Loading',
    model: {
      tabCount: 0,
      siteCount: 0,
      windowCount: 0,
      duplicates: { extra: 0, sets: 0 },
      scope: 'all',
      searchFocused: true,
      screen: { kind: 'loading' },
    },
  },
];
