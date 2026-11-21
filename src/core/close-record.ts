/**
 * The last close, kept by the service worker so a right-click close can be
 * undone from the popup. Pure: storing it is `ui/chrome-close.ts`'s job.
 */
import type { Tab } from './types';

export interface CloseRecord {
  /** The tabs really closed, in the order they were removed. */
  tabs: Tab[];
  /** Epoch ms just before they were removed (undo only uses session entries from then on). */
  closedAt: number;
  /** What the undo toast says, e.g. "Closed 3 duplicates of this tab". */
  message: string;
  /** Who closed them: the popup offers its own undo; menu closes get theirs when the popup opens. */
  source: 'popup' | 'menu';
}

/** How long after a right-click close the popup still offers to undo it. */
export const UNDO_OFFER_MS = 60_000;

const isTab = (t: unknown): t is Tab => {
  const x = t as Partial<Tab> | null;
  return typeof x === 'object' && x !== null && Number.isInteger(x.id) && Number.isInteger(x.windowId) && Number.isInteger(x.index) && typeof x.url === 'string';
};

/** A stored record, checked field by field; `null` if anything is off. */
export function readCloseRecord(raw: unknown): CloseRecord | null {
  const r = raw as Partial<CloseRecord> | null;
  if (typeof r !== 'object' || r === null) return null;
  if (!Array.isArray(r.tabs) || !r.tabs.every(isTab) || typeof r.closedAt !== 'number' || typeof r.message !== 'string') return null;
  if (r.source !== 'popup' && r.source !== 'menu') return null;
  return { tabs: r.tabs, closedAt: r.closedAt, message: r.message, source: r.source };
}

/**
 * The close the popup should offer to undo when it opens at `now`: a right-click
 * close from the last minute with something to bring back. Popup closes are
 * offered by the popup's own toast, so they aren't offered again.
 */
export function undoOffer(raw: unknown, now: number): CloseRecord | null {
  const record = readCloseRecord(raw);
  if (!record || record.source !== 'menu' || record.tabs.length === 0) return null;
  const age = now - record.closedAt;
  return age >= 0 && age <= UNDO_OFFER_MS ? record : null;
}
