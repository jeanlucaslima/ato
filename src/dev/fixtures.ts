/** Sample browser state + starting UI states for the screen gallery. */
import type { Snapshot, Tab } from '../core/types';
import { initialUi, type AppState, type UiState } from '../ui/state';

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

export interface Fixture {
  name: string;
  state: AppState;
}

const at = (ui: Partial<UiState>, snapshot: Snapshot | null = SNAPSHOT): AppState => ({ snapshot, ui: initialUi(ui) });

export const FIXTURES: Fixture[] = [
  { name: 'Tabs (on open)', state: at({}) },
  { name: 'Search', state: at({ query: 'chrome tabs', cursor: `tab:${idOf('chrome.tabs — Chrome for Developers')}` }) },
  {
    name: 'Sites',
    state: at({ view: 'sites', searchFocused: false, expanded: new Set(['news.ycombinator.com']), cursor: 'site:news.ycombinator.com' }),
  },
  { name: 'Duplicate review', state: at({ reviewOpen: true, searchFocused: false, cursor: `copy:${idOf('Hacker News', 1)}` }) },
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
  { name: 'Search, no matches', state: at({ query: 'kubernetes' }) },
  { name: 'Loading', state: at({}, null) },
];
