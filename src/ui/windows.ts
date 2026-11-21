/**
 * Windows view: every window as a row with a map of its tab strip (a dot per
 * tab, groups bracketed in their colour); opened, it lists its tabs under
 * their tab groups.
 */
import type { GroupColor } from '../core/types';
import { cls, h } from './dom';
import { tintFor } from './favicon';
import { plural } from './format';
import { icon } from './icons';
import type { GroupLabel, TabDot, WindowGroup, WindowRun } from './model';
import { tabRow } from './rows';

/** Chrome's group colours (dark tab strip), close enough to recognise. */
export const GROUP_HEX: Record<GroupColor, string> = {
  grey: '#dadce0',
  blue: '#8ab4f8',
  red: '#f28b82',
  yellow: '#fdd663',
  green: '#81c995',
  pink: '#ff8bcb',
  purple: '#c58af9',
  cyan: '#78d9ec',
  orange: '#fcad70',
};

const groupName = (g: GroupLabel) => g.title || 'Unnamed group';

function dot(d: TabDot): HTMLElement {
  return h('i', {
    class: cls('dot', d.current && 'is-current', d.duplicate && 'is-dup', d.playing && 'is-playing', d.unloaded && 'is-asleep', d.pinned && 'is-pinned'),
    style: `--c:${tintFor(d.domain)}`,
    title: d.title,
  });
}

/** The tab strip in miniature. A collapsed group is one pill, as Chrome draws it. */
function tabMap(runs: readonly WindowRun[]): HTMLElement {
  return h(
    'div',
    { class: 'tab-map', 'aria-hidden': 'true' },
    runs.map((r) =>
      !r.group
        ? r.dots.map(dot)
        : r.group.collapsed
        ? h('span', { class: 'map-pill', style: `--g:${GROUP_HEX[r.group.color]}`, title: `${groupName(r.group)} (collapsed)` }, r.group.title, h('b', null, r.dots.length))
        : h('span', { class: 'map-group', style: `--g:${GROUP_HEX[r.group.color]}`, title: groupName(r.group) }, r.dots.map(dot)),
    ),
  );
}

function summary(w: WindowGroup): string {
  return [plural(w.tabCount, 'tab'), plural(w.siteCount, 'site'), w.groupCount > 0 && plural(w.groupCount, 'group'), `used ${w.lastUsed}`].filter(Boolean).join(' · ');
}

/** What Close does here: it never takes protected tabs, so the window stays. */
function closeTitle(w: WindowGroup): string {
  const stay = w.protectedCount > 0 ? `; ${w.protectedCount} protected ${w.protectedCount === 1 ? 'stays' : 'stay'}` : '';
  return `Close ${plural(w.closable, 'tab')}${stay} (⌫)`;
}

export function windowGroup(w: WindowGroup, cursor: string | undefined, selection?: ReadonlySet<number>): HTMLElement {
  const key = `win:${w.id}`;
  const isCursor = cursor === key;
  const label = `Window ${w.n}`;
  const tab = (r: WindowRun['tabs'][number]) => tabRow(r, { treeItem: true, cursor: cursor === `tab:${r.id}`, selected: selection ? selection.has(r.id) : undefined });
  return h(
    'div',
    { class: cls('win', w.expanded && 'is-open', w.current && 'is-current'), role: 'none', 'data-key': `wgroup:${w.id}` },
    h(
      'div',
      {
        class: cls('win-row', isCursor && 'is-cursor'),
        'data-key': key,
        role: 'treeitem',
        'aria-level': 1,
        'aria-expanded': String(w.expanded),
        'aria-selected': String(isCursor),
        'aria-label': `${label}${w.current ? ', this window' : ''}, ${summary(w)}`,
      },
      h(
        'span',
        { class: 'win-toggle', 'data-action': 'toggle-window', 'data-window': w.id },
        h('span', { class: 'caret' }, icon('caretRight', 12)),
        h('span', { class: 'win-tile' }, w.n),
        h(
          'span',
          { class: 'win-text' },
          h('span', { class: 'win-name' }, label, w.current && h('span', { class: 'cur' }, 'This window')),
          h('span', { class: 'win-sub' }, summary(w)),
        ),
      ),
      h(
        'span',
        { class: 'win-flags' },
        w.duplicates > 0 && h('span', { class: 'dup', title: plural(w.duplicates, 'duplicate') }, `×${w.duplicates}`),
        w.playing && h('span', { class: 'audio' }, icon('audio', 14, 'Playing audio')),
      ),
      h(
        'span',
        { class: 'win-actions' },
        !w.current && h('button', { class: 'btn', type: 'button', 'data-action': 'focus-window', 'data-window': w.id, tabindex: -1, title: 'Bring to the front (↵)' }, 'Focus'),
        !w.current && h('button', { class: 'btn', type: 'button', 'data-action': 'merge-window', 'data-window': w.id, tabindex: -1, title: 'Move its tabs into this window (M)' }, 'Merge'),
        w.closable > 0 && h('button', { class: 'btn btn--danger', type: 'button', 'data-action': 'close-window', 'data-window': w.id, tabindex: -1, title: closeTitle(w), 'aria-label': closeTitle(w) }, `Close ${w.closable}`),
      ),
    ),
    h('div', { class: 'win-map', 'data-action': 'toggle-window', 'data-window': w.id }, tabMap(w.runs)),
    h(
      'div',
      { class: 'win-body', role: 'group', inert: !w.expanded },
      h(
        'div',
        { class: 'win-body-inner', role: 'none' },
        w.runs.map((r) =>
          !r.group
            ? r.tabs.map(tab)
            : h(
                'div',
                { class: cls('tab-group', r.group.collapsed && 'is-collapsed'), role: 'none', style: `--g:${GROUP_HEX[r.group.color]}` },
                h(
                  'div',
                  { class: 'tab-group-head', 'aria-hidden': 'true' },
                  h('span', { class: cls('tab-group-name', !r.group.title && 'is-unnamed') }, groupName(r.group)),
                  h('span', null, plural(r.tabs.length, 'tab')),
                  r.group.collapsed && h('span', { class: 'note' }, 'collapsed in Chrome'),
                ),
                r.tabs.map(tab),
              ),
        ),
      ),
    ),
  );
}
