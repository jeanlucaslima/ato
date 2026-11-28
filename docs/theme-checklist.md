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

## Blueprint: promotion

Blueprint is a prototype (`src/dev/proto-themes.css`); its promotion notes are there (the selected tab zooms like a game menu; light and dark following the OS, dark being the Prussian-blue sheet). Give it the same pass Missing Link got:

- Light and dark, both through every fixture above.
- The zoom on the cursor row: check it never shifts text under the pointer, never overlaps the row above or below, and that it stops with reduced motion.
- Crop marks as the cursor: visible on every kind of row, including the duplicates bar and Now playing.
- Its ruler and dimension lines: never under text, never shifting layout.
- Its own icons where they help (a drafting tool for settings?), drawn in the theme's linework.
- A preview card that shows both light and dark, like System's.

## Cyber: review

Cyber shipped before this checklist; give it the full pass:

- Its cursor on the duplicates bar was invisible until the outline fix; check every other kind of row, and hovers inside them.
- Glows and the grid: contrast of text over the glowing panels, and whether the glow still reads with the dimmer grid.
- Scanlines over the popup: do they cost frames when scrolling a long list?
- Its sliders icon: consistent weight with the rest of its linework.
- Motion: the pulsing dot and glows stop with reduced motion.
