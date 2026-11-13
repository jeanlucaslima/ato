/** The popup's fixed frame parts: search bar, duplicate strip, view bar, footers. */
import { cls, h } from './dom';
import { plural } from './format';
import { icon } from './icons';
import type { PopupModel, Scope, SearchMode, SiteSort, TabSort } from './model';

export function searchBar(m: PopupModel): HTMLElement {
  const query = m.screen.kind === 'search' ? m.screen.query : '';
  const placeholder = m.screen.kind === 'loading' ? 'Search tabs' : `Search ${plural(m.tabCount, 'tab')}`;
  return h(
    'div',
    { class: 'top' },
    h(
      'label',
      { class: cls('search', m.searchFocused && 'is-focused') },
      icon('search', 18),
      h('input', {
        type: 'search',
        name: 'q',
        value: query,
        placeholder,
        'aria-label': 'Search tabs',
        autocomplete: 'off',
        spellcheck: 'false',
      }),
      query
        ? h('button', { class: 'icon-btn', type: 'button', 'aria-label': 'Clear search', 'data-action': 'clear-query' }, icon('close', 12))
        : h('kbd', { class: 'k k--box' }, '/'),
    ),
    h('button', { class: 'icon-btn', type: 'button', 'aria-label': 'Settings', 'data-action': 'settings' }, icon('gear', 18)),
  );
}

const MODE_LABEL: Record<SearchMode, string> = { contains: 'Contains', exact: 'Exact' };

export function searchTips(mode: SearchMode): HTMLElement {
  return h(
    'div',
    { class: 'search-tips' },
    h('span', { class: 'chip' }, MODE_LABEL[mode]),
    h('span', null, 'Try'),
    ['"exact"', 'url:', 'title:'].map((s) => h('code', { class: 'k' }, s)),
  );
}

export function duplicateStrip(m: PopupModel): HTMLElement {
  const { extra, sets } = m.duplicates;
  const state = m.screen.kind === 'loading' ? 'idle' : extra === 0 ? 'clean' : 'dupes';
  return h(
    'div',
    { class: cls('strip', state === 'clean' && 'strip--clean', state === 'idle' && 'strip--idle'), role: 'status' },
    h('span', { class: 'dot', 'aria-hidden': 'true' }),
    state === 'idle' && h('span', { class: 'txt' }, 'Checking for duplicates…'),
    state === 'clean' &&
      h('span', { class: 'txt' }, h('strong', null, 'No duplicates'), ` · ${plural(m.tabCount, 'tab')} in ${plural(m.windowCount, 'window')}`),
    state === 'dupes' && h('span', { class: 'txt' }, h('strong', null, plural(extra, 'duplicate')), ` · ${plural(sets, 'set')}`),
    state === 'dupes' && h('button', { class: 'btn', type: 'button', 'data-action': 'open-review' }, 'Review', h('kbd', { class: 'k k--box' }, 'D')),
  );
}

const TAB_SORT: Record<TabSort, string> = { recent: 'Recent', oldest: 'Oldest', title: 'Title', site: 'Site', copies: 'Copies' };
const SITE_SORT: Record<SiteSort, string> = { most: 'Most tabs', name: 'A–Z', recent: 'Recent' };
const SCOPE: Record<Scope, string> = { all: 'All windows', current: 'This window' };

function cycleButton(label: string, action: string, title: string): HTMLElement {
  return h('button', { class: 'menu-btn', type: 'button', 'data-action': action, title }, label, icon('chevron', 10));
}

export function viewBar(m: PopupModel): HTMLElement {
  const sites = m.screen.kind === 'sites';
  const counted = m.screen.kind !== 'loading';
  const sortLabel = m.screen.kind === 'sites' ? SITE_SORT[m.screen.sort] : m.screen.kind === 'tabs' ? TAB_SORT[m.screen.sort] : '';
  return h(
    'div',
    { class: 'bar' },
    h(
      'div',
      { class: cls('seg', sites && 'seg--second'), role: 'group', 'aria-label': 'View' },
      h('span', { class: 'seg-thumb', 'aria-hidden': 'true' }),
      h('button', { type: 'button', 'aria-pressed': String(!sites), 'data-action': 'view', 'data-view': 'tabs' }, 'Tabs', counted && h('span', { class: 'n' }, m.tabCount)),
      h('button', { type: 'button', 'aria-pressed': String(sites), 'data-action': 'view', 'data-view': 'sites' }, 'Sites', counted && h('span', { class: 'n' }, m.siteCount)),
    ),
    h('span', { class: 'spacer' }),
    sortLabel && cycleButton(sortLabel, 'cycle-sort', 'Change sort order'),
    cycleButton(SCOPE[m.scope], 'cycle-scope', 'Switch between all windows and this window'),
  );
}

export type Hint = readonly [key: string, label: string];

export function hintFooter(hints: readonly Hint[]): HTMLElement {
  return h(
    'div',
    { class: 'foot' },
    hints.map(([key, label]) => h('span', null, h('kbd', { class: 'k' }, key), ` ${label}`)),
    h('button', { class: 'foot-help', type: 'button', 'data-action': 'toggle-help', title: 'Keyboard shortcuts' }, h('kbd', { class: 'k' }, '?'), ' keys'),
  );
}

export function selectionBar(count: number): HTMLElement {
  const none = count === 0;
  return h(
    'div',
    { class: 'actionbar', role: 'toolbar', 'aria-label': 'Selection actions', 'data-key': 'actionbar' },
    h('span', { class: 'count' }, none ? 'Select tabs' : `${count} selected`),
    h('button', { class: 'btn', type: 'button', disabled: none, 'data-action': 'move-selected' }, 'Move'),
    h('button', { class: 'btn', type: 'button', disabled: none, 'data-action': 'unload-selected' }, 'Unload'),
    h('button', { class: 'btn btn--danger', type: 'button', disabled: none, 'data-action': 'close-selected' }, 'Close'),
    h('button', { class: 'btn btn--ghost', type: 'button', 'data-action': 'exit-select' }, 'Done'),
  );
}

export function toast(t: NonNullable<PopupModel['toast']>): HTMLElement {
  return h(
    'div',
    // A new key per toast replays the enter animation.
    { class: 'toast', role: 'status', 'aria-live': 'polite', 'data-key': `toast:${t.id}` },
    h('span', { class: 'txt' }, t.message),
    t.undo && h('button', { class: 'btn', type: 'button', 'data-action': 'undo' }, 'Undo', h('kbd', { class: 'k' }, '⌘Z')),
  );
}
