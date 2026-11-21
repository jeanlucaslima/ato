/**
 * The one way ATO closes tabs, for the popup and the right-click menu alike:
 * read Chrome's tabs fresh, check protection again (`stillClosable`), remove.
 * Runs in the service worker (the popup asks with `CLOSE_MESSAGE`), like undo.
 */
import { DEFAULT_POLICY, stillClosable, type DuplicatePolicy } from '../core/duplicates';
import type { CloseResult } from './browser';
import { fromChromeTab } from './chrome-tab';

/** Message the popup sends the worker: `{ type, tabIds, policy }`; the reply is a `CloseReply`. */
export const CLOSE_MESSAGE = 'ato:close';

export type CloseReply = ({ ok: true } & CloseResult) | { ok: false; error: string };

/**
 * Close `tabIds`. With a `policy` (bulk and menu closes) protection is checked on
 * Chrome's current state, so a tab that became current, started playing or
 * joined a split view since the decision stays; `null` closes what the user picked.
 */
export async function closeTabs(tabIds: readonly number[], policy: DuplicatePolicy | null): Promise<CloseResult> {
  const now = Date.now();
  const fresh = (await chrome.tabs.query({ windowType: 'normal' })).flatMap((t) => fromChromeTab(t, now) ?? []);
  const { closable, kept } = stillClosable(fresh, tabIds, policy);
  if (closable.length > 0) await chrome.tabs.remove(closable.map((t) => t.id));
  return { closed: closable, kept };
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
