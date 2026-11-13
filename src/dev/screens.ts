import '../ui/tokens.css';
import '../ui/popup.css';
import './screens.css';
import { h } from '../ui/dom';
import { renderPopup } from '../ui/popup';
import { FIXTURES } from './fixtures';

const root = document.documentElement;
const params = new URLSearchParams(location.search);
if (params.get('theme') === 'light') root.dataset.theme = 'light';

function render(): void {
  const light = root.dataset.theme === 'light';
  document.body.replaceChildren(
    h(
      'header',
      { class: 'gallery-head' },
      h('h1', null, 'ATO 3 — popup screens'),
      h(
        'button',
        {
          class: 'btn',
          type: 'button',
          onclick: () => {
            if (light) delete root.dataset.theme;
            else root.dataset.theme = 'light';
            history.replaceState(null, '', light ? location.pathname : '?theme=light');
            render();
          },
        },
        light ? 'Dark theme' : 'Light theme',
      ),
    ),
    h(
      'main',
      { class: 'gallery' },
      FIXTURES.map((f, i) => h('figure', null, h('figcaption', null, `${i + 1} · ${f.name}`), renderPopup(f.model))),
    ),
  );
}

render();
