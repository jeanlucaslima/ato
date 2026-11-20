import { cls, h } from './dom';
import { favicon } from './favicon';
import { plural } from './format';
import { icon } from './icons';
import type { DuplicateCopy, DuplicateSet, ItemKey, Screen } from './model';

type ReviewScreen = Extract<Screen, { kind: 'review' }>;

/** How many tabs the current review would close. */
export function closeCount(sets: readonly DuplicateSet[]): number {
  return sets.reduce((n, s) => n + s.copies.filter((c) => c.verdict.action === 'close').length, 0);
}

export function reviewHeader(screen: ReviewScreen): HTMLElement {
  const n = closeCount(screen.sets);
  return h(
    'div',
    { class: 'head head--review' },
    h('button', { class: 'btn btn--ghost', type: 'button', 'data-action': 'close-review' }, icon('back', 12), 'Back'),
    h('h2', null, 'Duplicates ', h('span', null, `· ${plural(screen.sets.length, 'set')}`)),
    h('button', { class: 'btn btn--solid-danger', type: 'button', disabled: n === 0, 'data-action': 'confirm-review' }, `Close ${n}`, h('kbd', { class: 'k' }, '↵')),
  );
}

export function reviewPolicy(screen: ReviewScreen): HTMLElement {
  return h(
    'p',
    { class: 'policy' },
    'Keeping the ',
    h('b', null, 'current tab'),
    ' and any ',
    h('b', null, 'playing'),
    ' one, then ',
    h('b', null, 'pinned'),
    ', then the ',
    h('b', null, screen.keep),
    ' copy. ',
    screen.protectGroups ? 'Grouped tabs are left alone. ' : '',
    'Change in Settings.',
  );
}

const REASON_LABEL: Record<string, string> = {
  current: 'current tab',
  playing: 'playing',
  pinned: 'pinned',
  grouped: 'in a group',
  oldest: 'oldest',
  newest: 'newest',
  chosen: 'your choice',
};

/**
 * One copy, drawn like a tab row (favicon, its own title, where it is) so you can
 * tell the copies apart, with the keep/close decision as a pill on the right.
 */
function copyRow(copy: DuplicateCopy, cursor: ItemKey | undefined): HTMLElement {
  const keep = copy.verdict.action === 'keep';
  const { row } = copy;
  const why = copy.verdict.action === 'keep' ? (REASON_LABEL[copy.verdict.reason] ?? copy.verdict.reason) : copy.verdict.age;
  return h(
    'button',
    {
      type: 'button',
      class: cls('copy', keep ? 'copy--keep' : 'copy--close', cursor === `copy:${copy.tabId}` && 'is-cursor'),
      'data-key': `copy:${copy.tabId}`,
      role: 'option',
      'aria-selected': String(cursor === `copy:${copy.tabId}`),
      'aria-label': `${keep ? 'Keep' : 'Close'}: ${row.title}, ${copy.location}${row.audible ? ', playing' : ''}${copy.locked ? ', protected' : ''}`,
      'data-action': 'flip',
      'data-id': copy.tabId,
      disabled: copy.locked,
      title: copy.locked ? 'Protected — always kept' : keep ? 'Close this copy instead' : 'Keep this copy',
      tabindex: -1,
    },
    favicon(row.domain, row.favIconUrl),
    h('span', { class: 'row-text' }, h('span', { class: 'row-title' }, row.title), h('span', { class: 'row-sub' }, copy.location)),
    h(
      'span',
      { class: 'meta' },
      row.audible && h('span', { class: 'audio' }, icon(row.muted ? 'muted' : 'audio', 15, row.muted ? 'Playing, muted' : 'Playing audio')),
      row.pinned && icon('pin', 14, 'Pinned'),
    ),
    h(
      'span',
      { class: cls('verdict', keep ? 'verdict--keep' : 'verdict--close', copy.verdict.action === 'keep' && copy.verdict.reason === 'current' && 'verdict--current') },
      h('b', null, keep ? 'Keep' : 'Close'),
      h('span', null, why),
    ),
  );
}

export function reviewSets(screen: ReviewScreen, cursor: ItemKey | undefined): HTMLElement[] {
  return screen.sets.map((set) =>
    h(
      'section',
      { class: 'set', role: 'group', 'aria-label': `${set.title}, ${set.copies.length} copies` },
      h('h3', { class: 'set-title', title: set.address }, h('span', null, set.address), h('span', { class: 'k' }, plural(set.copies.length, 'copy', 'copies'))),
      set.copies.map((c) => copyRow(c, cursor)),
    ),
  );
}
