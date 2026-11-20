import { brandBar, duplicateStrip, nowPlaying, hintFooter, searchBar, searchTips, selectionBar, toast, viewBar, type Hint } from './chrome';
import { h, type Child } from './dom';
import { helpPanel } from './help';
import { plural } from './format';
import type { PopupModel } from './model';
import { closeCount, reviewDone, reviewHeader, reviewPolicy, reviewSets } from './review';
import { siteGroup, tabRow } from './rows';
import { windowGroup } from './windows';

function hintsFor(m: PopupModel): Hint[] {
  switch (m.screen.kind) {
    case 'loading':
      return [];
    case 'tabs':
      return [['↑↓', 'move'], ['↵', 'go'], ['⌫', 'close'], ['U', 'unload'], ['X', 'select']];
    case 'sites':
      return [['←→', 'fold'], ['⌫', 'close site'], ['U', 'unload site'], ['S', 'windows']];
    case 'windows':
      return [['←→', 'fold'], ['↵', 'focus'], ['M', 'merge'], ['⌫', 'close'], ['S', 'tabs']];
    case 'search':
      return [['↑↓', 'move'], ['↵', 'go'], ['⌘⌫', 'close all'], ['Esc', 'clear']];
    case 'review':
      return m.screen.sets.length === 0 ? [['Esc', 'back']] : [['↵', `close ${closeCount(m.screen.sets)}`], ['Space', 'keep/close'], ['Esc', 'back']];
  }
}

/**
 * The scrolling list. Its key changes with the screen, so switching screens
 * swaps in a fresh element (and its enter animation) instead of morphing rows.
 */
function list(screen: string, attrs: Record<string, string>, ...children: Child[]): HTMLElement {
  return h('div', { class: 'list', 'data-key': `list:${screen}`, ...attrs }, ...children);
}

/** Header + list for the active screen. */
function body(m: PopupModel): Child[] {
  const s = m.screen;
  const sel = m.selection;
  switch (s.kind) {
    case 'loading':
      return [viewBar(m), list('loading', { 'aria-busy': 'true' }, h('p', { class: 'empty' }, 'Reading tabs…'))];
    case 'tabs':
      return [
        viewBar(m),
        list(
          'tabs',
          { role: 'listbox', 'aria-label': 'Tabs', 'aria-multiselectable': sel ? 'true' : 'false' },
          s.rows.map((r) => tabRow(r, { cursor: m.cursor === `tab:${r.id}`, selected: sel ? sel.has(r.id) : undefined })),
          s.rows.length === 0 && h('p', { class: 'empty' }, 'No tabs in this window.'),
        ),
      ];
    case 'sites':
      return [viewBar(m), list('sites', { role: 'tree', 'aria-label': 'Sites', 'aria-multiselectable': sel ? 'true' : 'false' }, s.groups.map((g) => siteGroup(g, m.cursor, sel)))];
    case 'windows':
      return [viewBar(m), list('windows', { role: 'tree', 'aria-label': 'Windows', 'aria-multiselectable': sel ? 'true' : 'false' }, s.windows.map((w) => windowGroup(w, m.cursor, sel)))];
    case 'search': {
      const n = s.total;
      const hidden = s.total - s.results.length;
      return [
        searchTips(s.mode, s.field),
        h(
          'div',
          { class: 'head head--results' },
          h('h2', null, plural(n, 'match', 'matches'), n > 0 && h('span', null, ` · ${plural(s.windowCount, 'window')}`)),
          n > 0 && h('button', { class: 'btn', type: 'button', 'data-action': 'unload-results' }, `Unload ${n}`),
          n > 0 && h('button', { class: 'btn', type: 'button', 'data-action': 'move-results', title: 'Gather into a new window (M)' }, 'Move'),
          n > 0 &&
            (s.extra === undefined
              ? h('button', { class: 'btn btn--danger', type: 'button', 'data-action': 'close-results' }, `Close ${n}`)
              : h(
                  'button',
                  { class: 'btn btn--danger', type: 'button', 'data-action': 'close-results', disabled: s.extra === 0, title: 'Closes the extra copies; one of each stays' },
                  `Close ${plural(s.extra, 'extra', 'extras')}`,
                )),
        ),
        list(
          'search',
          { role: 'listbox', 'aria-label': 'Search results' },
          s.results.map((r) => tabRow(r, { cursor: m.cursor === `tab:${r.id}` })),
          n === 0 && s.field === 'dupe'
            ? h('p', { class: 'empty' }, s.text.trim() ? `No duplicated tabs match “${s.text.trim()}”.` : 'No duplicates. Every tab is open once.')
            : n === 0 && !s.text.trim()
            ? h('p', { class: 'empty' }, `Type to search ${s.field === 'title' ? 'tab titles' : 'URLs'}.`)
            : n === 0
            ? h('p', { class: 'empty' }, `No tabs match “${s.query}”.`)
            : hidden > 0
            ? h(
                'p',
                { class: 'note note--more' },
                `+${plural(hidden, 'more match', 'more matches')} · keep typing to narrow, or `,
                h('button', { class: 'btn btn--ghost', type: 'button', 'data-action': 'show-all-results' }, 'Show all'),
              )
            : h('p', { class: 'note' }, 'Search covers every window. ', h('kbd', { class: 'k' }, 'Esc'), ' clears it and returns to where you were.'),
        ),
      ];
    }
    case 'review':
      return [
        s.sets.length > 0 && reviewPolicy(s),
        list(
          'review',
          { role: 'listbox', 'aria-label': 'Duplicate copies: Space switches keep and close' },
          reviewSets(s, m.cursor),
          s.sets.length === 0 && reviewDone(),
        ),
      ];
  }
}

/** Render the whole popup for a model. Pure: same model, same DOM. */
export function renderPopup(m: PopupModel): HTMLElement {
  const { kind } = m.screen;
  return h(
    'div',
    { class: 'popup', tabindex: -1, 'data-screen': kind },
    brandBar(),
    m.screen.kind === 'review' ? reviewHeader(m.screen) : searchBar(m),
    kind !== 'review' && kind !== 'search' && duplicateStrip(m),
    (kind === 'tabs' || kind === 'sites' || kind === 'windows') && nowPlaying(m.playing),
    body(m),
    m.toast && toast(m.toast),
    m.helpOpen && helpPanel(),
    m.selection ? selectionBar(m.selection.size) : hintFooter(hintsFor(m)),
  );
}
