# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

**ATO (Advanced Tab Organizer)** is a Manifest V3 Chrome extension: a keyboard-first popup for closing duplicate tabs safely and managing tabs, sites and windows. Version 3 is a ground-up rewrite in **vanilla TypeScript** (Vite + Vitest, no UI framework). History and decisions: [docs/v3-status.md](docs/v3-status.md); structure and safety rules: [docs/architecture.md](docs/architecture.md).

```
src/
├── manifest.json        # popup → popup/index.html, options → options/index.html, worker → background/worker.js
├── background/worker.ts # MV3 service worker: toolbar badge (core/badge.ts) on tab events + settings changes;
│                        # tab right-click menu (core/tab-menu.ts); undo (ui/chrome-restore.ts, asked by the popup)
├── core/                # Pure logic, no DOM/Chrome: types, tabs (domain/age, duplicateKey + match modes), duplicates
│                        # (keep/close planner + safety rules), search, settings (defaults, safe read, 2.x import).
│                        # fast-check property tests live beside them.
├── ui/
│   ├── state.ts         # UiState (view, query, expanded sites, selection, review choices, toast…)
│   ├── derive.ts        # Snapshot + UiState → PopupModel
│   ├── model.ts         # PopupModel: the render contract
│   ├── actions.ts       # Action (intent/browser news) and Effect (browser work) unions
│   ├── update.ts        # update(state, action) → [state, effects]; pure state machine
│   ├── app.ts           # runtime: DOM events → actions, effects → BrowserPort, morph re-render
│   ├── browser.ts       # BrowserPort interface; chrome-browser.ts implements it over chrome.*
│   ├── settings-store.ts # SettingsStore interface; chrome-settings.ts = chrome.storage.sync (key "settings")
│   ├── settings-page.ts # options page render + mount (saves each change); settings.css; theme.ts
│   ├── morph.ts         # keyed in-place DOM patching (keeps focus, transitions, scroll)
│   ├── popup.ts chrome.ts rows.ts review.ts windows.ts   # render functions (PopupModel → DOM, data-action attrs)
│   └── tokens.css popup.css                    # tokens + components + motion section
├── popup/               # extension popup entry: loads settings, mounts the app over ChromeBrowser
├── options/             # extension options page entry (settings page over ChromeSettings)
└── dev/                 # live screen gallery: fixtures over an in-memory FakeBrowser + the settings page
                         # over MemorySettings (its theme drives the gallery theme)
```

- `npm run dev` → Vite dev server, opens `/dev/screens.html`: every fixture is a live popup (click, type, keyboard; Reset per frame).
- `npm run build` → icons + `tsc --noEmit` + `vite build` to `dist/`, as the **unpacked dev copy** (name "ATO 3 (dev)", version_name `-dev`, ⇧⌘U) so it can sit beside the installed store build. Rebuild after every change the user will try, and say so: they load `dist/` and reload it in `chrome://extensions`. `npm run build:store` (used by `npm run zip`) keeps `src/manifest.json` as written ("ATO", ⌘U). Chrome 157 is the minimum (`minimum_chrome_version`). `npm test` runs Vitest (DOM tests opt in with `// @vitest-environment happy-dom`).
- Flow: event → `Action` → `update` → new state (+ `Effect`s run by `app.ts` against `BrowserPort`) → `deriveModel` → `renderPopup` → `morph`.
- UI rules: rendering is a pure function of `PopupModel`; text goes in as text nodes (never `innerHTML` with data); motion is decorative only (state never waits on an animation; reduced-motion disables it).
- Commits: keep them small and focused (one concern each) so they can be rolled back individually.
- Performance: `npm run perf` times the pure paths at 500–5,000 tabs (`src/dev/perf.ts`; also importable in Chrome via the dev server to time render). Keep interactions under a frame at 2,000 tabs: morph skips unchanged keyed elements, hover/↑↓ patch two rows (`app.ts` fast path), search draws 150 results, list items use `content-visibility`.
- Verification: the safety rules are fast-check properties: `core/duplicates.test.ts` (never close an active, playing or split-view tab; every set keeps ≥1; only real duplicates under the chosen matching; protected tabs untouched), `core/tab-menu.test.ts`, `ui/update.test.ts` (review and per-set close, whatever the user flips), `ui/chrome-restore.test.ts` (undo brings each tab back exactly once). Anything new that closes tabs gets a property and a mutation check (remove the guard, see it fail).

## Settings (`chrome.storage.sync`, key `settings`)

Defined in `core/settings.ts` (`Settings`, `DEFAULT_SETTINGS`, `CHOICES`); `readSettings` validates anything stored, field by field.

| Key | Values (default first) | Used by |
| --- | --- | --- |
| `keep` | `oldest`, `newest` | planner: which unprotected copy stays |
| `match` | `exact`, `ignoreHash`, `ignoreQuery`, `ignoreBoth` | `duplicateKey`: what counts as the same page |
| `protectPinned` | `true` | planner, bulk closes |
| `protectGroups` | `true` | planner, bulk closes |
| `view` | `tabs`, `sites`, `windows` | where the popup opens |
| `scope` | `all`, `current` | which windows the popup starts on (search always covers all) |
| `theme` | `graphite` … 9 themes, or `system` | popup, settings page |
| `badge` | `duplicates`, `all`, `off` | worker |
| `badgeColor` | `#dc2626` … (`BADGE_COLORS`) | worker |

Adding a setting: add it to `Settings`, `DEFAULT_SETTINGS` and `CHOICES` (or the toggles), give it a control in `ui/settings-page.ts`, and map it in `policyOf` if the planner needs it. Settings saved by 2.x (flat keys) are carried over once by `fromLegacy` (`ui/chrome-settings.ts`).

## Permissions

`tabs`, `storage`, `sessions`, `tabGroups`, `contextMenus`. No host permissions: `tabs` alone exposes URLs (including `file://`), and favicons load as `<img>` from `tab.favIconUrl`; this avoids the store's broad-host-permission review. Justifications are in [docs/STORE_LISTING.md](docs/STORE_LISTING.md).

## Conventions

- Small commits, one concern each, every one passing `tsc` and the tests on its own. Check exit codes before committing.
- Conventional commits: `feat:`, `fix:`, `docs:`, `refactor:`, `test:`, `chore:`, `perf:`, `style:`.
- Keep `core/` pure; anything Chrome-specific stays in `ui/chrome-*.ts` and the worker.
- Every new popup state gets a gallery fixture (`dev/fixtures.ts`).
- Releases: bump the version in **both** `src/manifest.json` and `package.json`.
- No claude.ai Artifacts for design work: mockups go in the repo (the gallery).
