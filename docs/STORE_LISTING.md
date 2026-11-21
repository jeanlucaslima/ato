# Chrome Web Store Listing

The text for ATO's Chrome Web Store listing. Edit it here first, then paste each field into the Developer Dashboard.

The name and the short summary are not dashboard fields: the store reads them from `name` and `description` in `src/manifest.json`, so they change only with a new build. Keep the two blocks below identical to the manifest.

## Name (max 75 chars; from the manifest's `name`)

```
ATO - Advanced Tab Organizer
```

## Short summary (max 132 chars; from the manifest's `description`; shown in search results)

```
Close duplicate tabs safely, see every window at a glance, and find any tab fast. Keyboard-first. No tracking, nothing collected.
```

## Detailed description

```
Too many tabs? ATO finds the duplicates and closes them safely, shows every window at a glance, and finds any tab as you type, all from a fast, keyboard-first popup. No tracking, nothing collected.

Open it with Cmd+U (Mac) or Ctrl+U (Windows/Linux), or click the toolbar icon. The badge shows how many duplicates you have.

━━━━━━━━━━━━━━━━━━━━
DUPLICATES, SAFELY
━━━━━━━━━━━━━━━━━━━━

• One bar tells you how many extra copies are open. "Close N" closes them; "Review" shows each page with its copies, which one stays, and why.
• Never closed by cleanup: the tab you're on in each window, tabs playing sound, and tabs in a split view. Pinned tabs and tabs in a group are protected too, unless you turn that off in settings.
• Flip any copy between keep and close, close one page's copies, or all of them at once.
• Match the whole URL, or ignore the #hash, the ?query, or both.
• Undo brings back everything you closed, however many tabs.
• Right-click a tab: close its duplicates, or the other tabs from its site.

━━━━━━━━━━━━━━━━━━━━
SEE AND MOVE YOUR TABS
━━━━━━━━━━━━━━━━━━━━

• Tabs: every tab, by recency, title, site or number of copies.
• Sites: each site with its tabs; close, unload or move a whole site to its own window.
• Windows: a map of each window's tab strip, tab groups included. Merge a window into this one, focus it, or close it.
• Now playing: the tabs making sound, with mute.
• Unload tabs you're not using to free memory; they stay in the tab strip.

━━━━━━━━━━━━━━━━━━━━
KEYBOARD FIRST
━━━━━━━━━━━━━━━━━━━━

The popup opens with search focused. Type to search titles and URLs across every window, then use the arrow keys and Enter to jump to a tab.

While you're typing, letter keys type, so two shortcuts use Cmd (Ctrl on Windows and Linux): Cmd+D reviews duplicates, and Cmd+Delete (Ctrl+Backspace) closes the highlighted tab, or every result once you've typed a search.

With the search field empty, the down arrow steps into the list, where single keys work: Delete closes, U unloads, S switches views, X selects several tabs, and Cmd+Z undoes the last close. Press ? there for every shortcut.

━━━━━━━━━━━━━━━━━━━━
MAKE IT YOURS
━━━━━━━━━━━━━━━━━━━━

Thirteen themes, light, dark and true black: Graphite, Daylight, Paper, Onyx, Cyber, Neon, Poster, Riso, Nebula, Ember, Lagoon, Sakura and Dune. Or leave it on System, the default, which follows your OS: Daylight in light mode, Graphite in dark.

Choose which copy to keep, what counts as the same page, what's protected, the view the popup opens on, and what the badge shows. Settings from earlier versions of ATO carry over.

━━━━━━━━━━━━━━━━━━━━
PRIVATE BY DESIGN
━━━━━━━━━━━━━━━━━━━━

ATO has no analytics, no tracking and no backend. It reads your tabs inside your browser and never collects, sends or sells your data. Favicons are shown from the addresses Chrome provides, so your browser may load them as it does for the tab strip. Settings sync through your own Chrome account, if sync is on. The last close is remembered for Undo in session storage, which Chrome clears when the browser closes.

Open source: https://github.com/jeanlucaslima/ato

Requires Chrome 157 or newer. Change the shortcut at chrome://extensions/shortcuts.
```

## New in ATO 3

The store has no field for this, and it is the first store release of ATO 3: the people reading it are on 1.9.1. Paste it into the detailed description, above "Open source:". Take it out once most users have updated, a release or two later.

```
━━━━━━━━━━━━━━━━━━━━
NEW IN ATO 3
━━━━━━━━━━━━━━━━━━━━

ATO 3 is a ground-up rewrite of ATO 1.9.

• Review before you close: each page with its copies, which one stays, and why. Flip any copy between keep and close.
• Sites and Windows views: close, unload or move a whole site; merge, focus or close a window.
• Undo brings back any number of closed tabs.
• Unload tabs to free memory without closing them.
• A key for everything, and search across every window as you type.
• Right-click a tab to close its duplicates, or the other tabs from its site.
• Thirteen themes, plus System, the default, which follows your OS.
• Your settings carry over. Tabs in a group are now protected by default; you can change that in settings.

One new permission: when ATO updates, Chrome turns it off until you approve "View and manage your tab groups". ATO uses it to show your tab groups in the Windows view and to keep a group together when you merge windows.
```

## Screenshot captions

The store shows screenshots without captions, so these are the text to set into
each 1280×800 image, in order. The store takes up to five; the five in
`docs/screenshots/store/` follow this table.

| # | Shows | Caption |
| --- | --- | --- |
| 1 | Tabs with the duplicates bar, Daylight (`daylight-tabs.png`) | **Close duplicate tabs, safely.** See how many duplicates are open, and close them in one go. The tab you’re on, playing and pinned tabs stay. |
| 2 | Duplicate review, Daylight (`review.png`) | **Review before you close.** Which copy stays, which close, and why. Flip any copy, then close the rest. |
| 3 | Windows, Paper, beside Sites, Nebula (`windows.png`, `sites.png`) | **Every window at a glance.** Every window as a map of its tabs. Merge, focus or close a window, or a whole site. |
| 4 | Search with matches highlighted, Graphite (the gallery's Search screen) | **Find any tab.** Type to find any tab in any window, matches highlighted. Everything has a key. |
| 5 | The theme picker (`themes.png`) | **Thirteen themes.** Light, dark and true black, or follow your system. |

Alt text for the repo's own shots in `docs/screenshots/`:

- `cyber-tabs.png`: ATO in the Cyber theme: search, the duplicates bar, Now playing and the tab list, on a neon grid.
- `riso-tabs.png`: The tab list in Riso: two fluorescent inks a touch off register, on grained paper.
- `graphite-tabs.png`: The tab list in Graphite, the dark half of System.
- `daylight-tabs.png`: The tab list in Daylight, the light half of System: the current tab, copies and audio each have their own mark.
- `review.png`: Duplicate review in Daylight: each page with its copies, keep or close on each, and the reason a copy stays.
- `sites.png`: Sites view in Nebula: a site opened to show its tabs, with Unload, Move and Close for the whole site.
- `windows.png`: Windows view in Paper: each window with a dot map of its tab strip, tab groups outlined, and Focus, Merge and Close.
- `themes.png`: The settings page's theme picker: System and the thirteen themes, each as a miniature popup in its own colours.

## Supporting dashboard fields

- **Category:** Functionality & UI
- **Language:** English

### Single purpose (required)

```
ATO helps users find and close duplicate browser tabs, and search, sort and manage their open tabs and windows, from one popup.
```

### Remote code use (required)

Select **"No, I am not using remote code."** All JavaScript is bundled in the
package; nothing is fetched or evaluated at runtime. Favicons loaded from
`tab.favIconUrl` are images, not code.

### Permission justifications

`tabGroups` and `contextMenus` are new since 1.9.1, so the dashboard will ask for these two for the first time.

| Permission | Justification |
| --- | --- |
| `tabs` | Read tab titles and URLs (including local `file://` pages) to detect duplicates, search tabs and list them by site and window; close, move, mute and unload tabs on request. |
| `storage` | Save the user's settings (theme, matching, badge options, protections) in sync storage. Keep a record of the last close (the closed tabs' URLs and titles) in session storage, so Undo still works after the popup closes. Chrome clears that record when the browser closes. |
| `sessions` | Restore closed tabs for Undo. |
| `tabGroups` | Read tab group names, colours and collapsed state to draw groups in the Windows view, and move a whole group when the user merges one window into another. ATO does not create, rename or recolour groups. |
| `contextMenus` | Add "Close duplicates of this tab" and "Close other tabs from this site" to the tab right-click menu. |

No host permissions are requested: the `tabs` permission alone exposes tab URLs,
and favicons load as plain `<img>` from `tab.favIconUrl`.

### Data usage disclosure

Select **"This item does not collect or use user data."** Then certify:
- Does **not** sell or transfer user data to third parties (outside approved use cases).
- Does **not** use or transfer data for purposes unrelated to the item's single purpose.
- Does **not** use or transfer data to determine creditworthiness or for lending.

All true: ATO has no analytics, tracking or backend, and it sends tab data nowhere. Favicons are loaded by the browser from the addresses Chrome provides, as on the tab strip. Settings are synced by Chrome through the user's own account, if sync is on.

### Privacy policy URL

```
https://www.jeanlucas.me/en/projects/ato/privacy
```

Portuguese: `https://www.jeanlucas.me/pt/projetos/ato/privacidade`. Canonical source: [`PRIVACY.md`](../PRIVACY.md) in this repo; the site's page (in the jeanlucas.me repo) must say the same, so update both together. Use the `www` host: the bare domain didn't answer when checked on 2026-11-21.

### Homepage and support URLs

- **Homepage:** `https://www.jeanlucas.me/en/projects/ato`
- **Support:** `https://github.com/jeanlucaslima/ato/issues`
- **Official URL:** empty (needs a Search Console–verified site).

## Assets checklist

For 3.1.1, the first store release of ATO 3 (the store has 1.9.1).

- [x] Icon: 128×128 (`src/assets/icons/icon128.png`)
- [ ] Manifest: `name`, `description` and `action.default_title` match this file; version 3.1.1 in `src/manifest.json` and `package.json`
- [ ] Screenshots, 1280×800: `docs/screenshots/store/screenshot-1-1280x800.png` to `-5-`, in the order of [Screenshot captions](#screenshot-captions), each with its caption set into the image
- [ ] Small promo tile 440×280 (optional)
- [ ] Package: `npm run zip` → `ato-v3.1.1.zip`
- [ ] Detailed description pasted with the [New in ATO 3](#new-in-ato-3) block above "Open source:"
- [ ] Justifications entered for `tabGroups` and `contextMenus`, and the `storage` one updated
- [ ] Privacy policy at the URL above matches `PRIVACY.md`
- [ ] Permission note: `tabGroups` adds the warning "View and manage your tab groups", so Chrome turns ATO off on update until each user approves it. The New in ATO 3 block says so; expect questions about it.
