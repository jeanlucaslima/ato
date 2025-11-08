# ATO - Advanced Tab Organizer
## Technical Specification

---

## Overview

**ATO (Advanced Tab Organizer)** is a lightweight Chrome extension designed to solve one problem exceptionally well: **duplicate tab management**. Built with Manifest V3 and vanilla JavaScript, ATO provides real-time duplicate detection with a minimal, keyboard-driven popup interface.

**Tagline:** "Kill duplicate tabs instantly. Stay focused."

---

## Current Version

**Version:** 4.1.0
**Branch:** `v4-rebuild` (complete reimagining of the extension)
**Status:** Active development, Phase 3 complete

---

## Core Philosophy

ATO v4 represents a complete architectural shift from v3:

| Principle | Description |
|-----------|-------------|
| **Minimal First** | Ship essentials, then enhance progressively |
| **Duplicates First** | Primary focus on finding and closing duplicate tabs |
| **Keyboard-Driven** | Quick access via `Cmd+U` / `Ctrl+U` shortcut |
| **Lightweight** | Vanilla JS/TypeScript, no framework overhead |
| **Real-Time Awareness** | Badge always shows current duplicate count |

---

## Main Features

### Phase 1: MVP (Complete)
- Real-time duplicate tab detection
- Badge icon showing duplicate count (red badge when duplicates exist)
- Background service worker monitoring all tab events
- Popup interface listing duplicate tabs with:
  - Favicon, title, and URL for each tab
  - Click to switch to tab
  - Individual close buttons
- "Close All Duplicates" action
- Keyboard shortcut (`Cmd+U` / `Ctrl+U`) to open popup
- Never closes the active tab

### Phase 2: Tab Overview (Complete)
- Display all tabs, not just duplicates
- Total tab count in header
- Visual highlighting of duplicates with count badges (e.g., "×3")
- Click any tab to switch to it
- Individual close buttons for all tabs
- Stats display: "X tabs open, Y duplicates"

### Phase 3: Domain Filtering (Complete)
- Dropdown filter to show tabs by domain
- Domain list sorted by tab count (most tabs first)
- "Close All from Domain" action when filter is active
- Real-time filtering without page reload

### Phase 4: Future Enhancements (Planned)
- Search and filter by title/URL
- Tab suspension to free memory
- Session management (save/restore tab sets)
- Smart suggestions ("You have 5 YouTube tabs open")
- Export tab list as Markdown/JSON
- Custom rules for auto-management

---

## Architecture

### Two-Context Model

ATO follows the standard Chrome extension architecture with two separate JavaScript execution contexts:

#### 1. Background Service Worker
**File:** `src/background/service-worker.js`

**Responsibilities:**
- Runs independently in background (persistent monitoring)
- Listens to Chrome tab events:
  - `chrome.tabs.onCreated` - new tab opened
  - `chrome.tabs.onUpdated` - tab URL or properties changed
  - `chrome.tabs.onRemoved` - tab closed
  - `chrome.tabs.onReplaced` - tab replaced (e.g., after restore)
- Detects duplicates by comparing tab URLs
- Updates badge text and color in real-time
- No DOM access, no UI rendering

**Key Function:**
```javascript
function findDuplicates(tabs) {
  // Returns array of duplicate tabs (keeps first occurrence as "original")
  // Skips chrome:// and edge:// internal pages
}
```

#### 2. Popup UI
**Files:** `src/popup/popup.html`, `popup.js`, `popup.css`

**Responsibilities:**
- Opens when user clicks extension icon or uses keyboard shortcut
- Queries all tabs from Chrome API
- Displays duplicates and all tabs in separate sections
- Handles user interactions:
  - Click tab → switch to it
  - Click close button → close specific tab
  - "Close All Duplicates" → close all duplicate tabs (except active)
  - Domain filter → show tabs from specific domain
  - "Close All from Domain" → close all tabs from filtered domain
- Fresh instance created each time popup opens
- Automatically refreshes after any close action

**Key Functions:**
```javascript
async function loadAndRender()        // Queries tabs and renders UI
function render(tabs, duplicates)     // Updates DOM with tab lists
function createTabItem(tab, count)    // Creates tab element with badge
async function closeAllDuplicates()   // Closes all duplicates (preserves active tab)
```

**Communication:** Both contexts are independent. They don't directly communicate but both query the same Chrome Tab API.

---

## Project Structure

```
ato/
├── src/                          # Source files
│   ├── manifest.json            # Manifest V3 configuration
│   ├── background/
│   │   └── service-worker.js    # Tab monitoring & duplicate detection
│   ├── popup/
│   │   ├── popup.html          # Popup UI structure
│   │   ├── popup.css           # Minimal styling
│   │   └── popup.js            # Popup logic & user interactions
│   └── assets/
│       └── icons/              # Extension icons (16, 32, 48, 128 px)
│
├── dist/                        # Build output (loaded in Chrome)
│   └── [compiled extension]
│
├── CLAUDE.md                    # Development guidance
├── V4_GOALS.md                  # Feature roadmap
├── SPEC.md                      # This file
├── package.json                 # Dependencies & build scripts
├── vite.config.js              # Vite build configuration
└── tsconfig.json               # TypeScript configuration (optional)
```

---

## How the Codebase Works

### 1. Extension Loading

When Chrome loads the extension:

1. **Manifest** (`src/manifest.json`) defines:
   - Extension metadata (name, version, description)
   - Background service worker entry point
   - Popup HTML file
   - Permissions (`tabs`, `<all_urls>`)
   - Keyboard shortcut (`Cmd+U` / `Ctrl+U`)

2. **Service Worker** starts automatically:
   - Runs `service-worker.js` in background
   - Performs initial scan of all tabs
   - Sets up event listeners for tab changes
   - Updates badge immediately

### 2. Duplicate Detection Flow

```
Tab Event (create/update/remove)
  ↓
service-worker.js detects event
  ↓
scanAndUpdateBadge() queries all tabs
  ↓
findDuplicates() identifies duplicates
  ↓
updateBadge() sets badge text & color
```

**Duplicate Detection Logic:**
- Uses a `Map<URL, Tab>` to track first occurrence of each URL
- Any subsequent tab with the same URL is marked as duplicate
- Ignores `chrome://` and `edge://` internal pages
- Does NOT normalize URLs (exact match required)

**Edge Cases:**
- Same URL with different `#hash` → considered different (not duplicates)
- Same URL with different query params → considered different
- Active tab is never closed, even if duplicate

### 3. Popup Interaction Flow

```
User presses Cmd+U / Ctrl+U
  ↓
popup.html opens (new instance)
  ↓
popup.js runs loadAndRender()
  ↓
Queries all tabs via chrome.tabs.query({})
  ↓
Runs findDuplicates() locally
  ↓
Renders two sections:
  - Duplicates (if any)
  - All Tabs
  ↓
User clicks action button
  ↓
chrome.tabs.remove() closes tabs
  ↓
loadAndRender() refreshes UI
```

### 4. Domain Filtering Flow

```
User selects domain from dropdown
  ↓
activeDomain state updated
  ↓
loadAndRender() re-renders with filter
  ↓
Only tabs matching extractDomain(tab.url) === activeDomain shown
  ↓
"Close All from Domain" button appears
```

---

## Technical Stack

### Core Technologies
- **JavaScript/TypeScript**: Vanilla JS for all logic (TypeScript optional)
- **HTML/CSS**: Minimal, semantic markup
- **Chrome Extensions Manifest V3**: Latest extension platform
- **Vite**: Build tool for bundling and development

### Build System
- **Vite 6.0+**: Fast builds, watch mode for development
- **TypeScript Compiler**: Optional type checking
- **NPM Scripts**:
  - `npm run build` - Build extension to `dist/`
  - `npm run dev` - Watch mode (auto-rebuild on changes)
  - `npm run icons` - Generate icon files

### Chrome APIs Used
- `chrome.tabs.query()` - Get all tabs
- `chrome.tabs.onCreated` - Listen for new tabs
- `chrome.tabs.onUpdated` - Listen for tab changes
- `chrome.tabs.onRemoved` - Listen for tab closes
- `chrome.tabs.onReplaced` - Listen for tab replacements
- `chrome.tabs.remove(tabIds)` - Close tabs
- `chrome.tabs.update(tabId, {active: true})` - Switch to tab
- `chrome.windows.update(windowId, {focused: true})` - Focus window
- `chrome.action.setBadgeText()` - Set badge text
- `chrome.action.setBadgeBackgroundColor()` - Set badge color

### Permissions
- **`tabs`**: Read tab information (title, URL, favicon)
- **`<all_urls>`**: Required to access tab URLs and favicons for all sites

---

## Key Components

### service-worker.js

**Purpose:** Background monitoring and badge updates

**Key Functions:**

| Function | Purpose |
|----------|---------|
| `findDuplicates(tabs)` | Returns array of duplicate tabs |
| `updateBadge(count)` | Sets badge text/color based on count |
| `scanAndUpdateBadge()` | Queries tabs, finds duplicates, updates badge |

**Event Listeners:**
- Tab created/updated/removed/replaced → triggers `scanAndUpdateBadge()`

### popup.js

**Purpose:** User interface and interactions

**Key Functions:**

| Function | Purpose |
|----------|---------|
| `loadAndRender()` | Queries tabs and renders entire UI |
| `render(tabs, duplicates)` | Updates DOM with tab lists |
| `findDuplicates(tabs)` | Same logic as service worker |
| `countDuplicatesByUrl(tabs)` | Returns Map of URL → count |
| `createTabItem(tab, count)` | Creates DOM element for a tab |
| `closeAllDuplicates()` | Closes all duplicates except active tab |
| `switchToTab(tabId, windowId)` | Switches to clicked tab |
| `closeTab(tabId)` | Closes single tab |
| `groupTabsByDomain(tabs)` | Groups tabs by hostname |
| `renderDomainDropdown(tabs)` | Populates domain filter dropdown |
| `closeAllFromDomain()` | Closes all tabs from filtered domain |

**State:**
- `activeDomain` - Currently selected domain filter (null = show all)

### popup.css

**Purpose:** Minimal, clean styling

**Design Principles:**
- Monospace font for technical feel
- Minimal color palette (mostly grayscale)
- Red accents for badges and close buttons
- Subtle hover effects
- Responsive layout (flexbox)
- Truncated text with ellipsis for long URLs/titles

---

## Development Workflow

### 1. Setup
```bash
git clone <repo>
cd ato
npm install
npm run icons  # Generate icon files (first time only)
```

### 2. Development Cycle
```bash
# Edit files in src/
npm run build    # Build to dist/

# OR use watch mode
npm run dev      # Auto-rebuild on changes

# Load extension in Chrome:
# 1. Open chrome://extensions
# 2. Enable "Developer mode"
# 3. Click "Load unpacked"
# 4. Select dist/ folder
# 5. Click reload icon after each build
```

### 3. Testing
- Open multiple duplicate tabs
- Verify badge count is accurate
- Press `Cmd+U` / `Ctrl+U` to open popup
- Test "Close All Duplicates" action
- Test individual close buttons
- Test clicking tabs to switch
- Test domain filtering
- Test "Close All from Domain" action
- Verify active tab is never closed

---

## Roadmap

### Completed Phases

✅ **Phase 1: MVP**
- Duplicate detection
- Badge count
- Popup with keyboard shortcut
- Close all duplicates

✅ **Phase 2: Tab Overview**
- Show all tabs
- Click to switch
- Individual close buttons
- Duplicate count badges

✅ **Phase 3: Domain Filtering**
- Domain dropdown filter
- Close all from domain

### Upcoming Phases

🔜 **Phase 4: Advanced Features**
- Search/filter by title or URL
- Tab suspension (`chrome.tabs.discard()`)
- Session management (save/restore)
- Smart suggestions
- Export functionality
- Custom rules

---

## Design Decisions

### Why Popup Instead of Sidebar?
- **Faster access**: Keyboard shortcut opens immediately
- **Less intrusive**: Doesn't take screen space when not needed
- **Simpler**: No need for persistent state or complex layouts

### Why Vanilla JS Instead of React?
- **Zero build complexity**: Faster development iteration
- **Smaller bundle**: ~10-20KB vs ~100KB+ with framework
- **Faster load time**: No framework parsing overhead
- **Simpler debugging**: No virtual DOM, no abstractions

### Why Keep First Occurrence as "Original"?
- **User expectation**: First tab is usually the one they intended to keep
- **Predictable behavior**: Consistent with "close duplicates" mental model
- **Active tab protection**: If user is viewing a duplicate, it won't be closed

### Why No URL Normalization?
- **Simplicity**: Exact URL matching is predictable and fast
- **User control**: Users decide what counts as duplicate
- **Future enhancement**: Can add normalization options later (strip query params, ignore hash, etc.)

---

## Performance Considerations

### Optimizations
- **Event-driven architecture**: Only scans when tabs change
- **Map-based duplicate detection**: O(n) time complexity
- **Minimal DOM updates**: Only re-renders affected sections
- **No persistent storage**: All state derived from Chrome Tab API

### Memory Footprint
- **Service worker**: ~1-2 MB (lightweight, no UI)
- **Popup**: ~2-3 MB (only when open, closed after use)
- **Total**: Negligible impact on browser performance

---

## Security & Privacy

- **No external network requests**: All processing happens locally
- **No data collection**: No analytics, telemetry, or tracking
- **No data storage**: No user data persisted (uses Chrome Tab API only)
- **Minimal permissions**: Only `tabs` and `<all_urls>` (required for favicons)

---

## Known Limitations

1. **No URL normalization**: `https://example.com` and `https://example.com/` are considered different
2. **No favicon caching**: Favicons are fetched each time popup opens
3. **No undo**: Closing tabs is permanent (Chrome's native "Restore Tab" still works)
4. **No keyboard navigation**: Must use mouse to interact with popup (future enhancement)
5. **No fuzzy search**: Exact match only for domain filtering (future enhancement)

---

## Contributing

### Code Style
- Use vanilla JavaScript (TypeScript optional)
- Follow existing code structure
- Add comments for complex logic
- Keep functions small and focused
- Use async/await for Chrome API calls

### Testing
- Manually test all features before committing
- Ensure badge count is accurate
- Verify active tab is never closed
- Test with 100+ tabs for performance

---

## Version History

- **v4.1.0** - Phase 3: Domain filtering
- **v4.0.0** - Phase 2: Tab overview with full tab list
- **v4.0.0-mvp** - Phase 1: MVP with duplicate detection
- **v3.0** - Previous version (React + Vite, sidebar-based)

---

## License & Author

**Author:** Jean Lucas Lima (github.com/jeanlucaslima)
**Repository:** [github.com/jeanlucaslima/ato](https://github.com/jeanlucaslima/ato)

---

**Last Updated:** 2025-11-08
