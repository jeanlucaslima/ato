import { afterEach, describe, expect, it, vi } from 'vitest';
import fc from 'fast-check';
import { planDuplicates, protection } from '../core/duplicates';
import { duplicateKey } from '../core/tabs';
import type { Tab } from '../core/types';
import { FakeBrowser } from '../dev/fake-browser';
import { SNAPSHOT, TABS } from '../dev/fixtures';
import type { Action, Effect } from './actions';
import { ChromeBrowser } from './chrome-browser';
import { deriveModel } from './derive';
import { GROUPED, PROTECTED_WINDOW } from '../dev/fixtures';
import { initialUi, type AppState } from './state';
import { update } from './update';

/**
 * Between deciding a bulk close and running it (the 180 ms animation) a tab can
 * become current, start playing, join a split view, get pinned or grouped. The
 * close checks protection again on the fresh state and leaves those tabs open.
 */

type Flip = 'active' | 'audible' | 'split' | 'pinned' | 'group';
const flipTab = (t: Tab, flip: Flip): Tab =>
  flip === 'active' ? { ...t, active: true } : flip === 'audible' ? { ...t, audible: true } : flip === 'split' ? { ...t, splitViewId: 9 } : flip === 'pinned' ? { ...t, pinned: true } : { ...t, groupId: 77 };

const bulkActions: Action[] = [
  { type: 'closeDuplicates' },
  { type: 'closeSite', domain: 'news.ycombinator.com' },
  { type: 'closeSite', domain: 'docs.google.com' },
  { type: 'closeSite', domain: 'github.com' },
  { type: 'closeWindow', windowId: 1 },
  { type: 'closeWindow', windowId: 2 },
];
const ui = fc.record({ protectPinned: fc.boolean(), protectGroups: fc.boolean() });
const changes = fc.array(fc.tuple(fc.constantFrom(...TABS.map((t) => t.id)), fc.constantFrom<Flip>('active', 'audible', 'split', 'pinned', 'group')), { maxLength: 8 });

const closeEffect = (fx: Effect[]) => fx.find((e): e is Extract<Effect, { kind: 'close' }> => e.kind === 'close');

describe('bulk close rechecks protection on the fresh state', () => {
  it('never closes a tab protected by the time the close runs; closing ends empty; undo lists exactly the closed tabs', async () => {
    await fc.assert(
      fc.asyncProperty(fc.constantFrom(...bulkActions), ui, changes, async (action, prot, flips) => {
        const policy = { ...initialUi().policy, ...prot };
        const state: AppState = { snapshot: SNAPSHOT, ui: initialUi({ policy }) };
        const [deciding, fx] = update(state, action);
        const effect = closeEffect(fx);
        if (!effect) return true;
        const browser = new FakeBrowser(SNAPSHOT);
        for (const [id, flip] of flips) browser.change((t) => (t.id === id ? flipTab(t, flip) : t));
        const fresh = (await browser.snapshot()).tabs;
        const { closed, kept } = await browser.close(effect.tabIds, effect.policy, effect.cleanup);
        const freshById = new Map(fresh.map((t) => [t.id, t]));
        const [after] = update(deciding, { type: 'closed', tabs: closed, requested: effect.tabIds, noun: effect.noun, kept: effect.skipped + kept.length });
        const undo = (after.ui.toast?.undo ?? []).map((t) => t.id).sort();
        return (
          closed.every((t) => effect.tabIds.includes(t.id) && protection(freshById.get(t.id)!, policy) === null) &&
          effect.tabIds.every((id) => !after.ui.closing.has(id)) &&
          JSON.stringify(undo) === JSON.stringify(closed.map((t) => t.id).sort())
        );
      }),
    );
  });

  it('a single close the user picked still closes it, even if it became current', async () => {
    const id = TABS[3]!.id;
    const [, fx] = update({ snapshot: SNAPSHOT, ui: initialUi() }, { type: 'closeTab', tabId: id });
    const effect = closeEffect(fx)!;
    expect(effect.policy).toBeNull();
    const browser = new FakeBrowser(SNAPSHOT);
    browser.change((t) => (t.id === id ? { ...t, active: true } : t));
    const { closed } = await browser.close(effect.tabIds, effect.policy, effect.cleanup);
    expect(closed.map((t) => t.id)).toEqual([id]);
  });

  it('says what happened when the recheck keeps tabs', () => {
    const tabs = TABS.slice(2, 5);
    const [s] = update({ snapshot: SNAPSHOT, ui: initialUi() }, { type: 'closed', tabs: tabs.slice(0, 2), requested: tabs.map((t) => t.id), noun: 'duplicate', kept: 1 });
    expect(s.ui.toast?.message).toBe('Closed 2 duplicates · kept 1 protected');
    const [none] = update({ snapshot: SNAPSHOT, ui: initialUi() }, { type: 'closed', tabs: [], requested: [1], noun: 'tab', kept: 1 });
    expect(none.ui.toast).toMatchObject({ message: 'Nothing closed — 1 tab protected', undo: undefined });
  });
});

describe('ChromeBrowser.close', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('removes only tabs still unprotected in Chrome right now', async () => {
    await fc.assert(
      fc.asyncProperty(fc.constantFrom(...bulkActions), changes, async (action, flips) => {
        const policy = initialUi().policy;
        const [, fx] = update({ snapshot: SNAPSHOT, ui: initialUi({ policy }) }, action);
        const effect = closeEffect(fx);
        if (!effect) return true;
        let fresh = TABS.map((t) => ({ ...t }));
        for (const [id, flip] of flips) fresh = fresh.map((t) => (t.id === id ? flipTab(t, flip) : t));
        const removed: number[] = [];
        vi.stubGlobal('chrome', {
          tabs: {
            query: async () => fresh.map((t) => ({ ...t, mutedInfo: { muted: false } })),
            remove: async (ids: number[]) => void removed.push(...ids),
          },
          tabGroups: { query: async () => [] },
          windows: { getLastFocused: async () => ({ id: 1 }) },
        });
        const { closed } = await new ChromeBrowser().close(effect.tabIds, effect.policy, effect.cleanup);
        const byId = new Map(fresh.map((t) => [t.id, t]));
        return (
          removed.every((id) => protection(byId.get(id)!, policy) === null) &&
          JSON.stringify(removed.sort()) === JSON.stringify(closed.map((t) => t.id).sort())
        );
      }),
    );
  });
});

describe('Windows view Close N', () => {
  it('N is exactly what the window\'s bulk close asks to close, under any policy', () => {
    fc.assert(
      fc.property(fc.constantFrom(SNAPSHOT, GROUPED, PROTECTED_WINDOW), ui, (snapshot, prot) => {
        const state: AppState = { snapshot, ui: initialUi({ view: 'windows', policy: { ...initialUi().policy, ...prot } }) };
        const screen = deriveModel(state).screen;
        if (screen.kind !== 'windows') return false;
        return screen.windows.every((w) => {
          const effect = closeEffect(update(state, { type: 'closeWindow', windowId: w.id })[1]);
          return (effect?.tabIds.length ?? 0) === w.closable;
        });
      }),
    );
  });
});

describe('undo record', () => {
  it('keeps when the close ran, so undo only uses session entries from then on', () => {
    const tabs = TABS.slice(2, 4);
    const [s] = update({ snapshot: SNAPSHOT, ui: initialUi() }, { type: 'closed', tabs, requested: tabs.map((t) => t.id), noun: 'tab', kept: 0, at: 1234 });
    expect(update(s, { type: 'undo' })[1]).toContainEqual({ kind: 'restore', tabs, closedAt: 1234 });
  });
});

describe('a failed close', () => {
  it('never leaves a requested tab closing; undo lists exactly the tabs gone anyway', () => {
    fc.assert(
      fc.property(fc.constantFrom(...bulkActions), fc.array(fc.boolean(), { minLength: TABS.length, maxLength: TABS.length }), (action, goneMask) => {
        const [deciding, fx] = update({ snapshot: SNAPSHOT, ui: initialUi() }, action);
        const effect = closeEffect(fx);
        if (!effect) return true;
        const gone = TABS.filter((t, i) => effect.tabIds.includes(t.id) && goneMask[i]);
        const [after] = update(deciding, { type: 'closeFailed', tabs: gone, requested: effect.tabIds, noun: effect.noun });
        const undo = (after.ui.toast?.undo ?? []).map((t) => t.id).sort();
        return effect.tabIds.every((id) => !after.ui.closing.has(id)) && JSON.stringify(undo) === JSON.stringify(gone.map((t) => t.id).sort()) && /try again/.test(after.ui.toast?.message ?? '');
      }),
    );
  });
});

describe('duplicate cleanup when copies close or change during the animation', () => {
  type How = 'all' | 'review' | 'dupe' | 'set';
  const steps = (how: How, state: AppState): Action[] => {
    if (how === 'all') return [{ type: 'closeDuplicates' }];
    if (how === 'review') return [{ type: 'openReview' }, { type: 'confirmReview' }];
    if (how === 'dupe') return [{ type: 'query', text: 'dupe:' }, { type: 'closeResults' }];
    const key = planDuplicates(state.snapshot!.tabs, state.ui.policy)[0]?.key ?? '';
    return [{ type: 'openReview' }, { type: 'closeSet', key }];
  };
  const urls = [...new Set(TABS.map((t) => t.url))];
  const meddling = fc.record({
    gone: fc.subarray(TABS.map((t) => t.id)),
    moves: fc.array(fc.tuple(fc.constantFrom(...TABS.map((t) => t.id)), fc.constantFrom(...urls, 'https://elsewhere.test/')), { maxLength: 4 }),
    match: fc.constantFrom('exact' as const, 'ignoreHash' as const, 'ignoreQuery' as const, 'ignoreBoth' as const),
    keep: fc.constantFrom('oldest' as const, 'newest' as const),
  });

  it('every page it closes keeps a copy on the state the close runs on (survivor closed, copies navigated)', async () => {
    await fc.assert(
      fc.asyncProperty(fc.constantFrom<How>('all', 'review', 'dupe', 'set'), meddling, async (how, { gone, moves, match, keep }) => {
        const policy = { ...initialUi().policy, match, keep };
        let state: AppState = { snapshot: SNAPSHOT, ui: initialUi({ policy }) };
        let fx: Effect[] = [];
        for (const step of steps(how, state)) [state, fx] = update(state, step);
        const effect = closeEffect(fx);
        if (!effect) return true;
        if (!effect.cleanup || effect.policy === null) return false;
        const browser = new FakeBrowser(SNAPSHOT);
        await browser.close(gone, null); // the user closes tabs (planned survivors too)
        for (const [id, url] of moves) browser.change((t) => (t.id === id ? { ...t, url } : t));
        const fresh = (await browser.snapshot()).tabs;
        const { closed } = await browser.close(effect.tabIds, effect.policy, effect.cleanup);
        const left = (await browser.snapshot()).tabs;
        return closed.every((t) => {
          const key = duplicateKey(t, effect.policy!.match);
          return key !== null && left.some((o) => duplicateKey(o, effect.policy!.match) === key) && fresh.some((o) => o.id === t.id);
        });
      }),
    );
  });

  it('a site, window or selection close still closes every copy asked for: no survivor is added', async () => {
    const page = TABS.find((t) => TABS.filter((o) => o.url === t.url && !o.active && !o.pinned && o.groupId === -1).length >= 2)!;
    const copies = TABS.filter((t) => t.url === page.url && protection(t, initialUi().policy) === null);
    let state: AppState = { snapshot: SNAPSHOT, ui: initialUi() };
    [state] = update(state, { type: 'toggleSelectMode' });
    for (const t of copies) [state] = update(state, { type: 'toggleSelected', tabId: t.id });
    const [, fx] = update(state, { type: 'closeSelected' });
    const effect = closeEffect(fx)!;
    expect(effect.cleanup).toBe(false);
    const browser = new FakeBrowser(SNAPSHOT);
    const { closed } = await browser.close(effect.tabIds, effect.policy, effect.cleanup);
    expect(closed.map((t) => t.id).sort()).toEqual(copies.map((t) => t.id).sort());
    for (const action of bulkActions.filter((a) => a.type !== 'closeDuplicates')) expect(closeEffect(update({ snapshot: SNAPSHOT, ui: initialUi() }, action)[1])?.cleanup ?? false).toBe(false);
  });
});
