# v3: adopting new Chrome features

_Decided 2026-11-15. The research behind this plan is in [chrome-150-plus-features.md](chrome-150-plus-features.md)._

This plan covers the Chrome 140–157 features ATO will use, the order to build them in, and what each one needs.
- Each step is one or more small commits, and every commit passes `tsc` and the tests.
- Anything that touches closing tabs gets a fast-check property test alongside the existing safety rules.

Already done, so not part of this plan:
- **Discarded tabs are marked.** `derive.ts` turns `unloaded` into an "Unloaded" label and an `is-asleep` style in `rows.ts`.

## Minimum Chrome version

| Feature | Needs Chrome |
|---|---|
| Reading `splitViewId` | 140 |
| `browser.*` namespace | 148 |
| `"tab"` context menu | 150 |
| `publicSuffix` | 153 |
| `runtime.onExtensionLoaded` | 157 |

**Decided: Chrome 157 is the minimum** (`"minimum_chrome_version": "157"` in the manifest).
- Chrome 157 has been stable since 2026-11-03, and it's what we develop and test on.
- Every API in this plan is guaranteed to exist, so the code needs no feature detection or fallbacks for older Chrome.
- Chrome won't install ATO on older versions. With the two-week release cycle, that window closes quickly.

---

## 1. Never break a split view

**Why:** closing duplicates, or moving tabs to a new window, can close or separate one half of a side-by-side pair and silently break the user's layout. ATO already protects the current tab, pinned tabs and grouped tabs; split tabs need the same protection.

**Changes**
- `core/types.ts`: add `splitViewId: number` to `Tab` (−1 when the tab isn't split).
- `core/duplicates.ts`:
  - `protection()` returns `'split'` when `splitViewId !== -1`.
  - Add `'split'` to `KeepReason`.
  - Add a `protectSplit` field to `DuplicatePolicy`, defaulting to `true` like `protectPinned`.
- UI:
  - The review screen and rows show a "Split view" keep reason, like "Pinned".
  - `ui/update.ts`: the review can't flip split tabs to "close", the same way it handles active and pinned tabs.
- `dev/fixtures.ts`: add a fixture with a split pair that contains a duplicate.
- `moveToNewWindow`:
  - Don't move one half of a split on its own. Either move the whole pair or skip the split tab.
  - Before choosing, test in Chrome what happens when only one split tab is moved, because the docs don't say.

**Tests**
- Property: no duplicate set ever closes a tab with `splitViewId !== -1` while `protectSplit` is on.
- `update.test.ts`: whatever the user flips in review, split tabs aren't closed.

**Permissions:** none.

## 2. Undo for any number of tabs

**Why:** `chrome.sessions` only remembers the 25 most recently closed tabs and windows. If you close 40 duplicates, `sessions.restore` alone can't bring all of them back.

**How undo works**
- **Before closing:** save each tab's `url`, `title`, `windowId`, `index`, `groupId` and `pinned`. The `Tab` values the `restore` effect already carries hold most of this.
- **When undoing:**
  - Use `sessions.restore` for the closed tabs it can still find (at most 25). They come back exactly as they were, including back/forward history.
  - Reopen the rest with `tabs.create({ url, index, windowId, pinned })` and `tabs.group()` back into their original group if it still exists. These come back without history.
  - If a window is gone, reopen its tabs in the focused window.
- **Where the record is stored:**
  - In the popup's memory while the popup is open.
  - In `chrome.storage.session` once a service worker exists, so undo still works after the popup closes. It is cleared when the browser quits. No new permission is needed.
- **UI:** when some tabs came back without history, the undo toast says so, for example "Restored 40 tabs (15 without back history)".

**Change to the safety rule:** "Undo restores exactly what was closed" becomes "undo reopens every closed tab, in its original window, position, group and pinned state where those still exist."

**Tests**
- Property: for any close of N tabs, undo produces N reopened tabs with matching URLs.
- Property: tabs restored through `sessions` are never also reopened by URL, so nothing is reopened twice.
- `FakeBrowser.restore` simulates the 25-tab limit.

**Permissions:** none (`sessions` and `storage` are already declared).

## 3. Service worker host

This is groundwork for steps 4 and 5. It is not a feature by itself.

**Changes**
- `src/background/worker.ts` as the MV3 service worker. Add `"background": { "service_worker": …, "type": "module" }` to the manifest.
- The Chrome `BrowserPort` implementation is written against `browser.*` (Chrome 148+). This keeps Firefox possible without promising it, since Firefox handles sessions and discarding differently.
- **Badge** (duplicate count), computed with the same `core/duplicates` planner the popup uses.
- Set `"minimum_chrome_version": "157"` in the manifest.
- **When the badge is recomputed:**
  - when the extension loads, via `runtime.onExtensionLoaded`. It covers install, update, browser update, enable, startup and reload, so `onInstalled` and `onStartup` aren't needed;
  - on tab events (created, updated URL, removed, replaced), debounced.

**Permissions:** none new.

## 4. Tab right-click menu items

**Why:** the user can clean up from the tab strip without opening the popup.

**Items** (Chrome 150+, `"tab"` context):
- **Close duplicates of this tab:** runs the duplicate planner for just that URL, so all the protections apply.
- **Close other tabs from this site:** reuses the per-site close, with the same protections.

**Notes**
- `"all"` doesn't include `"tab"`, so list it explicitly. `documentUrlPatterns` doesn't work for this context.
- Assume the handler only gets the right-clicked tab, even when several are selected. The sources disagree, so test it.
- Items are created in the worker's `onExtensionLoaded` handler. Call `contextMenus.removeAll()` first so a reload doesn't register them twice.
- Each item's action goes through the same pure planner as the popup, plus an undo record (step 2).

**Permissions:** adds `contextMenus`. It shows no install warning.

## 5. Grouping by site at two levels (`publicSuffix`)

**Why:** `domainOf()` only strips `www.`, so `mail.google.com` and `docs.google.com` are separate groups. That's right for apps, but it splits one site into many. `publicSuffix.getDomain()` (Chrome 153+) gives the registrable domain correctly, including `co.uk` and similar.

**Design**
- Keep subdomain groups as they are, and add the registrable domain as a parent: **google.com → mail, docs, drive**.
- If a domain has only one subdomain, don't show the extra level.
- The core stays pure: `core/tabs.ts` receives a `siteOf(hostname) => string` function.
  - In the extension, that function wraps `publicSuffix.getDomain(host, { encoding: 'display' })`.
  - In tests and the gallery, it uses a small fixed table of suffixes.
- The permission is required, so the API is always there; no fallback is needed.

**To check first:** whether the `publicSuffix` permission shows an install warning. If it does, reconsider this step before shipping.

**Permissions:** adds `publicSuffix`.

---

## Order

| # | Step | Depends on | New permission |
|---|---|---|---|
| 1 | Never break a split view | — | — |
| 2 | Undo for any number of tabs | — (simplest version in the popup first) | — |
| 3 | Service worker and badge | — | — |
| 4 | Tab right-click menu | 3, 2 | `contextMenus` |
| 5 | Two-level grouping by site | — | `publicSuffix` |

## Not adopting (yet)

- **Split-view actions** (`tabs.createSplit`, "open side by side"): this would be a new feature. Revisit after the first release.
- **Focusgroup** (Chrome 150): ATO's own keyboard table is already tested, and switching would cost more than it saves.
- **To watch:** Chrome's "Notebooks/Organizer" tab-group panel (test builds only). It is the closest future competitor to grouping by site.
