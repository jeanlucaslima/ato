/** Sample browser state + starting UI states for the screen gallery. */
import type { Snapshot, Tab } from '../core/types';
import { initialUi, type AppState, type UiState } from '../ui/state';
import { makeSnapshot } from './perf';

const NOW = Date.UTC(2026, 10, 13, 12, 0);
const MIN = 60_000;

let nextId = 1;
const counters = new Map<number, number>();

function tab(windowId: number, title: string, url: string, minutesAgo: number, extra: Partial<Tab> = {}): Tab {
  const index = counters.get(windowId) ?? 0;
  counters.set(windowId, index + 1);
  return {
    id: nextId++,
    windowId,
    index,
    title,
    url,
    active: false,
    pinned: false,
    audible: false,
    discarded: false,
    groupId: -1,
    lastAccessed: NOW - minutesAgo * MIN,
    ...extra,
  };
}

const HN = 'https://news.ycombinator.com/';
const TABS_API = 'https://developer.chrome.com/docs/extensions/reference/api/tabs';
const INBOX = 'https://mail.proton.me/u/0/inbox';

/** Two windows, three duplicate sets (one with the current tab, one pinned). */
export const TABS: Tab[] = [
  tab(1, 'Inbox (3)', INBOX, 18, { pinned: true }),
  tab(1, 'chrome.tabs — Chrome for Developers', TABS_API, 0, { active: true }),
  tab(1, 'Issues · ato', 'https://github.com/jeanlucaslima/ato/issues', 2),
  tab(1, 'Hacker News', HN, 180),
  tab(1, 'Lo-fi beats to code to', 'https://www.youtube.com/watch?v=lofi', 12, { audible: true }),
  tab(1, 'ATO 3 — screen notes', 'https://docs.google.com/document/d/ato3', 60),
  tab(1, 'fast-check: property based testing', 'https://fast-check.dev/', 120),
  tab(1, 'chrome.tabs — Chrome for Developers', TABS_API, 8),
  tab(1, 'Hacker News', HN, 200),
  tab(1, 'Intl.RelativeTimeFormat — MDN', 'https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl/RelativeTimeFormat', 2 * 24 * 60, { discarded: true }),
  tab(1, 'Show HN: a tab manager that stays out of the way', 'https://news.ycombinator.com/item?id=4242', 3 * 24 * 60, { discarded: true }),
  tab(1, 'Pull request #212 · vitejs/vite', 'https://github.com/vitejs/vite/pull/212', 4 * 24 * 60),
  tab(2, 'Hacker News', HN, 24 * 60),
  tab(2, 'Inbox (3)', INBOX, 5 * 60),
  tab(2, 'Postgres connection pooling explained', 'https://stackoverflow.com/questions/pooling', 9 * 24 * 60),
  tab(2, 'Why we moved off microservices', 'https://medium.com/@eng/microservices', 8 * 24 * 60),
  tab(2, 'Q3 planning (draft)', 'https://docs.google.com/document/d/q3', 6 * 24 * 60),
  tab(2, 'Conference talk: building fast extensions', 'https://www.youtube.com/watch?v=talk', 6 * 24 * 60, { active: true }),
  tab(2, 'Unload tabs in Chrome to save memory', 'https://blog.chromium.org/2026/memory-tabs', 3 * 24 * 60),
  tab(2, 'Chrome Web Store — ATO tabs organizer', 'https://chromewebstore.google.com/detail/ato', 5 * 60),
];

export const SNAPSHOT: Snapshot = { tabs: TABS, focusedWindowId: 1, now: NOW };

const idOf = (title: string, n = 0) => TABS.filter((t) => t.title === title)[n]?.id ?? 0;
const cleaned: Snapshot = {
  ...SNAPSHOT,
  tabs: TABS.filter((t) => ![idOf('Hacker News', 1), idOf('Hacker News', 2), idOf('chrome.tabs — Chrome for Developers', 1), idOf('Inbox (3)', 1)].includes(t.id)),
};

/** An older, silent copy of the video that's playing: review must keep the playing one. */
const lofi = TABS.find((t) => t.title === 'Lo-fi beats to code to')!;
export const PLAYING_DUPLICATE: Snapshot = {
  ...SNAPSHOT,
  tabs: [...TABS, { ...lofi, id: 900, windowId: 2, index: 8, audible: false, lastAccessed: NOW - 3 * 24 * 60 * MIN }],
};

/** A side-by-side pair holding an older copy of Hacker News: review keeps it (split view). */
export const SPLIT_DUPLICATE: Snapshot = {
  ...SNAPSHOT,
  tabs: TABS.map((t) => (t.windowId === 2 && (t.index === 0 || t.index === 1) ? { ...t, splitViewId: 5 } : t)),
};

/** Nineteen copies of one page (16 in a window of their own): review starts that set folded. */
export const MANY_COPIES: Snapshot = {
  ...SNAPSHOT,
  tabs: [
    ...TABS,
    ...Array.from({ length: 16 }, (_, i): Tab => ({ ...TABS.find((t) => t.title === 'Hacker News')!, id: 800 + i, windowId: 3, index: i, lastAccessed: NOW - i * 20 * MIN })),
  ],
};

/**
 * Three windows with tab groups (one collapsed), for the Windows view. Groups are
 * contiguous runs in the strip, as in Chrome.
 */
export const GROUPED: Snapshot = (() => {
  const runs: Record<number, [from: number, to: number, groupId: number][]> = { 1: [[5, 6, 11], [9, 11, 12]], 2: [[2, 3, 21], [4, 4, 22]] };
  return {
    ...MANY_COPIES,
    tabs: MANY_COPIES.tabs.map((t) => {
      const run = runs[t.windowId]?.find(([a, b]) => t.index >= a && t.index <= b);
      return run ? { ...t, groupId: run[2] } : t;
    }),
    groups: [
      { id: 11, windowId: 1, title: 'ATO v3', color: 'blue', collapsed: false },
      { id: 12, windowId: 1, title: 'Read later', color: 'purple', collapsed: true },
      { id: 21, windowId: 2, title: 'Reading', color: 'orange', collapsed: false },
      { id: 22, windowId: 2, title: '', color: 'green', collapsed: false },
    ],
  };
})();

/** A third window holding only protected tabs (current, pinned, playing): its Close is hidden. */
export const PROTECTED_WINDOW: Snapshot = {
  ...GROUPED,
  tabs: [
    ...GROUPED.tabs.filter((t) => t.windowId !== 3),
    { ...TABS[0]!, id: 950, windowId: 3, index: 0 },
    { ...TABS[1]!, id: 951, windowId: 3, index: 1 },
    { ...TABS[4]!, id: 952, windowId: 3, index: 2, active: false },
  ],
};

export interface Fixture {
  name: string;
  state: AppState;
}

/** Thousands of duplicates: what the counts and Close buttons do at that size. */
const HUGE = makeSnapshot(6000, 7);

const at = (ui: Partial<UiState>, snapshot: Snapshot | null = SNAPSHOT): AppState => ({ snapshot, ui: initialUi(ui) });

export const FIXTURES: Fixture[] = [
  { name: 'Tabs (on open)', state: at({}) },
  { name: 'Tabs · cursor on the duplicates bar (↵ opens review)', state: at({ searchFocused: false, cursor: 'dupes' }) },
  { name: 'Search', state: at({ query: 'chrome tabs', cursor: `tab:${idOf('chrome.tabs — Chrome for Developers')}` }) },
  {
    name: 'Sites',
    state: at({ view: 'sites', searchFocused: false, expanded: new Set(['news.ycombinator.com']), cursor: 'site:news.ycombinator.com' }),
  },
  { name: 'Windows (tab map, groups)', state: at({ view: 'windows', searchFocused: false, openWindows: new Set([2]), cursor: 'win:2' }, GROUPED) },
  {
    name: 'Windows · Close counts only what it closes (protected stay; none left: no button)',
    state: at({ view: 'windows', searchFocused: false, openWindows: new Set([3]), cursor: 'win:3' }, PROTECTED_WINDOW),
  },
  { name: 'Duplicate review', state: at({ reviewOpen: true, searchFocused: false, cursor: `copy:${idOf('Hacker News', 1)}` }) },
  { name: 'Duplicate review · 19 copies of one page (folded)', state: at({ reviewOpen: true, searchFocused: false, cursor: `set:${HN}` }, MANY_COPIES) },
  {
    name: 'Duplicate review · 19 copies, opened',
    state: at({ reviewOpen: true, searchFocused: false, setOpen: new Map([[HN, true]]), cursor: 'copy:803' }, MANY_COPIES),
  },
  { name: 'Duplicate review · thousands of duplicates (6,000 tabs)', state: at({ reviewOpen: true, searchFocused: false }, HUGE) },
  { name: 'Tabs · thousands of duplicates (6,000 tabs)', state: at({ searchFocused: false, cursor: 'dupes' }, HUGE) },
  { name: 'Duplicate review · a copy is in a split view', state: at({ reviewOpen: true, searchFocused: false }, SPLIT_DUPLICATE) },
  { name: 'Duplicate review · a copy is playing', state: at({ reviewOpen: true, searchFocused: false }, PLAYING_DUPLICATE) },
  {
    name: 'Select mode',
    state: at({
      tabSort: 'oldest',
      searchFocused: false,
      selection: new Set(TABS.filter((t) => t.windowId === 2 && !t.active && t.lastAccessed < NOW - 5 * 24 * 60 * MIN).map((t) => t.id)),
      cursor: `tab:${idOf('Q3 planning (draft)')}`,
    }),
  },
  { name: 'After cleanup (undo)', state: at({ toast: { id: 1, message: 'Closed 4 duplicates', undo: [] } }, cleaned) },
  {
    name: 'Opened after a right-click close (Undo offered)',
    state: at({ toast: { id: 1, message: 'Closed 2 duplicates (tab menu)', undo: TABS.filter((t) => t.title === 'Hacker News').slice(1), closedAt: NOW - 20_000 } }, cleaned),
  },
  { name: 'A close failed (Chrome refused)', state: at({ toast: { id: 1, message: 'Couldn’t close tabs — try again' } }) },
  { name: 'Search, no matches', state: at({ query: 'kubernetes' }) },
  { name: 'Search · url: chip', state: at({ query: 'url:github', cursor: `tab:${idOf('Issues · ato')}` }) },
  { name: 'url: just typed (chip, no text yet)', state: at({ query: 'url:' }) },
  { name: 'Search · dupe: chip (every duplicated tab)', state: at({ query: 'dupe:' }) },
  { name: 'Search · title: chip', state: at({ query: 'title:chrome', cursor: `tab:${idOf('chrome.tabs — Chrome for Developers')}` }) },
  {
    name: 'Playing media (one muted)',
    state: at(
      { searchFocused: false },
      {
        ...SNAPSHOT,
        tabs: TABS.map((t) =>
          t.title === 'Conference talk: building fast extensions' ? { ...t, audible: true, muted: true } : t.title === 'Hacker News' && t.windowId === 2 ? { ...t, audible: true } : t,
        ),
      },
    ),
  },
  { name: 'Loading', state: at({}, null) },
];
