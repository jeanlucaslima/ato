# ATO v3: status and decisions

_Last updated 2026-11-21._ This is the hand-off note for the `v3` branch: what was decided, how we work, what's built, and what's open. Read it with the v3 section of [CLAUDE.md](../CLAUDE.md) and [the Chrome features plan](v3-chrome-features-plan.md) before continuing.

## Decisions

- **Ground-up rewrite (2026-11-12).** v3 replaces the 2.x code instead of patching it (that was the alternative to fixing #48/#49 and adding #50 "Unload" in place). It lives on the `v3` branch off `main`, keeping history and assets. Older rewrite branches (`v4-rebuild`, `v6`, `origin/ato-v3-rewrite`) exist but weren't chosen.
- **Stack:** vanilla TypeScript, Vite + Vitest, no UI framework.
- **Verification: "low effort, high quality".** A pure core (tabs + settings → what to close or unload) with explicit safety rules, checked by fast-check property tests from day one. TLA+ and Dafny/Lean were considered and not chosen. The rules today:
  - never close the active tab of any window, or a tab playing audio;
  - every duplicate set keeps at least one tab;
  - only real duplicates are closed;
  - protected tabs (pinned, grouped, per settings) are never closed by bulk actions;
  - the tab right-click menu never closes the tab that was clicked, nor a protected one.
- **Minimum Chrome 157** (`minimum_chrome_version`): every API in the plan exists, no fallbacks or feature detection.
- **Two builds.** `npm run build` is the unpacked dev copy ("ATO 3 (dev)", version_name `-dev`, ⇧⌘U) so it can sit beside the installed store 2.x. `npm run build:store` / `npm run zip` keep the manifest as written ("ATO", ⌘U), because v3 will replace 2.x under the same store listing.
- **Release scope of v3.0 (decided 2026-11-20):** everything built so far, plus split-view protection (plan step 1), undo for any number of tabs (step 2), the duplicate-matching setting from 2.x, and carrying 2.x settings over. Grouping by registrable domain (`publicSuffix`, step 5) waits for a later release.
- **Chrome 158 (stable 2026-11-17)** adds nothing for extensions; the minimum stays 157.

## How we work

- **Small commits, one concern each**, every one passing `tsc` and the tests on its own, so changes can be rolled back individually. Check exit codes before committing: a piped `grep` once hid a failing `tsc`.
- **No claude.ai Artifacts.** Mockups and prototypes go in the repo as local HTML/CSS/TS, normally as screens or a section of the gallery (`npm run dev` → `/dev/screens.html`). Prototypes are removed once the real thing lands.
- **Keep the gallery working** with the in-memory fakes (`FakeBrowser`, `MemorySettings`) as features are added; every new state gets a fixture.
- **Anything that closes tabs** gets a fast-check property beside the existing safety rules, and a mutation check (remove the guard, see the property fail).
- **Performance:** run `npm run perf` after touching derive, update or the planner (see "Performance" in CLAUDE.md for the budgets and rules).

## What's built

- **Popup:** Tabs, Sites and Windows views (S cycles); search with `url:`, `title:` and `dupe:` chips (first 150 results drawn, actions cover all); Select mode; Now playing card with mute; undo toast; `?` shortcuts panel.
- **Duplicates:** review works like Sites: each set is a header (page, which copy stays, its own "Close N") with its copies under it as tab rows; small sets start open, big ones folded; ←→ fold, ↵ goes to a copy, Space flips keep/close, ⌫ on a header closes that set's extras. Stays open after Close and ends on "No duplicates left". ↓ from search visits the duplicates bar (↵ opens review) and Now playing before the list. ⌘D opens review, ⌘D again closes all; playing, current, pinned and grouped copies protected.
- **Windows view:** each window with a map of its tab strip (a dot per tab, tab groups bracketed in their colour, collapsed groups as a pill); opened, its tabs under their groups; Focus, Merge into this window (whole groups move as groups), Close, Unload.
- **Moving tabs:** a site's tabs, search results or a selection to a new window (M).
- **Settings page:** 10 themes (incl. Cyber), the 3D logo, pinned status, badge preview; changes reach an open popup immediately; `system` theme follows the OS.
- **Service worker** (`src/background/worker.ts`): toolbar badge (duplicates the popup would close, or all tabs, in the chosen colour, live) and the tab right-click menu (close duplicates of this tab, close other tabs from this site).
- **Permissions:** `tabs`, `storage`, `sessions`, `tabGroups`, `contextMenus`.

## Confirmed in a real Chrome

The `dist/` dev build is in daily use (confirmed 2026-11-20): popup, settings, badge, right-click menu, moving and merging windows. One known limit stays until plan step 2: undo after closing many tabs can stop part-way if Chrome closes the popup while restoring.

## Release status

Done for 3.0 (each with tests; the closing rules also with fast-check properties and mutation checks):
- split views are never broken: split tabs are kept by every close, and moving one half moves both;
- undo runs in the service worker, brings back any number of tabs (sessions for the last 25, the rest reopened in their window, position and group) and says how many came back without history;
- duplicate matching: whole URL, or ignoring `#hash`, `?query` or both;
- 2.x settings carried over on first run (`fromLegacy`), old keys left in place;
- README, CONTRIBUTING, CLAUDE.md, architecture, privacy policy and store listing rewritten for v3; new screenshots, and three 1280×800 store images.

Left, for the owner:
- try the new pieces in the dev build (split view protection, undo of 30+ tabs, the matching setting, a 2.x profile's settings showing up);
- merge `v3` into `main`, tag, `npm run zip`, upload `ato-v3.0.0.zip` and the store images;
- tabs closed from the right-click menu still come back only with Chrome's ⇧⌘T.

Later: `publicSuffix` grouping (plan step 5), the `browser.*` namespace, hold-⌥ ages, "by window" chips, drawing only visible rows past 5,000 tabs.
