# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**ATO (Advanced Tab Organizer)** is a Manifest V3 Chrome Extension that helps manage duplicate and excess tabs through a lightweight popup interface. Built with **vanilla JavaScript** (no frameworks), it prioritizes simplicity, performance, and focused functionality.

**Key Principles:**
- **Duplicates First**: Primary feature is detecting and closing duplicate tabs
- **Popup Interface**: Quick keyboard access (`Cmd+U` / `Ctrl+U`)
- **Minimal**: Ship essentials first, enhance progressively
- **Vanilla JS**: Zero framework complexity, fast load times, small footprint
- **Real-Time Badge**: Always shows duplicate (or total tab) count
- **Configurable**: A full options page lets users tune detection, badge, appearance, and protection

## Project Structure

```
src/
├── manifest.json              # Manifest V3 configuration
├── background/
│   └── service-worker.js      # Tab monitoring, duplicate detection, badge updates
├── popup/
│   ├── popup.html             # Popup UI structure
│   ├── popup.css              # Popup styling
│   └── popup.js               # Popup logic (search, domain groups, actions)
├── options/
│   ├── options.html           # Settings page UI
│   ├── options.css            # Settings page styling
│   └── options.js             # Settings load/save via chrome.storage.sync
├── shared/
│   ├── tab-utils.js           # Pure tab/search/sort utilities (shared by both contexts)
│   ├── tab-utils.test.js      # Vitest tests for tab-utils
│   ├── font-config.js         # Font family map + applyFont()
│   ├── fonts.css              # @font-face declarations for bundled fonts
│   └── logger.js              # Debug-gated logger (log/error/initLogger)
└── assets/
    ├── icons/                 # Extension icons (16, 32, 48, 128) + logo source
    └── fonts/                 # Bundled variable fonts (.woff2)

scripts/
└── generate-icons.js          # Generates PNG icons from source via sharp

docs/
└── screenshots/               # README screenshots
```

## Development Workflow

### Build Process with Vite

```bash
# Install dependencies (first time only)
npm install

# Generate icon PNGs from source (runs automatically as part of build)
npm run icons

# Build extension to dist/
npm run build

# Watch mode (auto-rebuild on changes)
npm run dev

# Run tests
npm test            # vitest run (once)
npm run test:watch  # vitest watch mode

# Package a versioned zip of dist/ for the Chrome Web Store
npm run zip
```

**Development cycle:**
1. Edit files in `src/`
2. Rebuild: `npm run build` (or use `npm run dev` for watch mode)
3. Reload extension in `chrome://extensions` (click reload icon)
4. Test changes

Note: `npm run build` runs `npm run icons` first, so a fresh build regenerates icons via `sharp`.

### TypeScript Support

TypeScript is configured but optional:
- Current files are vanilla `.js`
- Future files can be `.ts` for type safety
- Vite handles compilation automatically
- Types available via `@types/chrome`

## Core Architecture

### Two-Context Model

Chrome extensions run in separate contexts:

1. **Background Service Worker** (`background/service-worker.js`)
   - Runs as an ES module (`"type": "module"` in manifest)
   - Listens to tab events via Chrome APIs (debounced, 300ms)
   - Detects duplicates by comparing normalized tab URLs
   - Updates badge text with duplicate count or total tab count
   - Restores tabs on `undoCloseTabs` messages from the popup
   - Reacts to settings changes via `chrome.storage.onChanged`
   - No DOM access, no UI rendering

2. **Popup** (`popup/popup.html` + `.js` + `.css`)
   - Opens on extension icon click or `Cmd+U` / `Ctrl+U`
   - Queries tabs, renders a "Playing Media" section (audible tabs), duplicates section + domain groups
   - Tabs producing sound (`tab.audible`) get a speaker icon wherever they're listed (media section, all tabs, domain groups, duplicates, search)
   - Fuzzy/exact/wildcard search with keyboard navigation and match highlighting
   - Per-domain merge/close, close-all-duplicates, undo
   - Separate instance each time the popup opens

3. **Options Page** (`options/options.html` + `.js` + `.css`)
   - Opened from the extension's options entry (`options_page` in manifest)
   - Loads/saves all settings to `chrome.storage.sync`
   - Saves each setting on change (no explicit save button)
   - Applies theme and font live

4. **Shared Utilities** (`shared/`)
   - `tab-utils.js`: pure functions used by both popup and service worker
   - `font-config.js`: `FONT_FAMILIES` map + `applyFont()`
   - `logger.js`: debug-gated logging
   - Pure functions are covered by `tab-utils.test.js` (Vitest)

**Communication:**
- Popup → background: `chrome.runtime.sendMessage()` (e.g. `{ action: 'undoCloseTabs', count }`)
- Settings propagation: the service worker and logger listen to `chrome.storage.onChanged` (sync area). This is the source of truth — settings changes apply automatically when storage updates.

## Key Implementation Details

### Settings (chrome.storage.sync)

All settings live in `chrome.storage.sync`. Defaults are declared in `options/options.js` (`DEFAULT_SETTINGS`); the service worker reads its subset with matching defaults.

| Key                | Type     | Default        | Used by            | Purpose |
| ------------------ | -------- | -------------- | ------------------ | ------- |
| `theme`            | select   | `dark`         | options            | UI theme (`data-theme` attribute) |
| `fontFamily`       | select   | `titillium`    | options, popup     | Font key from `FONT_FAMILIES` |
| `matchMode`        | select   | `exact`        | worker, popup      | URL normalization for duplicate detection |
| `keepTab`          | select   | `oldest`       | popup              | Which tab to keep when closing duplicates |
| `protectPinned`    | checkbox | `true`         | popup              | Never close pinned tabs |
| `protectGroups`    | checkbox | `false`        | popup              | Never close grouped tabs |
| `showBadge`        | checkbox | `true`         | worker             | Show/hide the toolbar badge |
| `badgeMode`        | select   | `duplicates`   | worker             | `duplicates` (count, hidden at 0) or `allTabs` (always shown) |
| `badgeColor`       | color    | `#DC2626`      | worker             | Badge background color |
| `advancedMode`     | checkbox | `false`        | options            | Reveals advanced settings section |
| `currentWindowOnly`| checkbox | `false`        | worker             | Scope detection to current window |
| `showMergeButton`  | checkbox | `false`        | popup              | Show per-domain merge action |
| `debugLogging`     | checkbox | `false`        | logger (all)       | Gate verbose `log()` output |

When adding a setting: add it to `DEFAULT_SETTINGS` and `SETTING_TYPES` in `options/options.js`, add a control with a matching `id` in `options.html`, and (if the worker needs it) add it to `loadSettings()` and the `onChanged` handler in `service-worker.js`.

### Shared Utilities (`shared/tab-utils.js`)

Exported pure functions (all JSDoc-documented and tested):

- `normalizeUrl(url, matchMode)` — normalizes per match mode: `exact`, `ignoreQuery`, `ignoreHash`, `ignoreQueryAndHash`
- `findDuplicates(tabs, matchMode)` — first occurrence is the original; later ones are duplicates. Skips empty/loading URLs
- `extractDomain(url)` — hostname or `null`
- `countDuplicatesByUrl(tabs, matchMode)` — `Map<url, count>`
- `groupTabsByDomain(tabs)` — `DomainGroup[]` sorted by count desc
- `formatTimeAgo(timestamp)` — `"2m"`, `"3h"`, `"5d"`, `"now"`, or `"—"`
- `sortTabs(tabs, sortBy, urlCounts, ageSortDirection)` — sort by `title`, `title-desc`, `domain`, `age`, `duplicates`, or `default`
- `parseSearchQuery(query)` — detects search mode: `"double quotes"` → exact (`{ term, exact: true }`); an unquoted query containing `*` → wildcard (`{ term, wildcard: true }`, with leading/trailing `*` stripped and internal `*` kept literal); otherwise fuzzy
- `fuzzyMatch(pattern, text)` / `exactWordMatch(pattern, text)` / `substringMatch(pattern, text)` — return `{ score, indices }` or `null`
- `searchTab(query, tab)` — dispatches fuzzy vs exact vs wildcard via `parseSearchQuery`; searches title, URL, domain
- `fuzzySearchTab(pattern, tab)` — fuzzy-only variant
- `highlightMatches(text, indices)` — wraps matched chars in `<span class="fuzzy-match">`; HTML-escapes the rest

### Duplicate Detection

**Location:** `shared/tab-utils.js` (`findDuplicates`), driven by `matchMode`.

- Skips empty URLs (tabs still loading)
- URLs are normalized per `matchMode` before comparison, so e.g. `ignoreQuery` treats `?a=1` variants as duplicates
- First occurrence = original, subsequent = duplicates
- The popup applies `keepTab`, `protectPinned`, and `protectGroups` when deciding what to actually close; the active tab is never closed

### Badge Updates

**Location:** `background/service-worker.js` (`updateBadge` / `scanAndUpdateBadge`).

- Respects `showBadge`, `badgeMode`, `badgeColor`, `currentWindowOnly`
- `duplicates` mode: shows duplicate count, hidden when 0
- `allTabs` mode: always shows total tab count
- Scans are debounced (`SCAN_DEBOUNCE_MS = 300`) to batch rapid tab events

### Tab Event Listeners

Monitored in `service-worker.js` (each triggers a debounced rescan):
- `chrome.tabs.onCreated`
- `chrome.tabs.onUpdated` (only when `changeInfo.url` changes)
- `chrome.tabs.onRemoved`
- `chrome.tabs.onReplaced`

### Logging

**Location:** `shared/logger.js`. Use `log(...)` for verbose output (gated by the `debugLogging` setting) and `error(...)` for errors (always logged). Call `initLogger()` once at startup; it loads the setting and subscribes to changes. Prefer these over raw `console.*` in extension code.

### Keyboard Shortcut

**Location:** `manifest.json`

```json
{
  "commands": {
    "_execute_action": {
      "suggested_key": { "default": "Ctrl+U", "mac": "Command+U" },
      "description": "Open ATO popup"
    }
  }
}
```

## Testing

### Automated Tests

```bash
npm test            # run once
npm run test:watch  # watch mode
```

Tests live in `src/shared/tab-utils.test.js` (Vitest). Keep them in sync with `tab-utils.js` — every exported function should have coverage.

### Manual Testing Checklist

1. **Badge Count Accuracy**
   - Open duplicate tabs (same URL); verify badge shows correct count
   - Toggle `badgeMode` between `duplicates` and `allTabs`; verify behavior
   - Toggle `showBadge` off; verify the badge clears

2. **Popup Functionality**
   - `Cmd+U` / `Ctrl+U` opens the popup
   - Duplicates section lists duplicates; "Close duplicates" closes them and badge updates
   - Search filters tabs (try fuzzy and `"exact"` quoted queries) with keyboard nav
   - Per-domain merge/close behave per `showMergeButton`, `protectPinned`, `protectGroups`
   - Undo restores recently closed tabs

3. **Settings**
   - Change settings in the options page; verify they persist and the badge/popup react live
   - Toggle `advancedMode`; verify advanced section visibility

4. **Edge Cases**
   - 0 duplicates (badge empty in `duplicates` mode)
   - Many tabs; tabs across multiple windows; `currentWindowOnly` scoping

## Common Development Tasks

### Adding a New Action to the Popup
1. Add a control to `popup.html`
2. Wire an event listener in `popup.js`
3. Use the Chrome API (e.g. `chrome.tabs.remove(tabId)`) or message the worker

### Adding a New Setting
See "Settings" above — touch `options.js` (`DEFAULT_SETTINGS` + `SETTING_TYPES`), `options.html`, and the worker if it consumes the value.

### Changing Duplicate / Search / Sort Logic
1. Edit the relevant function in `shared/tab-utils.js`
2. Update tests in `shared/tab-utils.test.js`
3. Run `npm test`, then reload the extension

### Adding a Font
1. Drop the `.woff2` in `assets/fonts/<Name>/`
2. Add an `@font-face` in `shared/fonts.css`
3. Add the key to `FONT_FAMILIES` in `shared/font-config.js`
4. Add the `<option>` to the font select in `options.html`

## Permissions

```json
{
  "permissions": ["tabs", "storage", "sessions"]
}
```

- `tabs` — read tab info (title, URL incl. `file://`, favicon) for all tabs
- `storage` — persist user settings (`chrome.storage.sync`)
- `sessions` — restore (undo) closed tabs

No host permissions: the `tabs` permission alone exposes tab URLs (verified to
include `file://`), and favicons load as `<img>` from `tab.favIconUrl`. This was
intentionally dropped (was `<all_urls>`) to avoid the Chrome Web Store
broad-host-permission in-depth review.

## Conventions

- When finishing a task, bump the version in **both** `manifest.json` and `package.json`, then commit
- Use conventional commits: `feat:`, `fix:`, `docs:`, `refactor:`, `test:`, `chore:`
- Keep functions pure where possible (especially in `shared/`)
- Add JSDoc comments to exported functions
- Use `log()` / `error()` from `logger.js` instead of raw `console.*`
</content>
</invoke>
