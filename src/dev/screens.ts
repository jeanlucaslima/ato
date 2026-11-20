import '../ui/tokens.css';
import '../ui/popup.css';
import '../ui/settings.css';
import './screens.css';
import { CHOICES, DEFAULT_SETTINGS, readSettings, type Settings } from '../core/settings';
import { mountApp, type App } from '../ui/app';
import { h } from '../ui/dom';
import { mountSettings } from '../ui/settings-page';
import { applyTheme, THEME_INFO } from '../ui/theme';
import { FakeBrowser } from './fake-browser';
import { FIXTURES, type Fixture } from './fixtures';
import { MemorySettings } from './memory-settings';
import { windowPrototypes } from './windows-prototype';

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

const themeButton = h('button', { class: 'btn', type: 'button' });
/** Cycles through every theme; the settings page's picker does the same. */
themeButton.addEventListener('click', async () => {
  const current = await settings.load();
  const themes = CHOICES.theme;
  await settings.save({ ...current, theme: themes[(themes.indexOf(current.theme) + 1) % themes.length]! });
});

function onSettings(s: Settings): void {
  applyTheme(s.theme);
  themeButton.textContent = `Theme: ${THEME_INFO[s.theme].name} →`;
  history.replaceState(null, '', s.theme === DEFAULT_SETTINGS.theme ? location.pathname : `?theme=${s.theme}`);
}

const figures = FIXTURES.map((fixture, i) => {
  const slot = h('div', { class: 'slot' });
  let app = mountFixture(slot, fixture);
  const reset = h('button', { class: 'btn btn--ghost', type: 'button', title: 'Back to the starting state' }, 'Reset');
  reset.addEventListener('click', () => {
    app.destroy();
    app = mountFixture(slot, fixture);
  });
  return h('figure', null, h('figcaption', null, h('span', null, `${i + 1} · ${fixture.name}`), reset), slot);
});

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
    h('h1', null, 'ATO 3 — popup screens'),
    themeButton,
    h('p', null, 'Every popup is live: click, type, or focus one and use the keyboard. The gear in any popup jumps to the settings page below.'),
  ),
  h('main', { class: 'gallery' }, figures),
  h(
    'section',
    { class: 'gallery-settings' },
    h('figure', null, h('figcaption', null, h('span', null, 'Settings page (options page, opened in a tab)'), h('span', null, pinButton, resetSettings)), settingsFrame),
  ),
  windowPrototypes(),
);

void mountSettings(settingsFrame, settings, { version: '3.0.0-dev', onChange: onSettings }).then((page) => {
  page.setPinned(pinned);
  pinButton.addEventListener('click', () => {
    pinned = !pinned;
    page.setPinned(pinned);
    syncPin();
  });
});
