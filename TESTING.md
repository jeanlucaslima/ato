# Testing ATO v4 MVP

## Before You Start

### 1. Install Dependencies & Build

The extension now uses Vite for building. Run these commands:

```bash
# Install dependencies
npm install

# Generate icon PNG files
npm run icons

# Build extension to dist/
npm run build
```

This will create a `dist/` folder with the compiled extension.

## Loading the Extension

1. Open Chrome and navigate to `chrome://extensions`
2. Enable **"Developer mode"** (toggle in top-right corner)
3. Click **"Load unpacked"**
4. Select the `dist/` directory from this project (NOT `src/`)
5. The extension should now appear in your extensions list

**Note:** Load the `dist/` folder, not `src/`. The build process copies and processes files into `dist/`.

## Testing Checklist

### ✅ Basic Functionality

- [ ] Extension loads without errors in `chrome://extensions`
- [ ] ATO icon appears in the Chrome toolbar
- [ ] Badge shows correct count when duplicates exist
- [ ] Badge is empty when no duplicates exist

### ✅ Keyboard Shortcut

- [ ] Press `Cmd+U` (Mac) or `Ctrl+U` (Windows/Linux)
- [ ] Popup opens successfully
- [ ] Popup shows correct stats (total tabs, duplicate count)

### ✅ Popup Interface

- [ ] Popup displays duplicate tabs with favicon, title, and URL
- [ ] Each tab item shows a close button (×)
- [ ] Clicking a tab switches to that tab
- [ ] Clicking × closes that specific tab
- [ ] "Close All Duplicates" button is visible when duplicates exist
- [ ] Button successfully closes all duplicates (except active tab)
- [ ] Empty state appears when no duplicates exist

### ✅ Real-Time Updates

- [ ] Open a new duplicate tab
- [ ] Badge count increases immediately
- [ ] Open popup and verify duplicate appears in list
- [ ] Close a duplicate manually (not via extension)
- [ ] Badge count decreases immediately

### ✅ Edge Cases

- [ ] Test with 0 duplicates - badge should be empty
- [ ] Test with 1 duplicate - badge shows "1"
- [ ] Test with 10+ duplicates - all shown in popup
- [ ] Test with duplicates across different windows
- [ ] Test closing active tab's duplicate - active tab stays open
- [ ] Test with chrome:// internal pages - should be ignored

### ✅ Performance

- [ ] Extension works smoothly with 50+ tabs
- [ ] No lag when opening/closing tabs
- [ ] Popup opens quickly (< 1 second)

## Common Issues & Solutions

### Extension won't load
- **Check for errors** in `chrome://extensions`
- **Verify** all files exist (manifest.json, service-worker.js, popup files)
- **Check** icon files are present (or comment out icons in manifest.json temporarily)

### Badge doesn't update
- **Open service worker console**: Go to `chrome://extensions`, click "Inspect views: service worker"
- **Check logs** for errors
- **Verify** tab event listeners are registered

### Popup doesn't open
- **Try** clicking the icon manually instead of keyboard shortcut
- **Check** for JavaScript errors: Right-click popup → Inspect
- **Verify** popup.html, popup.css, popup.js are in correct location

### Keyboard shortcut doesn't work
- **Check** for conflicts with other extensions or browser shortcuts
- **Verify** manifest.json has correct commands configuration
- **Try** different key combination in manifest.json if needed

### Duplicates not detected
- **Open service worker console** and check logs
- **Verify** URL matching logic in service-worker.js
- **Test** with simple duplicate URLs (e.g., google.com twice)

## Debugging

### Service Worker Console
```
1. Go to chrome://extensions
2. Find ATO extension
3. Click "Inspect views: service worker"
4. Console shows background logs
```

### Popup Console
```
1. Open the popup (Cmd+U or click icon)
2. Right-click inside the popup
3. Select "Inspect"
4. Console shows popup logs
```

### Reload Extension After Changes
```
1. Make changes to any file in src/
2. Rebuild the extension: npm run build
3. Go to chrome://extensions
4. Click reload icon (circular arrow) on ATO card
5. Test the changes
```

**Tip:** Use `npm run dev` to automatically rebuild when files change (watch mode).

## Test Scenarios

### Scenario 1: First-Time User
1. Load extension
2. Should see badge with duplicate count (if any duplicates exist)
3. Press Cmd+U
4. Should see clear list of duplicates
5. Click "Close All Duplicates"
6. Duplicates closed, badge updates to 0

### Scenario 2: Power User with Many Tabs
1. Open 50+ tabs with some duplicates
2. Verify badge shows correct count
3. Open popup
4. Should load quickly and show all duplicates
5. Close individual duplicates via × button
6. Verify UI updates correctly

### Scenario 3: No Duplicates
1. Ensure all tabs are unique
2. Badge should be empty (no text)
3. Open popup
4. Should show "No duplicate tabs found" message
5. "Close All Duplicates" button should be hidden

## Success Criteria

The MVP is successful if:

- ✅ Badge accurately shows duplicate count in real-time
- ✅ Keyboard shortcut (Cmd+U / Ctrl+U) opens popup
- ✅ Popup lists all duplicate tabs
- ✅ "Close All Duplicates" button works correctly
- ✅ Individual tab close (×) button works
- ✅ Extension uses minimal memory (< 20MB)
- ✅ No console errors in normal operation

## Next Steps After Testing

Once MVP is validated:
1. Create issues for any bugs found
2. Note usability improvements
3. Plan Phase 2 features
4. Consider additional edge cases

---

Happy testing! 🚀
