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

  it('jumps to the first and last rows', () => {
    const order = navOrder(deriveModel(start()));
    expect(run(start(), [{ type: 'cursorTo', where: 'last' }])[0].ui.cursor).toBe(order.at(-1));
    expect(run(start(), [{ type: 'moveCursor', delta: 99 }])[0].ui.cursor).toBe(order[0]); // first press lands on the list
    expect(run(start({ cursor: order[0] }), [{ type: 'moveCursor', delta: 99 }])[0].ui.cursor).toBe(order.at(-1));
    expect(run(start({ cursor: order[3] }), [{ type: 'moveCursor', delta: -99 }])[0].ui.cursor).toBe(order[0]);
  });

  it('extends and fills the selection from the keyboard', () => {
    const order = navOrder(deriveModel(start()));
    const id = (i: number) => Number(order[i]!.split(':')[1]);
    const [s] = run(start({ cursor: order[0] }), [
      { type: 'toggleSelectMode' },
      { type: 'extendSelection', delta: 1 },
      { type: 'extendSelection', delta: 1 },
    ]);
    expect([...(s.ui.selection ?? [])].sort()).toEqual([0, 1, 2].map(id).sort());
    expect(s.ui.cursor).toBe(order[2]);
    const [all] = run(s, [{ type: 'selectAll' }]);
    expect(all.ui.selection?.size).toBe(order.length);
  });

  it('keeps the cursor on the same tab when switching views if it is still visible', () => {
    const order = navOrder(deriveModel(start()));
    const [sites] = run(start({ cursor: order[0] }), [{ type: 'toggleView' }]);
    expect(sites.ui.view).toBe('sites');
    expect(sites.ui.cursor).toBeUndefined(); // its site is collapsed
    const domain = 'github.com';
    const tabId = TABS.find((t) => t.url.includes(domain))!.id;
    const [kept] = run(start({ view: 'sites', expanded: new Set([domain]), cursor: `tab:${tabId}` }), [{ type: 'toggleView' }]);
    expect(kept.ui.cursor).toBe(`tab:${tabId}`);
  });

  it('puts the cursor on the first search hit and restores the browse cursor on clear', () => {
    const order = navOrder(deriveModel(start()));
    const [searching] = run(start({ cursor: order[4] }), [{ type: 'query', text: 'h' }, { type: 'query', text: 'hacker' }]);
    expect(searching.ui.cursor).toBe(navOrder(deriveModel(searching))[0]);
    const [back] = run(searching, [{ type: 'clearQuery' }]);
    expect(back.ui.cursor).toBe(order[4]);
  });

  it('hands the cursor to a neighbour when its tab is closed elsewhere', () => {
    const order = navOrder(deriveModel(start()));
    const gone = Number(order[2]!.split(':')[1]);
    const snapshot = { ...SNAPSHOT, tabs: SNAPSHOT.tabs.filter((t) => t.id !== gone) };
    const [s] = run(start({ cursor: order[2] }), [{ type: 'snapshot', snapshot }]);
    expect(s.ui.cursor).toBe(order[3]);
  });

  it('keeps the cursor on something visible, whatever happens (#48)', () => {
    const ids = TABS.map((t) => t.id);
    const domains = ['github.com', 'news.ycombinator.com', 'mail.proton.me'];
    const actionArb: fc.Arbitrary<Action> = fc.oneof(
      fc.constantFrom<Action>(
        { type: 'moveCursor', delta: 1 },
        { type: 'moveCursor', delta: -1 },
        { type: 'moveCursor', delta: 8 },
        { type: 'cursorTo', where: 'last' },
        { type: 'toggleView' },
        { type: 'cycleSort' },
        { type: 'cycleScope' },
        { type: 'openReview' },
        { type: 'closeReview' },
        { type: 'clearQuery' },
        { type: 'toggleSelectMode' },
        { type: 'extendSelection', delta: 1 },
        { type: 'cursorKey', key: 'left' },
        { type: 'cursorKey', key: 'right' },
        { type: 'cursorKey', key: 'delete' },
      ),
      fc.constantFrom('h', 'chrome', 'zzz', '').map((text): Action => ({ type: 'query', text })),
      fc.constantFrom(...domains).map((domain): Action => ({ type: 'toggleSite', domain })),
      fc.constantFrom(...ids).map((tabId): Action => ({ type: 'flip', tabId })),
      fc.subarray(ids).map((gone): Action => ({ type: 'snapshot', snapshot: { ...SNAPSHOT, tabs: SNAPSHOT.tabs.filter((t) => !gone.includes(t.id)) } })),
    );
    fc.assert(
      fc.property(fc.array(actionArb, { maxLength: 30 }), (actions) => {
        let state = start();
        for (const action of actions) {
          [state] = update(state, action);
          const cursor = state.ui.cursor;
          if (cursor !== undefined && !navOrder(deriveModel(state)).includes(cursor)) return false;
        }
        return true;
      }),
    );
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
