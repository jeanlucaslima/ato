# Reel recorders

How the Instagram videos (2026-11-21) were made. They aren't kept in the repo; these scripts make them again. Each one opens a scene of `src/dev/reel.html` in headless Google Chrome and saves PNG frames; ffmpeg turns those into an MP4.

Not part of the build: `playwright-core` isn't a dependency, so install it without saving.

```bash
npm i --no-save playwright-core
npx vite --port 5199 --strictPort &   # the dev server the scripts load
```

Run the commands from the repo root. Everything is 1080×1920 (9:16, Stories and Reels), H.264, 30 fps, silent, with no text.

## Story: the popup in use (1080×1920, room on top for text)

```bash
node scripts/reel/story.mjs cyber /tmp/frames 476 846 1080 1920 top
ffmpeg -f concat -safe 0 -i /tmp/frames/list.txt \
  -vf "fps=30,scale=1080:1920:flags=lanczos,format=yuv420p" \
  -c:v libx264 -preset slow -crf 18 -movflags +faststart ato-story-cyber.mp4
```

The keystrokes (search, review and close duplicates, Sites, Windows) are in the script. For the 4:5 feed size: `... 520 650 1080 1350 0` and `scale=1080:1350`.

## Logo: one full turn on the Cyber backdrop

```bash
node scripts/reel/logo.mjs /tmp/logo 12 30
ffmpeg -framerate 30 -i /tmp/logo/f%04d.png -vf format=yuv420p \
  -c:v libx264 -preset slow -crf 16 -movflags +faststart ato-logo-cyber.mp4
```

## Themes: a tilted sheet of every theme, panning

```bash
node scripts/reel/themes.mjs /tmp/themes 10 30 '.reel-sheet { --zoom: 0.52; --travel: 1500px; }'
ffmpeg -framerate 30 -i /tmp/themes/f%04d.png -vf format=yuv420p \
  -c:v libx264 -preset slow -crf 17 -movflags +faststart ato-themes-pan.mp4
```

## Notes

- The popup runs over the gallery's sample tabs (`src/dev/fixtures.ts`) through `FakeBrowser`, so no real browsing data appears.
- `story.mjs` records in real time (keystrokes with pauses), so its timing varies a little between runs. `logo.mjs` and `themes.mjs` step frame by frame and are exact.
- Scenes, layout and theme: `src/dev/reel.ts` and `src/dev/reel.css`.
- To make the 4:5 feed version, use the arguments under Story above.
