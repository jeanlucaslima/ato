/**
 * Duplicate cleanup planning. This decides which tabs get closed, so it carries
 * ATO's safety rules; `duplicates.test.ts` checks them as properties:
 *
 *  1. The active tab of any window is never closed.
 *  2. Every duplicate set keeps at least one tab.
 *  3. Only real duplicates (same key, set of ≥ 2) are ever closed.
 *  4. Protected tabs (pinned / grouped, per policy) are never closed.
 */
import { duplicateKey } from './tabs';
import type { Tab } from './types';

export interface DuplicatePolicy {
  /** Which unprotected copy survives when nothing is protected. */
  keep: 'oldest' | 'newest';
  protectPinned: boolean;
  protectGroups: boolean;
}

export const DEFAULT_POLICY: DuplicatePolicy = { keep: 'oldest', protectPinned: true, protectGroups: true };

export type KeepReason = 'current' | 'pinned' | 'grouped' | 'oldest' | 'newest' | 'chosen';

export type Decision = { action: 'keep'; reason: KeepReason } | { action: 'close' };

export interface PlannedCopy {
  tab: Tab;
  decision: Decision;
}

export interface DuplicateSet {
  key: string;
  copies: PlannedCopy[];
}

/** Why a tab may not be closed by cleanup, or `null` if it may. */
export function protection(tab: Tab, policy: DuplicatePolicy): 'current' | 'pinned' | 'grouped' | null {
  if (tab.active) return 'current';
  if (policy.protectPinned && tab.pinned) return 'pinned';
  if (policy.protectGroups && tab.groupId !== -1) return 'grouped';
  return null;
}

/**
 * Group duplicates and decide keep/close for every copy. Protected copies are
 * kept; if none is protected, one copy is kept by `policy.keep` (tab id order
 * approximates creation order). Sets come back in first-seen order.
 */
export function planDuplicates(tabs: readonly Tab[], policy: DuplicatePolicy): DuplicateSet[] {
  const byKey = new Map<string, Tab[]>();
  for (const tab of tabs) {
    const key = duplicateKey(tab);
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

/** Tabs a plan would close. */
export function tabsToClose(sets: readonly DuplicateSet[]): Tab[] {
  return sets.flatMap((s) => s.copies.filter((c) => c.decision.action === 'close').map((c) => c.tab));
}
