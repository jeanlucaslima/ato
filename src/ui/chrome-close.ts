/**
 * The one way ATO closes tabs, for the popup and the right-click menu alike:
 * read Chrome's tabs fresh, check protection again (`stillClosable`), remove.
 * Runs in the service worker (the popup asks with `CLOSE_MESSAGE`), like undo.
 */
import { readCloseRecord, undoOffer, type CloseRecord } from '../core/close-record';
import { DEFAULT_POLICY, stillClosable, type DuplicatePolicy } from '../core/duplicates';
import { CHOICES } from '../core/settings';
import type { Tab } from '../core/types';
import type { CloseResult } from './browser';
import { restoreTabs, sessionsOf, type Restored } from './chrome-restore';
import { fromChromeTab } from './chrome-tab';

/** Where the last close is kept: session storage outlives the worker, not the browser. */
export const RECORD_KEY = 'ato:lastClose';

/** Message the popup sends the worker: `{ type, tabIds, policy, cleanup }`; the reply is a `CloseReply`. */
export const CLOSE_MESSAGE = 'ato:close';

export type CloseReply = ({ ok: true } & CloseResult) | { ok: false; error: string };

/** Who is closing, and what the undo toast will say for `n` closed tabs. */
export interface CloseSource {
  source: CloseRecord['source'];
  message: (n: number) => string;
}

const POPUP: CloseSource = { source: 'popup', message: () => '' };

async function readTabs(): Promise<Tab[]> {
  const now = Date.now();
  return (await chrome.tabs.query({ windowType: 'normal' })).flatMap((t) => fromChromeTab(t, now) ?? []);
}

/**
 * Close `tabIds` and remember them as the last close (replacing the one before).
 * With a `policy` (bulk and menu closes) protection is checked on Chrome's current
 * state, so a tab that became current, started playing or joined a split view
 * since the decision stays; `null` closes what the user picked. `cleanup` (duplicate
 * cleanup) also leaves one copy of every page open, on Chrome's current state. If
 * Chrome refuses part-way, the tabs already gone are still remembered, then the error goes on.
 */
export async function closeTabs(tabIds: readonly number[], policy: DuplicatePolicy | null, by: CloseSource = POPUP, cleanup = false): Promise<CloseResult> {
  const { closable, kept } = stillClosable(await readTabs(), tabIds, policy, cleanup);
  if (closable.length === 0) return { closed: [], kept };
  const closedAt = Date.now();
  try {
    await chrome.tabs.remove(closable.map((t) => t.id));
  } catch (error) {
    const open = new Set((await readTabs().catch(() => closable)).map((t) => t.id));
    const gone = closable.filter((t) => !open.has(t.id));
    if (gone.length > 0) await remember({ tabs: gone, closedAt, message: by.message(gone.length), source: by.source, sessions: await sessionsOf(gone, closedAt) });
    throw error;
  }
  await remember({ tabs: closable, closedAt, message: by.message(closable.length), source: by.source, sessions: await sessionsOf(closable, closedAt) });
  return { closed: closable, kept, closedAt };
}

async function remember(record: CloseRecord): Promise<void> {
  // Undo is a convenience: failing to remember must not fail the close.
  try {
    await chrome.storage.session.set({ [RECORD_KEY]: record });
  } catch {
    // Left without an undo record.
  }
}

async function lastClose(): Promise<unknown> {
  return (await chrome.storage.session.get(RECORD_KEY))[RECORD_KEY];
}

/** A right-click close the popup should offer to undo now, if any. */
export async function pendingUndo(now = Date.now()): Promise<CloseRecord | null> {
  return undoOffer(await lastClose().catch(() => undefined), now);
}

/**
 * Undo: restore `tabs` closed at `closedAt` (each from its own session entry,
 * the one the record pinned at close time, see `restoreTabs`), then forget what
 * came back: the record is cleared, or keeps only the tabs that couldn't.
 */
export async function undoClose(tabs: readonly Tab[], closedAt?: number): Promise<Restored> {
  const before = readCloseRecord(await lastClose().catch(() => undefined));
  const record = closedAt !== undefined && before?.closedAt === closedAt ? before : null;
  const restored = await restoreTabs(tabs, closedAt, record?.sessions);
  const after = readCloseRecord(await lastClose().catch(() => undefined));
  if (record && after?.closedAt === record.closedAt) {
    const failed = new Set(restored.failed.map((t) => t.id));
    const left = after.tabs.filter((t) => failed.has(t.id));
    await (left.length > 0 ? chrome.storage.session.set({ [RECORD_KEY]: { ...after, tabs: left } }) : chrome.storage.session.remove(RECORD_KEY)).catch(() => undefined);
  }
  return restored;
}

/** A close request from one of ATO's pages, checked field by field; `null` if malformed. */
export function readCloseRequest(message: unknown): { tabIds: number[]; policy: DuplicatePolicy | null; cleanup: boolean } | null {
  const m = message as { type?: unknown; tabIds?: unknown; policy?: unknown; cleanup?: unknown } | null;
  if (m?.type !== CLOSE_MESSAGE || !Array.isArray(m.tabIds) || !m.tabIds.every((id) => Number.isInteger(id))) return null;
  if (m.policy === null) return { tabIds: m.tabIds as number[], policy: null, cleanup: false };
  if (typeof m.policy !== 'object' || m.policy === undefined) return null;
  // Missing or odd fields fall back to the safe defaults (protect pinned and grouped;
  // exact matching, the one that finds fewest copies to close).
  const p = m.policy as Partial<DuplicatePolicy>;
  const policy: DuplicatePolicy = {
    ...DEFAULT_POLICY,
    ...(typeof p.protectPinned === 'boolean' ? { protectPinned: p.protectPinned } : {}),
    ...(typeof p.protectGroups === 'boolean' ? { protectGroups: p.protectGroups } : {}),
    ...(CHOICES.match.includes(p.match as never) ? { match: p.match } : {}),
    ...(CHOICES.keep.includes(p.keep as never) ? { keep: p.keep } : {}),
  };
  return { tabIds: m.tabIds as number[], policy, cleanup: m.cleanup === true };
}
