# ATO - Advanced Tab Organizer

Kill duplicate tabs instantly. Stay focused.

<p align="center">
  <img src="docs/screenshots/popup.png" alt="ATO popup showing a wildcard search for hack* with matched text highlighted across the result list, above stats for tabs, duplicates, and domains" width="420">
</p>

## What It Does

- **Badge Counter** - Shows how many duplicate tabs you have
- **One-Click Cleanup** - Close all duplicates with one button
- **Playing Media** - Tabs producing sound are grouped in a section on top, and flagged with a speaker icon wherever they're listed
- **Search** - Filter tabs by title, URL, or domain with keyboard navigation. Three modes: fuzzy (default), exact whole-word (`"word"`), and wildcard substring (`word*`). Scope a search to a single field with `inurl:` or `intitle:` (shown as a chip, or pick from the field menu)
- **Domain Groups** - Tabs grouped by site, sortable A-Z / Most / Recent
- **Merge & Close per Domain** - Consolidate or clear all tabs from a site
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

Wildcard search (`hack*`) matching the literal substring across titles and URLs, with matches highlighted. Above it: the stats header (tabs / duplicates / domains), search bar with live result count, view toggle, and Undo. Search also supports fuzzy (default) and exact whole-word (`"word"`) modes, plus field scopes (`inurl:` / `intitle:`) to search a single field.

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
- Click **Close duplicates** to remove all duplicate tabs

## Development

```bash
# Watch mode (auto-rebuild on changes)
npm run dev

# Run tests
npm test

# Build for production
npm run build
```

After changes, click the refresh icon on `chrome://extensions` to reload.

## Project Structure

```
src/
├── manifest.json           # Extension configuration
├── background/
│   └── service-worker.js   # Tab monitoring, badge updates
├── popup/
│   ├── popup.html          # Popup UI
│   ├── popup.css           # Styles
│   └── popup.js            # Popup logic
├── shared/
│   ├── tab-utils.js        # Shared utility functions
│   └── tab-utils.test.js   # Tests
└── assets/icons/           # Extension icons
```

## License

MIT
