# ATO - Advanced Tab Organizer

Kill duplicate tabs instantly. Stay focused.

<p align="center">
  <img src="docs/screenshots/popup.png" alt="ATO popup showing a wildcard search for hack* with matched text highlighted across the result list, above stats for tabs, duplicates, and domains" width="420">
</p>

## What It Does

- **Badge Counter** - Shows how many duplicate tabs you have
- **One-Click Cleanup** - Close all duplicates with one button
- **Playing Media** - Tabs producing sound are grouped in a section on top, and flagged with a speaker icon wherever they're listed
- **Search** - Filter tabs by title, URL, or domain with keyboard navigation. Three modes: fuzzy (default), contains, and exact whole-word. Scope a search to a single field with `url:` or `title:`; `inurl:` and `intitle:` remain supported aliases.
- **Domain Groups** - Tabs grouped by site, sortable A-Z / Most / Recent
- **Move to Window & Close per Domain** - Move all tabs from a site to a new window or close them
- **Undo** - Restore tabs you just closed
- **Keyboard Shortcut** - `Cmd+U` (Mac) or `Ctrl+U` (Windows/Linux)
- **Real-Time Updates** - Badge updates automatically as you browse

## Demo

<video src="https://github.com/jeanlucaslima/ato/raw/main/docs/never-gonna-give-tabs-up.mp4" controls width="640"></video>

> If the player doesn't load, [watch the demo here](docs/never-gonna-give-tabs-up.mp4).

## Screenshots

<p align="center">
  <img src="docs/screenshots/popup.png" alt="Popup showing a wildcard search for hack* with matched text highlighted across the result list" width="420">
</p>

Wildcard search (`hack*`) matching the literal substring across titles and URLs, with matches highlighted. Above it: compact stats, search controls, result actions, and contextual Undo. Search also supports fuzzy (default), contains, exact whole-word, and field scopes (`url:` / `title:`) to search a single field.

## Installation

### 1. Clone and Build

```bash
git clone https://github.com/jeanlucaslima/ato.git
cd ato
npm install
npm run icons
npm run build
```

### 2. Load in Chrome

1. Open `chrome://extensions`
2. Enable **Developer mode** (toggle in top right)
3. Click **Load unpacked**
4. Select the `dist/` folder

### 3. Use It

- Press `Cmd+U` / `Ctrl+U` to open the popup
- Or click the ATO icon in your toolbar
- Click **Clean up** to remove duplicate tabs

## Development

```bash
# Watch mode (auto-rebuild on changes)
npm run dev

# Run tests
npm test

# Build for production
npm run build

# Optional real-Chromium popup/extension checks (requires agent-browser on PATH)
# Build first; runs in a disposable browser session, not your everyday Chrome profile
npm run test:popup
```

After changes, click the refresh icon on `chrome://extensions` to reload.

`npm test` covers pure queries, safe actions, browser event reconciliation, worker/badge integration, and popup navigation. Engine tests use a small fake Chrome adapter to exercise multiple windows, focus changes, stale responses, partial failures, and worker recovery without launching Chrome. The optional popup checks exercise actual Chrome mutations and keyboard/DOM behavior. Set `ATO_SCREENSHOT_DIR` to a directory to capture the representative popup states.

## Project Structure

```
src/
├── manifest.json             # Extension configuration
├── engine/
│   ├── browser.js            # Chrome boundary and recoverable snapshots
│   ├── queries.js            # URL matching, duplicates, search and sorting
│   ├── policy.js             # Scope, current-tab and protection rules
│   ├── actions.js            # Planning and live-validated, serialized mutations
│   └── undo.js               # Operation-specific session/URL restoration
├── background/
│   └── service-worker.js     # Engine command host and badge updates
├── popup/
│   ├── popup.html            # Existing popup UI
│   ├── popup.css             # Themes and styles
│   ├── popup.js              # Interaction, rendering and engine commands
│   ├── popup-state.js        # UI state, stable selections and engine selectors
│   └── popup-machine.js      # View/search transitions
├── options/                  # Settings UI and storage
├── shared/
│   ├── tab-utils.js          # Compatibility exports from engine queries
│   ├── font-config.js        # Bundled font selection
│   └── logger.js             # Debug-gated logging
└── assets/                   # Icons and fonts

scripts/test-popup.mjs        # Optional real-browser regression checks
```

## Architecture — Tab Engine 2.0

**Chrome owns the tabs. The engine owns tab rules and safe operations. The popup owns interaction.** The popup and service worker share duplicate matching, search, sorting, scope, and protection rules. The worker executes commands so closing the popup does not make it the owner of an in-progress operation.

Browser events keep lightweight snapshots current. Structural changes and focus changes resynchronize from Chrome; metadata changes read the affected tab. Old asynchronous responses cannot overwrite newer snapshots. Destructive actions never trust those display snapshots: they validate live tab identities, protection, and duplicate survivors before closing anything, and report actual successes, skips, and failures.

Cleanup now preserves the active tab in the **focused or last-focused window**, rather than whichever active tab happens to appear first across all windows. Current-tab, pinned/grouped protections, and existing Chrome/Edge internal-page exclusions take precedence over oldest/newest preferences. The badge and review show **raw duplicates**; cleanup controls distinguish how many are actually closable. If focus or URLs change during an operation, it may conservatively skip tabs rather than add new targets.

Keyboard navigation uses stable tab IDs and stays within search results; clearing search, rerendering, and removing the last result no longer leave the cursor targeting unrelated browse controls. Undo survives popup reopening and worker restart within the browser session. It restores identified Chrome sessions when available, otherwise explicitly reports tabs **reopened by URL**; it never restores unrelated recent closures by count.

No new dependencies or permissions are required. See [the engine architecture notes](docs/architecture.md) for command contracts, protection precedence, and Chrome API limitations.

## License

MIT
