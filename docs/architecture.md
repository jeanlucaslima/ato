# ATO 3 architecture

Vanilla TypeScript, Vite and Vitest; no UI framework. Chrome owns the tabs; a pure core decides what may be closed; the popup is a state machine whose rendering is a pure function of a model.

## Layers

- **`core/`**: pure logic, no DOM, no Chrome. Types (`Tab`, `Snapshot`), duplicate planning and the safety rules (`duplicates.ts`), URL matching (`tabs.ts`), search, settings (defaults, validation, 2.x import), the badge, the tab-menu picks, the undo record (`close-record.ts`).
- **`ui/`**: the popup and the settings page.
  - `update(state, action) → [state, effects]` is the whole behaviour, pure.
  - `deriveModel` turns browser snapshot + UI state into a `PopupModel`; `renderPopup` draws it; `morph` patches the DOM in place (keyed, keeps focus and scroll).
  - `app.ts` turns DOM events into actions and runs effects against a `BrowserPort`: `ChromeBrowser` in the extension, `FakeBrowser` in the gallery and tests. Settings go through a `SettingsStore` the same way (`ChromeSettings` / `MemorySettings`).
  - `chrome-*.ts` are the only files in `ui/` that call `chrome.*`.
- **`background/worker.ts`**: the MV3 service worker. Toolbar badge, tab right-click menu, and every close and undo (see below), so they finish even if the popup closes.
- **`dev/`**: the gallery (`npm run dev`): every fixture is a live popup over a `FakeBrowser`, beside the settings page.

One interaction: DOM event → `Action` → `update` → new state, plus `Effect`s that `app.ts` runs against the `BrowserPort` (their results come back as actions) → `deriveModel` → `renderPopup` → `morph`.

## Closing and undo

One path closes tabs, for the popup and the right-click menu alike: `closeTabs` in `ui/chrome-close.ts`, run in the worker (the popup asks with a message and runs it itself only if no worker answers).

1. **Recheck.** Chrome's tabs are read fresh and `stillClosable` (`core/duplicates.ts`) applies protection again, so a tab that became current, started playing or joined a split view since the decision (the popup's 180 ms row animation, or the menu's click) stays open. Duplicate cleanup also keeps one copy of any page that would otherwise have none left (its planned survivor was closed or navigated away meanwhile). Closing a site, window, selection or a single tab closes everything asked.
2. **Remove**, and report what really closed; the popup's toast and undo list exactly those.
3. **Remember** the close as the last close record `{ tabs, closedAt, message, source, sessions }` in `chrome.storage.session` (key `ato:lastClose`): it survives the worker being stopped, not a browser restart. Each close replaces the one before. `sessions` maps each tab to its `chrome.sessions` entry, read right after the removal while those entries are still the newest.

**Undo** (`undoClose` → `restoreTabs` in `ui/chrome-restore.ts`) restores each tab from its pinned session entry, last-closed first so each lands at the index it closed from. Pinning matters because closed-tab entries carry only a URL and an index (Chrome 158 reports `windowId` 0), so after other tabs close a same-URL entry can't be told apart. Without pinned entries (no record for that close), entries are matched by URL, index at close and removal order. Tabs Chrome no longer remembers (it keeps the last 25), and tabs it refuses to restore, are reopened by URL in their window, position and group. Tabs that come back neither way are reported; the record keeps just those (so they can be tried again) and is cleared once everything is back, so a close is never undone twice.

**Undo for a right-click close.** The menu has nowhere to show a button, so the popup offers it: opened within a minute (`UNDO_OFFER_MS`) of a menu close that hasn't been undone, it shows that close's undo toast ("Closed 3 duplicates (tab menu) · Undo"). Chosen over a notification (needs the `notifications` permission, and outlives the moment) and over nothing (⇧⌘T brings tabs back one at a time). Popup closes aren't offered again: their toast already had the Undo.

## Safety rules

Checked as fast-check properties (`core/duplicates.test.ts`, `core/tab-menu.test.ts`, `core/close-record.test.ts`, `ui/update.test.ts`, `ui/close-recheck.test.ts`, `ui/chrome-menu.test.ts`, `ui/chrome-close.test.ts`, `ui/chrome-restore.test.ts`), each with a mutation check (remove the guard, watch the property fail):

1. The active tab of any window is never closed by cleanup.
2. A tab playing audio is never closed.
3. A tab in a split view is never closed; moving one half moves both.
4. Every duplicate set keeps at least one tab: whatever the user flips in review, and on Chrome's state when the close runs.
5. Only real duplicates (same key under the chosen matching) are closed.
6. Protected tabs (pinned, grouped, per settings) are never closed by bulk actions.
7. The tab menu never closes the tab that was right-clicked.
8. Every close (popup or menu) rechecks protection on Chrome's current state right before removing.
9. Undo brings every closed tab back at most once, from its own session entry while Chrome remembers it, otherwise reopened by URL; tabs it can't bring back are reported, never counted as restored.

## Performance

Budget: interactions within a frame at 2,000 tabs (`npm run perf` times the pure paths; measurements in [v3-status.md](v3-status.md#301-measurements)). What keeps it there: `deriveModel` is memoized per state; `morph` skips unchanged keyed elements; a cursor-only change (hover, ↑↓) patches two rows instead of rendering (`app.ts`); search draws the first 150 results; list rows use `content-visibility`.

## Chrome

Minimum Chrome 157 (`minimum_chrome_version`), so no feature detection: `splitViewId` (140), the `"tab"` context menu (150), `runtime.onExtensionLoaded` (157). Permissions: `tabs`, `storage`, `sessions`, `tabGroups`, `contextMenus`; no host permissions.

## Settings

`chrome.storage.sync`, one key, `settings`. Defined in `core/settings.ts` (`Settings`, `DEFAULT_SETTINGS`, `CHOICES`); `readSettings` validates whatever is stored, field by field. On first run after 2.x, its flat keys are carried over once (`fromLegacy`) and left in place.

| Key | Values (default first) | Used by |
| --- | --- | --- |
| `keep` | `oldest`, `newest` | planner: which unprotected copy stays |
| `match` | `exact`, `ignoreHash`, `ignoreQuery`, `ignoreBoth` | `duplicateKey`: what counts as the same page |
| `protectPinned` | `true`, `false` | planner, bulk closes |
| `protectGroups` | `true`, `false` | planner, bulk closes |
| `view` | `tabs`, `sites`, `windows` | where the popup opens |
| `scope` | `all`, `current` | which windows the popup starts on (search always covers all) |
| `theme` | `graphite` and eight more (`THEMES`), or `system` | popup, settings page |
| `badge` | `duplicates`, `all`, `off` | worker |
| `badgeColor` | `#dc2626` … (`BADGE_COLORS`) | worker |
