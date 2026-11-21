# ATO v3: status and decisions

_Last updated 2026-11-21 (3.0.1)._ This is the hand-off note for the `v3` branch: what was decided, how we work, what's built, and what's open. Read it with the v3 section of [CLAUDE.md](../CLAUDE.md) and [the Chrome features plan](v3-chrome-features-plan.md) before continuing.

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
- **Service worker** (`src/background/worker.ts`): toolbar badge (duplicates the popup would close, or all tabs, in the chosen colour, live), the tab right-click menu (close duplicates of this tab, close other tabs from this site), and every close and undo (one path for popup and menu, see [architecture](architecture.md)).
- **Permissions:** `tabs`, `storage`, `sessions`, `tabGroups`, `contextMenus`.

## Confirmed in a real Chrome

The `dist/` dev build is in daily use (confirmed 2026-11-20): popup, settings, badge, right-click menu, moving and merging windows. One known limit stays until plan step 2: undo after closing many tabs can stop part-way if Chrome closes the popup while restoring.

## 3.0.1: correctness and reliability

Branch `fix/3.0.1`, from an external review of 3.0.0 (findings, decisions and checks in [3.0.1-plan.md](3.0.1-plan.md)). Every close path changed here has a fast-check property and a mutation check, recorded in its commit.

Fixed:
- **Recheck before closing.** Bulk closes check protection again on Chrome's current state right before removing, so a tab that became current, started playing or joined a split view during the 180 ms animation stays. Toast and undo list only what really closed.
- **Close failures.** If Chrome refuses a close, no row stays mid-animation; the toast says so, tabs that did close keep their undo. Every other browser action toasts on failure too.
- **Undo restores each tab's own history.** Each closed tab is matched to its own `sessions` entry (URL, index at close, removal order, only entries from the close on), checked against what Chrome 158 records; restored last-closed first so positions come back exact.
- **Windows "Close N"** counts only what it will close, says protected tabs stay, and is hidden when nothing would close.
- **Quoted search** matches whole words, as the README always said (`"cat"` no longer finds "catalog"); highlights follow.
- **Privacy wording:** no analytics, tracking or backend; tabs never leave the browser; favicons are loaded by the browser from the addresses Chrome provides.
- **Navigation:** `deriveModel` is memoized per state (↓ derived up to three times). Measurements below.
- **Right-click closes get ATO's undo.** Popup and menu share one close path in the worker (recheck → remove → last-close record); the popup offers a menu close's undo for a minute after it.

Rejected:
- **"`ignoreHash` and `ignoreQuery` are swapped."** They aren't: `duplicateKey` reads "every mode but ignoreQuery clears the hash; every mode but ignoreHash clears the query", which is right, and `tabs.test.ts` pinned it. The suggested fix would have introduced the bug. 3.0.1 adds a comment and fast-check properties (with a mutation check: swapping the conditions fails them) instead of a change.

Left for 3.1: the render-path proposals below (frames over 16 ms when typing at 2,000 tabs).

## 3.0.1 measurements

Measured 2026-11-21 on Chrome 158 (macOS), the dev server's gallery in `?big=N` mode (one live popup over `perf.ts`'s generated tabs; unbundled dev modules, so a little slower than `dist/`), driven through the chrome-devtools MCP. "JS" is the synchronous handler (update, render, morph); "frame" adds the rendering work of the next frame (rAF to after paint). ↓: 60 presses (2 s held at ~30/s). Typing: `site1`, one key at a time.

| | 2,000 tabs, 1× | 2,000 tabs, 4× CPU | 5,000 tabs, 4× CPU |
| - | - | - | - |
| ↓ JS, median / p95 / max (ms) | 3.4 / 4.5 / 6.3 | 15.3 / 19.6 / 29.6 | 38.6 / 46.2 / 82.8 |
| ↓ frame, median / p95 / max (ms) | 7.6 / 11 / 21.4 | 67 / 83 / 88 | 92 / 110 / 144 |
| typing JS, median / max (ms) | 21.4 / 30.3 | 83 / 144 | 171 / 300 |
| typing frame, median / max (ms) | 28.4 / 39.3 | 116 / 196 | 182 / 349 |

Unthrottled at 2,000 tabs ↓ stays inside a frame (p95 11 ms), but typing doesn't: 28 ms median, and every throttled case is over 16 ms. Per the 3.0.1 plan this is recorded with its hot path and a proposal, not changed in 3.0.1.

Where a keystroke goes (typing `site` → `site1`, timed in the page with the app's own modules; ms, 1× / 4×): at 2,000 tabs update 7.6 / 32 (it derives twice: the query, then the state with the first result as cursor), renderPopup 2.9 / 12, morph 3.0 / 13, layout 1.9 / 8; at 5,000 update 17.9 / 80, the rest the same (search draws 150 rows). For ↓ the JS is small after memoization, but the tabs view at 2,000 tabs is 2,000 rows (~23,000 elements), and the next frame's style and paint cost 4 ms at 1× and ~50 ms at 4×.

`npm run perf` (Node, pure paths, before → after memoizing `deriveModel` per state): ↓ cursor + model for render 5.47 → 1.79 ms at 2,000 tabs, 13.9 → 4.60 at 5,000; typing + model for render 10.8 → 5.78 and 22.7 → 14.5.

**Chrome traces** (performance traces recorded through the chrome-devtools MCP at 4× CPU, ↓ held for 2 s at ~30/s and typing `site1` 150 ms apart; main-thread work per keystroke = the task that handled the key plus the style, layout, paint and commit work before the next key; ms):

| | keys | JS median / p95 / max | frame work median / p95 / max | longest task median |
| - | - | - | - | - |
| ↓, 2,000 tabs | 16 | 26 / 442 / 442 | 138 / 508 / 508 | 63 |
| typing, 2,000 tabs | 5 | 123 / 586 / 586 | 211 / 725 / 725 | 131 |
| ↓, 5,000 tabs | 10 | 44 / 974 / 974 | 230 / 1,086 / 1,086 | 125 |
| typing, 5,000 tabs | 5 | 182 / 1,383 / 1,383 | 255 / 1,493 / 1,493 | 182 |

Throttled, the main thread falls behind ↓'s key repeat (16 and 10 keys handled in 2 s, not 60). The max is the first key (a full render). **Hot path** (CPU profile self time inside the key tasks): `set innerHTML` comes first in all four traces (272 / 374 / 634 / 735 ms). It is `ui/icons.ts:67`: every icon of every row drawn parses its SVG markup again. Then `URL` parsing (74 to 217 ms, from `domainOf` on every tab in every derive), `removeChild`/`appendChild` and morph's `syncChildren`/`syncAttributes` (search swapping its 150 rows), and `scrollIntoView`. On ↓, `IntersectionObserverController::computeIntersections` (5–6.5 s across each trace, the `content-visibility: auto` bookkeeping for 2,000–5,000 rows) and paint dominate the frame side. The trace files are local only (`.perf-traces/`, excluded from git).

Proposed for 3.1, in order of payoff (not done):
0. **Parse each icon once.** Keep one parsed `<svg>` per icon and `cloneNode(true)` it, instead of setting `innerHTML` for every icon of every row on every render: the largest single cost in every trace.
1. **Cursor-only states share the model.** The model depends on the cursor only through its top-level `cursor` field, so a state that differs from a derived one only in `ui.cursor` can reuse that model with the cursor swapped. Typing then derives once, ↓ not at all.
2. **Search derives only what it shows.** `deriveModel` builds a row for every tab and the whole duplicate plan on each keystroke, then search keeps 150; build rows only for the results drawn, and cache `domainOf` per URL (`URL` parsing is second in the traces).
3. **Draw only the visible part of long lists.** Search already stops at 150; the tabs, sites and windows lists draw every row (`content-visibility` skips layout and paint off screen, not style or DOM size). This is the "drawing only visible rows past 5,000 tabs" item, now with numbers showing it matters from 2,000 on a slow machine.

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

Later: `publicSuffix` grouping (plan step 5), the `browser.*` namespace, hold-⌥ ages, "by window" chips, drawing only visible rows past 5,000 tabs.
