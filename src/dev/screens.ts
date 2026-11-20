import '../ui/tokens.css';
import '../ui/popup.css';
import '../ui/settings.css';
import './screens.css';
import { DEFAULT_SETTINGS } from '../core/settings';
import { mountApp, type App } from '../ui/app';
import { h } from '../ui/dom';
import { mountSettings } from '../ui/settings-page';
import { applyTheme } from '../ui/theme';
import { FakeBrowser } from './fake-browser';
import { FIXTURES, type Fixture } from './fixtures';
import { MemorySettings } from './memory-settings';

const startLight = new URLSearchParams(location.search).get('theme') === 'light';
const startSettings = { ...DEFAULT_SETTINGS, theme: startLight ? 'light' : 'dark' } as const;
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
themeButton.addEventListener('click', async () => {
  const current = await settings.load();
  await settings.save({ ...current, theme: document.documentElement.dataset.theme === 'light' ? 'dark' : 'light' });
});

function onSettings(s: { theme: 'system' | 'dark' | 'light' }): void {
  applyTheme(s.theme);
  const light = document.documentElement.dataset.theme === 'light';
  themeButton.textContent = light ? 'Dark theme' : 'Light theme';
  history.replaceState(null, '', light ? '?theme=light' : location.pathname);
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
    h('figure', null, h('figcaption', null, h('span', null, 'Settings page (options page, opened in a tab)'), resetSettings), settingsFrame),
  ),
);

void mountSettings(settingsFrame, settings, { version: '3.0.0-dev', onChange: onSettings });
