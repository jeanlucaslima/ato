# ATO — Advanced Tab Organizer
↳ Close tabs. Search smart. Reclaim your browser.

![Version](https://img.shields.io/badge/version-3.0-blue.svg)

**ATO** is a side panel Chrome Extension that gives you **superpowers** for managing tabs. Whether you’re deep into research, coding, or just riding the chaos of curiosity, ATO helps you **find, close, suspend, and understand** your tab landscape in real time.

No more getting lost in 38 open tabs. Stay focused. Stay fast. Stay in flow.

---

## ✨ Features

| Feature                          | Description |
|----------------------------------|-------------|
| **🧠 Full Tab Overview**         | Instantly view and interact with all open tabs across all windows. |
| **🔍 Fuzzy Search (Title + URL)**| Lightning-fast filtering using Fuse.js with weighted relevance. |
| **❌ Close Tabs Easily**         | One-click close for individual tabs or entire filtered sets. |
| **🧠 Detect Duplicates**         | Real-time detection of duplicate URLs with a "Close All Duplicates" button. |
| **📊 Stats Bar**                 | Glanceable count of open tabs, duplicates, and more coming. |
| **🎯 Active Tab Highlighting**   | Always know which tab you’re currently on — visually distinct. |
| **⚙️ Real-Time Updates**         | Tabs update live with Chrome events — no refresh required. |
| **🖱 Compact UI**                | Clean, efficient layout that feels native inside the side panel. |

Coming soon:
- 💤 Suspend tabs with `chrome.tabs.discard()`
- ⭐ Temporary favorites for session bookmarks
- 🎹 Keyboard nav (arrow keys, enter, escape)
- 🌗 Compact / detailed view toggle

---

## 🚀 Getting Started

1. Clone this repo:
   ```bash
   git clone https://github.com/yourusername/ato-extension.git
2. Open chrome://extensions in your browser.
3. Enable Developer Mode (top-right).
4. Click Load Unpacked, then select the ato-extension folder.
5. Click the ATO icon or use Cmd+U / Ctrl+U to open the side panel.

## 🧭 UI Layout Overview

```
┌────────────────────────────────────────────┐
│ 🔍 Search input                            │ ← filters tab list in real time
├────────────────────────────────────────────┤
│ 📊 Stats bar                               │ ← real-time tab insights
│ Tabs: 32 | Duplicates: 5                   │
├────────────────────────────────────────────┤
│ [🗑 Close Duplicates]                      │ ← quick global action
├────────────────────────────────────────────┤
│ ▸ Tab Item (favicon + title + url + ❌)    │
│ ▸ Tab Item                                 │ ← clickable, highlightable rows
│ ...                                        │
└────────────────────────────────────────────┘
```

## ✅ Current Feature Checklist (v3.0)

- [x] Full tab listing (all windows)
- [x] Fuzzy search (title + URL, via Fuse.js)
- [x] Close tab (with icon)
- [x] Duplicate detection (by URL)
- [x] "Close all duplicates" button
- [x] Stats bar
- [x] Highlight active tab
- [x] Hover feedback
- [x] Clean file split (hooks, components, icons)
- [x] Real-time updates with Chrome tab events

Coming soon:

- [ ] 💤 Suspend tabs (one or all)
- [ ] ⭐ Mark temporary favorites
- [ ] Group tabs by window or tab group
- [ ] Keyboard shortcuts inside the panel
- [ ] Undo batch actions
- [ ] Export tab list (Markdown, JSON)

## 🧠 Developer Notes & Architecture

* Manifest V3 — background service worker, side panel support
* Vite + React 18 — blazing fast dev experience
* Vanilla CSS — intentionally Tailwind-free for simplicity
* Fuse.js — for fuzzy searching with custom weighting
* MVCS structure — modular components and hooks

## 🧪 Roadmap / Stretch Goals

* Save tab sessions
* Export tabs to Markdown or JSON
* Smart cleanup suggestions
* Daily tab stats ("How many tabs today?")
* Drag-and-drop tab reordering (UI)
* Tab group awareness

## 🤝 Built with Love, Tabs, and a Hint of Madness

Jean Lucas — Developer, tab-overloader turned tab-organizer
ChatGPT — Co-designer, co-developer, co-problem-solver

ATO is a side project made with focus, curiosity, and a desire to make browsing feel better again.

Because 37 open tabs is not a problem — it's a power move.
