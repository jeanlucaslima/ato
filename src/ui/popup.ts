import { duplicateStrip, hintFooter, searchBar, searchTips, selectionBar, toast, viewBar, type Hint } from './chrome';
import { h, type Child } from './dom';
import { plural } from './format';
import type { PopupModel } from './model';
import { closeCount, reviewHeader, reviewPolicy, reviewSets } from './review';
import { siteGroup, tabRow } from './rows';

function hintsFor(m: PopupModel): Hint[] {
  switch (m.screen.kind) {
    case 'loading':
      return [];
    case 'tabs':
      return [['↑↓', 'move'], ['↵', 'go'], ['⌫', 'close'], ['U', 'unload'], ['X', 'select']];
    case 'sites':
      return [['←→', 'fold'], ['⌫', 'close site'], ['U', 'unload site'], ['S', 'tabs']];
    case 'search':
      return [['↑↓', 'move'], ['↵', 'go'], ['⌘⌫', 'close all'], ['Esc', 'clear']];
    case 'review':
      return [['↵', `close ${closeCount(m.screen.sets)}`], ['Space', 'keep/close'], ['Esc', 'back']];
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
          { role: 'list', 'aria-label': 'Tabs' },
          s.rows.map((r) => tabRow(r, { cursor: m.cursor === `tab:${r.id}`, selected: sel ? sel.has(r.id) : undefined })),
          s.rows.length === 0 && h('p', { class: 'empty' }, 'No tabs in this window.'),
        ),
      ];
    case 'sites':
      return [viewBar(m), list('sites', { 'aria-label': 'Sites' }, s.groups.map((g) => siteGroup(g, m.cursor, sel)))];
    case 'search': {
      const n = s.results.length;
      return [
        searchTips(s.mode),
        h(
          'div',
          { class: 'head head--results' },
          h('h2', null, plural(n, 'match', 'matches'), n > 0 && h('span', null, ` · ${plural(s.windowCount, 'window')}`)),
          n > 0 && h('button', { class: 'btn', type: 'button', 'data-action': 'unload-results' }, `Unload ${n}`),
          n > 0 && h('button', { class: 'btn btn--danger', type: 'button', 'data-action': 'close-results' }, `Close ${n}`),
        ),
        list(
          'search',
          { role: 'list', 'aria-label': 'Search results' },
          s.results.map((r) => tabRow(r, { cursor: m.cursor === `tab:${r.id}` })),
          n === 0
            ? h('p', { class: 'empty' }, `No tabs match “${s.query}”.`)
            : h('p', { class: 'note' }, 'Search covers every window. ', h('kbd', { class: 'k' }, 'Esc'), ' clears it and returns to where you were.'),
        ),
      ];
    }
    case 'review':
      return [
        reviewPolicy(s),
        list(
          'review',
          { 'aria-label': 'Duplicate sets' },
          reviewSets(s, m.cursor),
          s.sets.length === 0 && h('p', { class: 'empty' }, 'No duplicates left.'),
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
    m.screen.kind === 'review' ? reviewHeader(m.screen) : searchBar(m),
    kind !== 'review' && kind !== 'search' && duplicateStrip(m),
    body(m),
    m.toast && toast(m.toast),
    m.selection ? selectionBar(m.selection.size) : hintFooter(hintsFor(m)),
  );
}
