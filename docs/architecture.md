# Tab Engine 2.0

ATO keeps browser state, tab rules, mutations, and presentation separate. Chrome is the source of truth; a snapshot is a display cache, not permission to close a tab.

## Ownership

- `engine/browser.js`: Chrome API boundary and snapshot subscriptions. Snapshots contain full tab metadata, window metadata, and a focused/last-focused window ID. Group membership uses `Tab.groupId`; there is no native group-management UI or new permission.
- `engine/queries.js`: pure URL normalization, duplicate grouping, domain grouping, search/ranking/highlight data, and sorting. Existing shared utility imports remain compatible through a re-export.
- `engine/policy.js`: explicit scope, current-tab identification, protection reasons, and duplicate survivor selection.
- `engine/actions.js`: plans and serial execution of activation, close, duplicate cleanup, move, and undo commands.
- `engine/undo.js`: the latest close operation's short-lived restoration record.
- `background/service-worker.js`: command host and raw duplicate/total-tab badge, using the same queries and snapshots as the popup.
- `popup/`: rendering, keyboard focus, cursor IDs, selection, animation, and view transitions. It sends commands rather than mutating browser tabs directly.

## Snapshots and events

Listeners register synchronously when a context starts. Initial state and structural/focus changes come from populated Chrome windows. Tab updates fetch live metadata for that tab; removals are removed from the display snapshot immediately and then reconciled. Creation, activation, movement, attachment/detachment, replacement, and window changes trigger a coalesced full refresh.

Revision guards discard full reads invalidated by later events. Per-tab read versions reject delayed old metadata; competing updates resynchronize instead of trusting event payload ordering. Disposing the popup store unsubscribes listeners. A restarted worker reads Chrome again; tab snapshots are not persisted, and no long-lived scan timer is required.

`Tab.active` is per window. The user's current tab is active in the focused window, or the last-focused window when Chrome has no focused window. Other windows' active tabs do not receive current-tab protection merely because they are active there.

## Commands

The popup sends `{ action: 'tabEngine', command }` and receives `{ result }` or `{ error }`. Commands use `{ type: 'all' }` or `{ type: 'window', windowId }` scope. If omitted, scope follows the live `currentWindowOnly` setting at planning time. Explicit scope overrides that default.

The worker reads sync settings for each command. Engine callers can also use `createActions(createBrowser(api))` directly:

```js
const plan = await actions.plan({
  type: 'close-duplicates', scope: { type: 'all' }
}, { matchMode: 'ignoreQuery', keepTab: 'oldest', protectPinned: true });
const result = await actions.execute(plan);
// result: { succeeded: [tabId, ...], skipped: [{ id, reason }, ...],
//           failed: [{ id, error }, ...], operationId }
```

Plans are ephemeral. Close/move targets retain their exact ID, URL, and window identity. Execution reads Chrome again, skips changed/moved/loading targets, and never expands a stale plan to include new tabs. Duplicate cleanup rechecks live eligibility and a surviving matching identity, then checks the target and current-tab/protection state again after asynchronous session/survivor reads. Operations run one tab at a time; a rejected mutation does not count as a successful close or undo entry.

Close supports an explicit list of identities or a domain. Duplicate cleanup can optionally restrict a normalized URL group. Move uses a new window and reports individual failures; moves are not undoable. Activation and undo share the worker's command queue to avoid conflicting ATO mutations.

## Duplicate policy

One grouping implementation supports exact, ignore-query, ignore-hash, and ignore-both matching. Empty URLs are excluded. Badge and review count raw redundancy: each group contributes its size minus one. The actionable count separately applies scope and protection.

For bulk close and duplicate cleanup, current-tab protection comes first, followed by loading/navigation safety, existing Chrome/Edge internal-page exclusion, configured pinned protection, and configured group protection. All protected copies survive. If any protected copy exists, other eligible copies can close without retaining an additional arbitrary copy. Otherwise `keepTab` selects oldest/newest using the existing tab-ID order; this refactor does not invent a persisted creation-time history.

An explicitly requested single-tab close retains the existing opt-out from current/pinned/grouped bulk protections. It still validates identity and excludes loading/internal tabs. Future command callers should not set `single` for batch cleanup.

If focus changes after planning, cleanup can leave extra copies: the new current tab is protected, but the old survivor is not added to the target list. This conservative behavior is intentional.

## Undo and recovery

Only successful closes are recorded, with minimal URL/window/index/pinned information. A newly closed Chrome session is associated only when it can be identified unambiguously; restoration always supplies an exact session ID, never "restore the latest N sessions". Concurrent or unavailable session metadata falls back to opening the recorded URL.

The latest close record lives in `chrome.storage.session`, surviving popup reopening and worker restart, not a browser restart. Undo reports separate `restored`, `recreated`, and `failed` lists. URL recreation is not full restoration: navigation history, native groups, and other session metadata may be lost. Failed entries remain retryable without repeating successful ones. Consumption is persisted before restoration to avoid duplicate restoration after a worker interruption.

Chrome has no atomic compare-and-remove API. An external change between the final check and removal remains possible. Likewise, a worker interruption between closing a tab and persisting its undo entry can lose that entry; interruption after consuming an entry but before restoration can lose that restoration opportunity. ATO favors conservative skips and avoiding duplicate/unrelated restores over claiming transactional guarantees Chrome cannot provide. Chrome's recently closed list is limited, so older entries may require URL recreation.

## Testing and next steps

`npm test` uses a limited fake Chrome implementation plus existing query and popup-state tests. Coverage includes multi-window focus, normalized duplicates, survivor preferences/protections, stale identities, changes during execution, partial failures, event ordering/replacement, worker recovery, and operation-specific undo. `npm run build && npm run test:popup` adds real Chromium mutation and keyboard/DOM checks when `agent-browser` is installed; it uses disposable fixture tabs and a separate browser session.

Search modes, aliases, ranking, highlighting, domain ordering, media indicators, themes, and Easter eggs remain unchanged. Full tab metadata (including `lastAccessed`) is preserved for future sorting. Next phases can redesign presentation, then add commands such as context-menu operations, without duplicating browser rules. On-device AI classification is a later optional feature, not part of this engine.
