/**
 * Stages for Instagram videos, recorded by scripts/reel/ (see its README).
 * - Default: a single live popup, centred on a bare stage.
 * - `?scene=logo`: only the backdrop and the 3D logo, centred in the lower half;
 *   `window.drawLogo(deg)` draws it at an angle, so a recorder can step frame by frame.
 * - `?scene=themes`: every theme as a live popup on a tilted sheet;
 *   `window.panTo(t)` (0 to 1) slides the sheet, so a recorder can step frame by frame.
 * `?theme=cyber` picks the theme.
 */
import '../ui/tokens.css';
import '../ui/popup.css';
import '../ui/settings.css';
import './reel.css';
import { DEFAULT_SETTINGS, readSettings } from '../core/settings';
import { mountApp } from '../ui/app';
import { drawAt, icosahedron } from '../ui/icosahedron';
import { applyTheme } from '../ui/theme';
import { THEMES } from '../core/settings';
import { FakeBrowser } from './fake-browser';
import { FIXTURES } from './fixtures';

const params = new URLSearchParams(location.search);
const settings = readSettings({ ...DEFAULT_SETTINGS, theme: params.get('theme') ?? DEFAULT_SETTINGS.theme });
applyTheme(settings.theme);

if (params.get('scene') === 'themes') {
  // Tabs, review, sites and windows in turn, so the sheet shows more than one screen.
  const looks = [0, 6, 3, 4].map((i) => FIXTURES[i]!.state);
  const cols = 4;
  const rows = 6;
  const sheet = document.createElement('div');
  sheet.className = 'reel-sheet';
  sheet.style.setProperty('--cols', String(cols));
  for (let i = 0; i < cols * rows; i++) {
    const tile = document.createElement('div');
    tile.className = 'reel-tile';
    tile.dataset.theme = THEMES[(i * 5) % THEMES.length]!;
    const look = looks[(i + Math.floor(i / cols)) % looks.length]!;
    mountApp(tile, new FakeBrowser(look.snapshot!), look);
    sheet.append(tile);
  }
  const view = document.createElement('div');
  view.className = 'reel-view';
  view.append(sheet);
  document.body.replaceChildren(view);
  (window as unknown as { panTo: (t: number) => void }).panTo = (t) => sheet.style.setProperty('--pan', String(t));
} else if (params.get('scene') === 'logo') {
  const logo = icosahedron(Number(params.get('radius')) || 72);
  const spot = document.createElement('div');
  spot.className = 'reel-logo';
  spot.append(logo);
  document.body.replaceChildren(spot);
  (window as unknown as { drawLogo: (deg: number) => void }).drawLogo = (deg) => drawAt(logo, deg);
} else {
  const stage = document.createElement('div');
  stage.className = 'reel-stage';
  document.body.replaceChildren(stage);
  const start = FIXTURES[0]!.state;
  mountApp(stage, new FakeBrowser(start.snapshot!), start);
}
