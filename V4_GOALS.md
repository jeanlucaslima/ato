# ATO v4: Goals & Roadmap

## Vision

**ATO v4** is a complete reimagining focused on solving one problem exceptionally well: **duplicate tab management**.

Unlike v3's feature-rich sidebar approach, v4 embraces minimalism and progressive enhancement.

---

## Core Philosophy

1. **Start Minimal** - Build the essential, then expand
2. **Duplicates First** - Primary focus on finding and closing duplicate tabs
3. **Keyboard-Driven** - Quick access via `Cmd+U` / `Ctrl+U`
4. **Lightweight** - Vanilla JS, no framework overhead
5. **Real-Time Awareness** - Badge always shows duplicate count

---

## Architecture Decisions

### v3 vs v4

| Aspect | v3 | v4 |
|--------|----|----|
| **UI Pattern** | Side Panel | Popup |
| **Tech Stack** | React + Vite + TypeScript | Vanilla JS/TypeScript |
| | **Approach** | Feature-complete from start | Minimal, incremental |
| **Primary Feature** | Search & Browse | Duplicate Detection |
| **Activation** | Click icon | Keyboard shortcut (`Cmd+U`) |

### Why These Changes?

- **Popup vs Sidebar**: Faster access, less intrusive, better for quick actions
- **Vanilla JS**: Zero build complexity, faster load times, smaller bundle
- **Minimal Start**: Ship faster, learn from usage, iterate based on real needs
- **Duplicates Focus**: Solves the most annoying problem first

---

## Phase 1: MVP (Current Priority)

### Features

**Badge Icon**
- Displays count of duplicate tabs
- Updates in real-time as tabs change
- Red badge when duplicates exist, no badge when clean

**Background Service Worker**
- Monitors all tab events (created, updated, removed)
- Detects duplicates by comparing URLs
- Updates badge count automatically

**Popup Interface**
- Opens with `Cmd+U` (Mac) or `Ctrl+U` (Windows/Linux)
- Shows list of duplicate tabs with:
  - Favicon
  - Page title
  - URL (truncated)
- "Close All Duplicates" button
- Clean, minimal design

### Technical Requirements

```
src/
├── manifest.json          # Manifest V3 config
├── background/
│   └── service-worker.js  # Tab monitoring & duplicate detection
├── popup/
│   ├── popup.html        # Popup UI structure
│   ├── popup.css         # Minimal styling
│   └── popup.js          # Popup logic
└── assets/
    └── icons/            # Extension icons (16, 32, 48, 128)
```

### Success Criteria

- ✅ Badge shows accurate duplicate count
- ✅ Popup opens with keyboard shortcut
- ✅ Clicking "Close All Duplicates" works correctly
- ✅ UI updates in real-time when tabs change
- ✅ Extension uses minimal memory

---

## Phase 2: Tab Overview

### Additional Features

- Show **total tab count** in popup header
- Display **all tabs**, not just duplicates
- Highlight duplicates visually
- Click tab to switch to it
- Click X icon to close individual tab
- Basic stats: "X tabs open, Y duplicates"

### UI Enhancement

- Better visual design
- Smooth animations
- Improved typography
- Responsive layout

---

## Phase 3: Search & Filter

### Features

- Search input at top of popup
- Filter tabs by title or URL
- Fuzzy matching (optional - consider lightweight lib)
- Keyboard navigation (arrow keys, enter)

---

## Phase 4: Advanced Features (Future)

### Potential Features

- **Suspend Tabs**: Use `chrome.tabs.discard()` to free memory
- **Session Management**: Save/restore tab sets
- **Smart Suggestions**: "You have 5 YouTube tabs open"
- **Tab Groups**: Integrate with Chrome's native tab groups
- **Export**: Save tab list as Markdown or JSON
- **Custom Rules**: "Auto-close duplicates from domain X"

### Feature Evaluation

Each feature will be evaluated based on:
1. Does it solve a real pain point?
2. Can it be implemented simply?
3. Does it align with the minimal philosophy?

---

## Non-Goals

What v4 will **NOT** do (at least initially):

- ❌ Easter eggs or novelty features
- ❌ Complex animations or flashy UI
- ❌ Social features or sharing
- ❌ Analytics or telemetry
- ❌ Multiple view modes or heavy customization

---

## Development Principles

1. **Ship Early** - Get Phase 1 working and usable quickly
2. **Iterate Based on Use** - Don't build features speculatively
3. **Keep It Simple** - Avoid over-engineering
4. **Performance First** - Extension should be fast and lightweight
5. **User Control** - Never auto-close without user confirmation

---

## Current Status

**Branch**: `v4-rebuild`
**Phase**: Planning → Implementation starting
**Next Step**: Build Phase 1 MVP

---

## Questions to Answer During Development

- How to handle duplicate detection edge cases?
  - Same URL, different fragments (#hash)?
  - Same URL, different query params (?foo=bar)?
  - URLs that redirect to the same destination?

- Should we keep the first or last duplicate?
  - First opened (preserve oldest)
  - Last opened (preserve newest)
  - Active tab (never close the one you're viewing)

- Badge behavior options:
  - Show count only when duplicates exist?
  - Different colors for different counts?
  - Animation when count changes?
