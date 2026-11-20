import { cls, h } from './dom';
import { favicon } from './favicon';
import { plural } from './format';
import { icon } from './icons';
import type { CopyFold, DuplicateCopy, DuplicateSet, ItemKey, Screen } from './model';

type ReviewScreen = Extract<Screen, { kind: 'review' }>;

/** How many tabs the current review would close. */
export function closeCount(sets: readonly DuplicateSet[]): number {
  return sets.reduce((n, s) => n + s.toClose, 0);
}

export function reviewHeader(screen: ReviewScreen): HTMLElement {
  const n = closeCount(screen.sets);
  return h(
    'div',
    { class: 'head head--review' },
    h('button', { class: 'btn btn--ghost', type: 'button', 'data-action': 'close-review' }, icon('back', 12), 'Back'),
    h('h2', null, 'Duplicates ', screen.sets.length > 0 && h('span', null, `· ${plural(screen.sets.length, 'set')}`)),
    screen.sets.length > 0 &&
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
      class: cls('copy', keep ? 'copy--keep' : 'copy--close', cursor === `copy:${copy.tabId}` && 'is-cursor', copy.closing && 'is-closing'),
      'data-key': `copy:${copy.tabId}`,
      role: 'option',
      'aria-selected': String(cursor === `copy:${copy.tabId}`),
      'aria-label': `${keep ? 'Keep' : 'Close'}: ${row.title}, ${copy.location}${row.audible ? ', playing' : ''}${copy.locked ? ', protected' : ''}`,
      'data-action': 'flip',
      'data-id': copy.tabId,
      disabled: copy.locked || copy.closing,
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

/** What review ends on once every duplicate is closed: it stays put, so you see it worked. */
export function reviewDone(): HTMLElement {
  return h(
    'div',
    { class: 'done', role: 'status' },
    h('span', { class: 'done-mark', 'aria-hidden': 'true' }, icon('check', 22)),
    h('p', { class: 'done-title' }, 'No duplicates left'),
    h('p', { class: 'done-sub' }, 'Every tab is open once.'),
    h('button', { class: 'btn', type: 'button', 'data-action': 'close-review' }, icon('back', 12), 'Back to tabs', h('kbd', { class: 'k' }, 'Esc')),
  );
}

/**
 * A big set's Close copies as one row. Folded, it stands in for them (and wears
 * the Close pill); unfolded, it sits under them as a quiet "fold back" row.
 */
function foldRow(set: DuplicateSet, fold: CopyFold, cursor: ItemKey | undefined): HTMLElement {
  const key = `fold:${set.key}` as const;
  const attrs = {
    type: 'button',
    'data-key': key,
    role: 'option',
    'aria-selected': String(cursor === key),
    'aria-expanded': String(fold.open),
    'data-action': 'toggle-fold',
    'data-set': set.key,
    tabindex: -1,
  };
  if (fold.open) {
    return h(
      'button',
      { ...attrs, class: cls('copy', 'copy--fold-back', cursor === key && 'is-cursor'), title: 'Fold these copies back (←)' },
      h('span', { class: 'fold-caret is-open', 'aria-hidden': 'true' }, icon('chevron', 10)),
      h('span', { class: 'row-sub' }, `Fold ${plural(fold.count, 'copy', 'copies')} back`),
    );
  }
  return h(
    'button',
    {
      ...attrs,
      class: cls('copy', 'copy--close', 'copy--fold', cursor === key && 'is-cursor', fold.closing && 'is-closing'),
      'aria-label': `Close ${plural(fold.count, 'copy', 'copies')}, ${fold.where}. Space shows them.`,
      title: 'Show each copy (Space or →)',
    },
    h('span', { class: 'fav-stack', 'aria-hidden': 'true' }, favicon(set.domain, fold.favIconUrl), favicon(set.domain, fold.favIconUrl)),
    h('span', { class: 'row-text' }, h('span', { class: 'row-title' }, `${plural(fold.count, 'copy', 'copies')}`), h('span', { class: 'row-sub' }, `${fold.where} · ${fold.ages}`)),
    h('span', { class: 'fold-caret', 'aria-hidden': 'true' }, icon('chevron', 10)),
    h('span', { class: 'verdict verdict--close' }, h('b', null, 'Close'), h('span', null, String(fold.count))),
  );
}

export function reviewSets(screen: ReviewScreen, cursor: ItemKey | undefined): HTMLElement[] {
  return screen.sets.map((set) =>
    h(
      'section',
      { class: cls('set', set.resolving && 'is-resolving'), 'data-key': `set:${set.address}`, role: 'group', 'aria-label': `${set.title}, ${set.size} copies` },
      h('h3', { class: 'set-title', title: set.address }, h('span', null, set.address), h('span', { class: 'k' }, plural(set.size, 'copy', 'copies'))),
      set.copies.map((c) => copyRow(c, cursor)),
      set.fold && foldRow(set, set.fold, cursor),
    ),
  );
}
