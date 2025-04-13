# [ATO] Advanced Tab Organizer
↳ Close tabs. Sleep tabs. Search tabs. Regain control.

![Version](https://img.shields.io/badge/version-2.0-blue.svg)

**ATO** (Advanced Tab Organizer) is a Chrome Extension for taming the chaos of your browser tabs. Whether you're deep into research, coding, or just riding the wave of spontaneous curiosity, ATO helps you **find, close, sleep, and organize** tabs with a clean and focused UI.

No more getting lost in 38 open tabs. Take control — without breaking your flow.

---

## ✨ Features

| Feature                          | Description |
|----------------------------------|-------------|
| **Full Tab Overview**            | View all open tabs across all Chrome windows, neatly grouped. |
| **Search by Title or URL**       | Filter tabs in real-time using a smart fuzzy search. |
| **Close Tabs (One or Many)**     | Close individual tabs or the entire filtered batch. |
| **Sleep Tabs (Free Up Memory)**  | Suspend tabs with `chrome.tabs.discard()` — keep them open but out of RAM. |
| **Sleep All Tabs**               | Suspend all filtered tabs at once with one click. |
| **Detect & Close Duplicates**    | Instantly find and close duplicate tabs based on URL. |
| **Temporary Favorites**          | Mark tabs to revisit later — perfect for context-switchers. |
| **Keyboard Shortcut**            | Open ATO with `Cmd+U` / `Ctrl+U` (can be customized). |
| **Compact & Detailed Views**     | Toggle between a minimal view and full tab metadata. |
| **Grouped by Window/Group**      | Tabs are organized by Chrome window and tab group. |
| **Real-time Stats**              | Quick glance: how many tabs you’ve opened, duplicated, or put to sleep. |

---

## 🚀 Getting Started

> Requires Chrome with Manifest V3 support.

1. Clone or download this repository:
   ```bash
   git clone https://github.com/yourusername/ato-extension.git
   ```
2. Open Chrome and go to chrome://extensions.
3. Enable Developer mode in the top-right corner.
4. Click Load unpacked and select the ato-extension directory.
5. Use the shortcut Cmd+U / Ctrl+U to launch ATO from anywhere.

## 🧠 Good Practices (Development & UX)

Minimal permissions: Request only what's strictly needed — tabs, activeTab, storage.

Storage sync: Use chrome.storage.sync for favorites or view mode (optional and private).

Event-driven design: No background memory hogs — use service workers and event listeners only.

Visual clarity: Tailor the UI for fast scanning, tab title emphasis, and mouse+keyboard use.

Fail-safe actions: Batch operations (e.g., close all, sleep all) should be undoable or at least confirmable.

Local-first philosophy: No data leaves your machine unless you explicitly export it.

## 🧭 UI Layout Overview

ATO uses a structured side panel layout to organize tab management features clearly and scalably:

```
┌────────────────────────────────────────────┐
│ 🔍 Search input                            │ ← filters tab list by title/URL
├────────────────────────────────────────────┤
│ 📊 Stats bar                               │ ← shows real-time info:
│ Tabs: 32 | Duplicates: 5 | Playing: 2      │
├────────────────────────────────────────────┤
│ 🧠 Action bar (optional)                   │ ← quick global actions:
│ [🗑 Close Duplicates] [💤 Suspend All]      │
├────────────────────────────────────────────┤
│ ▸ Tab Item 1                               │
│ ▸ Tab Item 2                               │ ← each rendered with title, URL,
│ ▸ Tab Item 3                               │    favicon, and close/suspend
│  ...                                       │
└────────────────────────────────────────────┘
```

This layout ensures a clean separation between:

* Search/filtering
* Live tab insights (stats)
* Batch actions
* Individual tab control

## ✅ Feature Checklist (v3.x)

### Core Features

- [x] List all open tabs
- [x] Show favicon, title, URL
- [x] Click to focus tab and window
- [x] Close individual tab (with SVG icon)
- [x] Compact tab row layout
- [x] Missing favicon fallback icon
- [x] Highlight active tab
- [x] Hover styles for visual feedback
- [x] Clean code split (TabItem, TabList, useTabs, icons)

### In Progress / Coming Next

- [ ] 🔍 Search bar to filter tabs
- [ ] 📊 Stats bar (total tabs, duplicates, playing audio, etc.)
- [ ] 🧠 Detect duplicate tabs (by URL)
- [ ] 🗑 "Close all duplicates" button
- [ ] 💤 Suspend tab (via chrome.tabs.discard)
- [ ] Compact/detailed view toggle
- [ ] Local "favorites" for temporary pinning
- [ ] Group by window or Chrome tab group
- [ ] Keyboard nav (arrow keys, enter, delete)

## 📦 Tech Stack

Chrome Extension Manifest V3

Vanilla JavaScript (or TypeScript)

HTML + TailwindCSS (suggested)

Fuse.js (or similar) for fuzzy search

## 💡 Roadmap / Future Ideas

Save tab sessions (name + restore later)

Export open tabs to Markdown / JSON

Smart suggestions for tab cleanup

Usage heatmap (when and how you open tabs)

Integration with tab group colors and names

Public stats: “How many tabs did I really open today?”

## 🤝 Built with Love, Tabs, and a Bit of Chaos
This project was crafted by:

* Jean Lucas — Tabslinger, extension whisperer, and eternal enemy of tab overload.
* ChatGPT — Co-pilot and idea shaper, tirelessly helping turn caffeine into feature sets.

ATO is a labor of curiosity and necessity.
No fluff. No bloat. Just a better way to browse.

Because 37 open tabs is your workflow.

[ATO] Advanced Tab Organizer
↳ Close tabs. Sleep tabs. Search tabs. Regain control.
