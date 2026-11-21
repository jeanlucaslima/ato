# Contributing to ATO

Thanks for helping. ATO is a Chrome extension in vanilla TypeScript (Vite + Vitest, no UI framework); it needs Chrome 157 or newer.

## Setup

```bash
git clone https://github.com/jeanlucaslima/ato.git
cd ato
npm install
npm run build   # unpacked dev copy in dist/ ("ATO 3 (dev)", ⇧⌘U)
```

Load it: `chrome://extensions` → Developer mode → **Load unpacked** → `dist/`. After each rebuild, click the reload icon on the extension.

## Working on it

```bash
npm run dev        # live gallery: every popup state as a working popup, plus the settings page
npm test           # Vitest once
npm run test:watch # Vitest watching
npm run perf       # timings at 500–5,000 tabs
npm run zip        # store package
```

- Most work happens in the gallery (`npm run dev`): add a fixture in `src/dev/fixtures.ts` for any new state.
- Logic that decides what to close lives in `src/core/` and is tested with fast-check properties. If you touch it, keep the properties passing and add one for any new rule.
- Keep interactions under a frame at 2,000 tabs; run `npm run perf` after touching `derive`, `update` or the planner.
- One concern per commit, conventional commit messages (`feat:`, `fix:`, `docs:` …).

See [docs/architecture.md](docs/architecture.md) for how the pieces fit, and [CLAUDE.md](CLAUDE.md) for settings and conventions.
