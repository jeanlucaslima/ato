import { cls, h, type Child } from './dom';
import { favicon } from './favicon';
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
  /** Hide the domain line (rows nested under a site already show it). */
  compact?: boolean;
}

export function tabRow(row: TabRow, state: RowState = {}): HTMLElement {
  const selecting = state.selected !== undefined;
  const text = h(
    'span',
    { class: 'row-text' },
    h('span', { class: 'row-title' }, highlight(row.title, row.titleMatches)),
    !state.compact && h('span', { class: 'row-sub' }, highlight(row.detail, row.detailMatches)),
  );
  const rowClass = cls('row', state.cursor && 'is-cursor', state.selected && 'is-selected', row.unloaded && 'is-asleep', row.closing && 'is-closing');

  if (selecting) {
    return h(
      'label',
      { class: rowClass, 'data-key': `tab:${row.id}` },
      h(
        'span',
        { class: 'row-main' },
        h('input', { class: 'check', type: 'checkbox', name: 'selected', value: row.id, checked: state.selected, 'aria-label': `Select ${row.title}` }),
        !state.compact && favicon(row.domain, row.favIconUrl),
        text,
        rowMeta(row),
      ),
    );
  }

  return h(
    'div',
    { class: rowClass, 'data-key': `tab:${row.id}` },
    h(
      'button',
      { class: 'row-main', type: 'button' },
      !state.compact && favicon(row.domain, row.favIconUrl),
      text,
      rowMeta(row),
    ),
    h('button', { class: 'row-x', type: 'button', 'aria-label': `Close ${row.title}` }, icon('close', 12)),
  );
}

export function siteGroup(group: SiteGroup, cursor: string | undefined): HTMLElement {
  const count = group.tabs.length;
  const unloadable = group.tabs.filter((t) => !t.unloaded && !t.current).length;
  const isCursor = cursor === `site:${group.domain}`;
  return h(
    'section',
    { class: 'site', 'aria-label': `${group.domain}, ${count} tabs` },
    h(
      'div',
      { class: cls('site-row', isCursor && 'is-cursor'), 'data-key': `site:${group.domain}` },
      h(
        'button',
        { class: 'site-toggle', type: 'button', 'aria-expanded': String(group.expanded) },
        icon(group.expanded ? 'caretDown' : 'caretRight', 12),
        favicon(group.domain, group.favIconUrl),
        h('span', { class: 'name' }, group.domain),
      ),
      group.expanded
        ? h(
            'span',
            { class: 'site-actions' },
            unloadable > 0 && h('button', { class: 'btn', type: 'button' }, `Unload ${unloadable}`),
            h('button', { class: 'btn btn--danger', type: 'button' }, `Close ${count}`),
          )
        : h('span', { class: 'count' }, count),
    ),
    group.expanded && group.tabs.map((t) => tabRow(t, { compact: true, cursor: cursor === `tab:${t.id}` })),
  );
}
