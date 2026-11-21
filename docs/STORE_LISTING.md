# Chrome Web Store Listing

Source of truth for ATO's Chrome Web Store listing. Update this when the listing
changes, then copy fields into the Developer Dashboard. This is the **v3** listing:
v3 replaces 2.x under the same store item.

## Name (max 75 chars)

```
ATO – Advanced Tab Organizer
```

## Short summary (max 132 chars — shown in search results)

```
Close duplicate tabs safely, see every window at a glance, and find any tab fast. Keyboard-first. No data leaves your browser.
```

## Detailed description

```
Too many tabs? ATO finds the duplicates and closes them safely, shows every window at a glance, and finds any tab as you type, all from a fast, keyboard-first popup. Nothing leaves your browser.

Open it with Cmd+U (Mac) or Ctrl+U (Windows/Linux), or click the toolbar icon. The badge shows how many duplicates you have.

━━━━━━━━━━━━━━━━━━━━
DUPLICATES, SAFELY
━━━━━━━━━━━━━━━━━━━━

• One bar tells you how many extra copies are open. "Close" closes them; "Review" shows each page with its copies, which one stays, and why.
• Never closed: the tab you're on, tabs playing sound, tabs in a split view, pinned tabs, and (if you like) tabs in a group.
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

Start typing to search titles and URLs across every window. Arrow keys and Enter to jump, Delete to close (Cmd+Delete while you're still typing), D to review duplicates, S to switch views, X to select several tabs, Cmd+Z to undo. Press ? in the popup for every shortcut.

━━━━━━━━━━━━━━━━━━━━
MAKE IT YOURS
━━━━━━━━━━━━━━━━━━━━

Thirteen themes, light, dark and true black: Graphite, Daylight, Paper, Onyx, Cyber, Neon, Poster, Riso, Nebula, Ember, Lagoon, Sakura and Dune. Or leave it on System, the default, which is Daylight by day and Graphite by night.

Choose which copy to keep, what counts as the same page, what's protected, the view the popup opens on, and what the badge shows. Settings saved by ATO 2 carry over.

━━━━━━━━━━━━━━━━━━━━
PRIVATE BY DESIGN
━━━━━━━━━━━━━━━━━━━━

ATO runs entirely in your browser. ATO has no analytics, tracking or backend. Your tabs never leave your browser. Favicons are shown from the addresses Chrome provides, so your browser may load them as it would on the tab strip. It never collects, transmits or sells your data. Settings sync only through your own Chrome account, if sync is on.

Open source: https://github.com/jeanlucaslima/ato

Requires Chrome 157 or newer. Change the shortcut at chrome://extensions/shortcuts.
```

## What's new in 3.1

The store has no field for this. Paste it into the detailed description, above
"Open source:", and take it out at the next release.

```
━━━━━━━━━━━━━━━━━━━━
NEW IN 3.1
━━━━━━━━━━━━━━━━━━━━

• Four new themes. Daylight: neutral light where the current tab, copies, audio and keep or close are each a clear mark. Onyx: true black for OLED. Poster: black type, signal red, hard shadows. Riso: two fluorescent inks a touch off register.
• System is the default for new installs: Daylight by day, Graphite by night. A theme you already chose stays.
• Settings: "Same page when" shows two example URLs and whether they count as the same page.
• Keyboard: from an empty search field the arrows step into the list, so Delete closes the row. Cmd+Delete closes from the search field. The footer always shows the key that works right now.
• Big counts read properly (1,102 duplicates), and light themes show the selected view clearly.
• Now playing no longer slows the popup down with thousands of tabs open.
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

- **Category:** Workflow & Planning
- **Language:** English

### Single purpose (required)

```
ATO helps users find and close duplicate and excess browser tabs, and search, group, and manage their open tabs and windows, from a single popup.
```

### Remote code use (required)

Select **"No, I am not using remote code."** All JavaScript is bundled in the
package; nothing is fetched or evaluated at runtime. Favicons loaded from
`tab.favIconUrl` are images, not code.

### Permission justifications

| Permission | Justification |
| --- | --- |
| `tabs` | Read tab titles and URLs (including local `file://` pages) to detect duplicates, search and group tabs; close, move, mute and unload tabs on request. |
| `storage` | Save the user's settings (theme, matching, badge options, protections). |
| `sessions` | Restore recently closed tabs for Undo. |
| `tabGroups` | Show tab group names and colours in the Windows view, keep grouped tabs protected, and move whole groups when merging windows. |
| `contextMenus` | Add "Close duplicates of this tab" and "Close other tabs from this site" to the tab right-click menu. |

No host permissions are requested: the `tabs` permission alone exposes tab URLs,
and favicons load as plain `<img>` from `tab.favIconUrl`.

### Data usage disclosure

Select **"This item does not collect or use user data."** Then certify:
- Does **not** sell or transfer user data to third parties (outside approved use cases).
- Does **not** use or transfer data for purposes unrelated to the item's single purpose.
- Does **not** use or transfer data to determine creditworthiness or for lending.

All true: ATO has no analytics, tracking or backend, and tab data never leaves the browser (favicons are loaded by the browser from the addresses Chrome provides, as on the tab strip).

### Privacy policy URL

Preferred (own domain):

```
https://www.aleattorium.com/ato/privacy
```

Fallback (open-source mirror, live now):

```
https://github.com/jeanlucaslima/ato/blob/main/PRIVACY.md
```

Canonical source: [`PRIVACY.md`](../PRIVACY.md) in this repo. Publish the same
markdown content at `/ato/privacy` in the aleattorium.com repo and use that URL
in the store form.

## Assets checklist

- [x] Icon: 128×128 (`src/assets/icons/icon128.png`)
- [x] Screenshots, 1280×800, for 3.1: `docs/screenshots/store/screenshot-1-1280x800.png` to `-5-`, in the order of [Screenshot captions](#screenshot-captions), each with its caption set into the image
- [ ] Small promo tile 440×280 (optional)
- [ ] Package: `npm run zip` → `ato-v3.1.0.zip`
