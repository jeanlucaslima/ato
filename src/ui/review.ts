import { cls, h } from './dom';
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
    ', then ',
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
  pinned: 'pinned',
  grouped: 'in a group',
  oldest: 'oldest',
  newest: 'newest',
  chosen: 'your choice',
};

function copyRow(copy: DuplicateCopy, cursor: ItemKey | undefined): HTMLElement {
  const keep = copy.verdict.action === 'keep';
  const why =
    copy.verdict.action === 'keep'
      ? h('span', { class: cls('why', copy.verdict.reason === 'current' && 'why--current') }, REASON_LABEL[copy.verdict.reason] ?? copy.verdict.reason)
      : h('span', { class: 'why' }, copy.verdict.age);
  return h(
    'button',
    {
      type: 'button',
      class: cls('copy', keep ? 'copy--keep' : 'copy--close', cursor === `copy:${copy.tabId}` && 'is-cursor'),
      'data-key': `copy:${copy.tabId}`,
      'data-action': 'flip',
      'data-id': copy.tabId,
      disabled: copy.locked,
      title: copy.locked ? 'Protected — always kept' : keep ? 'Close this copy instead' : 'Keep this copy',
      tabindex: -1,
    },
    h('span', { class: 'verdict' }, keep ? 'Keep' : 'Close'),
    h('span', { class: 'where' }, copy.location),
    why,
  );
}

export function reviewSets(screen: ReviewScreen, cursor: ItemKey | undefined): HTMLElement[] {
  return screen.sets.map((set) =>
    h(
      'section',
      { class: 'set', 'aria-label': `${set.title}, ${set.copies.length} copies` },
      h('h3', { class: 'set-title' }, h('span', null, set.title), h('span', { class: 'k' }, set.domain)),
      set.copies.map((c) => copyRow(c, cursor)),
    ),
  );
}
