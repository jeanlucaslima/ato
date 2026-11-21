/**
 * The one way ATO closes tabs, for the popup and the right-click menu alike:
 * read Chrome's tabs fresh, check protection again (`stillClosable`), remove.
 * Runs in the service worker (the popup asks with `CLOSE_MESSAGE`), like undo.
 */
import { undoOffer, type CloseRecord } from '../core/close-record';
import { DEFAULT_POLICY, stillClosable, type DuplicatePolicy } from '../core/duplicates';
import type { Tab } from '../core/types';
import type { CloseResult } from './browser';
import { restoreTabs, type Restored } from './chrome-restore';
import { fromChromeTab } from './chrome-tab';

/** Where the last close is kept: session storage outlives the worker, not the browser. */
export const RECORD_KEY = 'ato:lastClose';

/** Message the popup sends the worker: `{ type, tabIds, policy }`; the reply is a `CloseReply`. */
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
 * since the decision stays; `null` closes what the user picked. If Chrome refuses
 * part-way, the tabs already gone are still remembered, then the error goes on.
 */
export async function closeTabs(tabIds: readonly number[], policy: DuplicatePolicy | null, by: CloseSource = POPUP): Promise<CloseResult> {
  const { closable, kept } = stillClosable(await readTabs(), tabIds, policy);
  if (closable.length === 0) return { closed: [], kept };
  const closedAt = Date.now();
  try {
    await chrome.tabs.remove(closable.map((t) => t.id));
  } catch (error) {
    const open = new Set((await readTabs().catch(() => closable)).map((t) => t.id));
    const gone = closable.filter((t) => !open.has(t.id));
    if (gone.length > 0) await remember({ tabs: gone, closedAt, message: by.message(gone.length), source: by.source });
    throw error;
  }
  await remember({ tabs: closable, closedAt, message: by.message(closable.length), source: by.source });
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
 * see `restoreTabs`), then forget that close so nothing offers it again.
 */
export async function undoClose(tabs: readonly Tab[], closedAt?: number): Promise<Restored> {
  const restored = await restoreTabs(tabs, closedAt);
  const record = (await lastClose().catch(() => undefined)) as Partial<CloseRecord> | undefined;
  if (closedAt !== undefined && record?.closedAt === closedAt) await chrome.storage.session.remove(RECORD_KEY).catch(() => undefined);
  return restored;
}

/** A close request from one of ATO's pages, checked field by field; `null` if malformed. */
export function readCloseRequest(message: unknown): { tabIds: number[]; policy: DuplicatePolicy | null } | null {
  const m = message as { type?: unknown; tabIds?: unknown; policy?: unknown } | null;
  if (m?.type !== CLOSE_MESSAGE || !Array.isArray(m.tabIds) || !m.tabIds.every((id) => Number.isInteger(id))) return null;
  if (m.policy === null) return { tabIds: m.tabIds as number[], policy: null };
  if (typeof m.policy !== 'object' || m.policy === undefined) return null;
  // Missing or odd fields fall back to the safe defaults (protect pinned and grouped).
  const p = m.policy as Partial<DuplicatePolicy>;
  const policy: DuplicatePolicy = {
    ...DEFAULT_POLICY,
    ...(typeof p.protectPinned === 'boolean' ? { protectPinned: p.protectPinned } : {}),
    ...(typeof p.protectGroups === 'boolean' ? { protectGroups: p.protectGroups } : {}),
  };
  return { tabIds: m.tabIds as number[], policy };
}
