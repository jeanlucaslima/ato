import '../ui/tokens.css';
import '../ui/popup.css';
import './screens.css';
import { mountApp, type App } from '../ui/app';
import { h } from '../ui/dom';
import { FakeBrowser } from './fake-browser';
import { FIXTURES, type Fixture } from './fixtures';

const root = document.documentElement;
if (new URLSearchParams(location.search).get('theme') === 'light') root.dataset.theme = 'light';

/** Each fixture is a live popup over its own in-memory browser. */
function mountFixture(slot: HTMLElement, fixture: Fixture): App {
  const browser = fixture.state.snapshot ? new FakeBrowser(fixture.state.snapshot) : null;
  return mountApp(slot, browser, fixture.state);
}

const themeButton = h('button', { class: 'btn', type: 'button' });
const syncThemeLabel = () => (themeButton.textContent = root.dataset.theme === 'light' ? 'Dark theme' : 'Light theme');
themeButton.addEventListener('click', () => {
  const light = root.dataset.theme !== 'light';
  if (light) root.dataset.theme = 'light';
  else delete root.dataset.theme;
  history.replaceState(null, '', light ? '?theme=light' : location.pathname);
  syncThemeLabel();
});
syncThemeLabel();

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

document.body.replaceChildren(
  h(
    'header',
    { class: 'gallery-head' },
    h('h1', null, 'ATO 3 — popup screens'),
    themeButton,
    h('p', null, 'Every popup is live: click, type, or focus one and use the keyboard.'),
  ),
  h('main', { class: 'gallery' }, figures),
);
