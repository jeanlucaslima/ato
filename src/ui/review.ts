import { cls, h } from './dom';
import { favicon } from './favicon';
import { plural } from './format';
import { icon } from './icons';
import type { DuplicateCopy, DuplicateSet, ItemKey, Screen } from './model';

type ReviewScreen = Extract<Screen, { kind: 'review' }>;

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
      h('button', { class: 'btn btn--solid-danger', type: 'button', disabled: n === 0, 'data-action': 'confirm-review' }, `Close ${n}`, h('kbd', { class: 'k k--box' }, '⌘D')),
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
    ' one, tabs in a ',
    h('b', null, 'split view'),
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
  playing: 'playing',
  split: 'split view',
  pinned: 'pinned',
  grouped: 'in a group',
  oldest: 'oldest',
  newest: 'newest',
  chosen: 'your choice',
};

/**
 * One copy, drawn like a tab under a site: click goes to it, the pill on the
 * right says keep or close and flips it (Space).
 */
function copyRow(copy: DuplicateCopy, cursor: ItemKey | undefined): HTMLElement {
  const keep = copy.verdict.action === 'keep';
  const { row } = copy;
  const key = `copy:${copy.tabId}` as const;
  const why = copy.verdict.action === 'keep' ? (REASON_LABEL[copy.verdict.reason] ?? copy.verdict.reason) : copy.verdict.age;
  return h(
    'div',
    {
      class: cls('row', 'copy', keep ? 'copy--keep' : 'copy--close', cursor === key && 'is-cursor', copy.closing && 'is-closing'),
      'data-key': key,
      role: 'treeitem',
      'aria-level': 2,
      'aria-selected': String(cursor === key),
      'aria-label': `${keep ? 'Keep' : 'Close'}: ${row.title}, ${copy.location}${row.audible ? ', playing' : ''}${copy.locked ? ', protected' : ''}`,
    },
    h(
      'span',
      { class: 'row-main', 'data-action': 'activate', 'data-id': copy.tabId, title: 'Go to this tab (↵)' },
      h('span', { class: 'row-text' }, h('span', { class: 'row-title' }, row.title), h('span', { class: 'row-sub' }, copy.location)),
      h(
        'span',
        { class: 'meta' },
        row.audible && h('span', { class: 'audio' }, icon(row.muted ? 'muted' : 'audio', 15, row.muted ? 'Playing, muted' : 'Playing audio')),
        row.pinned && icon('pin', 14, 'Pinned'),
      ),
    ),
    h(
      'button',
      {
        type: 'button',
        class: cls('verdict', keep ? 'verdict--keep' : 'verdict--close', copy.verdict.action === 'keep' && copy.verdict.reason === 'current' && 'verdict--current'),
        'data-action': 'flip',
        'data-id': copy.tabId,
        disabled: copy.locked || copy.closing,
        tabindex: -1,
        'aria-hidden': 'true',
        title: copy.locked ? 'Protected — always kept' : keep ? 'Close this copy instead (Space)' : 'Keep this copy (Space)',
      },
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
    h('button', { class: 'btn', type: 'button', 'data-action': 'close-review' }, icon('back', 12), 'Back to tabs', h('kbd', { class: 'k k--box' }, 'Esc')),
  );
}

/**
 * A set as a tree item, like a site: the header names the page and closes its
 * extra copies; its copies sit under it (inert while folded, so folding animates).
 */
function setGroup(set: DuplicateSet, cursor: ItemKey | undefined): HTMLElement {
  const key = `set:${set.key}` as const;
  const isCursor = cursor === key;
  return h(
    'div',
    { class: cls('site', 'set', set.expanded && 'is-open', set.resolving && 'is-resolving'), role: 'none', 'data-key': `dset:${set.key}` },
    h(
      'div',
      {
        class: cls('site-row', 'set-row', isCursor && 'is-cursor'),
        'data-key': key,
        role: 'treeitem',
        'aria-level': 1,
        'aria-expanded': String(set.expanded),
        'aria-selected': String(isCursor),
        'aria-label': `${set.title}, ${plural(set.size, 'copy', 'copies')}, keeps ${set.kept}`,
      },
      h(
        'span',
        { class: 'site-toggle', 'data-action': 'toggle-set', 'data-set': set.key, title: set.address },
        h('span', { class: 'caret' }, icon('caretRight', 12)),
        favicon(set.domain, set.favIconUrl),
        h('span', { class: 'set-text' }, h('span', { class: 'name' }, set.title), h('span', { class: 'set-sub' }, `${set.address} · keeps ${set.kept}`)),
      ),
      h('span', { class: 'count', title: plural(set.size, 'copy', 'copies') }, `×${set.size}`),
      h(
        'button',
        { class: 'btn btn--danger', type: 'button', 'data-action': 'close-set', 'data-set': set.key, disabled: set.toClose === 0, tabindex: -1, title: 'Close the extra copies; one stays (⌫)' },
        `Close ${set.toClose}`,
      ),
    ),
    h(
      'div',
      { class: 'site-body', role: 'group', inert: !set.expanded },
      h('div', { class: 'site-body-inner', role: 'none' }, set.copies.map((c) => copyRow(c, cursor))),
    ),
  );
}

export function reviewSets(screen: ReviewScreen, cursor: ItemKey | undefined): HTMLElement[] {
  return screen.sets.map((set) => setGroup(set, cursor));
}
