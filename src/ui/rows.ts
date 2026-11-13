import { cls, h, type Child } from './dom';
import { favicon } from './favicon';
import { plural } from './format';
import { icon } from './icons';
import type { Range, SiteGroup, TabRow } from './model';

/** Split `text` into plain runs and `<mark>` runs. Ranges may be unsorted or overlap. */
export function highlight(text: string, ranges: readonly Range[] = []): Child[] {
  const sorted = ranges
    .map(([s, e]) => [Math.max(0, s), Math.min(text.length, e)] as const)
    .filter(([s, e]) => e > s)
    .sort((a, b) => a[0] - b[0]);
  const out: Child[] = [];
  let pos = 0;
  for (const [start, end] of sorted) {
    if (end <= pos) continue;
    const from = Math.max(start, pos);
    if (from > pos) out.push(text.slice(pos, from));
    out.push(h('mark', { class: 'hl' }, text.slice(from, end)));
    pos = end;
  }
  if (pos < text.length) out.push(text.slice(pos));
  return out;
}

function rowMeta(row: TabRow): HTMLElement {
  return h(
    'span',
    { class: 'meta' },
    row.current && h('span', { class: 'cur' }, 'Current'),
    row.audible && h('span', { class: 'audio' }, icon('audio', 15, 'Playing audio')),
    row.pinned && icon('pin', 14, 'Pinned'),
    row.unloaded && h('span', null, 'Unloaded'),
    row.copies && row.copies > 1 ? h('span', { class: 'dup', title: `${row.copies} copies` }, `×${row.copies}`) : null,
    !row.current && !row.copies && row.age ? h('span', { class: 't' }, row.age) : null,
  );
}

export interface RowState {
  cursor?: boolean;
  /** Defined in Select mode: whether this row is selected. */
  selected?: boolean;
  /** Nested under a site: hide the domain line, and expose as a level-2 tree item. */
  compact?: boolean;
}

/**
 * One tab. The row is a listbox option (or tree item under a site); it holds no
 * nested focusable controls — clicks are delegated by `data-action`, keys go
 * through the keymap, and the cursor is announced via aria-activedescendant.
 */
export function tabRow(row: TabRow, state: RowState = {}): HTMLElement {
  const selecting = state.selected !== undefined;
  const text = h(
    'span',
    { class: 'row-text' },
    h('span', { class: 'row-title' }, highlight(row.title, row.titleMatches)),
    !state.compact && h('span', { class: 'row-sub' }, highlight(row.detail, row.detailMatches)),
  );
  const role = state.compact
    ? { role: 'treeitem', 'aria-level': 2, 'aria-selected': String(selecting ? Boolean(state.selected) : Boolean(state.cursor)) }
    : { role: 'option', 'aria-selected': String(selecting ? Boolean(state.selected) : Boolean(state.cursor)) };
  return h(
    'div',
    {
      class: cls('row', state.cursor && 'is-cursor', state.selected && 'is-selected', row.unloaded && 'is-asleep', row.closing && 'is-closing'),
      'data-key': `tab:${row.id}`,
      ...role,
    },
    h(
      'span',
      { class: 'row-main', 'data-action': selecting ? 'toggle-row' : 'activate', 'data-id': row.id },
      selecting && h('span', { class: cls('check', state.selected && 'is-checked'), 'aria-hidden': 'true' }),
      !state.compact && favicon(row.domain, row.favIconUrl),
      text,
      rowMeta(row),
    ),
    !selecting &&
      h(
        'button',
        { class: 'row-x', type: 'button', 'aria-hidden': 'true', 'data-action': 'close', 'data-id': row.id, tabindex: -1, title: 'Close tab (⌫)' },
        icon('close', 12),
      ),
  );
}

/**
 * A site and its tabs, as a tree item. The tabs are always rendered (inert
 * while collapsed) so expanding and collapsing can animate the same elements.
 */
export function siteGroup(group: SiteGroup, cursor: string | undefined, selection?: ReadonlySet<number>): HTMLElement {
  const count = group.tabs.length;
  const unloadable = group.tabs.filter((t) => !t.unloaded && !t.current).length;
  const isCursor = cursor === `site:${group.domain}`;
  return h(
    'div',
    { class: cls('site', group.expanded && 'is-open'), role: 'none', 'data-key': `group:${group.domain}` },
    h(
      'div',
      {
        class: cls('site-row', isCursor && 'is-cursor'),
        'data-key': `site:${group.domain}`,
        role: 'treeitem',
        'aria-level': 1,
        'aria-expanded': String(group.expanded),
        'aria-selected': String(isCursor),
        'aria-label': `${group.domain}, ${plural(count, 'tab')}`,
      },
      h(
        'span',
        { class: 'site-toggle', 'data-action': 'toggle-site', 'data-domain': group.domain },
        h('span', { class: 'caret' }, icon('caretRight', 12)),
        favicon(group.domain, group.favIconUrl),
        h('span', { class: 'name' }, group.domain),
      ),
      h('span', { class: 'count', 'aria-hidden': 'true' }, count),
      h(
        'span',
        { class: 'site-actions' },
        unloadable > 0 &&
          h('button', { class: 'btn', type: 'button', 'data-action': 'unload-site', 'data-domain': group.domain, tabindex: -1, title: 'Unload (U)' }, `Unload ${unloadable}`),
        h('button', { class: 'btn btn--danger', type: 'button', 'data-action': 'close-site', 'data-domain': group.domain, tabindex: -1, title: 'Close (⌫)' }, `Close ${count}`),
      ),
    ),
    h(
      'div',
      { class: 'site-body', role: 'group', inert: !group.expanded },
      h(
        'div',
        { class: 'site-body-inner', role: 'none' },
        group.tabs.map((t) => tabRow(t, { compact: true, cursor: cursor === `tab:${t.id}`, selected: selection ? selection.has(t.id) : undefined })),
      ),
    ),
  );
}
