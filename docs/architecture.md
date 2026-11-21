# ATO 3 architecture

Vanilla TypeScript, Vite and Vitest; no UI framework. Chrome owns the tabs; a pure core decides what may be closed; the popup is a state machine whose rendering is a pure function of a model.

## Layers

- **`core/`**: pure logic, no DOM, no Chrome. Types (`Tab`, `Snapshot`), duplicate planning and the safety rules (`duplicates.ts`), URL matching (`tabs.ts`), search, settings (defaults, validation, 2.x import), the badge, the tab-menu picks.
- **`ui/`**: the popup.
  - `update(state, action) → [state, effects]` is the whole behaviour, pure.
  - `deriveModel` turns browser snapshot + UI state into a `PopupModel`; `renderPopup` draws it; `morph` patches the DOM in place (keyed, keeps focus and scroll).
  - `app.ts` turns DOM events into actions and runs effects against a `BrowserPort`: `ChromeBrowser` in the extension, `FakeBrowser` in the gallery and tests.
- **`background/worker.ts`**: the MV3 service worker. Toolbar badge, tab right-click menu, and every close and undo (see below), so they finish even if the popup closes.

## Closing and undo

One path closes tabs, for the popup and the right-click menu alike: `ui/chrome-close.ts` `closeTabs`, run in the worker (the popup asks with a message and falls back to running it itself if no worker answers).

1. **Recheck.** Chrome's tabs are read fresh and `stillClosable` (`core/duplicates.ts`) applies protection again, so a tab that became current, started playing or joined a split view since the decision (the popup's 180 ms row animation, or the menu's click) stays open. A single close the user picked (no policy) closes what they picked.
2. **Remove**, and report what really closed; the popup's toast and undo list exactly those.
3. **Remember** the close as the last close record `{ tabs, closedAt, message, source }` in `chrome.storage.session` (key `ato:lastClose`): it survives the worker being stopped, not a browser restart. Each close replaces the record before it.

Undo (`undoClose`) restores through `restoreTabs` (`ui/chrome-restore.ts`), which matches each tab to its own `sessions` entry: same URL, then the index it had when it closed, then its place in the removal order, only among entries from `closedAt` on (Chrome 158 reports `windowId` 0 for closed tabs, so the window can't be matched). Whole tabs come back last-closed first, so each lands where it was; tabs Chrome no longer remembers are reopened by URL. The record is then cleared, so a close is never undone twice.

**How a right-click close is undone.** The menu has nowhere to show a button, so the popup offers it: when the popup opens within a minute (`UNDO_OFFER_MS`) of a menu close that hasn't been undone, it shows that close's usual undo toast ("Closed 3 duplicates (tab menu) · Undo"). Chosen over a notification (needs the `notifications` permission, and it outlives the moment) and over doing nothing (⇧⌘T brings tabs back one at a time, and the wrong copy's history). Popup closes aren't offered again: their toast already had the Undo. After a minute the offer lapses, but the record stays until the next close, and ⇧⌘T still works.

## Safety rules

Checked as fast-check properties (`core/duplicates.test.ts`, `core/tab-menu.test.ts`, `core/close-record.test.ts`, `ui/update.test.ts`, `ui/close-recheck.test.ts`, `ui/chrome-close.test.ts`, `ui/chrome-restore.test.ts`), each with a mutation check (remove the guard, watch the property fail):

1. The active tab of any window is never closed by cleanup.
2. A tab playing audio is never closed.
3. A tab in a split view is never closed; moving one half moves both.
4. Every duplicate set keeps at least one tab, whatever the user flips in review.
5. Only real duplicates (same key under the chosen matching) are closed.
6. Protected tabs (pinned, grouped, per settings) are never closed by bulk actions.
7. The tab menu never closes the tab that was right-clicked.
8. Undo brings every closed tab back exactly once, from its own `sessions` entry while Chrome remembers it (the last 25), otherwise reopened by URL in its window, position and group; a close, from the popup or the menu, is undone at most once.
9. Every close (popup or menu) rechecks protection on Chrome's current state right before removing.

## Chrome

Minimum Chrome 157 (`minimum_chrome_version`), so no feature detection: `splitViewId` (140), the `"tab"` context menu (150), `runtime.onExtensionLoaded` (157). Permissions: `tabs`, `storage`, `sessions`, `tabGroups`, `contextMenus`; no host permissions.

Settings live in `chrome.storage.sync` under one key, `settings`. On first run after 2.x, its flat keys are read once and carried over (and left in place).
