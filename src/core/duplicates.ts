/**
 * Duplicate cleanup planning. This decides which tabs get closed, so it carries
 * ATO's safety rules; `duplicates.test.ts` checks them as properties:
 *
 *  1. The active tab of any window is never closed.
 *  2. Every duplicate set keeps at least one tab.
 *  3. Only real duplicates (same key, set of ≥ 2) are ever closed.
 *  4. Protected tabs (pinned / grouped, per policy) are never closed.
 *  5. A tab playing audio is never closed: it's what the user is listening to.
 *  6. A tab in a split view is never closed: that would break the side-by-side pair.
 */
import { duplicateKey, type MatchMode } from './tabs';
import type { Tab } from './types';

export interface DuplicatePolicy {
  /** Which unprotected copy survives when nothing is protected. */
  keep: 'oldest' | 'newest';
  protectPinned: boolean;
  protectGroups: boolean;
  /** What counts as the same page (2.x's "match mode"). */
  match: MatchMode;
}

export const DEFAULT_POLICY: DuplicatePolicy = { keep: 'oldest', protectPinned: true, protectGroups: true, match: 'exact' };

export type KeepReason = 'current' | 'playing' | 'split' | 'pinned' | 'grouped' | 'oldest' | 'newest' | 'chosen';

export type Decision = { action: 'keep'; reason: KeepReason } | { action: 'close' };

export interface PlannedCopy {
  tab: Tab;
  decision: Decision;
}

export interface DuplicateSet {
  key: string;
  copies: PlannedCopy[];
}

/**
 * Why a tab may not be closed by a bulk close, or `null` if it may. Without
 * `focusedWindowId` (duplicate cleanup, the tab menu) the current tab of every
 * window is protected; with it (closing search results, a site, a selection or a
 * window) only the tab the user is looking at: the current tab of that window.
 */
export function protection(tab: Tab, policy: DuplicatePolicy, focusedWindowId?: number): 'current' | 'playing' | 'split' | 'pinned' | 'grouped' | null {
  if (tab.active && (focusedWindowId === undefined || tab.windowId === focusedWindowId)) return 'current';
  // Audible covers muted tabs too (Chrome reports sound it produced, heard or not).
  if (tab.audible) return 'playing';
  if (isSplit(tab)) return 'split';
  if (policy.protectPinned && tab.pinned) return 'pinned';
  if (policy.protectGroups && tab.groupId !== -1) return 'grouped';
  return null;
}

export function isSplit(tab: Pick<Tab, 'splitViewId'>): boolean {
  return tab.splitViewId !== undefined && tab.splitViewId !== -1;
}

/**
 * Group duplicates and decide keep/close for every copy. Protected copies are
 * kept; if none is protected, one copy is kept by `policy.keep` (tab id order
 * approximates creation order). Sets come back in first-seen order.
 */
export function planDuplicates(tabs: readonly Tab[], policy: DuplicatePolicy): DuplicateSet[] {
  const byKey = new Map<string, Tab[]>();
  for (const tab of tabs) {
    const key = duplicateKey(tab, policy.match);
    if (key === null) continue;
    const group = byKey.get(key);
    if (group) group.push(tab);
    else byKey.set(key, [tab]);
  }

  const sets: DuplicateSet[] = [];
  for (const [key, group] of byKey) {
    if (group.length < 2) continue;
    const reasons = group.map((tab) => protection(tab, policy));
    let survivorId: number | null = null;
    if (reasons.every((r) => r === null)) {
      const ids = group.map((t) => t.id);
      survivorId = policy.keep === 'oldest' ? Math.min(...ids) : Math.max(...ids);
    }
    sets.push({
      key,
      copies: group.map((tab, i) => {
        const reason = reasons[i];
        if (reason) return { tab, decision: { action: 'keep', reason } };
        if (tab.id === survivorId) return { tab, decision: { action: 'keep', reason: policy.keep } };
        return { tab, decision: { action: 'close' } };
      }),
    });
  }
  return sets;
}

/**
 * Apply the user's manual keep/close choices from review. A choice that would
 * break a safety rule is ignored: protected copies stay kept, and a set never
 * ends up with nothing kept (the planned survivor is restored).
 */
export function applyOverrides(
  sets: readonly DuplicateSet[],
  overrides: ReadonlyMap<number, 'keep' | 'close'>,
  policy: DuplicatePolicy,
): DuplicateSet[] {
  return sets.map((set) => {
    const copies = set.copies.map((copy): PlannedCopy => {
      const wanted = overrides.get(copy.tab.id);
      if (!wanted || protection(copy.tab, policy)) return copy;
      if (wanted === 'keep' && copy.decision.action === 'close') return { tab: copy.tab, decision: { action: 'keep', reason: 'chosen' } };
      if (wanted === 'close' && copy.decision.action === 'keep') return { tab: copy.tab, decision: { action: 'close' } };
      return copy;
    });
    return { key: set.key, copies: copies.some((c) => c.decision.action === 'keep') ? copies : set.copies };
  });
}

/**
 * The last check before a close: of the tabs asked for (`ids`), those still open
 * in `fresh` and still unprotected under `policy`. A tab that became current,
 * started playing or joined a split view since the decision is `kept`. With no
 * policy (a single close the user picked) only tabs that are gone drop out.
 * `focusedWindowId`: as in `protection`, read fresh by the caller.
 *
 * `cleanup` (duplicate cleanup, rule 2): every page keeps a copy in `fresh`. A
 * closable tab with no copy staying open (the planned survivor was closed or
 * navigated away, or the tab itself now shows another page) leaves one copy of
 * its page open, chosen by `policy.keep`. Other closes close all they're asked to.
 */
export function stillClosable(fresh: readonly Tab[], ids: Iterable<number>, policy: DuplicatePolicy | null, cleanup = false, focusedWindowId?: number): { closable: Tab[]; kept: Tab[] } {
  const wanted = new Set(ids);
  let closable: Tab[] = [];
  const kept: Tab[] = [];
  for (const tab of fresh) {
    if (!wanted.has(tab.id)) continue;
    if (policy && protection(tab, policy, focusedWindowId) !== null) kept.push(tab);
    else closable.push(tab);
  }
  if (cleanup && policy) {
    const closing = new Set(closable.map((t) => t.id));
    const staying = new Set(fresh.filter((t) => !closing.has(t.id)).map((t) => duplicateKey(t, policy.match)));
    const orphans = new Map<string | null, Tab[]>();
    for (const tab of closable) {
      const key = duplicateKey(tab, policy.match);
      if (key !== null && staying.has(key)) continue;
      orphans.set(key, [...(orphans.get(key) ?? []), tab]);
    }
    const spared = new Set<number>();
    for (const [key, copies] of orphans) {
      // No page to dedupe (null key): none of them is a duplicate, so none closes.
      const ids = copies.map((t) => t.id);
      const survivor = policy.keep === 'oldest' ? Math.min(...ids) : Math.max(...ids);
      for (const id of key === null ? ids : [survivor]) spared.add(id);
    }
    kept.push(...closable.filter((t) => spared.has(t.id)));
    closable = closable.filter((t) => !spared.has(t.id));
  }
  return { closable, kept };
}

export function tabsToClose(sets: readonly DuplicateSet[]): Tab[] {
  return sets.flatMap((s) => s.copies.filter((c) => c.decision.action === 'close').map((c) => c.tab));
}
