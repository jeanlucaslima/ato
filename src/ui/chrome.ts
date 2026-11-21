/** The popup's fixed frame parts: search bar, duplicate strip, view bar, footers. */
import { cls, h } from './dom';
import { plural } from './format';
import { icon } from './icons';
import { logoSvg } from './logo-svg';
import { PLAYING_ROWS, type ItemKey, type PopupModel, type Scope, type SearchField, type SearchMode, type SiteSort, type TabRow, type TabSort } from './model';

/**
 * The logo at header size: the 3D icosahedron in the text colour (so it follows
 * the theme), with heavier lines and fewer dashes than the big renders. Static,
 * trusted markup computed once.
 */
const MARK = logoSvg({ size: 28, spin: 100, pitch: -18, background: null, color: 'currentColor', weight: 2.4, dashes: 3, hiddenOpacity: 0.5 });

function brandMark(): HTMLElement {
  const el = h('span', { class: 'brand-logo', 'aria-hidden': 'true' });
  el.innerHTML = MARK;
  return el;
}

/** Logo, name and settings: the popup's identity row. */
export function brandBar(): HTMLElement {
  return h(
    'header',
    { class: 'brand' },
    brandMark(),
    h('span', { class: 'brand-name' }, 'ATO'),
    h('span', { class: 'brand-tag' }, 'Advanced Tab Organizer'),
    h('button', { class: 'icon-btn', type: 'button', 'aria-label': 'Settings', title: 'Settings', 'data-action': 'settings' }, icon('gear', 18)),
  );
}

const FIELD_LABEL: Record<SearchField, string> = { url: 'URL', title: 'Title', dupe: 'Duplicates' };
const FIELD_PLACEHOLDER: Record<SearchField, string> = { url: 'Search URLs', title: 'Search titles', dupe: 'Filter duplicated tabs' };
const FIELD_TIP: Record<SearchField, string> = { url: 'URLs only', title: 'Titles only', dupe: 'Tabs open more than once' };

/**
 * `url:` / `title:` / `dupe:` typed at the start of search turns into this chip. Always
 * rendered (hidden when unused) so the field's children keep their places and
 * the input never gets replaced mid-typing.
 */
function fieldChip(field: SearchField | null): HTMLElement {
  return h(
    'span',
    { class: 'field-chip', hidden: !field },
    field && FIELD_LABEL[field],
    field &&
      h('button', { class: 'field-chip-x', type: 'button', 'aria-label': `Remove ${FIELD_LABEL[field]} filter`, 'data-action': 'clear-field' }, icon('close', 8)),
  );
}

export function searchBar(m: PopupModel): HTMLElement {
  const search = m.screen.kind === 'search' ? m.screen : null;
  const query = search?.query ?? '';
  const field = search?.field ?? null;
  const placeholder = field ? FIELD_PLACEHOLDER[field] : m.screen.kind === 'loading' ? 'Search tabs' : `Search ${plural(m.tabCount, 'tab')}`;
  return h(
    'div',
    { class: 'top' },
    h(
      'label',
      { class: cls('search', m.searchFocused && 'is-focused') },
      icon('search', 18),
      fieldChip(field),
      h('input', {
        type: 'search',
        name: 'q',
        value: search?.text ?? '',
        placeholder,
        'aria-label': 'Search tabs',
        role: 'combobox',
        'aria-autocomplete': 'list',
        'aria-expanded': 'true',
        autocomplete: 'off',
        spellcheck: 'false',
      }),
      query
        ? h('button', { class: 'icon-btn', type: 'button', 'aria-label': 'Clear search', 'data-action': 'clear-query' }, icon('close', 12))
        : h('kbd', { class: 'k k--box' }, '/'),
    ),
  );
}

const MODE_LABEL: Record<SearchMode, string> = { contains: 'Contains', exact: 'Whole words' };

export function searchTips(mode: SearchMode, field: SearchField | null): HTMLElement {
  return h(
    'div',
    { class: 'search-tips' },
    h('span', { class: 'chip' }, MODE_LABEL[mode]),
    field
      ? [h('span', null, `${FIELD_TIP[field]} ·`), h('kbd', { class: 'k k--box' }, '⌫'), h('span', null, 'at the start removes it')]
      : [h('span', null, 'Try'), ['"exact"', 'url:', 'title:', 'dupe:'].map((s) => h('code', { class: 'k' }, s))],
  );
}

/** Equalizer bars: move while a tab plays, rest while it's muted. */
function eq(): HTMLElement {
  return h('span', { class: 'eq', 'aria-hidden': 'true' }, h('i'), h('i'), h('i'), h('i'));
}

/**
 * Tabs making sound, from any window: click one to go there, mute or unmute
 * it in place. Hidden when nothing plays.
 */
export function nowPlaying(rows: readonly TabRow[], cursor?: ItemKey): HTMLElement | null {
  if (rows.length === 0) return null;
  const extra = rows.length - PLAYING_ROWS;
  return h(
    'section',
    { class: 'playing', 'aria-label': 'Playing audio', 'data-key': 'playing' },
    rows.slice(0, PLAYING_ROWS).map((r) =>
      h(
        'div',
        { class: cls('play-row', r.muted && 'is-muted', cursor === `play:${r.id}` && 'is-cursor'), 'data-key': `play:${r.id}` },
        h(
          'button',
          { class: 'play-go', type: 'button', 'data-action': 'activate', 'data-id': r.id, title: 'Go to this tab' },
          eq(),
          h('span', { class: 'play-text' }, h('span', { class: 'play-title' }, r.title), h('span', { class: 'play-sub' }, r.muted ? `${r.domain} · muted` : r.domain)),
        ),
        h(
          'button',
          { class: 'icon-btn play-mute', type: 'button', 'data-action': 'toggle-mute', 'data-id': r.id, 'aria-pressed': String(Boolean(r.muted)), 'aria-label': r.muted ? 'Unmute' : 'Mute', title: r.muted ? 'Unmute' : 'Mute' },
          icon(r.muted ? 'muted' : 'audio', 16),
        ),
      ),
    ),
    extra > 0 && h('p', { class: 'play-more' }, `+${extra} more playing`),
  );
}

export function duplicateStrip(m: PopupModel): HTMLElement {
  const { extra, sets } = m.duplicates;
  const state = m.screen.kind === 'loading' ? 'idle' : extra === 0 ? 'clean' : 'dupes';
  return h(
    'div',
    { class: cls('strip', state === 'clean' && 'strip--clean', state === 'idle' && 'strip--idle', m.cursor === 'dupes' && 'is-cursor'), role: 'status', 'data-key': 'dupes' },
    h('span', { class: 'dot', 'aria-hidden': 'true' }),
    state === 'idle' && h('span', { class: 'txt' }, 'Checking for duplicates…'),
    state === 'clean' &&
      h('span', { class: 'txt' }, h('strong', null, 'No duplicates'), ` · ${plural(m.tabCount, 'tab')} in ${plural(m.windowCount, 'window')}`),
    state === 'dupes' && h('span', { class: 'txt' }, h('strong', null, plural(extra, 'duplicate')), ` · ${plural(sets, 'set')}`),
    // Show the key that works right now: in the search field, D would type a "d".
    state === 'dupes' &&
      h(
        'button',
        { class: 'btn', type: 'button', 'data-action': 'open-review', title: 'Review duplicates (D, or ⌘D from search)' },
        'Review',
        h('kbd', { class: 'k k--box' }, m.searchFocused ? '⌘D' : 'D'),
      ),
    state === 'dupes' &&
      h(
        'button',
        { class: 'btn btn--danger', type: 'button', 'data-action': 'close-duplicates', title: 'Close every extra copy now; one of each stays (undo after)' },
        `Close ${extra}`,
      ),
  );
}

const TAB_SORT: Record<TabSort, string> = { recent: 'Recent', oldest: 'Oldest', title: 'Title', site: 'Site', copies: 'Copies' };
const SITE_SORT: Record<SiteSort, string> = { most: 'Most tabs', name: 'A–Z', recent: 'Recent' };
const SCOPE: Record<Scope, string> = { all: 'All windows', current: 'This window' };

function cycleButton(label: string, action: string, title: string): HTMLElement {
  return h('button', { class: 'menu-btn', type: 'button', 'data-action': action, title }, label, icon('chevron', 10));
}

export function viewBar(m: PopupModel): HTMLElement {
  const view = m.screen.kind === 'sites' || m.screen.kind === 'windows' ? m.screen.kind : 'tabs';
  const counted = m.screen.kind !== 'loading';
  const sortLabel = m.screen.kind === 'sites' ? SITE_SORT[m.screen.sort] : m.screen.kind === 'tabs' ? TAB_SORT[m.screen.sort] : '';
  return h(
    'div',
    { class: 'bar' },
    h(
      'div',
      { class: cls('seg', `seg--at-${view}`), role: 'group', 'aria-label': 'View' },
      h('span', { class: 'seg-thumb', 'aria-hidden': 'true' }),
      h('button', { type: 'button', 'aria-pressed': String(view === 'tabs'), 'data-action': 'view', 'data-view': 'tabs' }, 'Tabs', counted && h('span', { class: 'n' }, m.tabCount)),
      h('button', { type: 'button', 'aria-pressed': String(view === 'sites'), 'data-action': 'view', 'data-view': 'sites' }, 'Sites', counted && h('span', { class: 'n' }, m.siteCount)),
      h('button', { type: 'button', 'aria-pressed': String(view === 'windows'), 'data-action': 'view', 'data-view': 'windows' }, 'Windows', counted && h('span', { class: 'n' }, m.windowTotal)),
    ),
    h('span', { class: 'spacer' }),
    sortLabel && cycleButton(sortLabel, 'cycle-sort', 'Change sort order'),
    // The Windows view always shows every window.
    view !== 'windows' && cycleButton(SCOPE[m.scope], 'cycle-scope', 'Switch between all windows and this window'),
  );
}

export type Hint = readonly [key: string, label: string];

export function hintFooter(hints: readonly Hint[]): HTMLElement {
  return h(
    'div',
    { class: 'foot' },
    hints.map(([key, label]) => h('span', null, h('kbd', { class: 'k k--box' }, key), ` ${label}`)),
    h('button', { class: 'foot-help', type: 'button', 'data-action': 'toggle-help', title: 'Keyboard shortcuts' }, h('kbd', { class: 'k k--box' }, '?'), ' keys'),
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
    t.undo && h('button', { class: 'btn', type: 'button', 'data-action': 'undo' }, 'Undo', h('kbd', { class: 'k k--box' }, '⌘Z')),
  );
}
