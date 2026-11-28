import type { Protection } from '../core/duplicates';
/** A count for people: `num(1102)` → `"1,102"`. */
export const num = (n: number): string => n.toLocaleString('en-US');

/**
 * A count where space is tight and it is only for orientation (the view tabs):
 * `1.2k`, `12.3k`, `123k` from `from` up. Close buttons and search use `num`.
 */
export function shortNum(n: number, from = 1_000): string {
  if (n < from) return num(n);
  return `${(n / 1000).toFixed(n < 100_000 ? 1 : 0).replace(/\.0$/, '')}k`;
}

/** `plural(3, 'tab')` → `"3 tabs"`; pass `many` for irregular plurals. */
export function plural(n: number, one: string, many = `${one}s`): string {
  return `${num(n)} ${n === 1 ? one : many}`;
}

/** Why a tab a bulk close asked for stayed open: its protection, or `copy` (the last copy of a page, kept by cleanup). */
export type KeptReason = Protection | 'copy';
export type KeptCounts = Partial<Record<KeptReason, number>>;

const KEPT: Record<KeptReason, (n: number) => string> = {
  current: (n) => (n === 1 ? 'the current tab' : `${num(n)} current tabs`),
  playing: (n) => `${num(n)} playing`,
  split: (n) => `${num(n)} in split view`,
  pinned: (n) => `${num(n)} pinned`,
  grouped: (n) => `${num(n)} in ${n === 1 ? 'a group' : 'groups'}`,
  copy: (n) => plural(n, 'last copy', 'last copies'),
};

/** Counts `reasons` (on top of `into`). */
export function tallyKept(reasons: Iterable<KeptReason>, into: KeptCounts = {}): KeptCounts {
  const counts = { ...into };
  for (const r of reasons) counts[r] = (counts[r] ?? 0) + 1;
  return counts;
}

export const keptTotal = (kept: KeptCounts): number => Object.values(kept).reduce((a, b) => a + (b ?? 0), 0);

/** `"2 playing, 1 pinned"`, in a fixed order. */
export function describeKept(kept: KeptCounts): string {
  return (Object.keys(KEPT) as KeptReason[])
    .filter((r) => (kept[r] ?? 0) > 0)
    .map((r) => KEPT[r](kept[r]!))
    .join(', ');
}

/**
 * What a Chrome error means for the user, for the ones that have a plain answer;
 * `undefined` for the rest (the toast then says only what failed).
 */
export function whyFailed(error: unknown): string | undefined {
  const text = error instanceof Error ? error.message : String(error);
  if (/cannot be edited right now|dragging a tab/i.test(text)) return 'finish dragging the tab, then try again';
  if (/no tab with id/i.test(text)) return 'the tab is already closed';
  if (/no window with id/i.test(text)) return 'the window is already closed';
  if (/normal windows/i.test(text)) return 'only normal windows can take tabs';
  return undefined;
}

/** `"Couldn’t move tabs"` plus the reason when there is one. */
export const failure = (what: string, why?: string): string => (why ? `${what}: ${why}` : `${what}. Try again.`);
