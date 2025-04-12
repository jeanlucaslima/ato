# ✅ ATO – Advanced Tab Organizer – TODO

This file tracks all planned features and enhancements for ATO (Advanced Tab Organizer), a Chrome side panel extension for power tab users.

---

## 🌟 Core Features (MVP)

- [x] Side panel UI (instead of popup)
- [x] Toggle side panel visibility via extension icon
- [x] First-click opens, subsequent clicks toggle visibility
- [x] Prevent side panel from hiding on first open
- [x] Vanilla CSS styling via `styles.css`
- [x] Vite 6 + React 18 setup with working build/dev

---

## 🧩 Tab Management

- [ ] List all open tabs with:
  - [ ] Favicon
  - [ ] Title
  - [ ] URL
- [ ] Switch to tab on click
- [ ] Close tab button (🗑)
- [ ] Suspend tab (`chrome.tabs.discard`)
- [ ] Pin/unpin tab
- [ ] Move tab to another window

---

## 🧠 Smart Features

- [ ] Fuzzy search bar (title + URL)
- [ ] Detect and highlight duplicate tabs
- [ ] Highlight special states:
  - [ ] Playing audio
  - [ ] Suspended tabs
  - [ ] Unpinned tabs
  - [ ] Inactive tabs (long idle?)

---

## 📊 UI Modes & Stats

- [ ] Toggle compact / detailed view
- [ ] Stats panel:
  - [ ] Tabs per window
  - [ ] Duplicate count
  - [ ] Suspended tabs
  - [ ] Media playing tabs

---

## 🧪 Power UX

- [ ] Local-only session favorites (mark a tab as temp "important")
- [ ] Drag-and-drop tab reordering (if API allows)
- [ ] Group tabs by:
  - [ ] Window
  - [ ] Chrome Tab Groups
- [ ] Keyboard navigation support

---

## 🔧 Config & UX Polish

- [ ] `Cmd+U` / `Ctrl+U` keyboard shortcut (via `commands`)
- [ ] Graceful fallback if side panel can’t open
- [ ] Optional feedback/warning if tab is unsupported (`chrome://`, etc)
- [ ] Lightweight onboarding banner ("click to toggle the panel")

---

## 📦 Future Nice-to-Haves

- [ ] Export/import tab sessions
- [ ] Save tab groups as named presets
- [ ] Open tab groups via command palette
