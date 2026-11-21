# ATO 3 architecture

Vanilla TypeScript, Vite and Vitest; no UI framework. Chrome owns the tabs; a pure core decides what may be closed; the popup is a state machine whose rendering is a pure function of a model.

## Layers

- **`core/`**: pure logic, no DOM, no Chrome. Types (`Tab`, `Snapshot`), duplicate planning and the safety rules (`duplicates.ts`), URL matching (`tabs.ts`), search, settings (defaults, validation, 2.x import), the badge, the tab-menu picks.
- **`ui/`**: the popup.
  - `update(state, action) → [state, effects]` is the whole behaviour, pure.
  - `deriveModel` turns browser snapshot + UI state into a `PopupModel`; `renderPopup` draws it; `morph` patches the DOM in place (keyed, keeps focus and scroll).
  - `app.ts` turns DOM events into actions and runs effects against a `BrowserPort`: `ChromeBrowser` in the extension, `FakeBrowser` in the gallery and tests.
- **`background/worker.ts`**: the MV3 service worker. Toolbar badge, tab right-click menu, and undo (restoring runs here so it finishes if the popup closes).

## Safety rules

Checked as fast-check properties (`core/duplicates.test.ts`, `core/tab-menu.test.ts`, `ui/update.test.ts`, `ui/chrome-restore.test.ts`), each with a mutation check (remove the guard, watch the property fail):

1. The active tab of any window is never closed by cleanup.
2. A tab playing audio is never closed.
3. A tab in a split view is never closed; moving one half moves both.
4. Every duplicate set keeps at least one tab, whatever the user flips in review.
5. Only real duplicates (same key under the chosen matching) are closed.
6. Protected tabs (pinned, grouped, per settings) are never closed by bulk actions.
7. The tab menu never closes the tab that was right-clicked.
8. Undo brings every closed tab back exactly once: through `sessions` while Chrome remembers it (the last 25), otherwise reopened by URL in its window, position and group.

## Chrome

Minimum Chrome 157 (`minimum_chrome_version`), so no feature detection: `splitViewId` (140), the `"tab"` context menu (150), `runtime.onExtensionLoaded` (157). Permissions: `tabs`, `storage`, `sessions`, `tabGroups`, `contextMenus`; no host permissions.

Settings live in `chrome.storage.sync` under one key, `settings`. On first run after 2.x, its flat keys are read once and carried over (and left in place).
