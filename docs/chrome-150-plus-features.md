# Chrome 150 → 158: what's new (research report)

_Compiled 2026-11-15 for ATO v3 planning._

Items marked **(unverified)** come only from press or third-party sources, not from Google.

## Where things stand

- **Release cadence:** Chrome moved to a **two-week stable cycle starting with 153**. That is why the version numbers move fast.
  - [Announcement](https://developer.chrome.com/blog/chrome-two-week-release)
  - [Launch post](https://developer.chrome.com/blog/chrome-two-week-start)
- **Where release notes live:** from Chrome 155 on, per-version release notes are only on [chromestatus.com/release-notes](https://chromestatus.com/release-notes).

| Version | Stable date | Status on 2026-11-15 |
|---|---|---|
| 150 | Jun 30, 2026 | — |
| 151 | Jul 28 | — |
| 152 | Aug 25 | last 4-week release |
| 153 | Sep 8 | first 2-week release |
| 154 | Sep 22 | — |
| 155 | Oct 6 | — |
| 156 | Oct 20 | — |
| **157** | **Nov 3** | **current stable** |
| 158 | Nov 17 | early stable since Nov 12 |
| 159 | Dec 8 | beta |
| 160 | Jan 5, 2027 | dev |

---

## Part 1: what matters for ATO

### Extension API changes

| Chrome | Change | Status | Relevance to ATO |
|---|---|---|---|
| 150 | **`chrome.contextMenus` `"tab"` context.** Adds items to the native right-click menu in the tab strip. | Stable | **High.** Enables "Close duplicates of this tab" or "Close other tabs from this site" without opening the popup. See the notes below. |
| 150 | `chrome.alarms`: names over 1024 bytes throw a `TypeError`. New `persistAcrossSessions` field. | Stable | Low. Only matters if we add scheduled scans. |
| 150 | `chrome.offscreen.hasDocument()` | Stable | None |
| 151 | New `chrome.mimeHandler` namespace (`canEmbed` added in 157) | Stable | None |
| 152 | `devtools.performance` and `devtools.recorder` available under `browser.*` | Stable | None |
| 153 | **`chrome.publicSuffix` API**: `getDomain()`, `getKnownSuffix()`, `isKnownSuffix()`. Needs the `publicSuffix` permission. | Stable | **High.** Gives correct "group by site": `docs.google.com` and `mail.google.com` both become `google.com`, and `co.uk` is handled. It is synchronous, so it can be passed into `core/` as a function. The cost is a new permission; whether it shows an install warning is unverified. |
| 153 | Toolbar icons of new extensions pinned by default | Canary experiment | Medium. If it ships, the badge is visible right after install. |
| 155 | **Split View API**: `tabs.createSplit([a, b])`, `tabs.unsplit(id)`, `tabs.create({ splitWithTabId })`. No permission needed. Designed with Mozilla. | Stable | **High.** See "Split view" below. |
| 155 | `runtime.onEnabled`: fires when the extension is re-enabled | Stable | Low. A hook to rescan the badge. |
| 155 | `chrome.debugger` restrictions on managed browsers | Rolled back Nov 4 | None |
| 157 | **`runtime.onExtensionLoaded`**, with reason `install`, `update`, `browser_update`, `enable`, `startup` or `reload` | Stable | Medium. One event to rebuild the badge state in the future service worker. Needs an `onInstalled` + `onStartup` fallback before 157. |

**Notes on the `"tab"` context menu (Chrome 150):**
- `"all"` does not include `"tab"`, so list it explicitly.
- `documentUrlPatterns` is not supported for this context.
- Before 150, creating such an item throws. Feature-detect with `chrome.contextMenus.ContextType.TAB`.
- The sources disagree on multi-tab selection:
  - The What's New page says items receive all selected tabs.
  - The official PSA says only the right-clicked tab is passed, which matches Firefox.
  - **Plan for the single-tab behavior and test it.**
- Canary had a crash when more than one `"tab"` item was registered. The PSA says the fix ships in M150.

**Split View API (Chrome 155) details:**
- The read side has existed since Chrome 140: `Tab.splitViewId`, `tabs.query({ splitViewId })`, `onUpdated` `changeInfo.splitViewId`, and `tabs.SPLIT_VIEW_ID_NONE = -1`.
- To split two tabs, they must:
  - be adjacent,
  - not already be split,
  - share `windowId`, `pinned` and `groupId`.

**No changes from 150 to 160 in:** `windows`, `sessions`, `tabGroups`, `sidePanel`, `action`, `commands`, `storage`, `omnibox`, `userScripts`, `scripting`, `permissions`.
- `sessions.MAX_SESSION_RESULTS` is still 25, which caps undo.
- There is still no API for saved tab groups.
- There is no API for vertical tabs or tab-strip orientation.
- `storage.sync` no longer has a per-minute sustained-writes quota (the constant is deprecated). The other quotas are unchanged.

**Baseline from just before 150, worth using in v3:**
- **Chrome 148:** every extension API is also available as `browser.*`. `BrowserPort` can target it and keep Firefox possible.
- **Chrome 148:** opt-in structured-clone messaging.
- **Chrome 149:** synchronous `userScripts.execute()` validation.

### Chrome's own tab features (overlap and competition)

| Feature | Since | Status | Overlap with ATO |
|---|---|---|---|
| **Split View**: two tabs side by side, now resizable | ~145 (Feb 2026) | Stable | Must not be broken by closing duplicates |
| **Vertical tabs**: right-click → "Show Tabs Vertically"; collapses to icons; supports groups and split view | Rolled out Apr 2026 (~147, unverified) | Stable | Competes with the "see all tabs with full titles" part of the popup |
| Vertical tabs: group color changes apply immediately; tab-strip scrolling restored | 153 | (unverified) | — |
| Vertical tabs on Android tablets | Code found in 156 | Not launched (unverified) | — |
| Gemini in Chrome working across several open tabs | Mar 2026 | Stable, US first | Little |
| AI Mode "+" menu adds open tabs to a query | Apr 2026 | Stable, US English | Little |
| "Ask Gemini about this group" (`#glic-tab-groups`) | Canary, Jul 2026 | Behind a flag (unverified) | Little |
| **"Notebooks" / "Organizer" side panel**: tab groups plus Gemini chats | Canary | Behind a flag (unverified) | **The most direct future competitor to a "groups by site" view** |
| Tab groups → bookmark folders | Canary | (unverified) | Small, relevant if we add "save session" |
| Saved tab groups save automatically | ~154 | (unverified) | Keep respecting `protectGroups` |
| AI "Organize similar tabs" | — | Help page now redirects, so possibly withdrawn (unverified) | If it's gone, Chrome has no automatic grouping |
| Memory Saver / discarding | — | No official change from 150 to 160 | Discarded tabs may no longer look different in the tab strip (unverified). ATO could flag them. |
| Tab Search | — | No change | — |
| Send a tab to your phone from the right-click menu | 157 | (unverified) | None |
| **Built-in duplicate-tab closer** | — | **None exists** | Still ATO's main advantage |

### Suggested v3 takeaways, by priority

1. **Split view safety.** Treat tabs with `splitViewId !== -1` as protected, or as preferred to keep, in the duplicate planner. Add a fast-check property: "never break a split view". This needs no permission and only reads data that exists since Chrome 140.
   - Chromestatus has a proposal, "Opening links in a split tab", that would make split tabs more common.
2. **Group by site with `publicSuffix.getDomain()`** (Chrome 153+). Weigh correct registrable domains against adding one more permission.
3. **Tab right-click menu items** (Chrome 150+), once the service worker exists. Feature-detect, and assume only the right-clicked tab is passed.
4. **`runtime.onExtensionLoaded`** (Chrome 157+) for badge initialization, with a fallback for older versions.
5. **Target `browser.*`** behind `BrowserPort` (Chrome 148+).

---

## Part 2: all features by version

### Chrome 150 (stable Jun 30, 2026)

**CSS**
- `AccentColor` / `AccentColorText` system colors, which follow the OS accent color; for installed web apps.
- `polygon()` gains an optional rounding parameter.
- `zoom` is animatable.
- `url()` request modifiers: `cross-origin()`, `integrity()`, `referrer-policy()`.
- `text-fit`: scales text to fill its container's width.
- `background-clip: border-area`: gradient borders in pure CSS.
- `image(<color>)`: a solid-color image.
- `light-dark()` accepts images.
- Comma-separated container queries, matched as "any of".
- `page-margin-safety`: keeps print content out of areas the printer can't print.
- `flex-wrap: balance`.
- `named-feature()` in `@supports`.
- `overscroll-behavior: chain`.
- `path-length` CSS property, mapping to SVG `pathLength`.

**HTML/DOM**
- `selectedcontent` cloning updates every instance inside a `<select>`.
- **Focusgroup**: declarative arrow-key navigation for composite widgets.
- Out-of-order streaming with `<template for>`.
- Processing instructions (`<?target data>`) in HTML.
- `popover=hint` gets a simpler stacking model.
- Programmatic scroll methods return promises.

**Web APIs**
- Web Speech on-device recognition `quality` option.
- PWA origin migration within the same site.

**WebGPU**
- Immediates: `setImmediateData()`.

**Security**
- `data:` URL workers get opaque origins.
- SVG filters no longer apply to plugins or to cross-origin iframes.

**Origin trials**
- Email Verification Protocol.
- `performance.getSpeculations()`.
- WebRTC Diagnostic Logging.

### Chrome 151 (stable Jul 28, 2026)

**CSS**
- `AnimationEvent.animation` / `TransitionEvent.animation` accessor.
- `ruby-overhang`.
- `position-anchor` initial value becomes `normal`.
- `AnimationTrigger` play methods no longer rewind finished animations.

**HTML/DOM**
- `shadowrootslotassignment` attribute on `<template>`.
- `aria-actions`.

**Web APIs**
- **`<usermedia>` element**: camera and microphone start only after a user click.
- `DeviceOrientation` / `DeviceMotion` `requestPermission()`.
- Wheel events get a `momentum` flag.
- `textStream()` on `Request`, `Response` and `Blob`.
- Web Speech `unspokenPunctuation`.
- Language Detector returns `zh-Hant` / `zh-Hans`.
- Direct Sockets: `local-network` / `loopback-network` permissions policies.

**Performance**
- `soft-navigation` and `interaction-contentful-paint` entries.
- Opt-in cross-origin redirect timing.
- Duplicate navigations no longer cancel each other.
- Speculation rules `form_submission`.

**Security**
- Non-XSLT XML parsing moves to a memory-safe Rust parser.
- About 370 security fixes (unverified).

**Origin trials**
- Post-quantum WebCrypto (ML-KEM, ML-DSA, ChaCha20-Poly1305, X-Wing).
- Declarative Performance Observer.
- Prefetch activation beacon.
- WebRTC SCTP negotiation acceleration.

**Removals**
- **macOS 12 dropped; macOS 13+ required.**
- `new FontFaceSet()` throws.

### Chrome 152 (stable Aug 25, 2026)

**CSS**
- `CSSPseudoElement` covers `::backdrop`, `::scroll-marker` and `::view-transition`.
- `alpha()` relative color function.
- `window-drag`, which replaces `app-region`.

**HTML/DOM**
- `autocorrect` global attribute.
- OpaqueRange for form-control text.
- **Reference Target** (cross-root ARIA).

**Web APIs**
- macOS PWA notifications show the app's name and icon.
- Isolated Web Apps: sub apps and an unframed display mode.
- `decodingInfo` `encryptionScheme`.
- `getDisplayMedia()` audio preference.

**Performance**
- CPU Performance API, which reports a device tier.

**WebGPU**
- Subgroup size control.

**Security**
- Connection Allowlists header.
- Suspicious-site warnings for Enhanced Safe Browsing users.

**Origin trials**
- Client-side XSLT deprecation trial.
- Speculation Rules viewport heuristics.
- User Agent Image Replacement API.

**Removals**
- **Private Aggregation and related Privacy Sandbox APIs** removed; third-party cookies stay as they are.

### Chrome 153 (stable Sep 8, 2026): first two-week release

**CSS**
- `scroll-axis-lock`.
- Interoperable timing for `transitionrun` and media-query events.
- Single-axis scroll containers: in beta here, listed as shipping in 156.

**HTML/DOM**
- **`<camera>` and `<microphone>` capability elements.**
- Rust XML parser (DOMParser, `responseXML`, SVG).

**Media**
- IAMF spatial audio decoding.
- WebAudio `renderSizeHint`.

**JavaScript**
- `Iterator.prototype.join()`.
- `Iterator.zip()` / `Iterator.zipKeyed()`.

**WebGPU**
- WGSL `buffer_view`.

**Origin trials**
- JS Self-Profiling Markers.

**Deprecations**
- Protected Audience, Related Website Sets, Shared Storage, `requestStorageAccessFor`, Attribution Reporting.

**Removals**
- `_current` navigation target.

**UI (unverified)**
- Bookmarks bar option "only on the New Tab page".

### Chrome 154 (stable Sep 22, 2026)

**CSS**
- `scroll-marker-group` `links` / `tabs` modes.
- `text-decoration-inset`. The sources disagree: 154 or 157.
- Typed OM in workers.
- `FontFace.width` / `font-width`.
- Popover and dialog light dismiss now fires on `click`.

**HTML/DOM**
- **Responsively-sized `<iframe>`** (`frame-sizing`; the embedded page must opt in).

**Network**
- `WebSocket` options bag.
- `targetAddressSpace` for WebSockets.
- Fetch abort reason exposed.
- CORS and Local Network Access for Background Fetch. The sources disagree on whether CORS landed in 154 or 157.

**JavaScript**
- `Iterator.prototype.includes()`.

**Security**
- **Ask before HTTP is on by default** (policy: `HttpsOnlyMode`).
- Secure Payment Confirmation locale validation.

**Isolated Web Apps**
- Window Shape API on ChromeOS.

**Origin trials**
- Private Verification Tokens.

### Chrome 155 (stable Oct 6, 2026)

**CSS**
- `symbols()`.
- `text-decoration-skip-spaces`.
- `margin-trim`.
- `display-state` / `resizable` media features.

**Web APIs**
- **Additional Windowing Controls**: PWAs can call `maximize()`, `minimize()`, `restore()` and `setResizable()`.
- Digital Credentials issuance.
- Linear canvas color spaces.
- **JPEG XL decoding** with a Rust decoder.
- Permissions policy to pause audible media in hidden iframes.

**JavaScript**
- **Import Text**: `import x from "./f.txt" with { type: "text" }`.

**Security**
- WebCrypto post-quantum and AEAD algorithms ship.
- Gemini-based server-side scam checks on desktop for Enhanced Safe Browsing users.
- HTTPS-First on by default (unverified).

**Extensions**
- Split View API.
- `runtime.onEnabled`.

**UI (unverified)**
- Gemini virtual try-on, US only.

### Chrome 156 (stable Oct 20, 2026)

**CSS**
- **`random()`**.
- A pseudo-class matching the element that started a navigation.
- Single-axis scroll containers (`overflow: scroll clip`).
- `scroll-snap-type: pair`.

**Web APIs**
- WebTransport `headers` / `responseHeaders`.
- Compression-dictionary fetch fixes.
- **IndexedDB on SQLite** for new stores.
- WebRTC Diagnostic Logging.

**JavaScript**
- Failed module loads are no longer cached, so `import()` retries.

**WebGPU**
- `frag_depth` `less` / `greater` modifiers.

**Removals**
- FencedFrame and `window.fence` become no-ops.

**UI (unverified)**
- Gemini can answer questions about video and audio you're playing.
- Gemini voice typing.

### Chrome 157 (stable Nov 3, 2026): current stable

**CSS**
- `text-overflow: <string>`.
- `position-visibility: anchor-valid`, plus `anchor-visible`.

**HTML/DOM**
- **New HTML insertion and streaming methods**: `before`/`after`/`append`/`prepend`/`replaceWith` variants that take HTML, and `stream…HTML()` methods returning a `WritableStream`.
- `runScripts` option.
- Trusted Types `createParserOptions`.

**Web APIs**
- `ProgressEvent` in service workers.
- Language Detector on Android.
- Web Bluetooth GATT server is an `EventTarget`.
- **HTML-in-canvas**.

**WebGPU**
- 64-bit atomic min/max on `vec2u`.

**Performance**
- Long Animation Frames: style and layout durations.

**Origin trials**
- Connection Allowlists Embedded Enforcement.
- Overscroll Areas.

**Extensions**
- `runtime.onExtensionLoaded`.

**UI (unverified)**
- Redesigned three-dot menu.
- AI "enhanced autofill".
- Send tab to phone.
- Windows dynamic patching without a restart.
- 213 security fixes, including an exploited XML use-after-free.

### Chrome 158 (stable Nov 17, 2026; early stable now)

**CSS**
- `::highlight(*)`.
- `flow-start` / `flow-end`.
- `object-fit` / `object-position` on embedded SVG.
- `:playing` / `:paused` media pseudo-classes.

**HTML**
- **`<install>` element** and **`navigator.install()`** (Web Install API).
- SVG `<textPath side>`.

**Web APIs**
- `OfflineAudioContext` incremental rendering.
- WebHID on Android 17+.
- WebTransport: draining, stream hints, reliability.
- IWA Source-Specific Multicast.

**Security**
- `focus-without-user-activation` permissions policy.

**Removals**
- **XSLT stops working on Stable** except for origin-trial and enterprise-policy users. It is fully removed in 176.

### Not covered

- Chrome 159 (beta) and 160 (dev) were not researched. Their notes are at [chromestatus.com/release-notes/159](https://chromestatus.com/release-notes/159).

---

## Sources

**Official release notes and blog posts**
- https://developer.chrome.com/release-notes/150
- https://developer.chrome.com/release-notes/151
- https://developer.chrome.com/release-notes/152
- https://developer.chrome.com/release-notes/153
- https://developer.chrome.com/release-notes/154
- https://chromestatus.com/release-notes/155
- https://chromestatus.com/release-notes/156
- https://chromestatus.com/release-notes/157
- https://chromestatus.com/release-notes/158
- https://developer.chrome.com/blog/new-in-chrome-150 through `new-in-chrome-154`
- https://developer.chrome.com/blog/chrome-157-beta
- https://developer.chrome.com/blog/chrome-158-beta
- https://chromiumdash.appspot.com/schedule
- https://chromereleases.googleblog.com/

**Extensions**
- https://developer.chrome.com/docs/extensions/whats-new
- https://developer.chrome.com/docs/extensions/reference/api (tabs, contextMenus, publicSuffix, runtime, alarms, tabGroups, sidePanel)
- https://developer.chrome.com/blog/split-view-api-extensions
- https://developer.chrome.com/docs/extensions/develop/concepts/browser-namespace
- https://groups.google.com/a/chromium.org/g/chromium-extensions/c/RReE8dtY4Ok (PSA on the `"tab"` context menu)
- https://chromestatus.com/feature/5136319775899648 (opening links in a split tab)

**Chrome product features**
- https://blog.google/products-and-platforms/products/chrome/new-chrome-productivity-features/ (vertical tabs)
- https://blog.google/products-and-platforms/products/chrome/chrome-productivity-improvements/ (split view)
- https://blog.google/products-and-platforms/products/search/ai-mode-chrome/

**Press, for items marked unverified**
- https://techcrunch.com/2026/04/07/chrome-is-finally-getting-vertical-tabs/
- PCWorld, PC-Welt, Gigazine, Chrome Unboxed, Windows Report, Android Authority, Android Headlines, piunikaweb, helentech.jp
