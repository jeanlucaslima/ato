# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**ATO** is a Manifest V3 Chrome Extension that helps manage duplicate tabs through a lightweight popup interface. Built with **vanilla JavaScript** (no frameworks), it prioritizes simplicity, performance, and focused functionality.

**Key Principles:**
- **Duplicates First**: Primary feature is detecting and closing duplicate tabs
- **Popup Interface**: Quick keyboard access (`Cmd+U` / `Ctrl+U`)
- **Minimal**: Ship essentials first, enhance progressively
- **Vanilla JS**: Zero framework complexity, fast load times, small footprint
- **Real-Time Badge**: Always shows duplicate count

## Project Structure

```
src/
├── manifest.json              # Manifest V3 configuration
├── background/
│   └── service-worker.js      # Tab monitoring, duplicate detection, badge updates
├── popup/
│   ├── popup.html             # Popup UI structure
│   ├── popup.css              # Styling
│   └── popup.js               # Popup logic
├── shared/
│   ├── tab-utils.js           # Shared utility functions
│   └── tab-utils.test.js      # Tests
└── assets/
    └── icons/                 # Extension icons (16, 32, 48, 128)
```

## Development Workflow

### Build Process with Vite

```bash
# Install dependencies (first time only)
npm install

# Generate icon files (first time only)
npm run icons

# Build extension to dist/
npm run build

# Watch mode (auto-rebuild on changes)
npm run dev

# Run tests
npm test
```

**Development cycle:**
1. Edit files in `src/`
2. Rebuild: `npm run build` (or use `npm run dev` for watch mode)
3. Reload extension in `chrome://extensions` (click reload icon)
4. Test changes

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
   - Runs independently in background
   - Listens to tab events via Chrome APIs
   - Detects duplicates by comparing tab URLs
   - Updates badge text with duplicate count
   - No DOM access, no UI rendering

2. **Popup** (`popup/popup.html` + `.js` + `.css`)
   - Opens when user clicks extension icon or uses `Cmd+U` / `Ctrl+U`
   - Queries tabs from Chrome API
   - Displays duplicate tabs in UI
   - Handles user actions (close duplicates, etc.)
   - Separate instance each time popup opens

3. **Shared Utilities** (`shared/tab-utils.js`)
   - Pure functions used by both contexts
   - `findDuplicates()`, `extractDomain()`, `sortTabs()`, etc.
   - Fully tested with Vitest

**Communication:** Use `chrome.runtime.sendMessage()` and `chrome.runtime.onMessage` to pass data between contexts.

## Key Implementation Details

### Duplicate Detection Logic

**Location:** `shared/tab-utils.js`

```javascript
function findDuplicates(tabs) {
  const urlMap = new Map();
  const duplicates = [];

  tabs.forEach(tab => {
    if (isInternalUrl(tab.url)) return;

    if (urlMap.has(tab.url)) {
      duplicates.push(tab);
    } else {
      urlMap.set(tab.url, tab);
    }
  });

  return duplicates;
}
```

**Behavior:**
- Skips `chrome://` and `edge://` internal pages
- First occurrence = original, subsequent = duplicates
- Active tab is never closed

### Badge Updates

**Location:** `background/service-worker.js`

```javascript
function updateBadge(count) {
  if (count > 0) {
    chrome.action.setBadgeText({ text: String(count) });
    chrome.action.setBadgeBackgroundColor({ color: '#DC2626' });
  } else {
    chrome.action.setBadgeText({ text: '' });
  }
}
```

### Tab Event Listeners

Monitor these events in `service-worker.js`:
- `chrome.tabs.onCreated`
- `chrome.tabs.onUpdated`
- `chrome.tabs.onRemoved`
- `chrome.tabs.onReplaced`

### Keyboard Shortcut

**Location:** `manifest.json`

```json
{
  "commands": {
    "_execute_action": {
      "suggested_key": {
        "default": "Ctrl+U",
        "mac": "Command+U"
      },
      "description": "Open ATO popup"
    }
  }
}
```

## Testing

### Automated Tests

```bash
npm test           # Run once
npm run test:watch # Watch mode
```

Tests are in `src/shared/tab-utils.test.js` using Vitest.

### Manual Testing Checklist

1. **Badge Count Accuracy**
   - Open several duplicate tabs (same URL)
   - Verify badge shows correct count
   - Close duplicates manually, verify count decreases

2. **Popup Functionality**
   - Press `Cmd+U` / `Ctrl+U` - popup should open
   - Popup should list duplicate tabs
   - "Close All Duplicates" should close them
   - Badge should update to 0

3. **Edge Cases**
   - Test with 0 duplicates (badge should be empty)
   - Test with many tabs
   - Test with tabs from different windows

## Common Development Tasks

### Adding a New Action to Popup

1. Add button to `popup.html`
2. Add event listener in `popup.js`
3. Use Chrome API (e.g., `chrome.tabs.remove(tabId)`)

### Changing Duplicate Logic

1. Edit functions in `shared/tab-utils.js`
2. Update tests in `shared/tab-utils.test.js`
3. Run `npm test` to verify
4. Reload extension

### Styling Changes

1. Edit `popup.css`
2. Reload extension
3. Reopen popup to see changes

## Permissions

```json
{
  "permissions": [
    "tabs",      // Read tab info (title, URL, etc.)
    "storage",   // Save user preferences
    "sessions"   // Undo closed tabs
  ],
  "host_permissions": [
    "<all_urls>" // Required to access tab URLs and favicons
  ]
}
```

## Conventions

- When finishing a task, bump the version in `manifest.json` and commit
- Use conventional commits: `feat:`, `fix:`, `docs:`, `refactor:`, `test:`, `chore:`
- Keep functions pure where possible
- Add JSDoc comments to exported functions
