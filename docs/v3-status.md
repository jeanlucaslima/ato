# ATO v3: status and decisions

_Last updated 2026-11-20._ This is the hand-off note for the `v3` branch: what was decided, how we work, what's built, and what's open. Read it with the v3 section of [CLAUDE.md](../CLAUDE.md) and [the Chrome features plan](v3-chrome-features-plan.md) before continuing.

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
- **Release scope of v3.0: not decided.** Ask before treating anything as "the release". Proposed (not agreed): everything built so far plus plan steps 1 and 2; steps 4–5 and the ⌥ age idea later.

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

## Deferred and open

- **Plan steps 1, 2 and 5** are deferred "for the future" (see [the plan](v3-chrome-features-plan.md)). Until 1 and 2 land:
  - moving or merging tabs can split a side-by-side (split view) pair;
  - tabs closed from the right-click menu only come back with Chrome's ⇧⌘T (no ATO undo there).
- **`browser.*` namespace** for the Chrome port (plan step 3 detail): not done.
- **Ideas, undecided:** hold ⌥ to show every row's last-used age and window; a loose performance check in `npm test`; "by window" chips to replace the All/This window switch.
- **5,000+ tabs:** opening the popup, opening a window and closing all duplicates take ~80–120 ms. The next step would be drawing only the rows in view; only worth it if that size is a real case.
- **Before publishing:** store listing and screenshots for v3; settings saved by 2.x (flat keys) are ignored by v3, which starts from its own defaults under the `settings` key: decide whether to migrate.
