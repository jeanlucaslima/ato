# Theme checklist

What a theme needs before it ships, learned from Poster's fixes and Missing Link's build (2026-11-28). A palette alone is not a theme: most of the bugs were in states nobody looked at, or in one theme rule quietly replacing a shared one.

## Every state, not just the list

Walk every gallery fixture in the theme, in light and dark if it has both:

- The cursor on every kind of row: tab, site, a tab inside a site, window (and its tab map), Now playing, Review set and copy, and the duplicates bar. The cursor must be unmistakable, not just a different border colour.
- Hover on everything inside a highlighted row: `×`, buttons, mute. A theme that inverts rows (Poster) must re-colour every child, or text goes white on white.
- Review, Review's "No duplicates left", select mode, search with chips, the toast (short and three-line), the shortcuts panel scrolled, the settings page and its theme card.

## One theme rule must not cancel a shared one

The bugs that shipped came from a theme setting a property the shared CSS used for state:

- A theme `box-shadow` on the duplicates bar replaced its cursor ring (Cyber, Riso). State now uses `outline`, which themes leave alone. Check any new state style the same way.
- An opaque, higher-specificity shared rule beat the theme's cursor colour (Poster's open Review set header).

Quick check in the gallery: toggle `is-cursor` on one element of each kind and compare computed styles; if nothing changes, the cursor is invisible.

## Shape is consistent

- Hard-edged themes are square everywhere (`:where(*) { border-radius: 0 !important }` in the theme). Soft themes have no stray square boxes.
- Boxed items (Now playing, the duplicates bar) and their highlighted rows agree: no white rim around an inverted row.
- Spacing is even: margins to the popup's sides are equal once shadows are counted; gaps between boxes are one value.

## Contrast, measured

Text on its real background (composited, including translucent fills) at least 4.5:1 for small text, 3:1 for large; check highlighted rows and hovers too.

## Motion

Decorative only: the app's state never waits on it, and `prefers-reduced-motion` turns it off. One motion at a time: a theme's screen transition replaces the app's own entrance effects, it does not play on top of them (Missing Link's first transition blinked because rows faded in under a stepped slide).

## Performance

`npm run perf` for the pure paths, and in the real extension: a theme's backgrounds, filters and transitions must not make scrolling, typing or opening the popup lag.

---

## How a theme is promoted (as Missing Link was)

1. Prototype in the gallery first: `src/dev/` CSS, a gallery tab (`PROTOS` in `src/dev/screens.ts`), nothing in settings.
2. Move it to `src/ui/theme-<id>.css` and import it from `src/ui/themes.css`. Scope everything to `[data-theme='<id>']`.
3. Add the id to `THEMES` (`src/core/settings.ts`) and an entry to `THEME_INFO` (`src/ui/theme.ts`): `isNew: true` lists it first in the picker with a badge (remove the flag the release after); `dayNight: true` for a theme with its own light and dark looks, which then follows the OS through `@media (prefers-color-scheme)` and takes `data-variant="day" | "night"` to force one (the picker card shows both; the gallery's forced tabs live in `VARIANT_OF`).
4. Give its picker card (`.mini[data-theme]`) the theme's signature, at that size.
5. Screen transitions: setting `--screen-door: iris` makes the app run a view transition into and out of Review (`app.ts`), and the settings page when the theme is picked (`options/main.ts`); the theme's CSS animates `::view-transition-old/new(ato-screen)`. Without it, nothing changes.
6. An 8-bit logo: `--ico-pixels: <grid>` on `.brand-logo` or `.settings-head .ico` draws `pixelIcosahedron` instead of the vector logo, in `--ico-px-1…3` and `--ico-px-edge`, turning in `--ico-px-step` degree frames.
7. Tests: the picker count and order (`settings-page.test.ts`, `theme.test.ts`). Store listing, README and the theme count. A gallery pass against this checklist in every variant, and a check in the real extension.

## Missing Link: what's next

- **The small logo.** At 14 pixels the popup's relic reads as a smooth gold gem: the silhouette and three shades are clean, but the triangles are lost. Next: try the inner edges in a darker gold (shade 3, not the outline colour) so the facets show without the harsh lines; or a bespoke hand-drawn 14×14 sprite for a few angles (a sprite sheet, with the turn picking the nearest frame), which is how small game sprites are really made. Compare at 1×, 2× and 6× in the gallery before choosing.
- **The settings title relic** (44 pixels) is good; check it at other spin angles, the outline can thicken where two edges meet.
- **The toolbar icon** stays the real PNG; no theme changes it.
- No characters, names, catchphrases or logos from any game (the Triforce, a fairy that says "Hey, listen!"): the store risk was weighed and declined. The genre's vocabulary (pixels, dungeons, chests, hearts, keys, iris doors, text boxes) is fine.

## Blueprint: promotion

Blueprint is a prototype (`src/dev/proto-themes.css`); its promotion notes are there (the selected tab zooms like a game menu; light and dark following the OS, dark being the Prussian-blue sheet). Give it the same pass Missing Link got:

- Light and dark, both through every fixture above.
- The zoom on the cursor row: check it never shifts text under the pointer, never overlaps the row above or below, and that it stops with reduced motion.
- Crop marks as the cursor: visible on every kind of row, including the duplicates bar and Now playing.
- Its ruler and dimension lines: never under text, never shifting layout.
- Its own icons where they help (a drafting tool for settings?), drawn in the theme's linework.
- A preview card that shows both light and dark, like System's: `dayNight: true` and `data-variant`, as above.
- Concretely: move the `BLUEPRINT` block out of `src/dev/proto-themes.css` into `src/ui/theme-blueprint.css`; write the dark sheet (Prussian blue, white and pale-cyan lines, a faint white grid) as the night variant; build the zoom as a transform on the cursor row (`scale: 1.03` with `transform-origin` at its left edge, so text under the pointer moves least), off with reduced motion, and check it at 2,000 tabs (`npm run perf` and scrolling in the real popup).

## Cyber: review

Cyber shipped before this checklist; give it the full pass:

- Its cursor on the duplicates bar was invisible until the outline fix; check every other kind of row, and hovers inside them.
- Glows and the grid: contrast of text over the glowing panels, and whether the glow still reads with the dimmer grid.
- Scanlines over the popup: do they cost frames when scrolling a long list?
- Its sliders icon: consistent weight with the rest of its linework.
- Motion: the pulsing dot and glows stop with reduced motion.
