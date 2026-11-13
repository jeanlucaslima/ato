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
        ? h('button', { class: 'icon-btn', type: 'button', 'aria-label': 'Clear search' }, icon('close', 12))
        : h('kbd', { class: 'k k--box' }, '/'),
    ),
    h('button', { class: 'icon-btn', type: 'button', 'aria-label': 'Settings' }, icon('gear', 18)),
  );
}

const MODE_LABEL: Record<SearchMode, string> = { fuzzy: 'Fuzzy', exact: 'Exact', wildcard: 'Wildcard' };

export function searchTips(mode: SearchMode): HTMLElement {
  return h(
    'div',
    { class: 'search-tips' },
    h('span', { class: 'chip' }, MODE_LABEL[mode]),
    h('span', null, 'Try'),
    ['"exact"', 'url:', 'title:', 'doc*'].map((s) => h('code', { class: 'k' }, s)),
  );
}

export function duplicateStrip(m: PopupModel): HTMLElement {
  const { extra, sets } = m.duplicates;
  if (m.screen.kind === 'loading') {
    return h('div', { class: 'strip strip--idle', role: 'status' }, h('span', { class: 'dot' }), h('span', { class: 'txt' }, 'Checking for duplicates…'));
  }
  if (extra === 0) {
    return h(
      'div',
      { class: 'strip strip--clean', role: 'status' },
      h('span', { class: 'dot', 'aria-hidden': 'true' }),
      h('span', { class: 'txt' }, h('strong', null, 'No duplicates'), ` · ${plural(m.tabCount, 'tab')} in ${plural(m.windowCount, 'window')}`),
    );
  }
  return h(
    'div',
    { class: 'strip', role: 'status' },
    h('span', { class: 'dot', 'aria-hidden': 'true' }),
    h('span', { class: 'txt' }, h('strong', null, plural(extra, 'duplicate')), ` · ${plural(sets, 'set')}`),
    h('button', { class: 'btn', type: 'button' }, 'Review', h('kbd', { class: 'k k--box' }, 'D')),
  );
}

const TAB_SORT: Record<TabSort, string> = { recent: 'Recent', oldest: 'Oldest', title: 'Title', site: 'Site', copies: 'Copies' };
const SITE_SORT: Record<SiteSort, string> = { most: 'Most tabs', name: 'A–Z', recent: 'Recent' };
const SCOPE: Record<Scope, string> = { all: 'All windows', current: 'This window' };

function menuButton(label: string): HTMLElement {
  return h('button', { class: 'menu-btn', type: 'button', 'aria-haspopup': 'menu' }, label, icon('chevron', 10));
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
      { class: 'seg', role: 'group', 'aria-label': 'View' },
      h('button', { type: 'button', 'aria-pressed': String(!sites) }, 'Tabs', counted && h('span', { class: 'n' }, m.tabCount)),
      h('button', { type: 'button', 'aria-pressed': String(sites) }, 'Sites', counted && h('span', { class: 'n' }, m.siteCount)),
    ),
    h('span', { class: 'spacer' }),
    sortLabel && menuButton(sortLabel),
    menuButton(SCOPE[m.scope]),
  );
}

export type Hint = readonly [key: string, label: string];

export function hintFooter(hints: readonly Hint[]): HTMLElement {
  return h(
    'div',
    { class: 'foot' },
    hints.map(([key, label]) => h('span', null, h('kbd', { class: 'k' }, key), ` ${label}`)),
    h('span', { class: 'brand' }, 'ATO'),
  );
}

export function selectionBar(count: number): HTMLElement {
  const none = count === 0;
  return h(
    'div',
    { class: 'actionbar', role: 'toolbar', 'aria-label': 'Selection actions' },
    h('span', { class: 'count' }, `${count} selected`),
    h('button', { class: 'btn', type: 'button', disabled: none }, 'Move'),
    h('button', { class: 'btn', type: 'button', disabled: none }, 'Unload'),
    h('button', { class: 'btn btn--danger', type: 'button', disabled: none }, 'Close'),
    h('button', { class: 'btn btn--ghost', type: 'button' }, 'Done'),
  );
}

export function toast(message: string, undo: boolean): HTMLElement {
  return h(
    'div',
    { class: 'toast', role: 'status', 'aria-live': 'polite' },
    h('span', { class: 'txt' }, message),
    undo && h('button', { class: 'btn', type: 'button' }, 'Undo', h('kbd', { class: 'k' }, '⌘Z')),
  );
}
