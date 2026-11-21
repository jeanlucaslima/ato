import '../ui/tokens.css';
import '../ui/popup.css';
import '../ui/settings.css';
import './screens.css';
import './proto-themes.css';
import { CHOICES, DEFAULT_SETTINGS, readSettings, type Settings } from '../core/settings';
import { mountApp, type App } from '../ui/app';
import { h } from '../ui/dom';
import { mountSettings } from '../ui/settings-page';
import { applyTheme, resolveTheme, THEME_INFO } from '../ui/theme';
import { attachSpin, icosahedron } from '../ui/icosahedron';
import { logoSvg } from '../ui/logo-svg';
import { FakeBrowser } from './fake-browser';
import { FIXTURES, type Fixture } from './fixtures';
import { MemorySettings } from './memory-settings';
import { makeSnapshot } from './perf';
import { initialUi } from '../ui/state';
// Not src/manifest.json: the dev server serves that path as the raw file, so importing it fails.
import pkg from '../../package.json';

/** `?big=2000`: only one popup, over that many generated tabs (timing in real Chrome). */
const big = Number(new URLSearchParams(location.search).get('big')) || 0;
const shown: Fixture[] = big > 0 ? [{ name: `${big} generated tabs (perf)`, state: { snapshot: makeSnapshot(big), ui: initialUi() } }] : FIXTURES;

const startSettings: Settings = readSettings({ ...DEFAULT_SETTINGS, theme: new URLSearchParams(location.search).get('theme') ?? DEFAULT_SETTINGS.theme });
/** One settings store for the whole gallery: its theme is the gallery's theme. */
const settings = new MemorySettings(startSettings);

const settingsFrame = h('div', { class: 'slot settings-frame' });
const showSettings = () => settingsFrame.scrollIntoView({ behavior: 'smooth', block: 'start' });

/** Each fixture is a live popup over its own in-memory browser. */
function mountFixture(slot: HTMLElement, fixture: Fixture): App {
  const browser = fixture.state.snapshot ? new FakeBrowser(fixture.state.snapshot, showSettings) : null;
  return mountApp(slot, browser, fixture.state);
}


/** Prototype themes (gallery only, see proto-themes.css): `?proto=holo` wears one over every screen. */
const PROTOS = { holo: 'Holo', blueprint: 'Blueprint', glacier: 'Glacier' } as const;
type Proto = keyof typeof PROTOS;
const isProto = (v: string | null): v is Proto => v !== null && v in PROTOS;
const fromUrl = new URLSearchParams(location.search).get('proto');
let proto: Proto | null = isProto(fromUrl) ? fromUrl : null;
let currentTheme: Settings['theme'] = startSettings.theme;
/**
 * Every theme, and the prototypes after them, as a row of tabs: click to wear one
 * (saved like the settings picker), hover to preview it without leaving the current one.
 */
const themeTab = (label: string, value: string, title: string) => h('button', { class: 'theme-tab', type: 'button', 'data-theme-tab': value, title }, label);
const themeTabs = h(
  'nav',
  { class: 'theme-tabs', 'aria-label': 'Theme' },
  CHOICES.theme.map((t) => themeTab(THEME_INFO[t].name, t, THEME_INFO[t].tagline)),
  h('span', { class: 'theme-tabs-sep' }, 'Prototypes'),
  (Object.keys(PROTOS) as Proto[]).map((p) => themeTab(PROTOS[p], `proto:${p}`, 'Prototype, gallery only')),
);
const tabValue = (el: EventTarget | null) => (el as HTMLElement | null)?.closest<HTMLElement>('[data-theme-tab]')?.dataset.themeTab;
themeTabs.addEventListener('click', async (e) => {
  const value = tabValue(e.target);
  if (!value) return;
  if (value.startsWith('proto:')) {
    proto = value.slice(6) as Proto;
    applyProto();
    return;
  }
  proto = null;
  await settings.save({ ...(await settings.load()), theme: value as Settings['theme'] });
});
themeTabs.addEventListener('mouseover', (e) => {
  const value = tabValue(e.target);
  if (!value) return;
  document.documentElement.dataset.theme = value.startsWith('proto:') ? value.slice(6) : resolveTheme(value as Settings['theme']);
});
themeTabs.addEventListener('mouseleave', () => applyProto());
function applyProto(): void {
  applyTheme(currentTheme);
  if (proto) document.documentElement.dataset.theme = proto;
  const active = proto ? `proto:${proto}` : currentTheme;
  for (const tab of themeTabs.querySelectorAll<HTMLElement>('[data-theme-tab]')) tab.setAttribute('aria-pressed', String(tab.dataset.themeTab === active));
  const params = new URLSearchParams(location.search);
  if (proto) params.set('proto', proto);
  else params.delete('proto');
  history.replaceState(null, '', params.size ? `?${params}` : location.pathname);
}

function onSettings(s: Settings): void {
  currentTheme = s.theme;
  applyTheme(s.theme);
  const params = new URLSearchParams(location.search);
  if (s.theme === DEFAULT_SETTINGS.theme) params.delete('theme');
  else params.set('theme', s.theme);
  history.replaceState(null, '', params.size ? `?${params}` : location.pathname);
  applyProto();
}

const figures = shown.map((fixture, i) => {
  const slot = h('div', { class: 'slot' });
  let app = mountFixture(slot, fixture);
  const reset = h('button', { class: 'btn btn--ghost', type: 'button', title: 'Back to the starting state' }, 'Reset');
  reset.addEventListener('click', () => {
    app.destroy();
    app = mountFixture(slot, fixture);
  });
  return h('figure', null, h('figcaption', null, h('span', null, `${i + 1} · ${fixture.name}`), reset), slot);
});


/** Every logo in one place: the spinning 3D one at its sizes, and the static marks and app icons. */
function logoTile(label: string, art: Node): HTMLElement {
  return h('figure', { class: 'logo-tile' }, h('div', { class: 'logo-art' }, art), h('figcaption', null, label));
}
function staticLogo(svg: string): Node {
  // Our own generated SVG string (logoSvg), not user data.
  const t = document.createElement('template');
  t.innerHTML = svg;
  return t.content;
}
/** Speed of every spinning logo here: the buttons above them. */
let logoRate = 1;
const rate = () => logoRate;
const speeds = [0.1, 0.5, 1, 2, 10];
const speedBar = h('div', { class: 'theme-tabs logo-speed', role: 'group', 'aria-label': 'Spin speed' }, speeds.map((v) => h('button', { class: 'theme-tab', type: 'button', 'data-speed': String(v), 'aria-pressed': String(v === 1) }, `${v}×`)));
speedBar.addEventListener('click', (e) => {
  const b = (e.target as HTMLElement).closest<HTMLElement>('[data-speed]');
  if (!b) return;
  logoRate = Number(b.dataset.speed);
  for (const x of speedBar.querySelectorAll('[data-speed]')) x.setAttribute('aria-pressed', String(x === b));
});
/** Corner cut sizes to compare (share of an edge); the middle one is the default. */
const spinning = [0.05, 0.07, 0.09].map((chamfer) => {
  const stage = icosahedron(72, chamfer);
  attachSpin(stage, false, rate);
  return logoTile(`3D, corners cut ${Math.round(chamfer * 100)}%${chamfer === 0.07 ? ' (default)' : ''}`, stage);
});
const small = icosahedron(44);
attachSpin(small, false, rate);
spinning.push(logoTile('3D, radius 44', small));
const logosSection = h(
  'section',
  { class: 'gallery-logos' },
  h('h2', null, 'Logos'),
  speedBar,
  h('div', { class: 'logo-row' }, spinning),
  h(
    'div',
    { class: 'logo-row' },
    logoTile('Popup brand mark, 28px', staticLogo(logoSvg({ size: 28, spin: 100, pitch: -18, background: null, color: 'currentColor', weight: 2.4, dashes: 3, hiddenOpacity: 0.5 }))),
    logoTile('Toolbar badge preview, 18px', staticLogo(logoSvg({ size: 18, spin: 100, pitch: -18, background: null, color: 'currentColor', weight: 2.6, dashes: 2, hiddenOpacity: 0.5 }))),
    ...[128, 48, 32, 16].map((size) => logoTile(`App icon, ${size}px`, staticLogo(logoSvg({ size })))),
  ),
);

const resetSettings = h('button', { class: 'btn btn--ghost', type: 'button', title: 'Back to the default settings' }, 'Reset');
/** Pinning happens in Chrome's own menu; here a button stands in for it. */
let pinned = true;
const pinButton = h('button', { class: 'btn btn--ghost', type: 'button', title: 'Pretend to pin or unpin ATO in Chrome' });
const syncPin = () => (pinButton.textContent = pinned ? 'Simulate: unpin ATO' : 'Simulate: pin ATO');
syncPin();
resetSettings.addEventListener('click', () => void settings.save(startSettings));

document.body.replaceChildren(
  h(
    'header',
    { class: 'gallery-head' },
    h('h1', null, 'ATO 3 — design gallery'),
    h('p', null, 'Popups, the settings page and the logos, all live. Click, type, or focus a popup and use the keyboard; the gear in any popup jumps to the settings page. Drag the 3D logos to spin them.'),
  ),
  themeTabs,
  h('main', { class: 'gallery' }, figures),
  h(
    'section',
    { class: 'gallery-settings' },
    h('figure', null, h('figcaption', null, h('span', null, 'Settings page (options page, opened in a tab)'), h('span', null, pinButton, resetSettings)), settingsFrame),
  ),
  logosSection,
);

void mountSettings(settingsFrame, settings, { version: `${pkg.version}-dev`, onChange: onSettings }).then((page) => {
  page.setPinned(pinned);
  pinButton.addEventListener('click', () => {
    pinned = !pinned;
    page.setPinned(pinned);
    syncPin();
  });
});
