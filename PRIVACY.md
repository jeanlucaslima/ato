# Privacy Policy for ATO – Advanced Tab Organizer

_Last updated: 2026-06-16_

ATO (Advanced Tab Organizer) is a Chrome extension that helps you find and close
duplicate tabs and search, group, and manage your open tabs from a popup.

## The short version

**ATO does not collect, transmit, sell, or share any of your data.** Everything
the extension does happens locally, inside your own browser. It makes no network
requests, contains no analytics or trackers, and has no backend server.

## What ATO accesses (and why)

To do its job, ATO reads information about your open tabs entirely on your device:

- **Tab titles and URLs** — used to detect duplicate tabs, power search, and
  group tabs by domain. This information is read in memory to render the popup
  and is never sent anywhere.
- **Favicons** — each tab's icon is displayed in the popup using the icon URL the
  browser already has for that tab.
- **Recently closed tabs** — used only to provide the "Undo" feature, via
  Chrome's `sessions` API.

## Settings storage

Your preferences (theme, font, duplicate-matching mode, badge options, tab
protection) are saved using Chrome's `storage.sync` API. If you have Chrome Sync
enabled, these settings sync across your own signed-in browsers through your
Google account. ATO itself never receives this data — it is handled by Chrome.

## Data sharing

ATO does not sell or transfer any user data to third parties. It does not use or
transfer data for any purpose unrelated to its single purpose, and it does not
use data to determine creditworthiness or for lending purposes.

## Permissions

- `tabs` — read tab titles/URLs to detect duplicates, search, and group tabs.
- `storage` — save your settings locally / via Chrome Sync.
- `sessions` — restore recently closed tabs (Undo).
- Host access (`<all_urls>`) — read tab URLs to detect duplicates and load
  favicons. URLs are only processed locally.

## Open source

ATO is open source. You can review exactly what it does at
https://github.com/jeanlucaslima/ato

## Contact

Questions about this policy? Open an issue at
https://github.com/jeanlucaslima/ato/issues
