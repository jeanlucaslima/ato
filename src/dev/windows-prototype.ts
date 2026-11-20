/**
 * PROTOTYPE, not app code: three ways to show every window, drawn with the real
 * popup frame and tokens over the gallery's sample tabs. Shown in the screen
 * gallery's "Prototype" section; nothing here is wired to the app.
 */
import './windows-prototype.css';
import { domainOf, formatAge } from '../core/tabs';
import type { Snapshot, Tab } from '../core/types';
import { deriveModel, extraCopies } from '../ui/derive';
import { cls, h } from '../ui/dom';
import { favicon, tintFor } from '../ui/favicon';
import { plural } from '../ui/format';
import { icon } from '../ui/icons';
import type { TabRow } from '../ui/model';
import { renderPopup } from '../ui/popup';
import { tabRow } from '../ui/rows';
import { initialUi } from '../ui/state';
import { MANY_COPIES } from './fixtures';

/** Chrome tab groups, made up for the mock (the sample tabs have none). */
interface GroupInfo {
  id: number;
  title: string;
  color: string;
  collapsed: boolean;
}
/** Chrome's nine group colours, roughly. */
const GROUP_COLOR = { blue: '#8ab4f8', purple: '#c58af9', orange: '#fcad70', green: '#81c995' };
const GROUPS = new Map<number, GroupInfo>([
  [11, { id: 11, title: 'ATO v3', color: GROUP_COLOR.blue, collapsed: false }],
  [12, { id: 12, title: 'Read later', color: GROUP_COLOR.purple, collapsed: true }],
  [21, { id: 21, title: 'Reading', color: GROUP_COLOR.orange, collapsed: false }],
  [22, { id: 22, title: 'Planning', color: GROUP_COLOR.green, collapsed: false }],
]);
/** window → [first index, last index, group id]: groups are contiguous runs, as in Chrome. */
const GROUP_RUNS: Record<number, [number, number, number][]> = { 1: [[5, 6, 11], [9, 11, 12]], 2: [[2, 3, 21], [4, 4, 22]] };

const snapshot: Snapshot = {
  ...MANY_COPIES,
  tabs: MANY_COPIES.tabs.map((t) => {
    const run = GROUP_RUNS[t.windowId]?.find(([a, b]) => t.index >= a && t.index <= b);
    return run ? { ...t, groupId: run[2] } : t;
  }),
};
const ui = initialUi({ searchFocused: false });
const rows = new Map<number, TabRow>();
{
  const m = deriveModel({ snapshot, ui });
  if (m.screen.kind === 'tabs') for (const r of m.screen.rows) rows.set(r.id, r);
}
const extras = new Set(extraCopies(snapshot, ui, snapshot.tabs).map((t) => t.id));

interface WindowInfo {
  n: number;
  id: number;
  focused: boolean;
  tabs: Tab[];
  sites: { domain: string; count: number; favIconUrl?: string }[];
  dupes: number;
  playing: number;
  unloaded: number;
  lastUsed: string;
}

const windowIds = [...new Set(snapshot.tabs.map((t) => t.windowId))].sort((a, b) => a - b);
const windows: WindowInfo[] = windowIds.map((id, i) => {
  const tabs = snapshot.tabs.filter((t) => t.windowId === id).sort((a, b) => a.index - b.index);
  const bySite = new Map<string, { domain: string; count: number; favIconUrl?: string }>();
  for (const t of tabs) {
    const d = domainOf(t.url) || 'Other';
    const s = bySite.get(d) ?? { domain: d, count: 0, favIconUrl: t.favIconUrl };
    s.count++;
    bySite.set(d, s);
  }
  return {
    n: i + 1,
    id,
    focused: id === snapshot.focusedWindowId,
    tabs,
    sites: [...bySite.values()].sort((a, b) => b.count - a.count),
    dupes: tabs.filter((t) => extras.has(t.id)).length,
    playing: tabs.filter((t) => t.audible).length,
    unloaded: tabs.filter((t) => t.discarded).length,
    lastUsed: formatAge(snapshot.now - Math.max(...tabs.map((t) => t.lastAccessed))),
  };
});
const totalTabs = snapshot.tabs.length;

/** Chrome doesn't give extensions window names, so a window is described by what's in it. */
const describe = (w: WindowInfo) => (w.sites.length === 1 ? w.sites[0]!.domain : `${w.sites[0]!.domain} + ${plural(w.sites.length - 1, 'site')}`);

function favStrip(w: WindowInfo, max = 5): HTMLElement {
  const shown = w.sites.slice(0, max);
  return h('span', { class: 'fav-strip', 'aria-hidden': 'true' }, shown.map((s) => favicon(s.domain, s.favIconUrl)), w.sites.length > max && h('span', { class: 'more' }, `+${w.sites.length - max}`));
}

/** The real popup frame (brand, search, strip) with the body swapped for a prototype. */
function frame(bar: HTMLElement | null, list: HTMLElement, hints: string): HTMLElement {
  const popup = renderPopup(deriveModel({ snapshot, ui }));
  const oldBar = popup.querySelector('.bar');
  if (bar) oldBar?.replaceWith(bar);
  popup.querySelector('.playing')?.remove();
  popup.querySelector('.list')?.replaceWith(list);
  const foot = popup.querySelector('.foot');
  if (foot) foot.firstChild && (foot.querySelectorAll('span').forEach((s) => s.remove()), foot.prepend(h('span', { class: 'proto-hint' }, hints)));
  return popup;
}

function seg(active: 'tabs' | 'sites' | 'windows', three = true): HTMLElement {
  const b = (v: string, label: string, n: number) => h('button', { type: 'button', 'aria-pressed': String(active === v) }, label, h('span', { class: 'n' }, n));
  return h(
    'div',
    { class: cls('seg', three && 'seg--three', `seg--at-${active}`), role: 'group' },
    h('span', { class: 'seg-thumb', 'aria-hidden': 'true' }),
    b('tabs', 'Tabs', totalTabs),
    b('sites', 'Sites', new Set(snapshot.tabs.map((t) => domainOf(t.url))).size),
    three && b('windows', 'Windows', windows.length),
  );
}

// --- A · Windows view ---------------------------------------------------------

function windowGroup(w: WindowInfo, open: boolean): HTMLElement {
  const el = h(
    'div',
    { class: cls('site', 'win', open && 'is-open') },
    h(
      'div',
      { class: 'site-row win-row' },
      h(
        'span',
        { class: 'site-toggle' },
        h('span', { class: 'caret' }, icon('caretRight', 12)),
        h('span', { class: cls('win-tile', w.focused && 'is-focused') }, w.n),
        h(
          'span',
          { class: 'win-text' },
          h('span', { class: 'win-name' }, `Window ${w.n}`, w.focused && h('span', { class: 'cur' }, 'This window')),
          h('span', { class: 'win-sub' }, favStrip(w), `${plural(w.tabs.length, 'tab')} · ${w.lastUsed}`),
        ),
      ),
      h(
        'span',
        { class: 'win-flags' },
        w.dupes > 0 && h('span', { class: 'dup' }, `${w.dupes} dup`),
        w.playing > 0 && h('span', { class: 'audio' }, icon('audio', 14)),
      ),
      h(
        'span',
        { class: 'site-actions' },
        !w.focused && h('button', { class: 'btn', type: 'button', title: 'Bring this window to the front' }, 'Focus'),
        !w.focused && h('button', { class: 'btn', type: 'button', title: 'Move its tabs into this window' }, 'Merge'),
        h('button', { class: 'btn btn--danger', type: 'button' }, `Close ${w.tabs.length}`),
      ),
    ),
    h('div', { class: 'site-body' }, h('div', { class: 'site-body-inner' }, w.tabs.slice(0, 6).map((t) => tabRow({ ...rows.get(t.id)!, detail: domainOf(t.url) }, { compact: true })))),
  );
  el.querySelector('.site-toggle')!.addEventListener('click', () => el.classList.toggle('is-open'));
  return el;
}

function variantA(): HTMLElement {
  return frame(
  h('div', { class: 'bar' }, seg('windows'), h('span', { class: 'spacer' }), h('button', { class: 'menu-btn', type: 'button' }, 'Most tabs', icon('chevron', 10))),
  h('div', { class: 'list' }, windows.map((w) => windowGroup(w, w.n === 1))),
  '↵ focus window   M merge   ⌫ close window',
  );
}

// --- B · Window map -----------------------------------------------------------

/** A window's tabs in strip order, cut into runs: each group, and the ungrouped tabs between. */
function runs(tabs: readonly Tab[]): { group: GroupInfo | null; tabs: Tab[] }[] {
  const out: { group: GroupInfo | null; tabs: Tab[] }[] = [];
  for (const t of tabs) {
    const group = GROUPS.get(t.groupId) ?? null;
    const last = out[out.length - 1];
    if (last && last.group?.id === group?.id) last.tabs.push(t);
    else out.push({ group, tabs: [t] });
  }
  return out;
}

function dot(t: Tab): HTMLElement {
  return h('i', {
    class: cls('dot', t.active && 'is-active', extras.has(t.id) && 'is-dup', t.audible && 'is-playing', t.discarded && 'is-asleep', t.pinned && 'is-pinned'),
    style: `--c:${tintFor(domainOf(t.url))}`,
    title: t.title,
  });
}

/** Dots in strip order; a group brackets its dots in its colour, a collapsed group is one pill. */
function dotStrip(w: WindowInfo): HTMLElement {
  return h(
    'div',
    { class: 'tab-dots', 'aria-hidden': 'true' },
    runs(w.tabs).map(({ group, tabs }) =>
      !group
        ? tabs.map(dot)
        : group.collapsed
        ? h('span', { class: 'dot-pill', style: `--g:${group.color}`, title: `${group.title} (collapsed)` }, group.title, h('b', null, tabs.length))
        : h('span', { class: 'dot-group', style: `--g:${group.color}`, title: group.title }, tabs.map(dot)),
    ),
  );
}

/** The window's tabs as rows, grouped under their tab groups, in strip order. */
function windowTabs(w: WindowInfo): HTMLElement {
  const row = (t: Tab) => tabRow({ ...rows.get(t.id)!, detail: domainOf(t.url) || t.url });
  return h(
    'div',
    { class: 'win-tabs' },
    runs(w.tabs).map(({ group, tabs }) =>
      !group
        ? tabs.map(row)
        : h(
            'div',
            { class: cls('tab-group', group.collapsed && 'is-collapsed'), style: `--g:${group.color}` },
            h(
              'div',
              { class: 'tab-group-head' },
              h('span', { class: 'tab-group-name' }, group.title),
              h('span', { class: 'tab-group-n' }, plural(tabs.length, 'tab')),
              group.collapsed && h('span', { class: 'tab-group-note' }, 'collapsed in Chrome'),
              h('span', { class: 'spacer' }),
              h('button', { class: 'btn', type: 'button', title: 'Move this group to a new window' }, icon('newWindow', 14)),
              h('button', { class: 'btn btn--danger', type: 'button' }, `Close ${tabs.length}`),
            ),
            tabs.map(row),
          ),
    ),
  );
}

function windowCard(w: WindowInfo, open: boolean): HTMLElement {
  const groups = new Set(w.tabs.map((t) => t.groupId).filter((g) => GROUPS.has(g))).size;
  const card = h(
    'div',
    { class: cls('win-card', w.focused && 'is-focused', open && 'is-open') },
    h(
      'div',
      { class: 'win-card-head' },
      h('span', { class: cls('win-tile', w.focused && 'is-focused') }, w.n),
      h(
        'span',
        { class: 'win-text' },
        h('span', { class: 'win-name' }, `Window ${w.n}`, w.focused && h('span', { class: 'cur' }, 'This window')),
        h('span', { class: 'win-sub' }, `${describe(w)} · used ${w.lastUsed}`),
      ),
      h('span', { class: 'win-card-count' }, w.tabs.length),
    ),
    dotStrip(w),
    h(
      'div',
      { class: 'win-card-foot' },
      h('span', null, plural(w.sites.length, 'site')),
      groups > 0 && h('span', null, plural(groups, 'group')),
      w.dupes > 0 && h('span', { class: 'dup' }, plural(w.dupes, 'duplicate')),
      w.unloaded > 0 && h('span', null, `${w.unloaded} unloaded`),
      h('span', { class: 'spacer' }),
      !w.focused && h('button', { class: 'btn', type: 'button' }, 'Merge here'),
      !w.focused && h('button', { class: 'btn', type: 'button' }, 'Focus'),
      h('button', { class: 'btn win-toggle', type: 'button', 'aria-expanded': String(open) }, 'Tabs', h('span', { class: 'fold-caret' }, icon('chevron', 10))),
    ),
    windowTabs(w),
  );
  const toggle = () => {
    card.classList.toggle('is-open');
    card.querySelector('.win-toggle')?.setAttribute('aria-expanded', String(card.classList.contains('is-open')));
  };
  card.querySelector('.win-toggle')!.addEventListener('click', toggle);
  card.querySelector('.win-card-head')!.addEventListener('click', toggle);
  return card;
}

function variantB(): HTMLElement {
  return frame(
    h('div', { class: 'bar' }, seg('windows'), h('span', { class: 'spacer' }), h('button', { class: 'btn', type: 'button', title: 'Move every tab into this window' }, 'Merge all')),
    h(
      'div',
      { class: 'list win-map' },
      windows.map((w) => windowCard(w, w.n === 1)),
      h(
        'p',
        { class: 'win-legend' },
        h('i', { class: 'dot is-active' }), 'current',
        h('i', { class: 'dot is-dup' }), 'duplicate',
        h('i', { class: 'dot is-playing' }), 'playing',
        h('i', { class: 'dot is-asleep' }), 'unloaded',
        h('span', { class: 'dot-group', style: `--g:${GROUP_COLOR.blue}` }, h('i', { class: 'dot' })), 'group',
      ),
    ),
    'Click a window to see its tabs · each dot is a tab',
  );
}

// --- A + B · Windows view with the tab map ---------------------------------------

/** A's foldable window row, with B's dot strip (groups included) as its second line. */
function hybridWindow(w: WindowInfo, open: boolean): HTMLElement {
  const groups = new Set(w.tabs.map((t) => t.groupId).filter((g) => GROUPS.has(g))).size;
  const el = h(
    'div',
    { class: cls('ab-win', w.focused && 'is-focused', open && 'is-open') },
    h(
      'div',
      { class: 'ab-head' },
      h('span', { class: 'caret' }, icon('caretRight', 12)),
      h('span', { class: cls('win-tile', w.focused && 'is-focused') }, w.n),
      h(
        'span',
        { class: 'win-text' },
        h('span', { class: 'win-name' }, `Window ${w.n}`, w.focused && h('span', { class: 'cur' }, 'This window')),
        h(
          'span',
          { class: 'win-sub' },
          [plural(w.tabs.length, 'tab'), plural(w.sites.length, 'site'), groups > 0 && plural(groups, 'group'), `used ${w.lastUsed}`].filter(Boolean).join(' · '),
        ),
      ),
      h(
        'span',
        { class: 'win-flags' },
        w.dupes > 0 && h('span', { class: 'dup', title: plural(w.dupes, 'duplicate') }, `×${w.dupes}`),
        w.playing > 0 && h('span', { class: 'audio' }, icon('audio', 14)),
      ),
      h(
        'span',
        { class: 'ab-actions' },
        !w.focused && h('button', { class: 'btn', type: 'button', title: 'Bring this window to the front (↵)' }, 'Focus'),
        !w.focused && h('button', { class: 'btn', type: 'button', title: 'Move its tabs into this window (M)' }, 'Merge'),
        h('button', { class: 'btn btn--danger', type: 'button', title: 'Close this window (⌫)' }, `Close ${w.tabs.length}`),
      ),
    ),
    h('div', { class: 'ab-map' }, dotStrip(w)),
    h('div', { class: 'ab-body' }, windowTabs(w)),
  );
  el.querySelector('.ab-head')!.addEventListener('click', (e) => {
    if ((e.target as HTMLElement).closest('button')) return;
    el.classList.toggle('is-open');
  });
  return el;
}

function variantAB(): HTMLElement {
  return frame(
    h('div', { class: 'bar' }, seg('windows'), h('span', { class: 'spacer' }), h('button', { class: 'menu-btn', type: 'button' }, 'Recent', icon('chevron', 10))),
    h('div', { class: 'list' }, windows.map((w) => hybridWindow(w, w.n === 1))),
    '←→ fold   ↵ focus   M merge   ⌫ close',
  );
}

// --- C · Window chips ---------------------------------------------------------

function variantC(): HTMLElement {
  const chosen = windows[2]!;
  return frame(
  h(
    'div',
    { class: 'bar bar--chips' },
    h(
      'div',
      { class: 'bar-row' },
      seg('tabs', false),
      h('span', { class: 'spacer' }),
      h('button', { class: 'menu-btn', type: 'button' }, 'Recent', icon('chevron', 10)),
    ),
    h(
      'div',
      { class: 'win-chips', role: 'radiogroup', 'aria-label': 'Window' },
      h('button', { class: 'win-chip', type: 'button' }, 'All', h('span', { class: 'n' }, totalTabs)),
      windows.map((w) =>
        h(
          'button',
          { class: cls('win-chip', w === chosen && 'is-on'), type: 'button', title: describe(w) },
          favicon(w.sites[0]!.domain, w.sites[0]!.favIconUrl),
          w.focused ? 'This' : `W${w.n}`,
          h('span', { class: 'n' }, w.tabs.length),
        ),
      ),
    ),
  ),
  h(
    'div',
    { class: 'list' },
    h('div', { class: 'win-filter-note' }, `Window ${chosen.n} · ${describe(chosen)}`, h('span', { class: 'spacer' }), h('button', { class: 'btn', type: 'button' }, 'Focus'), h('button', { class: 'btn', type: 'button' }, 'Merge')),
    chosen.tabs.map((t) => tabRow(rows.get(t.id)!)),
  ),
  '1–9 pick a window   0 all',
  );
}

// --- Gallery section ------------------------------------------------------------

const fig = (title: string, note: string, popup: HTMLElement) =>
  h('figure', { class: 'proto-fig' }, h('figcaption', null, h('span', null, title)), popup, h('p', { class: 'proto-note' }, note));

/** The "Prototype · all windows" section of the screen gallery. */
export function windowPrototypes(): HTMLElement {
  return h(
    'section',
    { class: 'gallery-proto' },
    h(
      'header',
      { class: 'gallery-head' },
      h('h2', null, 'Prototype · showing all windows'),
      h('p', null, `Static mocks over the sample tabs (${plural(windows.length, 'window')}, ${plural(totalTabs, 'tab')}), in the real popup frame. Buttons don't act; A's window rows open and close. Not wired to the app.`),
    ),
    h(
      'div',
      { class: 'gallery' },
      fig(
        'A + B · Windows view with a tab map (proposed)',
        "A's rows, each with B's dot strip: every dot a tab in strip order, groups bracketed in their colour, a collapsed group as one pill. Click a window to see its tabs under their groups. Window 1 starts open.",
        variantAB(),
      ),
      fig('A · Windows view', 'A third view beside Tabs and Sites. Each window folds like a site: its tabs underneath, Focus / Merge / Close when open. Familiar, keyboard-friendly, scales to many windows.', variantA()),
      fig('B · Window map', 'All windows at a glance: one card each, every tab a dot coloured by site, rings for current, duplicate and playing. Best for spotting the messy window; less for acting on single tabs.', variantB()),
      fig('C · Window chips', "No new view: chips under the bar narrow Tabs or Sites to one window (replaces the All windows / This window switch). Cheapest; doesn't show windows side by side.", variantC()),
    ),
  );
}
