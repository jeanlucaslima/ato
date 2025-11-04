# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Branch: v4-rebuild

**Complete reimagining of ATO** focused on duplicate tab management with a minimal, popup-based approach.

### v4 Project Overview

**ATO v4** is a Manifest V3 Chrome Extension that helps manage duplicate tabs through a lightweight popup interface. Built with **vanilla JavaScript** (no frameworks), it prioritizes simplicity, performance, and focused functionality.

**Key Principles:**
- **Duplicates First**: Primary feature is detecting and closing duplicate tabs
- **Popup Interface**: Quick keyboard access (`Cmd+U` / `Ctrl+U`), not a sidebar
- **Minimal Start**: Ship essentials first, enhance progressively
- **Vanilla JS**: Zero build complexity, fast load times, small footprint
- **Real-Time Badge**: Always shows duplicate count

## Current Development Phase

**Phase 1: MVP**

Building the minimum viable product with these features:
1. Badge showing real-time duplicate count
2. Background service worker monitoring tabs
3. Simple popup listing duplicates
4. "Close All Duplicates" action
5. Keyboard shortcut activation

**See `V4_GOALS.md` for complete roadmap.**

## Project Structure

```
src/
├── manifest.json              # Manifest V3 configuration
├── background/
│   └── service-worker.js     # Tab monitoring, duplicate detection, badge updates
├── popup/
│   ├── popup.html            # Popup UI structure
│   ├── popup.css             # Minimal styling
│   └── popup.js              # Popup logic (display duplicates, handle actions)
└── assets/
    └── icons/                # Extension icons (16, 32, 48, 128)
```

## Development Workflow

### No Build Step Required

Since v4 uses vanilla JS, there's **no build process** for development:

1. **Make changes** to JS/HTML/CSS files in `src/`
2. **Load unpacked** at `chrome://extensions`:
   - Enable "Developer Mode"
   - Click "Load Unpacked"
   - Select the `src/` directory
3. **Test changes**:
   - Click reload icon in `chrome://extensions`
   - Test the extension
4. **Iterate** - edit files and reload

### Optional: TypeScript

If using TypeScript:
- Files end in `.ts`
- Use `tsc` to compile to `.js` before loading
- Keep compiled `.js` files in `src/` for Chrome to read

## Core Architecture

### Two-Context Model

Like all Chrome extensions, ATO v4 runs in separate contexts:

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

**Communication:** Use `chrome.runtime.sendMessage()` and `chrome.runtime.onMessage` to pass data between contexts.

## Key Implementation Details

### Duplicate Detection Logic

**Location:** `background/service-worker.js`

```javascript
// Basic duplicate detection
function findDuplicates(tabs) {
  const urlMap = new Map();
  const duplicates = [];

  tabs.forEach(tab => {
    const url = tab.url;
    if (urlMap.has(url)) {
      duplicates.push(tab); // Keep later occurrence in duplicates list
    } else {
      urlMap.set(url, tab);
    }
  });

  return duplicates;
}
```

**Edge cases to consider:**
- URLs with different fragments (`#hash`) - treat as same or different?
- URLs with different query params - when to consider duplicates?
- Active tab handling - never close the currently active tab

### Badge Updates

**Location:** `background/service-worker.js`

```javascript
// Update badge with duplicate count
function updateBadge(count) {
  if (count > 0) {
    chrome.action.setBadgeText({ text: String(count) });
    chrome.action.setBadgeBackgroundColor({ color: '#FF0000' });
  } else {
    chrome.action.setBadgeText({ text: '' });
  }
}
```

### Tab Event Listeners

**Location:** `background/service-worker.js`

Monitor these events to keep duplicate count accurate:
- `chrome.tabs.onCreated`
- `chrome.tabs.onUpdated`
- `chrome.tabs.onRemoved`
- `chrome.tabs.onReplaced` (tab replaced with another, e.g., after restore)

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

Note: `_execute_action` is a special command that triggers the default action (opening popup).

## Testing the Extension

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

3. **Real-Time Updates**
   - Open popup
   - Open new duplicate in another window
   - Badge should update without reloading popup

4. **Edge Cases**
   - Test with 0 duplicates (badge should be empty)
   - Test with 100+ tabs
   - Test with tabs from different windows

## Common Development Tasks

### Adding a New Action to Popup

1. Add button to `popup.html`
2. Add event listener in `popup.js`
3. Use Chrome API (e.g., `chrome.tabs.remove(tabId)`)

### Changing Duplicate Logic

1. Edit `findDuplicates()` in `background/service-worker.js`
2. Reload extension in `chrome://extensions`
3. Test with various tab scenarios

### Styling Changes

1. Edit `popup.css`
2. Reload extension
3. Reopen popup to see changes

## Permissions in manifest.json

```json
{
  "permissions": [
    "tabs",        // Read tab info (title, URL, etc.)
    "storage"      // Save user preferences (optional, future)
  ],
  "host_permissions": [
    "<all_urls>"   // Required to access tab URLs and favicons
  ]
}
```

## Future Phases

**Phase 2:** Add full tab list view, click to switch tabs
**Phase 3:** Add search/filter functionality
**Phase 4:** Advanced features (suspend tabs, sessions, etc.)

See `V4_GOALS.md` for complete roadmap.

---

## Reference: v3.0 (on main branch)

v3 was built with React + Vite, used a side panel, and had many features built-in. Key differences:

| Aspect | v3 (main) | v4 (v4-rebuild) |
|--------|-----------|-----------------|
| UI | Side Panel | Popup |
| Tech | React + Vite + TypeScript | Vanilla JS/TS |
| Build | Vite bundler required | No build step |
| Focus | Feature-rich browser | Duplicate management |
| Access | Click icon | Keyboard shortcut |

To view v3 code: `git checkout main`
