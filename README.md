# ATO - Advanced Tab Organizer

**ATO** is a side panel Chrome Extension that gives you **superpowers** for managing tabs. Whether you're deep into research, coding, or just riding the chaos of curiosity, ATO helps you **find, close, suspend, and understand** your tab landscape in real time.

No more getting lost in 38 open tabs. Stay focused. Stay fast. Stay in flow.

---

## ✨ Features

| Feature                          | Description |
|----------------------------------|-------------|
| **🧠 Full Tab Overview**         | Instantly view and interact with all open tabs across all windows. |
| **🔍 Fuzzy Search (Title + URL)**| Lightning-fast filtering using Fuse.js with weighted relevance. |
| **❌ Close Tabs Easily**         | One-click close for individual tabs or entire filtered sets. |
| **🧠 Detect Duplicates**         | Real-time detection of duplicate URLs with a "Close All Duplicates" button. |
| **📊 Tab Count Badge**           | Color-coded badge showing tab count (green < 10, yellow < 25, red 25+). |
| **⚡ Quick Actions Menu**        | Right-click context menu with bulk domain actions and power tools. |
| **⚙️ Auto-Cleanup Rules**        | Intelligent auto-close and auto-suspend based on tab inactivity. |
| **📊 Stats Bar**                 | Glanceable count of open tabs, duplicates, and inactive tabs. |
| **🎯 Active Tab Highlighting**   | Always know which tab you're currently on — visually distinct. |
| **⚙️ Real-Time Updates**         | Tabs update live with Chrome events — no refresh required. |
| **🖱 Compact UI**                | Clean, efficient layout that feels native inside the side panel. |

Coming soon:
- 💤 Suspend tabs with `chrome.tabs.discard()`
- ⭐ Temporary favorites for session bookmarks
- 🎹 Keyboard nav (arrow keys, enter, escape)
- 🌗 Compact / detailed view toggle
- 📱 Session management and export

---

## 🚀 Getting Started

### Prerequisites
- Node.js 18+ and npm
- Chrome browser with Developer Mode enabled

### Installation

1. **Clone and setup:**
   ```bash
   git clone https://github.com/yourusername/ato-extension.git
   cd ato-extension
   npm install
   ```

2. **Build the extension:**
   ```bash
   npm run build
   ```

3. **Load in Chrome:**
   - Open `chrome://extensions` in your browser
   - Enable **Developer Mode** (top-right toggle)
   - Click **Load Unpacked**
   - Select the `dist` folder from this project

4. **Start using ATO:**
   - Click the ATO icon in your toolbar
   - Or use the keyboard shortcut: `Cmd+U` (Mac) / `Ctrl+U` (Windows/Linux)
   - The side panel will open with your tab overview

### Development

```bash
# Start development server with hot reload
npm run dev

# Build for production
npm run build

# Run tests
npm test

# Lint code
npm run lint
```

---

## 🧭 UI Layout Overview

```
┌────────────────────────────────────────────┐
│ 🔍 Search input                            │ ← filters tab list in real time
├────────────────────────────────────────────┤
│ 📊 Stats bar                               │ ← real-time tab insights
│ Tabs: 32 | Duplicates: 5 | Inactive: 12    │
├────────────────────────────────────────────┤
│ [🗑 Close Duplicates] [💤 Suspend Old]     │ ← quick global actions
├────────────────────────────────────────────┤
│ ▸ Tab Item (favicon + title + url + ❌)    │ ← right-click for menu
│ ▸ Tab Item (⚠️ inactive 2h)               │ ← visual indicators
│ ▸ Tab Item                                 │ ← clickable, highlightable
│ ...                                        │
└────────────────────────────────────────────┘
```

**Badge in toolbar:** Shows tab count with color coding
- 🟢 Green (< 10 tabs): You're in control
- 🟡 Yellow (10-24 tabs): Getting busy
- 🔴 Red (25+ tabs): Time to clean up!

---

## ⚡ Quick Actions Menu

Right-click any tab for powerful bulk operations:

- **🌐 Close all from domain** - Clean up all tabs from the same website
- **💤 Suspend all but active** - Free up memory while keeping your current tab
- **🔄 Close all duplicates** - Remove redundant tabs instantly
- **⏰ Close tabs older than...** - Bulk remove by age
- **🎯 Keep only this domain** - Focus mode for current website

---

## ⚙️ Auto-Cleanup Rules

Set intelligent rules to keep your browser tidy:

- **📅 Auto-close after X hours** - Automatically close tabs you haven't visited
- **💤 Auto-suspend background tabs** - Free memory from inactive tabs
- **🔄 Auto-close repeated tabs** - Remove duplicates after a set time
- **🛡️ Whitelist important domains** - Never auto-close critical sites

Configure in the settings panel to match your browsing habits.

---

## 🎯 Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Cmd/Ctrl + U` | Open ATO side panel |
| `↑ ↓` | Navigate tab list |
| `Enter` | Switch to selected tab |
| `Delete` | Close selected tab |
| `Escape` | Clear search / close menus |
| `/` | Focus search bar |

---

## 🔧 Technical Details

- **Manifest V3** - Modern Chrome extension architecture
- **React 18** - Component-based UI with hooks
- **Vite** - Lightning-fast development and builds
- **Fuse.js** - Fuzzy search with weighted relevance
- **Vanilla CSS** - No framework dependencies, optimized for performance
- **Service Worker** - Background processing for real-time updates

### Project Structure

```
src/
├── background/           # Service worker scripts
│   ├── service-worker.js # Main background script
│   ├── badgeManager.js   # Tab count badge logic
│   ├── autoCleanup.js    # Auto-cleanup engine
│   └── tabTracker.js     # Tab activity tracking
├── sidepanel/           # React app
│   ├── components/      # UI components
│   ├── hooks/          # Custom React hooks
│   ├── utils/          # Helper functions
│   └── styles/         # CSS files
└── manifest.json       # Extension configuration
```

---

## 📊 Performance & Privacy

- **Local storage only** - No data sent to external servers
- **Minimal permissions** - Only requests necessary browser APIs
- **Optimized for large tab counts** - Tested with 100+ tabs
- **Real-time efficiency** - Updates without polling or refresh

---

## 🤝 Contributing

We welcome contributions! Here's how to get started:

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Make your changes and test thoroughly
4. Commit with descriptive messages: `git commit -m 'Add amazing feature'`
5. Push to your branch: `git push origin feature/amazing-feature`
6. Open a Pull Request

### Development Guidelines

- Follow the existing code style
- Add tests for new features
- Update documentation as needed
- Test with various tab counts (1, 10, 50, 100+ tabs)
- Ensure performance remains snappy

---

## 📝 Changelog

### v3.0.0 (In Development)
- 🆕 Tab count badge with color coding
- 🆕 Right-click context menu for quick actions
- 🆕 Auto-cleanup rules engine
- 🆕 Enhanced duplicate detection
- 🆕 Real-time tab activity tracking
- 🆕 Bulk domain operations
- 🔧 Complete rewrite with React 18 + Vite
- 🔧 Improved performance for large tab counts

---

## 🐛 Known Issues & Roadmap

### Current Limitations
- Chrome only (no Firefox support yet)
- No cross-device sync
- Limited undo functionality for bulk operations

### Upcoming Features
- Session save/restore
- Tab grouping and organization
- Advanced analytics and insights
- Export functionality (Markdown, JSON)
- Custom keyboard shortcuts

---

## 📄 License

MIT License - see [LICENSE](LICENSE) file for details.

---

## 🙏 Acknowledgments

- Chrome Extensions team for excellent APIs
- React team for the amazing framework
- Fuse.js for powerful fuzzy search
- The open-source community for inspiration

---

**Built with ❤️ and way too many browser tabs**

For support, feature requests, or bug reports, please [open an issue](https://github.com/jeanlucaslima/ato/issues).
