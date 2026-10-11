# Tab Engine 2.0

ATO keeps browser state, tab rules, mutations, and presentation separate. Chrome is the source of truth; a snapshot is a display cache, not permission to close a tab.

## Ownership

- `engine/browser.js`: Chrome API boundary and snapshot subscriptions. Snapshots contain full tab metadata, window metadata, and a focused/last-focused window ID. Group membership uses `Tab.groupId`; there is no native group-management UI or new permission.
- `engine/queries.js`: pure URL normalization, duplicate grouping, domain grouping, search/ranking/highlight data, and sorting. Existing shared utility imports remain compatible through a re-export.
- `engine/policy.js`: explicit scope, current-tab identification, protection reasons, and duplicate survivor selection.
- `engine/actions.js`: plans and serial execution of activation, close, duplicate cleanup, move, and undo commands.
- `engine/undo.js`: the latest close operation's short-lived restoration record.
- `background/service-worker.js`: command host and raw duplicate/total-tab badge, using the same queries and snapshots as the popup.
- `popup/`: rendering, keyboard focus, cursor IDs, selection, review, and view transitions. It sends commands rather than mutating browser tabs directly.

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

## ATO 2.0 presentation

The 420px-wide root requests an explicit 620px height so Chrome can autosize its toolbar bubble; the body is capped by the resulting available viewport height. A viewport-relative root creates a sizing loop and collapsed the 2.0.0 toolbar popup to 25px despite passing fixed-viewport tab tests. The 2.0.1 correction keeps the root independent of the viewport. Header, 46px search, duplicate instrument, browse navigation, and a compact action/status rail surround one scrolling working surface. Rows remain 64px tall when height is constrained; the popup reduces surrounding padding rather than squeezing text. Review occupies that same working surface instead of introducing competing nested scrolling. Search temporarily takes precedence without changing the saved browse view or duplicate scope.

`shared/theme.css` owns light/dark material tokens, focus and reduced-motion rules; popup and Settings consume it. Existing Paper, Ivory, Graphite, Obsidian, legacy theme aliases and bundled fonts remain supported. The original logo source is unchanged. Row indicators use a single priority: audible, pinned, duplicate copies, discarded, native membership, then recency when relevant. The former separate media surface is consolidated into ordinary rows with the existing audible-first ordering.

`popup-state.js` and `popup-machine.js` continue to own view/search transitions, stable cursor identities and reconciled selections. `popup-render-elements.js` builds semantic row buttons, checkboxes, site sections and inspectable duplicate copies; keyed reconciliation retains equal DOM nodes and focus. Only the active surface is rendered. `popup-list-events.js` delegates ordinary activation, explicit selection and modifier selection. Shift ranges use current visible order, not browser IDs. Scope changes clear selection; snapshot updates discard disappeared targets.

View and per-area sort preferences are validated and stored as `browsePreferences` in `chrome.storage.local`; duplicate disclosure uses the existing local expansion record. Scope uses the existing `currentWindowOnly` sync setting. Queries, cursors, selection, Select mode and snapshots are not persisted. The Settings first-use view remains a fallback. Startup restores preferences and current browser data, then focuses search.

`popup-review.js` owns a native, cancel-first bulk-close dialog. It captures requested identities and scope, estimates eligibility through engine policy, and sends the captured command only on confirmation. The engine still owns live validation, target choice and mutations. Duplicate cleanup sends `close-duplicates`, never a popup-generated close list. Counts distinguish raw redundancy, removable copies and protected members; review states uncertainty and affected windows. Search/site bulk actions explicitly describe their own targets. An explicitly requested single close retains engine opt-in semantics; it is not silently treated as protected bulk cleanup.

The action rail is permanently mounted. Pending operations disable affected actions; feedback reports actual successes/skips/failures. Move does not discard the preceding close operation's Undo. Undo distinguishes session restoration from URL recreation and leaves failed entries retryable. A failed browser read withholds stale surfaces and disables browser-targeted actions until a successful snapshot refresh; it never claims the browser is clean. Recorded-operation Undo remains independently available.

Search modes, aliases, ranking and highlighting remain in the engine unchanged. Sites now includes one-tab sites rather than only larger domains. No Groups view is shipped because the current contract lacks native group metadata; existing membership/protection remains intact. No new dependencies, permissions, tracking or remote services were introduced. The existing playful demo asset is retained; no separate Easter-egg implementation was present in the audited baseline popup/query code.

### Verification and limits

The audited 1.21.0 baseline passed 277 tests across 11 files, the production build and real Chromium popup tests. The 2.0.0 interface passes 279 tests across the same files, the build, expanded real-mutation popup checks, and `npm run test:ui`. That second browser suite exercises deterministic snapshots, review/selection/theme/error states, Settings persistence, 440px constrained height and 5/50/500/1,200-tab rendering. Injected partial and failed responses test truthful presentation, not Chrome's real failure mechanics. Screenshot capture is optional via `ATO_SCREENSHOT_DIR`.

Large-collection checks render and search all fixture rows and synchronize keyboard focus. Observed synchronous sort/render work for 1,200 rows was approximately 33–83ms across orb runs; these are synthetic local measurements, not a cross-device performance guarantee. This did not justify a virtual-list framework. Since 2.0.1, `test:popup` also opens the actual toolbar bubble via `chrome.action.openPopup()` and inspects its natural viewport through CDP without imposing dimensions. It checks usable height, content width, autofocus and the action rail fitting within the viewport; the regression fails on 2.0.0. Optional toolbar screenshots use native resolution because toolbar targets do not support viewport/DPR overrides. Other interaction checks use the extension document in a tab. Physical display scaling, assistive-technology announcements and macOS modifier behavior still need device-level review; native semantics and keyboard behavior are checked in Chromium.

Settings exposes GitHub and a review invitation using the repository's existing Chrome Web Store homepage URL, accurately labelled as a way to find ATO. A direct product listing was not present in the repository and was not fabricated. Supplying that verified URL is a useful follow-up, along with read-only native group metadata if a later phase deliberately extends the permissions/API contract. On-device AI classification and new group/context-menu operations remain future work, not advertised capabilities.
