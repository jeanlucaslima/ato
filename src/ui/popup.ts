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
      return [['↑↓', 'move'], ['↵', 'go'], ['⌫', 'close'], ['U', 'unload'], ['?', 'keys']];
    case 'sites':
      return [['←→', 'fold'], ['⌫', 'close site'], ['U', 'unload site']];
    case 'search':
      return [['↑↓', 'move'], ['↵', 'go'], ['⌘⌫', 'close all'], ['Esc', 'clear']];
    case 'review':
      return [['↵', `close ${closeCount(m.screen.sets)}`], ['Space', 'flip keep/close'], ['Esc', 'back']];
  }
}

/** Header + list for the active screen. */
function body(m: PopupModel): Child[] {
  const s = m.screen;
  const sel = m.selection;
  switch (s.kind) {
    case 'loading':
      return [
        viewBar(m),
        h('div', { class: 'list', 'aria-busy': 'true' }, h('p', { class: 'empty' }, 'Reading tabs…')),
      ];
    case 'tabs':
      return [
        viewBar(m),
        h(
          'div',
          { class: 'list', role: 'list' },
          s.rows.map((r) => tabRow(r, { cursor: m.cursor === `tab:${r.id}`, selected: sel ? sel.has(r.id) : undefined })),
        ),
      ];
    case 'sites':
      return [viewBar(m), h('div', { class: 'list' }, s.groups.map((g) => siteGroup(g, m.cursor)))];
    case 'search': {
      const n = s.results.length;
      return [
        searchTips(s.mode),
        h(
          'div',
          { class: 'head head--results' },
          h('h2', null, plural(n, 'match', 'matches'), n > 0 && h('span', null, ` · ${plural(s.windowCount, 'window')}`)),
          n > 0 && h('button', { class: 'btn', type: 'button' }, `Unload ${n}`),
          n > 0 && h('button', { class: 'btn btn--danger', type: 'button' }, `Close ${n}`),
        ),
        h(
          'div',
          { class: 'list', role: 'list', 'aria-label': 'Search results' },
          s.results.map((r) => tabRow(r, { cursor: m.cursor === `tab:${r.id}` })),
          n === 0
            ? h('p', { class: 'empty' }, `No tabs match “${s.query}”.`)
            : h('p', { class: 'note' }, 'Search covers every window. ', h('kbd', { class: 'k' }, 'Esc'), ' clears it and returns to where you were.'),
        ),
      ];
    }
    case 'review':
      return [reviewPolicy(s), h('div', { class: 'list' }, reviewSets(s, m.cursor))];
  }
}

/** Render the whole popup for a model. Pure: same model, same DOM. */
export function renderPopup(m: PopupModel): HTMLElement {
  const { kind } = m.screen;
  return h(
    'div',
    { class: 'popup' },
    m.screen.kind === 'review' ? reviewHeader(m.screen) : searchBar(m),
    kind !== 'review' && kind !== 'search' && duplicateStrip(m),
    body(m),
    m.toast && toast(m.toast.message, m.toast.undo),
    m.selection ? selectionBar(m.selection.size) : hintFooter(hintsFor(m)),
  );
}
