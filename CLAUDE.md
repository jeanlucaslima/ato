# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Branch: v4-rebuild

**This branch is a clean slate rebuild of ATO.** The v3.0 codebase is on the `main` branch.

### Current State
- Empty `src/` directory
- No build configuration yet
- Tech stack not yet determined
- Ready for fresh implementation

---

## Reference: v3.0 Architecture (from main branch)

The following documentation describes the v3.0 implementation and can serve as reference for the rebuild:

### Original Project Overview

**ATO (Advanced Tab Organizer)** is a Manifest V3 Chrome Extension that provides a side panel interface for managing browser tabs. The v3.0 version was built with React 18 + Vite + TypeScript, offering fuzzy search (via Fuse.js), duplicate detection, real-time tab updates, and easter eggs.

### v3.0 Build Commands

```bash
# Development mode with hot reload
npm run dev

# Production build (outputs to dist/)
npm run build

# Preview production build
npm run preview
```

### Loading the Extension in Chrome

1. Build the extension: `npm run build`
2. Navigate to `chrome://extensions`
3. Enable "Developer Mode"
4. Click "Load Unpacked" and select the `dist/` folder

## Architecture

### Two-Context Architecture

The extension runs in **two separate JavaScript contexts** that cannot directly share state:

1. **Background Service Worker** (`src/background/index.ts`)
   - Handles extension icon clicks
   - Opens/manages the side panel
   - Runs in a separate context from the UI
   - Cannot directly manipulate the DOM or share state with the side panel

2. **Side Panel UI** (`src/sidepanel/`)
   - React application that renders in the Chrome side panel
   - Manages its own state via React hooks
   - Uses Chrome APIs directly (chrome.tabs.*, chrome.windows.*)
   - Real-time updates via Chrome event listeners

**Important:** These two contexts communicate only via Chrome APIs (e.g., `chrome.runtime.sendMessage`). They do not share memory, imports, or state.

### Build System (Vite)

The `vite.config.ts` defines **two separate entry points**:

```javascript
input: {
  sidepanel: "src/sidepanel/index.html",  // React UI
  background: "src/background/index.ts"   // Service Worker
}
```

Output structure:
```
dist/
├── sidepanel/
│   ├── index.html
│   ├── index.js (bundled React app)
│   └── styles.css
├── background/
│   └── index.js (service worker)
├── manifest.json
└── icons/
```

### State Management Pattern

**No global state management library.** State is managed through:

- **`useTabs` hook** (`src/sidepanel/hooks/useTabs.tsx`): Main hook for tab operations
  - Fetches all tabs via `chrome.tabs.query({})`
  - Listens to Chrome tab events (onCreated, onRemoved, onUpdated, etc.)
  - Implements fuzzy search via Fuse.js with weighted keys (title: 0.7, url: 0.3)
  - Handles duplicate detection by calling `getDuplicateTabs()` from `src/lib/tabs.ts`
  - Returns filtered tabs, handlers, and query state

- **`useEasterEggs` hook** (`src/sidepanel/hooks/useEasterEggs.ts`): Detects and triggers easter eggs
  - Monitors query input and tab context
  - Triggers effects defined in `src/lib/easterEggs.ts`
  - Examples: `!chaos` for chaos mode, `!boom` for self-destruct countdown

### Key Utilities

- **`src/lib/tabs.ts`**: Core tab utilities
  - `getAllTabs()`: Async wrapper for chrome.tabs.query
  - `getDuplicateTabs(tabs)`: Returns duplicate tabs by URL (keeps first occurrence)

- **`src/lib/easterEggs.ts`**: Easter egg definitions
  - Each egg has: `name`, `trigger(ctx, date)`, `effect(ctx)`
  - Exported array: `easterEggs`

### Component Structure

```
App.tsx (root)
├── SearchBar (controlled input, manages query state)
├── StatsBar (displays tab count, duplicate count, action buttons)
├── TabList (renders list of tabs)
│   └── TabItem (individual tab row with click/close handlers)
└── Toast (ephemeral messages)
```

### Real-Time Updates

The `useTabs` hook subscribes to **all Chrome tab events** in a single `useEffect`:

- `onCreated`, `onRemoved`, `onUpdated`, `onMoved`, `onDetached`, `onAttached`
- Callback: `chrome.tabs.query({}, setTabs)` to refresh full tab list
- Cleanup: all listeners removed on unmount

This ensures the UI stays in sync with Chrome's tab state without manual refreshes.

### Search Implementation

**Fuzzy search** powered by Fuse.js:

```typescript
const fuse = new Fuse(tabs, {
  keys: [
    { name: "title", weight: 0.7 },
    { name: "url", weight: 0.3 }
  ],
  threshold: 0.4,
  ignoreLocation: true
})
```

**Special query handling:**
- Queries starting with `!` are treated as **commands** (e.g., `!chaos`, `!boom`)
- Commands do **not** filter tabs; they trigger easter eggs instead
- Empty queries show all tabs

### Styling

**Vanilla CSS** (`src/sidepanel/styles.css`), no Tailwind in runtime despite devDependencies. CSS is bundled by Vite.

Notable CSS classes:
- `.chaos-mode`: Applied to `<body>` when `!chaos` is triggered
- `.tab-item.active`: Highlights the current active tab
- `.stats-bar`, `.close-dupes`: UI components

## Common Development Patterns

### Adding a New Tab Action

1. Add handler function in `useTabs` hook
2. Return it from the hook
3. Pass it to the relevant component (e.g., `TabItem`, `App`)
4. Use Chrome API (e.g., `chrome.tabs.discard(tabId)` for suspending)

### Adding a New Easter Egg

1. Define egg object in `src/lib/easterEggs.ts`:
   ```typescript
   export const myEgg: EasterEgg = {
     name: "My Egg",
     trigger: ({ query, tabs }) => /* condition */,
     effect: ({ showMessage, setUIFlag }) => /* action */
   }
   ```
2. Add to `easterEggs` array
3. It will be automatically detected by `useEasterEggs` hook

### Testing Changes

After modifying code:
1. Run `npm run build`
2. Go to `chrome://extensions`
3. Click "Reload" icon on the ATO extension card
4. Re-open the side panel to see changes

**Hot reload in dev mode** (`npm run dev`) does NOT work for Chrome extensions. Always build and reload.

## Permissions in manifest.json

- `tabs`: Read tab info
- `tabGroups`: Access tab groups (planned feature)
- `sidePanel`: Enable side panel UI
- `contextMenus`: Planned feature
- `storage`: Planned feature for saving sessions
- `host_permissions: ["<all_urls>"]`: Required to read tab URLs and favicons

## Roadmap (from README)

Planned features:
- Suspend tabs (`chrome.tabs.discard()`)
- Temporary favorites
- Keyboard navigation
- Tab grouping awareness
- Export to Markdown/JSON
- Session saving
