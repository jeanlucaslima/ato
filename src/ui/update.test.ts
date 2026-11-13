import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { SNAPSHOT, TABS } from '../dev/fixtures';
import type { Action, Effect } from './actions';
import { deriveModel } from './derive';
import { initialUi, type AppState } from './state';
import { navOrder, update } from './update';

const start = (ui = {}): AppState => ({ snapshot: SNAPSHOT, ui: initialUi(ui) });

function run(state: AppState, actions: Action[]): [AppState, Effect[]] {
  const effects: Effect[] = [];
  for (const action of actions) {
    const [next, fx] = update(state, action);
    state = next;
    effects.push(...fx);
  }
  return [state, effects];
}

const closeEffects = (effects: Effect[]) => effects.flatMap((e) => (e.kind === 'close' ? e.tabIds : []));
const activeIds = TABS.filter((t) => t.active).map((t) => t.id);
const pinnedIds = TABS.filter((t) => t.pinned).map((t) => t.id);

describe('update', () => {
  it('expands and collapses a site, moving the cursor onto it', () => {
    const [opened] = run(start({ view: 'sites' }), [{ type: 'toggleSite', domain: 'github.com' }]);
    expect(opened.ui.expanded.has('github.com')).toBe(true);
    expect(opened.ui.cursor).toBe('site:github.com');
    const [closed] = run(opened, [{ type: 'cursorKey', key: 'left' }]);
    expect(closed.ui.expanded.has('github.com')).toBe(false);
  });

  it('marks tabs as closing, then reports them with an undo toast', () => {
    const id = TABS[3]!.id;
    const [closing, effects] = run(start(), [{ type: 'closeTab', tabId: id }]);
    expect(closing.ui.closing.has(id)).toBe(true);
    expect(effects).toContainEqual({ kind: 'close', tabIds: [id], message: 'Closed 1 tab' });
    const [done] = run(closing, [{ type: 'closed', tabs: [TABS[3]!], message: 'Closed 1 tab' }]);
    expect(done.ui.closing.size).toBe(0);
    expect(done.ui.toast?.undo).toEqual([TABS[3]]);
    const [, undoFx] = run(done, [{ type: 'undo' }]);
    expect(undoFx).toContainEqual({ kind: 'restore', tabs: [TABS[3]] });
  });

  it('skips protected tabs when closing a whole site', () => {
    const [, effects] = run(start(), [{ type: 'closeSite', domain: 'mail.proton.me' }]);
    expect(closeEffects(effects).some((id) => pinnedIds.includes(id))).toBe(false);
  });

  it('moves the cursor within the visible list and clamps at the ends', () => {
    const order = navOrder(deriveModel(start()));
    const [s] = run(start(), [{ type: 'moveCursor', delta: 1 }, { type: 'moveCursor', delta: -1 }, { type: 'moveCursor', delta: -1 }]);
    expect(s.ui.cursor).toBe(order[0]);
  });

  it('moves the cursor to the next row when the cursor row is closed', () => {
    const order = navOrder(deriveModel(start()));
    const [s] = run(start({ cursor: order[1] }), [{ type: 'cursorKey', key: 'delete' }]);
    expect(s.ui.cursor).toBe(order[2]);
  });

  it('selects a range with shift', () => {
    const order = navOrder(deriveModel(start()));
    const id = (i: number) => Number(order[i]!.split(':')[1]);
    const [s] = run(start(), [{ type: 'toggleSelectMode' }, { type: 'toggleSelected', tabId: id(1) }, { type: 'toggleSelected', tabId: id(4), range: true }]);
    expect([...(s.ui.selection ?? [])].sort()).toEqual([1, 2, 3, 4].map(id).sort());
  });

  it('never closes an active or protected tab from review, whatever the user flips', () => {
    const flippable = TABS.map((t) => t.id);
    fc.assert(
      fc.property(fc.array(fc.constantFrom(...flippable), { maxLength: 20 }), (flips) => {
        const actions: Action[] = [{ type: 'openReview' }, ...flips.map((tabId): Action => ({ type: 'flip', tabId })), { type: 'confirmReview' }];
        const closed = closeEffects(run(start(), actions)[1]);
        return closed.every((id) => !activeIds.includes(id) && !pinnedIds.includes(id));
      }),
    );
  });
});
