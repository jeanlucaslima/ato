import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { GROUPED, MANY_COPIES, SNAPSHOT, TABS } from '../dev/fixtures';
import type { Action, Effect } from './actions';
import { deriveModel } from './derive';
import { initialUi, type AppState } from './state';
import { navOrder, update } from './update';

const start = (ui = {}): AppState => ({ snapshot: SNAPSHOT, ui: initialUi(ui) });
const setCursor = (s: AppState, key: NonNullable<AppState['ui']['cursor']>): AppState => update(s, { type: 'setCursor', key })[0];

function run(state: AppState, actions: Action[]): [AppState, Effect[]] {
  const effects: Effect[] = [];
  for (const action of actions) {
    const [next, fx] = update(state, action);
    state = next;
    effects.push(...fx);
  }
  return [state, effects];
}

/** The list's own keys, without the duplicates bar and Now playing above it. */
const listKeys = (state: AppState) => navOrder(deriveModel(state)).filter((k) => k !== 'dupes' && !k.startsWith('play:'));

const closeEffects = (effects: Effect[]) => effects.flatMap((e) => (e.kind === 'close' ? e.tabIds : []));
const activeIds = TABS.filter((t) => t.active).map((t) => t.id);
const pinnedIds = TABS.filter((t) => t.pinned).map((t) => t.id);

describe('update', () => {
  it('stays in review after Close: copies animate out, a second ↵ closes nothing twice, and it ends on done', () => {
    const [s, fx] = run(start({ reviewOpen: true }), [{ type: 'confirmReview' }]);
    const ids = closeEffects(fx);
    expect(ids.length).toBeGreaterThan(0);
    expect(s.ui.reviewOpen).toBe(true);
    expect([...s.ui.closing].sort()).toEqual([...ids].sort());
    const [again, fx2] = run(s, [{ type: 'confirmReview' }]);
    expect(fx2).toEqual([]);
    const during = deriveModel(again).screen;
    if (during.kind !== 'review') throw new Error('expected review');
    expect(during.sets.every((set) => set.resolving)).toBe(true);
    const closedTabs = TABS.filter((t) => ids.includes(t.id));
    const [done] = run(again, [
      { type: 'closed', tabs: closedTabs, requested: ids, noun: 'duplicate', kept: 0 },
      { type: 'snapshot', snapshot: { ...SNAPSHOT, tabs: TABS.filter((t) => !ids.includes(t.id)) } },
    ]);
    const after = deriveModel(done).screen;
    expect(after.kind === 'review' && after.sets.length).toBe(0);
    expect(done.ui.toast?.undo).toHaveLength(ids.length);
  });

  it('review works like Sites: a big set starts folded, opens with →, ← from a copy folds it, ⌫ closes only its extras', () => {
    const hn = 'https://news.ycombinator.com/';
    const total = MANY_COPIES.tabs.filter((t) => t.url === hn).length;
    const [s0] = run({ snapshot: MANY_COPIES, ui: initialUi() }, [{ type: 'openReview' }]);
    const review = (s: AppState) => {
      const screen = deriveModel(s).screen;
      if (screen.kind !== 'review') throw new Error('expected review');
      return screen.sets.find((set) => set.key === hn)!;
    };
    expect(s0.ui.cursor).toBe(navOrder(deriveModel(s0))[0]); // opens on the first set, not on nothing
    expect(review(s0)).toMatchObject({ expanded: false, size: total, toClose: total - 1 });
    expect(navOrder(deriveModel(s0)).some((k) => k.startsWith('copy:') && MANY_COPIES.tabs.find((t) => `copy:${t.id}` === k)?.url === hn)).toBe(false);

    const [opened] = run(setCursor(s0, `set:${hn}`), [{ type: 'cursorKey', key: 'right' }, { type: 'moveCursor', delta: 1 }]);
    expect(review(opened).expanded).toBe(true);
    expect(opened.ui.cursor?.startsWith('copy:')).toBe(true);
    const [, go] = run(opened, [{ type: 'cursorKey', key: 'enter' }]);
    expect(go).toContainEqual({ kind: 'activate', tabId: Number(opened.ui.cursor!.slice(5)) });
    const [refolded] = run(opened, [{ type: 'cursorKey', key: 'left' }]);
    expect(review(refolded).expanded).toBe(false);
    expect(refolded.ui.cursor).toBe(`set:${hn}`);
    // ← again, on the folded set, goes back out of review onto the bar → came in from.
    const [back] = run(refolded, [{ type: 'cursorKey', key: 'left' }]);
    expect(back.ui.reviewOpen).toBe(false);
    expect(back.ui.cursor).toBe('dupes');
    expect(run(back, [{ type: 'cursorKey', key: 'right' }])[0].ui.reviewOpen).toBe(true);

    const [, unloadFx] = run(refolded, [{ type: 'cursorKey', key: 'unload' }]);
    const unloaded = unloadFx.flatMap((e) => (e.kind === 'discard' ? e.tabIds : []));
    expect(unloaded.length).toBeGreaterThan(0);
    expect(unloaded.every((id) => { const t = MANY_COPIES.tabs.find((x) => x.id === id)!; return t.url === hn && !t.active; })).toBe(true);

    const [after, fx] = run(refolded, [{ type: 'cursorKey', key: 'delete' }]);
    const closed = closeEffects(fx);
    expect(closed).toHaveLength(total - 1);
    expect(closed.every((id) => MANY_COPIES.tabs.find((t) => t.id === id)?.url === hn)).toBe(true);
    expect(after.ui.cursor).not.toBe(`set:${hn}`);
    expect(after.ui.cursor?.startsWith('set:')).toBe(true);
  });

  it('closing one set never closes an active or protected tab and keeps a copy, whatever the user flips', () => {
    const keys = [...new Set(TABS.map((t) => t.url))].filter((url) => TABS.filter((t) => t.url === url).length > 1);
    fc.assert(
      fc.property(fc.array(fc.constantFrom(...TABS.map((t) => t.id)), { maxLength: 20 }), fc.constantFrom(...keys), (flips, key) => {
        const actions: Action[] = [{ type: 'openReview' }, ...flips.map((tabId): Action => ({ type: 'flip', tabId })), { type: 'closeSet', key }];
        const closed = closeEffects(run(start(), actions)[1]);
        const copies = TABS.filter((t) => t.url === key);
        return (
          closed.every((id) => !activeIds.includes(id) && !pinnedIds.includes(id) && copies.some((t) => t.id === id)) &&
          copies.some((t) => !closed.includes(t.id))
        );
      }),
    );
  });

  it('↓ visits the duplicates bar and Now playing before the list; ↵ opens review or goes to the tab', () => {
    const order = navOrder(deriveModel(start()));
    const playing = TABS.find((t) => t.audible)!.id;
    expect(order.slice(0, 3)).toEqual(['dupes', `play:${playing}`, listKeys(start())[0]]);
    const [onBar] = run(start(), [{ type: 'moveCursor', delta: 1 }]);
    expect(onBar.ui.cursor).toBe('dupes');
    expect(run(onBar, [{ type: 'cursorKey', key: 'enter' }])[0].ui.reviewOpen).toBe(true);
    expect(closeEffects(run(onBar, [{ type: 'cursorKey', key: 'delete' }])[1])).toHaveLength(4);
    const [onPlay, fx] = run(onBar, [{ type: 'moveCursor', delta: 1 }, { type: 'cursorKey', key: 'enter' }]);
    expect(onPlay.ui.cursor).toBe(`play:${playing}`);
    expect(fx).toContainEqual({ kind: 'activate', tabId: playing });
    expect(run(onPlay, [{ type: 'cursorKey', key: 'space' }])[1]).toContainEqual({ kind: 'mute', tabId: playing, muted: true });
    // Search hides both: the cursor starts on the first hit.
    expect(navOrder(deriveModel(start({ query: 'hacker' })))[0]?.startsWith('tab:')).toBe(true);
  });

  it('dupe: Close closes only the extra copies: every duplicated page keeps a tab', () => {
    fc.assert(
      fc.property(fc.constantFrom('dupe:', 'dupe: hacker', 'dupe: inbox', 'dupe: chrome'), (query) => {
        const [, fx] = run(start({ query }), [{ type: 'closeResults' }]);
        const closed = new Set(closeEffects(fx));
        const urls = new Set(TABS.filter((t) => closed.has(t.id)).map((t) => t.url));
        return [...urls].every((url) => TABS.some((t) => t.url === url && !closed.has(t.id))) && TABS.every((t) => !(t.active && closed.has(t.id)));
      }),
    );
    const [, fx] = run(start({ query: 'dupe:' }), [{ type: 'closeResults' }]);
    expect(closeEffects(fx)).toHaveLength(4);
  });

  it('closes every duplicate from the front screen, as review would, without opening it', () => {
    const [s, fx] = run(start(), [{ type: 'closeDuplicates' }]);
    expect(s.ui.reviewOpen).toBe(false);
    const ids = closeEffects(fx);
    expect(ids).toHaveLength(4);
    expect(ids.some((id) => activeIds.includes(id) || pinnedIds.includes(id))).toBe(false);
    const [, again] = run(s, [{ type: 'closeDuplicates' }]);
    expect(closeEffects(again)).toEqual([]);
  });

  it('gathers a site or the search results into a new window, in their current order', () => {
    const moved = (fx: Effect[]) => fx.flatMap((e) => (e.kind === 'move' ? e.tabIds : []));
    const hn = TABS.filter((t) => t.url === 'https://news.ycombinator.com/');
    const [, siteFx] = run(start({ view: 'sites' }), [{ type: 'moveSite', domain: 'news.ycombinator.com' }]);
    const expected = TABS.filter((t) => t.url.startsWith('https://news.ycombinator.com/'))
      .sort((a, b) => Number(b.pinned) - Number(a.pinned) || a.windowId - b.windowId || a.index - b.index)
      .map((t) => t.id);
    expect(moved(siteFx)).toEqual(expected);
    expect(hn.every((t) => expected.includes(t.id))).toBe(true);

    const [, keyFx] = run(start({ view: 'sites', cursor: 'site:news.ycombinator.com' }), [{ type: 'cursorKey', key: 'move' }]);
    expect(moved(keyFx)).toEqual(expected);

    const [s, resultsFx] = run(start({ query: 'inbox' }), [{ type: 'moveResults' }]);
    expect(moved(resultsFx).sort()).toEqual(TABS.filter((t) => t.title === 'Inbox (3)').map((t) => t.id).sort());
    expect(s.ui.toast?.message).toBe('Moved 2 tabs to a new window');
  });

  it('moving half of a split view takes the other half along', async () => {
    const { SPLIT_DUPLICATE } = await import('../dev/fixtures');
    const pair = SPLIT_DUPLICATE.tabs.filter((t) => t.splitViewId === 5).map((t) => t.id);
    const [, fx] = run({ snapshot: SPLIT_DUPLICATE, ui: initialUi() }, [{ type: 'toggleSelectMode' }, { type: 'toggleSelected', tabId: pair[0]! }, { type: 'moveSelected' }]);
    expect(fx.flatMap((e) => (e.kind === 'move' ? e.tabIds : [])).sort()).toEqual([...pair].sort());
    const screen = deriveModel({ snapshot: SPLIT_DUPLICATE, ui: initialUi({ reviewOpen: true }) }).screen;
    const hn = screen.kind === 'review' ? screen.sets.find((s) => s.address === 'news.ycombinator.com/') : undefined;
    expect(hn?.copies.find((c) => c.tabId === pair[0])?.verdict).toEqual({ action: 'keep', reason: 'split' });
  });

  it("doesn't move tabs that already have a window to themselves", () => {
    const lone = { ...SNAPSHOT, tabs: [...TABS, { ...TABS[0]!, id: 700, windowId: 9, index: 0, url: 'https://solo.test/', title: 'Solo' }] };
    const [s, fx] = run({ snapshot: lone, ui: initialUi({ view: 'sites' }) }, [{ type: 'moveSite', domain: 'solo.test' }]);
    expect(fx.some((e) => e.kind === 'move')).toBe(false);
    expect(s.ui.toast?.message).toBe('Already in a window of their own');
  });

  it('Windows view: every window as a row; groups cut the strip into runs; ← → fold, ↵ focuses, M merges, ⌫ closes', () => {
    const s0: AppState = { snapshot: GROUPED, ui: initialUi({ view: 'windows', scope: 'current' }) };
    const screen = deriveModel(s0).screen;
    if (screen.kind !== 'windows') throw new Error('expected windows');
    expect(screen.windows.map((w) => [w.n, w.tabCount, w.current])).toEqual([[1, 13, true], [2, 8, false], [3, 16, false]]);
    const w1 = screen.windows[0]!;
    expect(w1.runs.map((r) => [r.group?.title ?? null, r.tabs.length])).toEqual([[null, 5], ['ATO v3', 2], [null, 2], ['Read later', 3], [null, 1]]);
    expect(w1.runs.flatMap((r) => r.dots.map((d) => d.id))).toEqual(GROUPED.tabs.filter((t) => t.windowId === 1).sort((a, b) => a.index - b.index).map((t) => t.id));
    expect(screen.windows[2]!.duplicates).toBe(16);
    expect(listKeys(s0)).toEqual(['win:1', 'win:2', 'win:3']);

    const [open] = run(setCursor(s0, 'win:2'), [{ type: 'cursorKey', key: 'right' }]);
    expect(listKeys(open)).toHaveLength(3 + 8);
    const firstTab = listKeys(open)[2]!;
    const [back] = run(setCursor(open, firstTab), [{ type: 'cursorKey', key: 'left' }]);
    expect(back.ui.cursor).toBe('win:2');
    expect(back.ui.openWindows.has(2)).toBe(false);

    const [, focusFx] = run(back, [{ type: 'cursorKey', key: 'enter' }]);
    expect(focusFx).toContainEqual({ kind: 'focusWindow', windowId: 2 });
    const [, mergeFx] = run(back, [{ type: 'cursorKey', key: 'move' }]);
    const w2 = GROUPED.tabs.filter((t) => t.windowId === 2).sort((a, b) => a.index - b.index).map((t) => t.id);
    expect(mergeFx).toContainEqual({ kind: 'moveTo', tabIds: w2, windowId: 1 });
    const [, selfMerge] = run(setCursor(s0, 'win:1'), [{ type: 'cursorKey', key: 'move' }]);
    expect(selfMerge.some((e) => e.kind === 'moveTo')).toBe(false);
    const [, closeFx] = run(back, [{ type: 'cursorKey', key: 'delete' }]);
    const closing = closeEffects(closeFx);
    expect(closing.every((id) => w2.includes(id))).toBe(true);
    expect(closing.some((id) => GROUPED.tabs.find((t) => t.id === id)!.active)).toBe(false);
  });

  it('S cycles Tabs → Sites → Windows → Tabs', () => {
    const [a] = run(start(), [{ type: 'toggleView' }]);
    const [b] = run(a, [{ type: 'toggleView' }]);
    const [c] = run(b, [{ type: 'toggleView' }]);
    expect([a.ui.view, b.ui.view, c.ui.view]).toEqual(['sites', 'windows', 'tabs']);
  });

  it('draws the first 150 search results, acts on all of them, and shows all on request', async () => {
    const { makeSnapshot } = await import('../dev/perf');
    const big = makeSnapshot(600);
    const s0: AppState = { snapshot: big, ui: initialUi({}) };
    const [typed] = run(s0, [{ type: 'query', text: 'page' }]);
    const screen = deriveModel(typed).screen;
    if (screen.kind !== 'search') throw new Error('expected search');
    expect(screen.total).toBe(600);
    expect(screen.results).toHaveLength(150);
    const [, fx] = run(typed, [{ type: 'unloadResults' }]);
    expect(fx.flatMap((e) => (e.kind === 'discard' ? e.tabIds : [])).length).toBeGreaterThan(150);
    const [all] = run(typed, [{ type: 'showAllResults' }]);
    const allScreen = deriveModel(all).screen;
    expect(allScreen.kind === 'search' && allScreen.results.length).toBe(600);
    const [retyped] = run(all, [{ type: 'query', text: 'page 1' }]);
    expect(retyped.ui.showAllResults).toBe(false);
  });

  it('follows a policy change while open: newly protected tabs are no longer closed', () => {
    const unprotected = { keep: 'oldest', protectPinned: false, protectGroups: false, match: 'exact' } as const;
    const [s] = run(start({ policy: unprotected }), [{ type: 'policy', policy: { ...unprotected, protectPinned: true } }]);
    expect(s.ui.policy.protectPinned).toBe(true);
    const [, effects] = run(s, [{ type: 'closeSite', domain: 'mail.proton.me' }]);
    expect(closeEffects(effects).some((id) => pinnedIds.includes(id))).toBe(false);
  });

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
    expect(effects).toContainEqual({ kind: 'close', tabIds: [id], noun: 'tab', skipped: 0, policy: null, cleanup: false });
    const [done] = run(closing, [{ type: 'closed', tabs: [TABS[3]!], requested: [id], noun: 'tab', kept: 0 }]);
    expect(done.ui.closing.size).toBe(0);
    expect(done.ui.toast?.undo).toEqual([TABS[3]]);
    const [, undoFx] = run(done, [{ type: 'undo' }]);
    expect(undoFx).toContainEqual({ kind: 'restore', tabs: [TABS[3]] });
    const [back] = run(done, [{ type: 'undo' }, { type: 'restored', count: 40, fresh: 15 }]);
    expect(back.ui.toast?.message).toBe('Restored 40 tabs (15 without back history)');
    expect(back.ui.toast?.undo).toBeUndefined();
  });

  it('an undo that brings back only some tabs says so and keeps undo for the rest', () => {
    const [partial] = run(start(), [{ type: 'restored', count: 2, fresh: 1, failed: [TABS[5]!], closedAt: 1234 }]);
    expect(partial.ui.toast).toMatchObject({ message: 'Restored 2 tabs (1 without back history) · couldn’t restore 1', undo: [TABS[5]], closedAt: 1234 });
    expect(run(partial, [{ type: 'undo' }])[1]).toContainEqual({ kind: 'restore', tabs: [TABS[5]], closedAt: 1234 });
    const [none] = run(start(), [{ type: 'restored', count: 0, failed: [TABS[5]!, TABS[6]!] }]);
    expect(none.ui.toast?.message).toBe('Couldn’t restore 2 tabs');
  });

  it('skips protected tabs when closing a whole site', () => {
    const [, effects] = run(start(), [{ type: 'closeSite', domain: 'mail.proton.me' }]);
    expect(closeEffects(effects).some((id) => pinnedIds.includes(id))).toBe(false);
  });

  it('wraps ↑↓ around the ends of the list; paging stops at them', () => {
    const order = navOrder(deriveModel(start()));
    expect(run(start(), [{ type: 'moveCursor', delta: 1 }, { type: 'moveCursor', delta: -1 }])[0].ui.cursor).toBe(order.at(-1));
    expect(run(start({ cursor: order.at(-1) }), [{ type: 'moveCursor', delta: 1 }])[0].ui.cursor).toBe(order[0]);
    expect(run(start({ cursor: order[1] }), [{ type: 'moveCursor', delta: -8 }])[0].ui.cursor).toBe(order[0]);
    expect(run(start({ cursor: order.at(-2) }), [{ type: 'moveCursor', delta: 8 }])[0].ui.cursor).toBe(order.at(-1));
  });

  it('moves the cursor to the next row when the cursor row is closed', () => {
    const order = listKeys(start());
    const [s] = run(start({ cursor: order[1] }), [{ type: 'cursorKey', key: 'delete' }]);
    expect(s.ui.cursor).toBe(order[2]);
  });

  it('selects a range with shift', () => {
    const order = listKeys(start());
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
    const order = listKeys(start());
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
    const order = listKeys(start());
    const [sites] = run(start({ cursor: order[0] }), [{ type: 'toggleView' }]);
    expect(sites.ui.view).toBe('sites');
    expect(sites.ui.cursor).toBeUndefined(); // its site is collapsed
    const domain = 'github.com';
    const tabId = TABS.find((t) => t.url.includes(domain))!.id;
    const [kept] = run(start({ view: 'sites', expanded: new Set([domain]), cursor: `tab:${tabId}` }), [{ type: 'setView', view: 'tabs' }]);
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
    const order = listKeys(start());
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
