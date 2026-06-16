# Chrome Web Store Listing

Source of truth for ATO's Chrome Web Store listing. Update this when the listing
changes, then copy fields into the Developer Dashboard.

## Name (max 75 chars)

```
ATO – Advanced Tab Organizer
```

## Short summary (max 132 chars — shown in search results)

```
Kill duplicate tabs instantly. Find, group, and clean up open tabs from a fast keyboard-driven popup. No data leaves your browser.
```

## Detailed description

```
Drowning in tabs? ATO (Advanced Tab Organizer) finds and closes duplicate tabs in one click, and gives you a fast, keyboard-driven popup to search, group, and tidy everything you have open — without sending a single byte off your device.

Open it with Cmd+U (Mac) or Ctrl+U (Windows/Linux), or click the toolbar icon. The badge always shows how many duplicates you have, so you know at a glance when it's time to clean up.

━━━━━━━━━━━━━━━━━━━━
WHAT IT DOES
━━━━━━━━━━━━━━━━━━━━

• Duplicate detection — Spots duplicate tabs automatically and shows the count on the toolbar badge in real time.

• One-click cleanup — Close every duplicate at once, keeping the tab you want (oldest or newest). Your active tab is never closed.

• Powerful search — Filter tabs by title, URL, or domain with full keyboard navigation and match highlighting. Three modes:
   – Fuzzy (default): forgiving, typo-tolerant matching
   – Exact whole-word: wrap a query in quotes, e.g. "burger"
   – Wildcard substring: add an asterisk, e.g. hack* — matches the literal text anywhere

• Playing media — Tabs making sound float to a section at the top and get a speaker icon wherever they appear, so you can find that noisy tab instantly.

• Domain groups — See your tabs grouped by site, sortable A–Z, by most tabs, or by most recent. Merge or close every tab from a domain in one move.

• Undo — Accidentally closed something? Restore the tabs you just closed.

• Real-time updates — The badge and popup react as you browse.

━━━━━━━━━━━━━━━━━━━━
MAKE IT YOURS
━━━━━━━━━━━━━━━━━━━━

A full options page lets you tune ATO to your workflow:
• Light / dark theme and a choice of bundled fonts
• How duplicates are matched (exact URL, or ignore query string and/or hash)
• Which tab to keep when closing duplicates
• Protect pinned tabs and tab groups from being closed
• Badge behavior — show duplicate count or total tab count, custom color, or hide it
• Scope detection to the current window only

━━━━━━━━━━━━━━━━━━━━
PRIVATE BY DESIGN
━━━━━━━━━━━━━━━━━━━━

ATO runs entirely in your browser. It makes no network requests, has no analytics or trackers, and never collects, transmits, or sells your data. Your tabs and settings stay on your device (settings sync only through your own Chrome account, if you have sync enabled).

Built with vanilla JavaScript for a tiny footprint and fast load times. Open source — review the code or contribute at:
https://github.com/jeanlucaslima/ato

━━━━━━━━━━━━━━━━━━━━
KEYBOARD SHORTCUT
━━━━━━━━━━━━━━━━━━━━

Cmd+U (Mac) / Ctrl+U (Windows & Linux) to open the popup. You can change this in chrome://extensions/shortcuts.
```

## Supporting dashboard fields

- **Category:** Workflow & Planning
- **Language:** English

### Single purpose (required)

```
ATO helps users find and close duplicate and excess browser tabs, and search, group, and manage their open tabs, from a single popup.
```

### Remote code use (required)

Select **"No, I am not using remote code."** All JavaScript is bundled in the
package; nothing is fetched or evaluated at runtime. Favicons loaded from
`tab.favIconUrl` are images, not code.

### Permission justifications

| Permission | Justification |
| --- | --- |
| `tabs` | Read tab titles and URLs (including local `file://` pages) to detect duplicates, search, and group tabs; close tabs on request. |
| `storage` | Save the user's settings (theme, match mode, badge options, etc.). |
| `sessions` | Restore recently closed tabs for the Undo feature. |

No host permissions are requested — the `tabs` permission alone exposes tab URLs
(verified to include `file://`), and favicons load as plain `<img>` from
`tab.favIconUrl`. Dropping `<all_urls>` avoids the broad-host-permission in-depth
review with no loss of functionality.

### Data usage disclosure

Select **"This item does not collect or use user data."** Then certify:
- Does **not** sell or transfer user data to third parties (outside approved use cases).
- Does **not** use or transfer data for purposes unrelated to the item's single purpose.
- Does **not** use or transfer data to determine creditworthiness or for lending.

All true: ATO makes no network requests and has no analytics/trackers.

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

- [ ] Icon: 128×128 (from `src/assets/icons/`)
- [ ] At least 1 screenshot, 1280×800 or 640×400 (have `docs/screenshots/popup.png` — verify dimensions/crop)
- [ ] Small promo tile 440×280 (optional but recommended)
- [ ] Package: `ato-v1.9.1.zip`
