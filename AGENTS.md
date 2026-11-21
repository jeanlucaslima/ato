# AGENTS.md

ATO (Advanced Tab Organizer) is a Manifest V3 Chrome extension: a keyboard-first popup for closing duplicate tabs safely and managing tabs, sites and windows. Vanilla TypeScript, Vite and Vitest, no UI framework; Chrome 157 or newer.

How it fits together: [docs/architecture.md](docs/architecture.md). Decisions and history: [docs/v3-status.md](docs/v3-status.md).

## Commands

```bash
npm run dev          # live gallery (/dev/screens.html): every fixture is a working popup, plus the settings page
npm test             # Vitest; DOM tests opt in with `// @vitest-environment happy-dom`
npx tsc --noEmit     # type check
npm run build        # icons + tsc + vite build → dist/, the unpacked dev copy ("ATO 3 (dev)", ⇧⌘U)
npm run build:store  # manifest as written ("ATO", ⌘U); `npm run zip` packages it
npm run perf         # timings of the pure paths at 500–5,000 tabs
```

After a change meant to be tried in Chrome, run `npm run build`: the dev copy is loaded from `dist/` and reloaded in `chrome://extensions`.

## Where things are

- `src/core/`: pure logic, no DOM or Chrome: duplicate planning and the safety rules, URL matching, search, settings, badge, tab-menu picks, the undo record.
- `src/ui/`: the popup (`update` state machine, `deriveModel`, render functions, `morph`), the settings page, and the Chrome adapters (`chrome-*.ts`).
- `src/background/worker.ts`: service worker: badge, tab right-click menu, every close and undo.
- `src/popup/`, `src/options/`: entry points. `src/dev/`: gallery fixtures, `FakeBrowser`, `MemorySettings`, perf harness.

## Rules

- Keep `core/` pure. Chrome-specific code stays in `ui/chrome-*.ts` and the worker.
- Every close goes through `closeTabs` (`ui/chrome-close.ts`) and every undo through `undoClose`; don't add another path.
- Anything that closes tabs gets a fast-check property beside the existing safety rules and a mutation check: remove the guard and watch the property fail. The rules are listed in [docs/architecture.md](docs/architecture.md#safety-rules).
- Rendering is a pure function of `PopupModel`. Text goes in as text nodes, never `innerHTML` with data. Motion is decorative: state never waits on an animation, and reduced motion turns it off.
- Every new popup state gets a gallery fixture in `src/dev/fixtures.ts`.
- Keep interactions under a frame at 2,000 tabs; run `npm run perf` after touching `derive`, `update` or the planner.
- Adding a setting: add it to `Settings`, `DEFAULT_SETTINGS` and `CHOICES` in `core/settings.ts`, give it a control in `ui/settings-page.ts`, and map it in `policyOf` if the planner needs it.
- No host permissions: `tabs` already exposes URLs, and favicons load as `<img>`. Justifications for each permission are in [docs/STORE_LISTING.md](docs/STORE_LISTING.md).
- Mockups and prototypes go in the repo, normally in the gallery.

## Commits and releases

- Small commits, one concern each, each passing `tsc` and the tests on its own. Check exit codes; a piped command can hide a failure.
- Conventional commits: `feat:`, `fix:`, `docs:`, `refactor:`, `test:`, `chore:`, `perf:`, `style:`.
- A release bumps the version in both `src/manifest.json` and `package.json`.
